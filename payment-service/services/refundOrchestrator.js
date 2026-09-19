import 'dotenv/config';
import crypto from 'crypto';
import Refund from '../models/Refund.js';
import { completeWalletRefund } from './walletRefundService.js';
import {
  createPayoutSnapshot,
  findReusablePayoutProfile,
  getPayoutDetailsForRefund,
} from './payoutProfileService.js';

const ACTIVE_REFUND_STATUSES = [
  'REQUESTED',
  'AWAITING_CUSTOMER_DETAILS',
  'PAYOUT_DETAILS_SUBMITTED',
  'PROCESSING',
  'PENDING',
];
const RELEASED_REFUND_STATUSES = ['FAILED', 'CANCELLED'];
const FINAL_REFUND_STATUSES = ['PROCESSED', 'FAILED', 'CANCELLED'];

const VALID_REASONS = new Set([
  'CUSTOMER_REQUESTED',
  'ORDER_CANCELLED',
  'DAMAGED_ITEM',
  'WRONG_ITEM',
  'DELIVERY_ISSUE',
  'DUPLICATE_PAYMENT',
  'PRICE_ADJUSTMENT',
  'GOODWILL',
  'OTHER',
]);

const roundPaise = (value) => Math.round(Number(value) * 100);
const fromPaise = (value) => value / 100;

const fail = (message, status = 400, extra = {}) => {
  const error = new Error(message);
  error.status = status;
  Object.assign(error, extra);
  return error;
};

const makeFallbackIdempotencyKey = ({
  orderId,
  orderItemId,
  paymentId,
  amount,
  reasonCode,
  reasonNote,
  refundMethod,
  source,
}) => crypto
  .createHash('sha256')
  .update([
    source || 'ADMIN_MANUAL',
    refundMethod,
    orderId || '',
    orderItemId || '',
    paymentId || '',
    Number(amount).toFixed(2),
    String(reasonCode).trim().toUpperCase(),
    String(reasonNote || '').trim(),
  ].join('|'))
  .digest('hex');

const getRefundExposurePaise = async (orderId) => {
  const result = await Refund.aggregate([
    {
      $match: {
        orderId: String(orderId),
        status: { $nin: RELEASED_REFUND_STATUSES },
      },
    },
    {
      $group: {
        _id: null,
        amount: { $sum: '$amount' },
      },
    },
  ]);

  return result.length ? roundPaise(result[0].amount) : 0;
};

const assertRefundAmountAvailable = async ({ orderId, orderTotal, amount }) => {
  const totalPaise = roundPaise(orderTotal);

  if (!Number.isFinite(totalPaise) || totalPaise <= 0) {
    throw fail('Authoritative order total is required to create a refund.');
  }

  const exposurePaise = await getRefundExposurePaise(orderId);
  const requestedPaise = roundPaise(amount);
  const remainingPaise = totalPaise - exposurePaise;

  if (requestedPaise > remainingPaise) {
    throw fail(
      `Refund exceeds the remaining refundable amount of ${fromPaise(Math.max(remainingPaise, 0)).toFixed(2)}.`,
      409,
      {
        remainingRefundableAmount: Math.max(remainingPaise, 0) / 100,
        orderTotal: totalPaise / 100,
        existingRefundExposure: exposurePaise / 100,
      }
    );
  }

  return {
    orderTotal: totalPaise / 100,
    existingRefundExposure: exposurePaise / 100,
    remainingRefundableAmount: Math.max(remainingPaise - requestedPaise, 0) / 100,
  };
};

const findActiveRefundForOrder = async (orderId) => Refund.findOne({
  orderId: String(orderId),
  status: { $in: ACTIVE_REFUND_STATUSES },
}).sort({ createdAt: -1 });

const getReusablePayoutSnapshot = async (userId, explicitPayoutProfileId = null) => {
  let profile = null;

  if (explicitPayoutProfileId) {
    const candidates = await findReusablePayoutProfile({ userId });
    if (candidates && String(candidates._id) === String(explicitPayoutProfileId)) {
      profile = candidates;
    } else {
      throw fail('The selected payout profile does not belong to this customer.', 403);
    }
  } else {
    profile = await findReusablePayoutProfile({ userId });
  }

  return profile ? createPayoutSnapshot({ profile }) : null;
};

