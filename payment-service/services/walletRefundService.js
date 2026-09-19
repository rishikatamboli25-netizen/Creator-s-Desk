import Refund from '../models/Refund.js';
import WalletLedgerEntry from '../models/WalletLedgerEntry.js';

const FINAL_REFUND_STATUSES = new Set(['PROCESSED', 'FAILED', 'CANCELLED']);

const walletSource = (source) => {
  if (source === 'PRICE_PROTECTION') return 'PRICE_PROTECTION';
  if (source === 'SYSTEM') return 'SYSTEM';
  return 'ADMIN_MANUAL';
};

export const completeWalletRefund = async (refund) => {
  if (!refund) {
    const error = new Error('Refund not found.');
    error.status = 404;
    throw error;
  }

  if (FINAL_REFUND_STATUSES.has(refund.status)) {
    return { refund, ledger: null, idempotent: true };
  }

  if (refund.refundMethod !== 'WALLET_CREDIT') {
    const error = new Error('Wallet completion applies only to wallet-credit refunds.');
    error.status = 400;
    throw error;
  }

  const referenceId = refund.idempotencyKey;
  const now = new Date();

  let ledger = await WalletLedgerEntry.findOne({ referenceId });

  if (!ledger) {
    ledger = await WalletLedgerEntry.create({
      userId: refund.userId,
      orderId: refund.orderId,
      orderItemId: refund.orderItemId,
      type: 'CREDIT',
      amount: Number(refund.amount),
      currency: refund.currency || 'INR',
      status: 'POSTED',
      source: walletSource(refund.source),
      referenceId,
      description: refund.reasonNote || refund.reasonCode,
      postedAt: now,
    });
  } else if (ledger.status === 'POSTED') {
    // Already posted: safe to finalize the linked refund idempotently.
  } else if (ledger.status === 'PENDING') {
    ledger.status = 'POSTED';
    ledger.postedAt = ledger.postedAt || now;
    await ledger.save();
  } else {
    const error = new Error(`Wallet ledger entry is ${String(ledger.status).toLowerCase()} and cannot be reposted automatically.`);
    error.status = 409;
    error.refund = refund;
    throw error;
  }

  const updated = await Refund.findOneAndUpdate(
    {
      _id: refund._id,
      status: { $nin: ['PROCESSED', 'FAILED', 'CANCELLED'] },
    },
    {
      $set: {
        walletLedgerEntryId: ledger._id,
        status: 'PROCESSED',
        activeOrderRefundKey: null,
        processedAt: refund.processedAt || now,
        failureReason: null,
      },
    },
    { new: true }
  );

  if (!updated) {
    const current = await Refund.findById(refund._id);
    return {
      refund: current,
      ledger,
      idempotent: true,
    };
  }

  return {
    refund: updated,
    ledger,
    idempotent: false,
  };
};
