import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { createProxyMiddleware } from 'http-proxy-middleware';

dotenv.config();

const app = express();

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

const createProxyOptions = (targetUrl, pathPrefix, serviceName) => ({
  target: targetUrl,
  changeOrigin: true,
  secure: false,
  pathRewrite: {
    [`^${pathPrefix}`]: '',
  },
  onProxyReq: (proxyReq, req) => {
    console.log(
      `[Gateway] Routing to ${serviceName}: ${req.method} ${req.originalUrl} -> ${proxyReq.path}`
    );
  },
  onError: (err, req, res) => {
    console.error(`[Gateway] Error routing to ${serviceName}:`, err.message);
    res.status(502).json({ error: `Failed to connect to ${serviceName} Service.` });
  },
});

const createAIProxyOptions = (targetUrl, serviceName) => ({
  target: targetUrl,
  changeOrigin: true,
  secure: false,
  pathRewrite: (path) => path.replace(/^\/api/, ''),
  onProxyReq: (proxyReq, req) => {
    console.log(
      `[Gateway] Routing to ${serviceName}: ${req.originalUrl} -> ${proxyReq.path}`
    );
  },
  onError: (err, req, res) => {
    console.error(`[Gateway] ${serviceName}:`, err.message);
    res.status(502).json({ error: `Failed to connect to ${serviceName}` });
  },
});

app.use(
  '/api/auth',
  createProxyMiddleware(
    createProxyOptions(process.env.AUTH_SERVICE_URL, '/api/auth', 'Auth')
  )
);

app.use(
  '/api/products',
  createProxyMiddleware(
    createProxyOptions(process.env.PRODUCT_SERVICE_URL, '/api/products', 'Products')
  )
);

app.use((req, res, next) => {
  console.log(
    `[Gateway Request] ${req.method} ${req.originalUrl}`
  );
  next();
});

app.use(
  '/api/orders',
  createProxyMiddleware(
    createProxyOptions(process.env.ORDER_SERVICE_URL, '/api/orders', 'Orders')
  )
);

app.use(
  '/api/payment',
  createProxyMiddleware(
    createProxyOptions(
      process.env.PAYMENT_SERVICE_URL || 'http://localhost:5004',
      '/api/payment',
      'Payment'
    )
  )
);

// Invoice route must be registered before the generic /api AI proxy.
app.use(
  '/api/invoices',
  createProxyMiddleware(
    createProxyOptions(
      process.env.INVOICE_SERVICE_URL || 'http://localhost:5006',
      '/api/invoices',
      'Invoices'
    )
  )
);

app.use(
  '/api',
  createProxyMiddleware(
    createAIProxyOptions(
      process.env.AI_SERVICE_URL || 'http://localhost:5005',
      'AI'
    )
  )
);

app.get('/health', (req, res) =>
  res.status(200).json({ status: 'API Gateway is online.' })
);

const PORT = process.env.PORT || 5000;

app.listen(PORT, '0.0.0.0', () =>
  console.log(`🔀 API Gateway running on port ${PORT}`)
);
