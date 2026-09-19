import mongoose from 'mongoose';

const priceChangeSchema = new mongoose.Schema({
  productId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true, index: true },
  oldPrice: { type: Number, required: true, min: 0 },
  newPrice: { type: Number, required: true, min: 0 },
  reason: { type: String, required: true, enum: ['REGULAR_UPDATE', 'SALE', 'PROMOTION', 'CLEARANCE', 'FLASH_SALE', 'CORRECTION'] },
  changedByAdminId: { type: String, required: true },
  changedByEmail: { type: String, required: true },
  effectiveAt: { type: Date, required: true, default: Date.now },
}, { timestamps: true });

priceChangeSchema.index({ productId: 1, effectiveAt: -1 });

export default mongoose.model('PriceChange', priceChangeSchema);
