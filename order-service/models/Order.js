import mongoose from 'mongoose';

const orderSchema = new mongoose.Schema(
  {
    userId: {
      type: String,
      required: true,
    },

    items: [
      {
        productId: {
          type: String,
          required: true,
        },

        name: {
          type: String,
          required: true,
        },

        price: {
          type: Number,
          required: true,
        },

        quantity: {
          type: Number,
          default: 1,
        },
      },
    ],

    totalAmount: {
      type: Number,
      required: true,
    },

    paymentMethod: {
      type: String,
      enum: ['COD', 'ONLINE'],
      required: true,
    },

    paymentId: {
      type: String,
      default: null,
    },

    status: {
      type: String,
      enum: ['Processing', 'Shipped', 'Delivered', 'Cancelled'],
      default: 'Processing',
    },

    shippingAddress: {
      type: Object,
      required: true,
    },

    document: {
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
