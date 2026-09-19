import 'dotenv/config';
import crypto from 'crypto';
import Refund from '../models/Refund.js';
import PayoutProfile from '../models/PayoutProfile.js';
import { getPayoutDetailsForRefund } from './payoutProfileService.js';

const RAZORPAYX_KEY_ID = process.env.RAZORPAYX_KEY_ID || '';
const RAZORPAYX_KEY_SECRET = process.env.RAZORPAYX_KEY_SECRET || '';
const RAZORPAYX_ACCOUNT_NUMBER = process.env.RAZORPAYX_ACCOUNT_NUMBER || '';
const RAZORPAYX_API_URL = (
  process.env.RAZORPAYX_API_URL || 'https://api.razorpay.com/v1'
).replace(/\/$/, '');
const RAZORPAYX_MODE = String(process.env.RAZORPAYX_MODE || 'test').trim().toLowerCase();
const RAZORPAYX_BANK_PAYOUT_MODE = String(
  process.env.RAZORPAYX_BANK_PAYOUT_MODE || 'IMPS'
).trim().toUpperCase();

const TEST_USABLE_PROFILE_STATUSES = ['PENDING_VERIFICATION', 'VERIFIED'];
const LIVE_USABLE_PROFILE_STATUSES = ['PENDING_VERIFICATION', 'VERIFIED'];
const FINAL_STATUS_SET = new Set(['PROCESSED', 'FAILED', 'CANCELLED']);

const basicAuth = () =>
  Buffer.from(`${RAZORPAYX_KEY_ID}:${RAZORPAYX_KEY_SECRET}`).toString('base64');

const ensureConfigured = () => {
  if (!RAZORPAYX_KEY_ID || !RAZORPAYX_KEY_SECRET || !RAZORPAYX_ACCOUNT_NUMBER) {
    const error = new Error(
      'RazorpayX payout integration is not configured. Set RAZORPAYX_KEY_ID, RAZORPAYX_KEY_SECRET and RAZORPAYX_ACCOUNT_NUMBER.'
    );
    error.status = 503;
    throw error;
  }
};

const getUsableProfileStatuses = () =>
  RAZORPAYX_MODE === 'live'
    ? LIVE_USABLE_PROFILE_STATUSES
    : TEST_USABLE_PROFILE_STATUSES;

const razorpayXFetch = async (path, options = {}) => {
  ensureConfigured();

  const response = await fetch(`${RAZORPAYX_API_URL}${path}`, {
    ...options,
    headers: {
      Accept: 'application/json',
      Authorization: `Basic ${basicAuth()}`,
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
      ...(options.headers || {}),
    },
  });

  const text = await response.text();
  let data = {};
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    data = { error: text || 'Invalid response from RazorpayX.' };
  }

  if (!response.ok) {
    const error = new Error(
      data?.error?.description ||
        data?.error?.reason ||
        data?.error_description ||
        `RazorpayX request failed (${response.status}).`
    );
    error.status = response.status;
    error.gateway = data;
    throw error;
  }

  return data;
};

const mapPayoutStatus = (gatewayStatus) => {
  const status = String(gatewayStatus || '').toLowerCase();
  if (status === 'processed') return 'PROCESSED';
  if (['failed', 'reversed', 'rejected'].includes(status)) return 'FAILED';
  if (status === 'cancelled') return 'CANCELLED';
  if (status === 'pending') return 'PENDING';
  return 'PROCESSING';
};

const payoutErrorMessage = (payout) =>
  payout?.failure_reason ||
  payout?.status_details?.description ||
  payout?.status_details?.reason ||
  payout?.error?.description ||
  null;

