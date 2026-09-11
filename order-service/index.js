import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import mongoose from 'mongoose';
import Order from './models/Order.js';
import { requireAuth } from './middleware/authMiddleware.js';
import {
  publishEvent,
  startInvoiceGeneratedConsumer,
  stopSqsConsumers,
} from './events/sqs.js';

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
  .catch((err) => console.error('❌ Order DB Connection Error:', err));

// CREATE A NEW ORDER
app.post('/', requireAuth, async (req, res) => {
  try {
    const {
      items,
      totalAmount,
      shippingAddress,
      paymentMethod,
      paymentId,
    } = req.body;

    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'Cart is empty' });
    }

    if (!paymentMethod || !['COD', 'ONLINE'].includes(paymentMethod)) {
      return res.status(400).json({ error: 'Invalid payment method' });
    }

    const newOrder = await Order.create({
      userId: req.user.userId,
      items,
      totalAmount,
      shippingAddress,
      paymentMethod,
      paymentId: paymentId || null,
    });

    // Publish only authoritative, persisted order data.
    try {
      await publishEvent('order.created', {
        orderId: newOrder._id.toString(),
        userId: newOrder.userId,
        items: newOrder.items,
        totalAmount: newOrder.totalAmount,
        paymentMethod: newOrder.paymentMethod,
        paymentId: newOrder.paymentId,
        shippingAddress: newOrder.shippingAddress,
        createdAt: newOrder.createdAt,
      });
    } catch (eventError) {
      console.error('⚠️ Failed to publish order.created:', eventError);
    }

    res.status(201).json({
      message: 'Order placed successfully!',
      orderId: newOrder._id,
      status: newOrder.status,
      document: newOrder.document,
    });
  } catch (error) {
    console.error('Checkout Error:', error);

    res.status(500).json({
      error: 'Failed to process order',
    });
  }
});

// GET LOGGED-IN USER'S ORDER HISTORY
app.get('/me', requireAuth, async (req, res) => {
  try {
    const orders = await Order.find({
      userId: req.user.userId,
    }).sort({
      createdAt: -1,
    });

    res.status(200).json(orders);
  } catch (error) {
    console.error('Order History Error:', error);

    res.status(500).json({
      error: 'Failed to fetch order history',
    });
  }
});

// GET ONE LOGGED-IN USER'S ORDER
app.get('/:orderId', requireAuth, async (req, res) => {
  try {
    console.log('🔎 Fetch order request:', {
      orderId: req.params.orderId,
      userId: req.user.userId,
    });

    const order = await Order.findOne({
      _id: req.params.orderId,
      userId: req.user.userId,
    });

    if (!order) {
      console.log('❌ Order not found:', {
        orderId: req.params.orderId,
        userId: req.user.userId,
      });

      return res.status(404).json({ error: 'Order not found' });
    }

    console.log('✅ Order found:', order._id.toString());

    res.status(200).json(order);
  } catch (error) {
    console.error('Order Fetch Error:', error);

    res.status(500).json({
      error: 'Failed to fetch order',
    });
  }
});

// HEALTH CHECK
app.get('/health', (req, res) => {
  res.status(200).json({
    service: 'order-service',
    status: 'healthy',
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
  });
});

async function startServer() {
  startInvoiceGeneratedConsumer().catch((error) => {
    console.error('⚠️ SQS consumer unavailable:', error.message);
  });

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`🛒 Order Service running on port ${PORT}`);
  });
}

async function shutdown() {
  stopSqsConsumers();

  try {
    await mongoose.connection.close();
  } catch (error) {
    console.error('⚠️ MongoDB shutdown error:', error.message);
  }

  process.exit(0);
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

startServer();
