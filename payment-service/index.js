import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import mongoose from 'mongoose';

dotenv.config();

const app = express();

app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 5004;

// --------------------------------------------------
// DATABASE CONNECTION
// --------------------------------------------------

mongoose
  .connect(
    process.env.MONGO_URI_PAYMENT ||
      'mongodb://localhost:27017/creatorsdesk_payments'
  )
  .then(() => console.log('✅ Payment Service DB Connected'))
  .catch((err) =>
    console.error('❌ Payment DB Connection Error:', err)
  );

// --------------------------------------------------
// HEALTH CHECK
// --------------------------------------------------

app.get('/health', (req, res) => {
  res.status(200).json({
    service: 'payment-service',
    status: 'healthy',
    uptime: process.uptime(),
    timestamp: new Date().toISOString()
  });
});

// --------------------------------------------------
// START SERVER
// --------------------------------------------------

app.listen(PORT, '0.0.0.0', () => {
  console.log(`💳 Payment Service running on port ${PORT}`);
});