const sanitizePayoutResponse = (payout) => {
  if (!payout) return null;
  return {
    id: payout.id || null,
    entity: payout.entity || 'payout',
    amount: payout.amount ?? null,
    currency: payout.currency || null,
    status: payout.status || null,
    mode: payout.mode || null,
    purpose: payout.purpose || null,
    reference_id: payout.reference_id || null,
    narration: payout.narration || null,
    utr: payout.utr || null,
    status_details: payout.status_details || null,
    failure_reason: payout.failure_reason || null,
    created_at: payout.created_at || null,
    fees: payout.fees ?? null,
    tax: payout.tax ?? null,
  };
};

const payoutReferenceId = (refund) => `cd-${String(refund._id)}`.slice(0, 40);

const payoutAmountMatchesRefund = (refund, payout) => {
  const payoutPaise = Number(payout?.amount);
  if (!Number.isFinite(payoutPaise)) return true;
  return Math.round(payoutPaise) === Math.round(Number(refund.amount) * 100);
};

export const applyCodPayoutState = async ({ refund, payout, eventId = null }) => {
  if (!refund || !payout?.id) return refund;
  if (!payoutAmountMatchesRefund(refund, payout)) {
    const error = new Error('RazorpayX payout amount does not match the refund amount.');
    error.status = 409;
    throw error;
  }

  // Once a refund reaches a terminal state, a late/duplicate webhook must not
  // downgrade it back to PROCESSING/FAILED/CANCELLED.
  if (FINAL_STATUS_SET.has(refund.status)) return refund;

  const gatewayStatus = String(payout.status || '').toLowerCase();
  const internalStatus = mapPayoutStatus(gatewayStatus);

  refund.payoutId = payout.id;
  refund.payoutStatus = gatewayStatus || refund.payoutStatus || null;
  refund.payoutReference = payout.utr || payout.reference_id || refund.payoutReference || null;
  refund.payoutResponse = sanitizePayoutResponse(payout);
  if (eventId) refund.payoutEventId = eventId;

  if (internalStatus === 'PROCESSED') {
    refund.status = 'PROCESSED';
    refund.processedAt = refund.processedAt || new Date();
    refund.payoutProcessedAt = refund.payoutProcessedAt || new Date();
    refund.failureReason = null;
    refund.payoutFailureReason = null;
  } else if (internalStatus === 'FAILED') {
    refund.status = 'FAILED';
    refund.failureReason = payoutErrorMessage(payout) || 'RazorpayX reported that the COD payout failed or was reversed.';
    refund.payoutFailureReason = refund.failureReason;
  } else if (internalStatus === 'CANCELLED') {
    refund.status = 'CANCELLED';
    refund.failureReason = payoutErrorMessage(payout) || 'The COD payout was cancelled.';
    refund.payoutFailureReason = refund.failureReason;
  } else {
    refund.status = 'PROCESSING';
    refund.failureReason = null;
    refund.payoutFailureReason = null;
  }

  await refund.save();
  return refund;
};

const buildPayoutPayload = ({ refund, profile }) => {
  const customerName =
    String(refund.customerNameSnapshot || '').trim() ||
    String(profile.details?.accountHolderName || '').trim() ||
    'Creator Desk Customer';

  const referenceId = payoutReferenceId(refund);
  const contact = {
    name: customerName.slice(0, 50),
    type: 'customer',
    reference_id: `cd-user-${crypto.createHash('sha256').update(String(refund.userId)).digest('hex').slice(0, 24)}`,
  };

  const common = {
    account_number: RAZORPAYX_ACCOUNT_NUMBER,
    amount: Math.round(Number(refund.amount) * 100),
    currency: refund.currency || 'INR',
    purpose: 'refund',
    queue_if_low_balance: true,
    reference_id: referenceId,
    narration: `Refund ${String(refund._id).slice(-10)}`.slice(0, 30),
    notes: {
      refund_id: String(refund._id),
      order_id: String(refund.orderId || ''),
      source: String(refund.source || 'ADMIN_MANUAL'),
    },
  };

  if (profile.method === 'UPI') {
    return {
      ...common,
      mode: 'UPI',
      fund_account: {
        account_type: 'vpa',
        vpa: { address: profile.details.upiId },
        contact,
      },
    };
  }

  return {
    ...common,
    mode: RAZORPAYX_BANK_PAYOUT_MODE,
    fund_account: {
      account_type: 'bank_account',
      bank_account: {
        name: profile.details.accountHolderName,
        ifsc: profile.details.ifsc,
        account_number: profile.details.accountNumber,
      },
      contact,
    },
  };
};

