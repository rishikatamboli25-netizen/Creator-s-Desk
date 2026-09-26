import mongoose from 'mongoose';

const orderItemSchema = new mongoose.Schema(
  {
    productId: {
      type: String,
      required: true,
    },
    sku: {
      type: String,
      default: null,
    },
    name: {
      type: String,
      required: true,
    },
    price: {
      type: Number,
      required: true,
      min: 0,
    },
    quantity: {
      type: Number,
      default: 1,
      min: 1,
    },
  },
  { _id: false }
);

const orderSchema = new mongoose.Schema(
  {
    userId: {
      type: String,
      required: true,
    },

    checkoutId: {
      type: String,
      unique: true,
      sparse: true,
      index: true,
    },

    inventoryReservationId: {
      type: String,
      default: null,
      index: true,
    },

    inventoryStatus: {
      type: String,
      enum: ['RESERVED', 'COMMITTED', 'RELEASED', 'COMMIT_PENDING'],
      default: 'RESERVED',
      index: true,
    },

    items: {
      type: [orderItemSchema],
      required: true,
      validate: {
        validator: (items) => Array.isArray(items) && items.length > 0,
        message: 'An order must contain at least one item.',
      },
    },

    totalAmount: {
      type: Number,
      required: true,
      min: 0,
    },

    paymentMethod: {
      type: String,
      enum: ['COD', 'ONLINE'],
      required: true,
    },

    paymentId: {
      type: String,
      default: null,
      index: true,
    },

    customerName: {
      type: String,
      required: true,
      trim: true,
    },

    shippingCharge: {
      type: Number,
      required: true,
      default: 20,
      min: 0,
    },

    status: {
      type: String,
      enum: ['Pending Payment', 'Processing', 'Shipped', 'Delivered', 'Cancelled'],
      default: 'Processing',
    },

    shippingAddress: {
      type: Object,
      required: true,
    },

    document: {
      invoiceNumber: {
        type: String,
        unique: true,
        sparse: true,
        default: null,
      },
      url: {
        type: String,
        default: null,
      },
      provider: {
        type: String,
        default: null,
      },
      publicId: {
        type: String,
        default: null,
      },
      generatedAt: {
        type: Date,
        default: null,
      },
    },
  },
  { timestamps: true }
);

export default mongoose.model('Order', orderSchema);
