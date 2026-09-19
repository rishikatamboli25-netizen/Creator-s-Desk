import 'dotenv/config';

import express from 'express';
import cors from 'cors';
import mongoose from 'mongoose';
import crypto from 'crypto';
import Order from './models/Order.js';
import { requireAuth } from './middleware/authMiddleware.js';
import { requireAdminInternalAuth } from './middleware/adminInternalAuth.js';
import {
  publishEvent,
  startInvoiceGeneratedConsumer,
  stopSqsConsumers,
} from './events/sqs.js';

const app = express();

app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 5003;
const DEFAULT_SHIPPING_CHARGE = 20;

function generateInvoiceNumber() {
  return crypto.randomInt(100000000000, 1000000000000).toString();
}

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
      customerName,
    } = req.body;

    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'Cart is empty' });
    }

    if (!paymentMethod || !['COD', 'ONLINE'].includes(paymentMethod)) {
      return res.status(400).json({ error: 'Invalid payment method' });
    }

    if (!customerName || !customerName.trim()) {
      return res.status(400).json({ error: 'Customer name is required' });
    }

    const newOrder = await Order.create({
      userId: req.user.userId,
      items,
      totalAmount,
      shippingAddress,
      paymentMethod,
      paymentId: paymentId || null,
      customerName: customerName.trim(),
      shippingCharge: DEFAULT_SHIPPING_CHARGE,
      'document.invoiceNumber': generateInvoiceNumber(),
    });

    // Publish only authoritative, persisted order data.
    try {
      await publishEvent('order.created', {
        orderId: newOrder._id.toString(),
        userId: newOrder.userId,
        items: newOrder.items,
        paymentMethod: newOrder.paymentMethod,
        paymentId: newOrder.paymentId,
        customerName: newOrder.customerName,
        shippingAddress: newOrder.shippingAddress,
        shippingCharge: newOrder.shippingCharge,
        totalAmount: newOrder.totalAmount,
        invoiceNumber: newOrder.document?.invoiceNumber,
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

/* -------------------------------------------------------------------------- */
/* Admin order access                                                         */
/* -------------------------------------------------------------------------- */

const buildAdminOrderFilter = (query = {}) => {
  const filter = {};
  const status = String(query.status || '').trim();
  const paymentMethod = String(query.paymentMethod || '').trim();
  const searchText = String(query.search || '').trim();

  if (status) filter.status = status;
  if (paymentMethod) filter.paymentMethod = paymentMethod;

  if (searchText) {
    const escaped = searchText.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(escaped, 'i');

    filter.$or = [
      { customerName: regex },
      { userId: regex },
      { paymentId: regex },
      { 'document.invoiceNumber': regex },
    ];

    if (mongoose.isValidObjectId(searchText)) {
      filter.$or.push({ _id: searchText });
    }
  }

  return filter;
};

app.get(
  '/admin/orders',
  requireAdminInternalAuth,
  async (req, res) => {
    try {
      const page = Math.max(1, Number(req.query.page || 1));
      const limit = Math.min(50, Math.max(1, Number(req.query.limit || 20)));
      const skip = (page - 1) * limit;
      const filter = buildAdminOrderFilter(req.query);

      const [orders, total] = await Promise.all([
        Order.find(filter)
          .sort({ createdAt: -1 })
          .skip(skip)
          .limit(limit),
        Order.countDocuments(filter),
      ]);

      return res.status(200).json({
        orders,
        pagination: {
          page,
          limit,
          total,
          pages: Math.max(1, Math.ceil(total / limit)),
        },
      });
    } catch (error) {
      console.error('Admin Order List Error:', error);
      return res.status(500).json({
        error: 'Failed to fetch admin orders',
      });
    }
  }
);

app.get(
  '/admin/orders/:orderId',
  requireAdminInternalAuth,
  async (req, res) => {
    try {
      if (!mongoose.isValidObjectId(req.params.orderId)) {
        return res.status(400).json({ error: 'Invalid order ID.' });
      }

      const order = await Order.findById(req.params.orderId);
      if (!order) {
        return res.status(404).json({ error: 'Order not found' });
      }

      return res.status(200).json({ order });
    } catch (error) {
      console.error('Admin Order Detail Error:', error);
      return res.status(500).json({ error: 'Failed to fetch order' });
    }
  }
);

app.patch(
  '/admin/orders/:orderId/status',
  requireAdminInternalAuth,
  async (req, res) => {
    try {
      const { status } = req.body || {};
      const allowedStatuses = [
        'Processing',
        'Shipped',
        'Delivered',
        'Cancelled',
      ];

      if (!allowedStatuses.includes(status)) {
        return res.status(400).json({ error: 'Invalid order status.' });
      }

      if (!mongoose.isValidObjectId(req.params.orderId)) {
        return res.status(400).json({ error: 'Invalid order ID.' });
      }

      const order = await Order.findById(req.params.orderId);
      if (!order) {
        return res.status(404).json({ error: 'Order not found' });
      }

      const previousStatus = order.status;

      if (previousStatus === status) {
        return res.status(200).json({
          message: 'Order status is already set to the requested value.',
          previousStatus,
          order,
        });
      }

      order.status = status;
      await order.save();

      return res.status(200).json({
        message: 'Order status updated successfully.',
        previousStatus,
        order,
      });
    } catch (error) {
      console.error('Admin Order Status Error:', error);
      return res.status(500).json({
        error: 'Failed to update order status',
      });
    }
  }
);

/* -------------------------------------------------------------------------- */
/* Admin invoice read model                                                  */
/* -------------------------------------------------------------------------- */

const escapeRegex = (value) =>
  String(value || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const parseInteger = (value, fallback, min, max) => {
  const parsed = Number.parseInt(value, 10);

  if (!Number.isFinite(parsed)) return fallback;

  return Math.min(max, Math.max(min, parsed));
};

const getInvoiceStatus = (order) => {
  const invoiceNumber =
    order.document?.invoiceNumber || null;
  const invoiceUrl = order.document?.url || null;

  if (invoiceUrl) return 'GENERATED';
  if (invoiceNumber) return 'PENDING';
  return 'NOT_GENERATED';
};

const toAdminInvoice = (order, { includeSourceUrl = false } = {}) => {
  const invoiceStatus = getInvoiceStatus(order);

  return {
    id: order._id.toString(),
    orderId: order._id.toString(),
    invoiceNumber:
      order.document?.invoiceNumber || null,
    invoiceStatus,
    customerName: order.customerName,
    userId: order.userId,
    itemCount: Array.isArray(order.items)
      ? order.items.reduce(
          (sum, item) =>
            sum + Number(item.quantity || 1),
          0
        )
      : 0,
    totalAmount: Number(order.totalAmount || 0),
    paymentMethod: order.paymentMethod,
    orderStatus: order.status,
    provider: order.document?.provider || null,
    generatedAt: order.document?.generatedAt || null,
    createdAt: order.createdAt,
    ...(includeSourceUrl
      ? {
          sourceUrl: order.document?.url || null,
        }
      : {}),
  };
};

const buildInvoiceSearch = (query) => {
  const search = String(query || '')
    .trim()
    .slice(0, 100);

  if (!search) return {};

  const regex = new RegExp(escapeRegex(search), 'i');
  const clauses = [
    { 'document.invoiceNumber': regex },
    { customerName: regex },
    { userId: regex },
    { paymentMethod: regex },
  ];

  if (mongoose.Types.ObjectId.isValid(search)) {
    clauses.push({
      _id: new mongoose.Types.ObjectId(search),
    });
  }

  return { $or: clauses };
};

const combineFilters = (...filters) => {
  const activeFilters = filters.filter(
    (filter) => Object.keys(filter).length > 0
  );

  if (activeFilters.length === 0) return {};
  if (activeFilters.length === 1) return activeFilters[0];

  return { $and: activeFilters };
};

const buildInvoiceStatusFilter = (status) => {
  switch (String(status || '').toUpperCase()) {
    case 'GENERATED':
      return {
        'document.url': {
          $exists: true,
          $nin: [null, ''],
        },
      };

    case 'PENDING':
      return {
        'document.invoiceNumber': {
          $exists: true,
          $nin: [null, ''],
        },
        $or: [
          { 'document.url': { $exists: false } },
          { 'document.url': null },
          { 'document.url': '' },
        ],
      };

    case 'NOT_GENERATED':
      return {
        $or: [
          { 'document.invoiceNumber': { $exists: false } },
          { 'document.invoiceNumber': null },
          { 'document.invoiceNumber': '' },
        ],
      };

    default:
      return {};
  }
};

const sortMap = {
  createdAt_desc: { createdAt: -1 },
  createdAt_asc: { createdAt: 1 },
  generatedAt_desc: { 'document.generatedAt': -1 },
  amount_desc: { totalAmount: -1 },
  amount_asc: { totalAmount: 1 },
  invoiceNumber_asc: {
    'document.invoiceNumber': 1,
  },
};

app.get(
  '/admin/invoices',
  requireAdminInternalAuth,
  async (req, res) => {
    try {
      const page = parseInteger(
        req.query.page,
        1,
        1,
        100000
      );

      const limit = parseInteger(
        req.query.limit,
        25,
        1,
        100
      );

      const skip = (page - 1) * limit;

      const searchFilter = buildInvoiceSearch(
        req.query.q
      );

      const statusFilter = buildInvoiceStatusFilter(
        req.query.status
      );

      const listFilter = combineFilters(
        searchFilter,
        statusFilter
      );

      const sort =
        sortMap[req.query.sort] ||
        sortMap.createdAt_desc;

      const [
        orders,
        total,
        generated,
        pending,
        notGenerated,
      ] = await Promise.all([
        Order.find(listFilter)
          .sort(sort)
          .skip(skip)
          .limit(limit)
          .lean(),

        Order.countDocuments(listFilter),

        Order.countDocuments(
          combineFilters(
            searchFilter,
            buildInvoiceStatusFilter('GENERATED')
          )
        ),

        Order.countDocuments(
          combineFilters(
            searchFilter,
            buildInvoiceStatusFilter('PENDING')
          )
        ),

        Order.countDocuments(
          combineFilters(
            searchFilter,
            buildInvoiceStatusFilter('NOT_GENERATED')
          )
        ),
      ]);

      return res.status(200).json({
        items: orders.map((order) =>
          toAdminInvoice(order)
        ),
        summary: {
          total,
          generated,
          pending,
          notGenerated,
        },
        pagination: {
          page,
          limit,
          total,
          totalPages:
            total === 0
              ? 0
              : Math.ceil(total / limit),
        },
      });
    } catch (error) {
      console.error(
        'Admin invoice list error:',
        error
      );

      return res.status(500).json({
        error: 'Failed to fetch admin invoice records.',
      });
    }
  }
);

app.get(
  '/admin/invoices/:orderId',
  requireAdminInternalAuth,
  async (req, res) => {
    try {
      if (
        !mongoose.Types.ObjectId.isValid(
          req.params.orderId
        )
      ) {
        return res.status(400).json({
          error: 'Invalid order ID.',
        });
      }

      const order = await Order.findById(
        req.params.orderId
      ).lean();

      if (!order) {
        return res.status(404).json({
          error: 'Order not found.',
        });
      }

      return res.status(200).json({
        invoice: toAdminInvoice(order, {
          includeSourceUrl: true,
        }),
      });
    } catch (error) {
      console.error(
        'Admin invoice detail error:',
        error
      );

      return res.status(500).json({
        error: 'Failed to fetch admin invoice.',
      });
    }
  }
);

// GET ONE LOGGED-IN USER'S ORDER
app.get('/:orderId', requireAuth, async (req, res) => {
  try {
    const order = await Order.findOne({
      _id: req.params.orderId,
      userId: req.user.userId,
    });

    if (!order) {
      return res.status(404).json({ error: 'Order not found' });
    }

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
