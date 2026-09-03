import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import mongoose from 'mongoose';
import Order from './models/Order.js';
import { requireAuth } from './middleware/authMiddleware.js';

dotenv.config();

const app = express();

app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 5003;

mongoose
  .connect(
    process.env.MONGO_URI_ORDERS ||
      'mongodb://localhost:27017/creatorsdesk_orders'
  )
  .then(() => console.log('✅ Order Service DB Connected'))
  .catch((err) =>
    console.error('❌ Order DB Connection Error:', err)
  );

// --------------------------------------------------
// CREATE A NEW ORDER
// --------------------------------------------------

app.post('/', requireAuth, async (req, res) => {
  try {
    const {
      items,
      totalAmount,
      shippingAddress,
      paymentMethod
    } = req.body;

    // Check cart
    if (!items || items.length === 0) {
      return res.status(400).json({
        error: 'Cart is empty'
      });
    }

    // Validate payment method
    if (!paymentMethod || !['COD', 'ONLINE'].includes(paymentMethod)) {
      return res.status(400).json({
        error: 'Invalid payment method'
      });
    }

    const newOrder = await Order.create({
      userId: req.user.userId,
      items,
      totalAmount,
      shippingAddress,
      paymentMethod
    });

    res.status(201).json({
      message: 'Order placed successfully!',
      orderId: newOrder._id
    });

  } catch (error) {
    console.error('Checkout Error:', error);

    res.status(500).json({
      error: 'Failed to process order'
    });
  }
});

// --------------------------------------------------
// GET LOGGED-IN USER'S ORDER HISTORY
// --------------------------------------------------

app.get('/me', requireAuth, async (req, res) => {
  try {
    const orders = await Order.find({
      userId: req.user.userId
    }).sort({
      createdAt: -1
    });

    res.status(200).json(orders);

  } catch (error) {
    console.error('Order History Error:', error);

    res.status(500).json({
      error: 'Failed to fetch order history'
    });
  }
});

// --------------------------------------------------
// HEALTH CHECK
// --------------------------------------------------

app.get('/health', (req, res) => {
  res.status(200).json({
    service: 'order-service',
    status: 'healthy',
    uptime: process.uptime(),
    timestamp: new Date().toISOString()
  });
});

// --------------------------------------------------
// START SERVER
// --------------------------------------------------

app.listen(PORT, '0.0.0.0', () => {
  console.log(`🛒 Order Service running on port ${PORT}`);
});