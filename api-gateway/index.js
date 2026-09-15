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
  auth:
    process.env.AUTH_SERVICE_URL ||
    'http://localhost:5001',

  products:
    process.env.PRODUCT_SERVICE_URL ||
    'http://localhost:5002',

  orders:
    process.env.ORDER_SERVICE_URL ||
    'http://localhost:5003',

  payment:
    process.env.PAYMENT_SERVICE_URL ||
    'http://localhost:5004',

  invoice:
    process.env.INVOICE_SERVICE_URL ||
    'http://localhost:5006',

  ai:
    process.env.AI_SERVICE_URL ||
    'http://localhost:5005',
};

/* -------------------------------------------------------------------------- */
/* Middleware                                                                 */
/* -------------------------------------------------------------------------- */

app.use(
  cors({
    origin: [
      'http://localhost:5173',
      'https://creator-s-desk.vercel.app',
    ],
    methods: [
      'GET',
      'POST',
      'PUT',
      'DELETE',
      'OPTIONS',
    ],
    credentials: true,
  })
);

app.use(
  express.json({
    limit: '1mb',
  })
);

/* -------------------------------------------------------------------------- */
/* Proxy configuration                                                        */
/* -------------------------------------------------------------------------- */

const createProxyOptions = (
  targetUrl,
  serviceName
) => ({
  target: targetUrl,
  changeOrigin: true,
  secure: false,

  // Allows the proxy to safely forward JSON bodies
  // after express.json() has already consumed the request stream.
  on: {
    proxyReq: fixRequestBody,

    error: (err, req, res) => {
      console.error(
        `[Gateway] ${serviceName} proxy error:`,
        err.message
      );

      if (!res.headersSent) {
        res.status(502).json({
          error: `Failed to connect to ${serviceName} Service.`,
        });
      }
    },
  },

  // Prevent indefinitely hanging upstream requests.
  proxyTimeout: 30_000,
  timeout: 30_000,

  // Forward standard proxy headers.
  xfwd: true,
});

const createAIProxyOptions = (
  targetUrl
) => ({
  target: targetUrl,
  changeOrigin: true,
  secure: false,

  on: {
    proxyReq: fixRequestBody,

    error: (err, req, res) => {
      console.error(
        '[Gateway] AI proxy error:',
        err.message
      );

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

/* -------------------------------------------------------------------------- */
/* Service routes                                                             */
/* -------------------------------------------------------------------------- */

/*
 * Express removes the mounted prefix before handing the request
 * to the middleware.
 *
 * Example:
 *
 * /api/auth/send-code
 *        ↓
 * /send-code
 *        ↓
 * Auth Service
 *
 * Therefore no pathRewrite is required here.
 */

app.use(
  '/api/auth',
  createProxyMiddleware(
    createProxyOptions(
      SERVICE_URLS.auth,
      'Auth'
    )
  )
);

app.use(
  '/api/products',
  createProxyMiddleware(
    createProxyOptions(
      SERVICE_URLS.products,
      'Products'
    )
  )
);

app.use(
  '/api/orders',
  createProxyMiddleware(
    createProxyOptions(
      SERVICE_URLS.orders,
      'Orders'
    )
  )
);

app.use(
  '/api/payment',
  createProxyMiddleware(
    createProxyOptions(
      SERVICE_URLS.payment,
      'Payment'
    )
  )
);

/*
 * Keep invoices before the generic /api route.
 */
app.use(
  '/api/invoices',
  createProxyMiddleware(
    createProxyOptions(
      SERVICE_URLS.invoice,
      'Invoice'
    )
  )
);

/*
 * Everything else under /api goes to AI Service.
 */
app.use(
  '/api',
  createProxyMiddleware(
    createAIProxyOptions(
      SERVICE_URLS.ai
    )
  )
);

/* -------------------------------------------------------------------------- */
/* Health check                                                               */
/* -------------------------------------------------------------------------- */

app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'API Gateway is online.',
  });
});

/* -------------------------------------------------------------------------- */
/* Fallback                                                                   */
/* -------------------------------------------------------------------------- */

app.use((req, res) => {
  res.status(404).json({
    error: 'Gateway route not found.',
  });
});

/* -------------------------------------------------------------------------- */
/* Server                                                                     */
/* -------------------------------------------------------------------------- */

app.listen(PORT, '0.0.0.0', () => {
  console.log(
    `🔀 API Gateway running on port ${PORT}`
  );
});