const findPayoutByReference = async (refund) => {
  const query = new URLSearchParams({
    account_number: RAZORPAYX_ACCOUNT_NUMBER,
    reference_id: payoutReferenceId(refund),
    count: '10',
  });

  const data = await razorpayXFetch(`/payouts?${query.toString()}`);
  const items = Array.isArray(data?.items) ? data.items : [];
  return items.find((payout) => payout.reference_id === payoutReferenceId(refund)) || null;
};

const safeReconcileAfterUnknownCreate = async (refund) => {
  try {
    return await findPayoutByReference(refund);
  } catch (error) {
    console.error('[Payment] RazorpayX recovery lookup failed:', error.message);
    return null;
  }
};

export const processCodPayout = async (refundId) => {
  const refund = await Refund.findById(refundId).select('+payoutDetailsEncrypted +payoutDetailsIv +payoutDetailsAuthTag');

  if (!refund) {
    const error = new Error('Refund not found.');
    error.status = 404;
    throw error;
  }
  if (refund.refundMethod !== 'COD_PAYOUT') {
    const error = new Error('COD payout processing applies only to COD payout refunds.');
    error.status = 400;
    throw error;
  }
  if (refund.status === 'PROCESSED') return { refund, idempotent: true };
  if (['PROCESSING', 'PENDING'].includes(refund.status) && refund.payoutId) {
    return { refund, idempotent: true };
  }
  if (refund.status !== 'PAYOUT_DETAILS_SUBMITTED') {
    const error = new Error(
      `COD payout cannot be started while the refund is ${String(refund.status).toLowerCase().replace(/_/g, ' ')}.`
    );
    error.status = 409;
    error.refund = refund;
    throw error;
  }

  const claimed = await Refund.findOneAndUpdate(
    {
      _id: refund._id,
      status: 'PAYOUT_DETAILS_SUBMITTED',
      payoutId: null,
    },
    {
      $set: {
        status: 'PROCESSING',
        failureReason: null,
        payoutFailureReason: null,
      },
    },
    { new: true }
  ).select('+payoutDetailsEncrypted +payoutDetailsIv +payoutDetailsAuthTag');

  if (!claimed) {
    const current = await Refund.findById(refund._id);
    return { refund: current, idempotent: true };
  }

  try {
    const profile = await getPayoutDetailsForRefund({
      refund: claimed,
      allowedStatuses: getUsableProfileStatuses(),
    });

    if (!profile) {
      claimed.status = 'PAYOUT_DETAILS_SUBMITTED';
      claimed.failureReason = 'The payout destination attached to this refund is no longer available for processing in the current environment.';
      claimed.payoutFailureReason = claimed.failureReason;
      await claimed.save();

      const error = new Error(claimed.failureReason);
      error.status = 409;
      error.refund = claimed;
      throw error;
    }

    const gatewayPayout = await razorpayXFetch('/payouts', {
      method: 'POST',
      headers: {
        'X-Payout-Idempotency': claimed.idempotencyKey,
      },
      body: JSON.stringify(buildPayoutPayload({ refund: claimed, profile })),
    });

    if (!payoutAmountMatchesRefund(claimed, gatewayPayout)) {
      claimed.status = 'FAILED';
      claimed.failureReason = 'RazorpayX returned a payout with an amount different from the refund amount.';
      claimed.payoutFailureReason = claimed.failureReason;
      await claimed.save();
      const error = new Error(claimed.failureReason);
      error.status = 502;
      error.refund = claimed;
      throw error;
    }

    await PayoutProfile.updateOne(
      { _id: claimed.payoutProfileId, userId: String(claimed.userId) },
      { $set: { lastUsedAt: new Date() } }
    );

    await applyCodPayoutState({ refund: claimed, payout: gatewayPayout });

    return {
      refund: claimed,
      payout: sanitizePayoutResponse(gatewayPayout),
      idempotent: false,
    };
  } catch (error) {
    const current = await Refund.findById(claimed._id);
    if (!current) throw error;

    // A 409 can mean an idempotent duplicate already exists at the provider.
    // Reconcile before deciding what the refund state should be.
    if (error?.status === 409 || error?.status === 429 || error?.status >= 500) {
      const recovered = await safeReconcileAfterUnknownCreate(current);
      if (recovered) {
        await applyCodPayoutState({ refund: current, payout: recovered });
        error.refund = current;
        return {
          refund: current,
          payout: sanitizePayoutResponse(recovered),
          idempotent: true,
        };
      }
    }

    if (error?.status === 400 || error?.status === 422) {
      current.status = 'FAILED';
      current.failureReason = error.message;
      current.payoutFailureReason = error.message;
      current.payoutResponse = error.gateway ? sanitizePayoutResponse(error.gateway) : current.payoutResponse;
      await current.save();
      error.refund = current;
    } else if (error?.status === 401 || error?.status === 403) {
      current.status = 'PAYOUT_DETAILS_SUBMITTED';
      current.failureReason = 'RazorpayX payout authorization/configuration is not available. Fix the payout integration and retry.';
      current.payoutFailureReason = error.message;
      await current.save();
      error.refund = current;
    } else if (error?.status === 429) {
      current.status = 'PAYOUT_DETAILS_SUBMITTED';
      current.failureReason = 'RazorpayX rate-limited the payout request. Retry the payout after the provider limit clears.';
      current.payoutFailureReason = error.message;
      await current.save();
      error.refund = current;
    } else {
      // Network/5xx/unknown response: keep the payout active until reconciliation
      // establishes whether money was actually sent.
      current.status = 'PROCESSING';
      current.failureReason = 'RazorpayX response was not received. Reconcile the payout before attempting any retry.';
      current.payoutFailureReason = current.failureReason;
      await current.save();
      error.refund = current;
    }

    throw error;
  }
};

