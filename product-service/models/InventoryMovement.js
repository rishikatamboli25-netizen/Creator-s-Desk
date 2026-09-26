import mongoose from 'mongoose';

const inventoryMovementSchema = new mongoose.Schema(
  {
    productId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true, index: true },
    reservationId: { type: mongoose.Schema.Types.ObjectId, ref: 'InventoryReservation', default: null, index: true },
    orderId: { type: String, default: null, index: true },
    movementType: {
      type: String,
      enum: [
        'PRODUCT_CREATED',
        'STOCK_ADJUSTMENT',
        'RESERVED',
        'RESERVATION_COMMITTED',
        'RESERVATION_RELEASED',
        'MANUAL_OUT_OF_STOCK',
        'MANUAL_AVAILABLE',
      ],
      required: true,
      index: true,
    },
    quantityDelta: { type: Number, required: true },
    beforeQuantity: { type: Number, required: true, min: 0 },
    afterQuantity: { type: Number, required: true, min: 0 },
    reason: { type: String, default: '', maxlength: 500 },
    source: { type: String, enum: ['ADMIN', 'ORDER', 'SYSTEM'], required: true },
    actorAdminId: { type: String, default: null },
    actorAdminEmail: { type: String, default: null },
    requestId: { type: String, default: null, index: true },
  },
  { timestamps: true }
);

inventoryMovementSchema.index({ productId: 1, createdAt: -1 });

export default mongoose.model('InventoryMovement', inventoryMovementSchema);
