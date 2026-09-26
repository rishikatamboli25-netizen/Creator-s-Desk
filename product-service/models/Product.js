import mongoose from 'mongoose';

const productSchema = new mongoose.Schema(
  {
    sku: {
      type: String,
      trim: true,
      uppercase: true,
      unique: true,
      sparse: true,
      index: true,
    },
    name: { type: String, required: true, trim: true },
    slug: { type: String, required: true, unique: true, trim: true },
    price: { type: Number, required: true, min: 0 },
    category: { type: String, required: true, trim: true },
    image: { type: String, required: true, trim: true },
    description: { type: String, required: true, trim: true },
    features: [{ type: String, trim: true }],

    // Available units after reservations have been deducted.
    quantity: { type: Number, required: true, min: 0, default: 0 },

    // Manual availability override. This never overrides zero quantity.
    manualOutOfStock: { type: Boolean, default: false },

    // Kept for compatibility with the existing consumer frontend.
    // Effective value: quantity > 0 && !manualOutOfStock.
    inStock: { type: Boolean, default: false },
  },
  { timestamps: true }
);

productSchema.index({ category: 1, createdAt: -1 });
productSchema.index({ quantity: 1 });

productSchema.pre('save', function syncEffectiveStock() {
  if (this.isNew || this.isModified('quantity') || this.isModified('manualOutOfStock')) {
    this.inStock = Number(this.quantity || 0) > 0 && !this.manualOutOfStock;
  }
});

export default mongoose.model('Product', productSchema);
