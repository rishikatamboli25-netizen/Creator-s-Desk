import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import {
  createProxyMiddleware,
  fixRequestBody,
} from 'http-proxy-middleware';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

const SERVICE_URLS = {
  auth: process.env.AUTH_SERVICE_URL || 'http://localhost:5001',
  products: process.env.PRODUCT_SERVICE_URL || 'http://localhost:5002',
  orders: process.env.ORDER_SERVICE_URL || 'http://localhost:5003',
  payment: process.env.PAYMENT_SERVICE_URL || 'http://localhost:5004',
  invoice: process.env.INVOICE_SERVICE_URL || 'http://localhost:5006',
  ai: process.env.AI_SERVICE_URL || 'http://localhost:5005',
  admin: process.env.ADMIN_BACKEND_URL || 'http://localhost:5010',
};

app.use(
  cors({
    origin: [
      'http://localhost:5173',
      'https://creator-s-desk.vercel.app',
      ...(process.env.ADMIN_FRONTEND_URL
        ? [process.env.ADMIN_FRONTEND_URL]
        : ['http://localhost:5174']),
    ],
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    credentials: true,
  })
);

// Admin proxy BEFORE express.json so the admin service can receive the request
// body without relying on a consumed request stream at the gateway layer.
app.use(
  '/api/admin',
  createProxyMiddleware({
    target: SERVICE_URLS.admin,
    changeOrigin: true,
    secure: false,
    proxyTimeout: 30_000,
    timeout: 30_000,
    xfwd: true,
    on: {
      error: (err, req, res) => {
        console.error('[Gateway] CD_ADMIN proxy error:', err.message);
        if (!res.headersSent) {
          res.status(502).json({
            error: 'Failed to connect to CD_ADMIN Service.',
          });
        }
      },
    },
  })
);

app.use(express.json({ limit: '1mb' }));

const createProxyOptions = (targetUrl, serviceName) => ({
  target: targetUrl,
  changeOrigin: true,
  secure: false,
  on: {
    proxyReq: fixRequestBody,
    error: (err, req, res) => {
      console.error(`[Gateway] ${serviceName} proxy error:`, err.message);
      if (!res.headersSent) {
        res.status(502).json({
          error: `Failed to connect to ${serviceName} Service.`,
        });
      }
    },
  },
  proxyTimeout: 30_000,
  timeout: 30_000,
  xfwd: true,
});

const createAIProxyOptions = (targetUrl) => ({
  target: targetUrl,
  changeOrigin: true,
  secure: false,
  on: {
    proxyReq: fixRequestBody,
    error: (err, req, res) => {
      console.error('[Gateway] AI proxy error:', err.message);
      if (!res.headersSent) {
        res.status(502).json({
          error: 'Failed to connect to AI Service.',
        });
      }
    },
  },
  proxyTimeout: 30_000,
  timeout: 30_000,
  xfwd: true,
});

app.use('/api/auth', createProxyMiddleware(createProxyOptions(SERVICE_URLS.auth, 'Auth')));
app.use('/api/products', createProxyMiddleware(createProxyOptions(SERVICE_URLS.products, 'Products')));
app.use('/api/orders', createProxyMiddleware(createProxyOptions(SERVICE_URLS.orders, 'Orders')));
app.use('/api/payment', createProxyMiddleware(createProxyOptions(SERVICE_URLS.payment, 'Payment')));
app.use('/api/invoices', createProxyMiddleware(createProxyOptions(SERVICE_URLS.invoice, 'Invoice')));
app.use('/api', createProxyMiddleware(createAIProxyOptions(SERVICE_URLS.ai)));

app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'API Gateway is online and routing traffic.',
  });
});

app.use((req, res) => {
  res.status(404).json({
    error: 'Gateway route not found.',
  });
});

app.listen(PORT, () => {
  console.log(`🔀 API Gateway running on port ${PORT}`);
});