export const reconcileCodPayout = async (refundId) => {
  const refund = await Refund.findById(refundId).select('+payoutDetailsEncrypted +payoutDetailsIv +payoutDetailsAuthTag');
  if (!refund) {
    const error = new Error('Refund not found.');
    error.status = 404;
    throw error;
  }
  if (refund.refundMethod !== 'COD_PAYOUT') {
    const error = new Error('Payout reconciliation applies only to COD payout refunds.');
    error.status = 400;
    throw error;
  }
  if (FINAL_STATUS_SET.has(refund.status)) {
    return { refund, payout: null, message: 'Refund is already in a final state.' };
  }

  let payout = null;
  if (refund.payoutId) {
    payout = await razorpayXFetch(`/payouts/${encodeURIComponent(refund.payoutId)}`);
  } else {
    payout = await findPayoutByReference(refund);
  }

  if (!payout) {
    return {
      refund,
      payout: null,
      message: 'No RazorpayX payout is visible yet for this refund reference. The refund remains processing.',
    };
  }

  const updated = await applyCodPayoutState({ refund, payout });
  return {
    refund: updated,
    payout: sanitizePayoutResponse(payout),
    message:
      updated.status === 'PROCESSED'
        ? 'RazorpayX returned a processed payout response.'
        : updated.status === 'FAILED'
          ? 'RazorpayX returned a failed or reversed payout response.'
          : updated.status === 'CANCELLED'
            ? 'RazorpayX returned a cancelled payout response.'
            : 'No final RazorpayX payout response is available yet; the payout remains processing.',
  };
};