export const createRefundRequest = async ({
  orderId,
  orderItemId = null,
  userId,
  paymentId = null,
  paymentMethod,
  refundMethod,
  amount,
  orderTotal,
  reasonCode,
  reasonNote = '',
  source = 'ADMIN_MANUAL',
  adminUserId = null,
  adminEmail = null,
  idempotencyKey = null,
  payoutProfileId = null,
  customerName = null,
}) => {
  if (!orderId) throw fail('Order ID is required for a refund request.');
  if (!userId) throw fail('Customer user ID is required for a refund request.');

  const numericAmount = Number(amount);
  if (!Number.isFinite(numericAmount) || numericAmount <= 0) {
    throw fail('Refund amount must be greater than zero.');
  }
  const amountPaise = roundPaise(numericAmount);
  if (Math.abs(numericAmount * 100 - amountPaise) > 1e-9) {
    throw fail('Refund amount can have at most two decimal places.');
  }

  const cleanReasonCode = String(reasonCode || '').trim().toUpperCase();
  if (!VALID_REASONS.has(cleanReasonCode)) {
    throw fail('A valid refund reason is required.');
  }

  const cleanReasonNote = String(reasonNote || '').trim().slice(0, 250);

  if (!['ONLINE', 'COD'].includes(paymentMethod)) {
    throw fail('Unsupported payment method for refund.');
  }
  if (paymentMethod === 'ONLINE' && refundMethod !== 'ORIGINAL_PAYMENT') {
    throw fail('Online payments must be refunded to the original payment method.');
  }
  if (
    paymentMethod === 'COD' &&
    !['COD_PAYOUT', 'WALLET_CREDIT'].includes(refundMethod)
  ) {
    throw fail('COD refunds must use customer payout details or wallet credit.');
  }

  const finalKey = idempotencyKey || makeFallbackIdempotencyKey({
    orderId,
    orderItemId,
    paymentId,
    amount: numericAmount,
    reasonCode: cleanReasonCode,
    reasonNote: cleanReasonNote,
    refundMethod,
    source,
  });

  // Idempotency must be checked before active-balance guards so an exact retry
  // returns the existing refund rather than being mistaken for a new request.
  const existing = await Refund.findOne({ idempotencyKey: finalKey });
  if (existing) {
    if (existing.refundMethod === 'WALLET_CREDIT' && existing.status === 'PENDING') {
      const walletResult = await completeWalletRefund(existing);
      return {
        ...walletResult,
        idempotent: true,
        nextAction: 'NONE',
      };
    }
    return { refund: existing, idempotent: true, nextAction: 'NONE' };
  }

  await assertRefundAmountAvailable({
    orderId,
    orderTotal,
    amount: numericAmount,
  });

  const activeRefund = await findActiveRefundForOrder(orderId);
  if (activeRefund) {
    throw fail(
      `A refund for this order is already ${activeRefund.status.toLowerCase().replace(/_/g, ' ')}. Wait for the current refund to reach a final processed, failed, or cancelled state.`,
      409,
      { refund: activeRefund }
    );
  }

  let payoutSnapshot = null;
  let initialStatus = 'REQUESTED';
  let nextAction = null;

  if (refundMethod === 'COD_PAYOUT') {
    payoutSnapshot = await getReusablePayoutSnapshot(userId, payoutProfileId);
    initialStatus = payoutSnapshot
      ? 'PAYOUT_DETAILS_SUBMITTED'
      : 'AWAITING_CUSTOMER_DETAILS';
    nextAction = payoutSnapshot
      ? 'PAYOUT_READY_FOR_PROCESSING'
      : 'CUSTOMER_MUST_SUBMIT_PAYOUT_DETAILS';
  }

  const refund = await Refund.create({
    orderId: String(orderId),
    orderItemId: orderItemId || null,
    userId: String(userId),
    paymentId: paymentId || null,
    idempotencyKey: finalKey,
    source,
    refundMethod,
    reasonCode: cleanReasonCode,
    reasonNote: cleanReasonNote,
    amount: numericAmount,
    status: initialStatus,
    payoutProfileId: payoutSnapshot?.payoutProfileId || null,
    payoutProfileVersion: payoutSnapshot?.payoutProfileVersion || null,
    payoutMethodSnapshot: payoutSnapshot?.payoutMethodSnapshot || null,
    payoutDetailsEncrypted: payoutSnapshot?.payoutDetailsEncrypted || null,
    payoutDetailsIv: payoutSnapshot?.payoutDetailsIv || null,
    payoutDetailsAuthTag: payoutSnapshot?.payoutDetailsAuthTag || null,
    requestedByAdminId: adminUserId || null,
    requestedByAdminEmail: adminEmail || null,
    customerNameSnapshot: customerName ? String(customerName).trim().slice(0, 150) : null,
  });

  if (refundMethod === 'WALLET_CREDIT') {
    const walletResult = await completeWalletRefund(refund);
    return {
      ...walletResult,
      idempotent: false,
      nextAction: 'NONE',
    };
  }

  return { refund, idempotent: false, nextAction };
};

export const attachPayoutProfileToRefund = async ({ refundId, payoutProfileId }) => {
  const refund = await Refund.findById(refundId);
  if (!refund) throw fail('Refund not found.', 404);
  if (refund.refundMethod !== 'COD_PAYOUT') {
    throw fail('Payout profiles can only be attached to COD payout refunds.');
  }
  if (FINAL_REFUND_STATUSES.includes(refund.status)) {
    throw fail('A final refund cannot have its payout destination changed.', 409, { refund });
  }

  const profile = await findReusablePayoutProfile({ userId: refund.userId });
  if (!profile || String(profile._id) !== String(payoutProfileId)) {
    throw fail('A usable payout profile belonging to this customer is required.', 403);
  }

  const snapshot = createPayoutSnapshot({ profile });

  const updated = await Refund.findOneAndUpdate(
    {
      _id: refund._id,
      status: { $in: ['AWAITING_CUSTOMER_DETAILS', 'PAYOUT_DETAILS_SUBMITTED'] },
    },
    {
      $set: {
        ...snapshot,
        activeOrderRefundKey: String(refund.orderId),
        status: 'PAYOUT_DETAILS_SUBMITTED',
        failureReason: null,
        payoutFailureReason: null,
      },
    },
    { new: true }
  );

  if (!updated) {
    const current = await Refund.findById(refund._id);
    throw fail('Refund state changed while attaching payout details.', 409, { refund: current });
  }

  return updated;
};

export { ACTIVE_REFUND_STATUSES, RELEASED_REFUND_STATUSES, FINAL_REFUND_STATUSES };
