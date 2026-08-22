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

app.use('/api/auth', createProxyMiddleware(createProxyOptions('https://creator-s-desk-auth-service.onrender.com', '/api/auth', 'Auth')));
app.use('/api/products', createProxyMiddleware(createProxyOptions('https://creator-s-desk-product-service.onrender.com', '/api/products', 'Products')));
app.use('/api/orders', createProxyMiddleware(createProxyOptions('https://creator-s-desk-order-service.onrender.com', '/api/orders', 'Orders')));

app.get('/health', (req, res) => res.status(200).json({ status: 'API Gateway is online.' }));

const PORT = process.env.PORT || 5000;
app.listen(PORT, '0.0.0.0', () => console.log(`🔀 API Gateway running on port ${PORT}`));