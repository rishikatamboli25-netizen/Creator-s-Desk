import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { createProxyMiddleware } from 'http-proxy-middleware';

dotenv.config();
const app = express();

app.use(cors({
  origin: [
    'http://localhost:5173',
    'https://creator-s-desk.vercel.app'
  ],
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  credentials: true 
}));

const createProxyOptions = (targetUrl, pathPrefix, serviceName) => ({
  target: targetUrl,
  changeOrigin: true,
  secure: false, 
  pathRewrite: {
    [`^${pathPrefix}`]: '',
  },
  // Flattened handlers: Top-level keys only. Do not use an 'on' object.
  onProxyReq: (proxyReq, req, res) => {
    console.log(`[Gateway] Routing to ${serviceName}: ${req.method} ${req.originalUrl} -> ${proxyReq.path}`);
  },
  onError: (err, req, res) => {
    console.error(`[Gateway] Error routing to ${serviceName}:`, err.message);
    res.status(502).json({ error: `Failed to connect to ${serviceName} Service.` });
  }
});

const createAIProxyOptions = (targetUrl, serviceName) => ({
  target: targetUrl,
  changeOrigin: true,
  secure: false,

  // Only strip "/api"
  pathRewrite: (path) => path.replace(/^\/api/, ''),

  onProxyReq: (proxyReq, req) => {
    console.log(
      `[Gateway] Routing to ${serviceName}: ${req.originalUrl} -> ${proxyReq.path}`
    );
  },

  onError: (err, req, res) => {
    console.error(`[Gateway] ${serviceName}:`, err.message);
    res.status(502).json({ error: `Failed to connect to ${serviceName}` });
  }
});

app.use('/api/auth', createProxyMiddleware(createProxyOptions( process.env, 'http://localhost:5001', '/api/auth', 'Auth')));
app.use('/api/products', createProxyMiddleware(createProxyOptions('', '/api/products', 'Products')));
app.use('/api/orders', createProxyMiddleware(createProxyOptions('', '/api/orders', 'Orders')));
app.use('/api/payment', createProxyMiddleware(createProxyOptions(process.env.PAYMENT_SERVICE_URL || 'http://localhost:5004', '/api/payment', 'Payment')));
app.use('/api',createProxyMiddleware(createAIProxyOptions(process.env.AI_SERVICE_URL || 'http://localhost:5005','AI')));
app.get('/health', (req, res) => res.status(200).json({ status: 'API Gateway is online.' }));

const PORT = process.env.PORT || 5000;
app.listen(PORT, '0.0.0.0', () => console.log(`🔀 API Gateway running on port ${PORT}`));