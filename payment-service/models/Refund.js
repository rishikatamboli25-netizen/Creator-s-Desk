import mongoose from 'mongoose';

const refundSchema = new mongoose.Schema({
  orderId: { type: String, required: true, index: true },
  orderItemId: { type: String, default: null, index: true },
  userId: { type: String, required: true, index: true },
  paymentId: { type: String, default: null, index: true },
  idempotencyKey: { type: String, required: true, unique: true, index: true },
  source: {
    type: String,
    enum: ['ADMIN_MANUAL', 'PRICE_PROTECTION', 'SYSTEM', 'CUSTOMER_REQUEST'],
    default: 'ADMIN_MANUAL',
    index: true,
  },
  refundMethod: {
    type: String,
    enum: ['ORIGINAL_PAYMENT', 'COD_PAYOUT', 'WALLET_CREDIT'],
    required: true,
    index: true,
  },
  reasonCode: {
    type: String,
    enum: [
      'CUSTOMER_REQUESTED',
      'ORDER_CANCELLED',
      'DAMAGED_ITEM',
      'WRONG_ITEM',
      'DELIVERY_ISSUE',
      'DUPLICATE_PAYMENT',
      'PRICE_ADJUSTMENT',
      'GOODWILL',
      'OTHER',
    ],
    required: true,
    index: true,
  },
  reasonNote: { type: String, default: '', maxlength: 250 },
  amount: { type: Number, required: true, min: 0.01 },
  currency: { type: String, default: 'INR', uppercase: true },
  status: {
    type: String,
    enum: [
      'REQUESTED',
      'AWAITING_CUSTOMER_DETAILS',
      'PAYOUT_DETAILS_SUBMITTED',
      'PROCESSING',
      'PENDING',
      'PROCESSED',
      'FAILED',
      'CANCELLED',
    ],
    default: 'REQUESTED',
    index: true,
  },

  // Set only while a refund is active. A partial unique index prevents two
  // unresolved refund requests for the same order from existing concurrently.
  activeOrderRefundKey: { type: String, default: null },

  gatewayRefundId: { type: String, default: null, index: true },
  gatewayStatus: { type: String, default: null },
  gatewayReference: { type: String, default: null },

  payoutProfileId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'PayoutProfile',
    default: null,
    index: true,
  },
  payoutProfileVersion: { type: Number, default: null },
  payoutMethodSnapshot: {
    type: String,
    enum: ['UPI', 'BANK_ACCOUNT', null],
    default: null,
  },

  // Encrypted immutable snapshot of the destination that this refund will use.
  // These are never returned by customer/admin list APIs.
  payoutDetailsEncrypted: { type: String, default: null, select: false },
  payoutDetailsIv: { type: String, default: null, select: false },
  payoutDetailsAuthTag: { type: String, default: null, select: false },

  payoutId: { type: String, default: null },
  payoutStatus: { type: String, default: null },
  payoutReference: { type: String, default: null },
  payoutEventId: { type: String, default: null },
  payoutProcessedAt: { type: Date, default: null },
  payoutFailureReason: { type: String, default: null },
  payoutResponse: { type: mongoose.Schema.Types.Mixed, default: null },

  walletLedgerEntryId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'WalletLedgerEntry',
    default: null,
    index: true,
  },

  requestedByAdminId: { type: String, default: null, index: true },
  requestedByAdminEmail: { type: String, default: null },
  customerNameSnapshot: { type: String, default: null },

  gatewayEventId: { type: String, default: null },
  processedAt: { type: Date, default: null },
  failureReason: { type: String, default: null },
  gatewayResponse: { type: mongoose.Schema.Types.Mixed, default: null },
}, { timestamps: true });

refundSchema.index(
  { activeOrderRefundKey: 1 },
  {
    unique: true,
    partialFilterExpression: { activeOrderRefundKey: { $type: 'string' } },
    name: 'uniq_active_order_refund_present',
  }
);
refundSchema.index({ orderId: 1, createdAt: -1 });
refundSchema.index({ paymentId: 1, createdAt: -1 });
refundSchema.index({ paymentId: 1, status: 1 });
refundSchema.index({ payoutId: 1 }, { sparse: true, name: 'payout_id_lookup' });

// These values are explicitly stored as null until a real provider value exists.
// Partial indexes exclude nulls while still enforcing uniqueness when an actual
// provider/event identifier is present. New names let syncIndexes replace the
// older sparse/null-sensitive indexes cleanly.
refundSchema.index(
  { payoutEventId: 1 },
  {
    unique: true,
    partialFilterExpression: { payoutEventId: { $type: 'string' } },
    name: 'uniq_payout_event_present',
  }
);

refundSchema.index(
  { gatewayEventId: 1 },
  {
    unique: true,
    partialFilterExpression: { gatewayEventId: { $type: 'string' } },
    name: 'uniq_gateway_event_present',
  }
);

const FINAL_REFUND_STATUSES = new Set([
  'PROCESSED',
  'FAILED',
  'CANCELLED',
]);

// Mongoose 9 pre middleware is promise/synchronous-hook based; it no longer
// receives the legacy next() callback.
refundSchema.pre('save', function syncActiveOrderRefundKey() {
  if (this.isNew || this.isModified('status') || this.isModified('orderId')) {
    if (FINAL_REFUND_STATUSES.has(this.status)) {
      this.activeOrderRefundKey = null;
    } else if (this.orderId) {
      this.activeOrderRefundKey = String(this.orderId);
    }
  }
});

export default mongoose.model('Refund', refundSchema);
