import mongoose from 'mongoose';

const reservationItemSchema = new mongoose.Schema(
  {
    productId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
    sku: { type: String, default: '' },
    name: { type: String, required: true },
    unitPrice: { type: Number, required: true, min: 0 },
    quantity: { type: Number, required: true, min: 1 },
    applied: { type: Boolean, default: false },
  },
  { _id: false }
);

const reservationSchema = new mongoose.Schema(
  {
    idempotencyKey: { type: String, required: true, unique: true, index: true },
    userId: { type: String, required: true, index: true },
    checkoutId: { type: String, default: null, index: true },
    orderId: { type: String, default: null, index: true },
    status: {
      type: String,
      enum: ['ACTIVE', 'COMMITTED', 'RELEASED', 'EXPIRED'],
      default: 'ACTIVE',
      index: true,
    },
    items: { type: [reservationItemSchema], required: true },
    subtotal: { type: Number, required: true, min: 0 },
    expiresAt: { type: Date, required: true, index: true },
    committedAt: { type: Date, default: null },
    releasedAt: { type: Date, default: null },
    releaseReason: { type: String, default: '' },
  },
  { timestamps: true }
);

reservationSchema.index({ status: 1, expiresAt: 1 });
reservationSchema.index({ userId: 1, createdAt: -1 });

export default mongoose.model('InventoryReservation', reservationSchema);
