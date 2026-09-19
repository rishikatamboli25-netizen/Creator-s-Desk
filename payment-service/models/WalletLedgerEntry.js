import mongoose from 'mongoose';

const walletLedgerEntrySchema = new mongoose.Schema({
  userId: { type: String, required: true, index: true },
  orderId: { type: String, default: null, index: true },
  orderItemId: { type: String, default: null },
  type: { type: String, enum: ['CREDIT', 'DEBIT'], required: true },
  amount: { type: Number, required: true, min: 0.01 },
  currency: { type: String, default: 'INR', uppercase: true },
  status: { type: String, enum: ['PENDING', 'POSTED', 'REVERSED', 'FAILED'], default: 'PENDING', index: true },
  source: { type: String, enum: ['REFUND', 'PRICE_PROTECTION', 'ADMIN_MANUAL', 'SYSTEM'], default: 'REFUND', index: true },
  referenceId: { type: String, required: true, unique: true, index: true },
  description: { type: String, default: '', maxlength: 500 },
  postedAt: { type: Date, default: null },
}, { timestamps: true });

walletLedgerEntrySchema.index({ userId: 1, createdAt: -1 });

export default mongoose.model('WalletLedgerEntry', walletLedgerEntrySchema);
