import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { createProxyMiddleware } from 'http-proxy-middleware';

dotenv.config();

const app = express();

app.use(express.json());

app.use(
  cors({
    origin: [
      'http://localhost:5173',
      'https://creator-s-desk.vercel.app',
    ],
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    credentials: true,
  })
);

const createProxyOptions = (targetUrl, pathPrefix) => ({
  target: targetUrl,
  changeOrigin: true,
  secure: false,
  pathRewrite: {
    [`^${pathPrefix}`]: '',
  },
  onError: (err, req, res) => {
    console.error(
      `[Gateway] Proxy error for ${req.method} ${req.originalUrl}:`,
      err.message
    );

    if (!res.headersSent) {
      res.status(502).json({
        error: 'Failed to connect to requested service.',
      });
    }
  },
});

const createAIProxyOptions = (targetUrl) => ({
  target: targetUrl,
  changeOrigin: true,
  secure: false,
  pathRewrite: (path) => path.replace(/^\/api/, ''),
  onError: (err, req, res) => {
    console.error(
      `[Gateway] AI proxy error for ${req.method} ${req.originalUrl}:`,
      err.message
    );

    if (!res.headersSent) {
      res.status(502).json({
        error: 'Failed to connect to AI Service.',
      });
    }
  },
});

app.use(
  '/api/auth',
  createProxyMiddleware(
    createProxyOptions(
      process.env.AUTH_SERVICE_URL || 'http://localhost:5001',
      '/api/auth'
    )
  )
);

app.use(
  '/api/products',
  createProxyMiddleware(
    createProxyOptions(
      process.env.PRODUCT_SERVICE_URL || 'http://localhost:5002',
      '/api/products'
    )
  )
);

app.use(
  '/api/orders',
  createProxyMiddleware(
    createProxyOptions(
      process.env.ORDER_SERVICE_URL || 'http://localhost:5003',
      '/api/orders'
    )
  )
);

app.use(
  '/api/payment',
  createProxyMiddleware(
    createProxyOptions(
      process.env.PAYMENT_SERVICE_URL || 'http://localhost:5004',
      '/api/payment'
    )
  )
);

// Invoice route must stay before the generic /api AI proxy.
app.use(
  '/api/invoices',
  createProxyMiddleware(
    createProxyOptions(
      process.env.INVOICE_SERVICE_URL || 'http://localhost:5006',
      '/api/invoices'
    )
  )
);

app.use(
  '/api',
  createProxyMiddleware(
    createAIProxyOptions(
      process.env.AI_SERVICE_URL || 'http://localhost:5005'
    )
  )
);

app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'API Gateway is online.',
  });
});

const PORT = process.env.PORT || 5000;

app.listen(PORT, '0.0.0.0', () => {
  console.log(`🔀 API Gateway running on port ${PORT}`);
});