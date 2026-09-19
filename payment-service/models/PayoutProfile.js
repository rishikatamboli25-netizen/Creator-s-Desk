import mongoose from 'mongoose';

const payoutProfileSchema = new mongoose.Schema({
  userId: { type: String, required: true, unique: true, index: true },
  status: {
    type: String,
    enum: ['INCOMPLETE', 'PENDING_VERIFICATION', 'VERIFIED', 'SUSPENDED'],
    default: 'INCOMPLETE',
    index: true,
  },
  method: { type: String, enum: ['UPI', 'BANK_ACCOUNT'], default: null },
  // Incremented every time the customer saves/changes payout details. A refund
  // stores this version and its own encrypted snapshot to freeze its destination.
  version: { type: Number, default: 1, min: 1 },
  encryptedDetails: { type: String, default: null, select: false },
  iv: { type: String, default: null, select: false },
  authTag: { type: String, default: null, select: false },
  maskedDisplay: { type: String, default: null },
  verifiedAt: { type: Date, default: null },
  lastUsedAt: { type: Date, default: null },
}, { timestamps: true });

export default mongoose.model('PayoutProfile', payoutProfileSchema);
