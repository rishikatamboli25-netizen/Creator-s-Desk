import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import Razorpay from 'razorpay';
import crypto from 'crypto';

dotenv.config();

dotenv.config();

console.log("KEY_ID =", process.env.RAZORPAY_KEY_ID);
console.log("KEY_SECRET =", process.env.RAZORPAY_KEY_SECRET);
console.log(process.env);

const app = express();
app.use(cors());
app.use(express.json());

const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID, 
  key_secret: process.env.RAZORPAY_KEY_SECRET,
});

// Health check
app.get('/health', (req, res) => {
  res.status(200).json({ service: 'Payment Service', status: 'Healthy' });
});

// ROUTE CHANGED: Gateway strips '/api/payment', so we just listen for '/create-order'
app.post('/create-order', async (req, res) => {
  try {
    const { amount } = req.body; 

    const options = {
      amount: Math.round(amount * 100), // Convert to paise
      currency: 'INR',
      receipt: `receipt_${Date.now()}`,
    };

    const order = await razorpay.orders.create(options);
    if (!order) return res.status(500).send('Error creating order');
    
    res.json(order);
  } catch (error) {
    console.error('Order creation error:', error);
    res.status(500).json({ error: error.message });
  }
});

// ROUTE CHANGED: Gateway strips '/api/payment', so we just listen for '/verify'
app.post('/verify', async (req, res) => {
  try {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;

    const sign = razorpay_order_id + '|' + razorpay_payment_id;
    const expectedSign = crypto
      .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
      .update(sign)
      .digest('hex');

    if (razorpay_signature === expectedSign) {
      // Payment verified! Emit an 'order.completed' event here later
      return res.status(200).json({ message: 'Payment verified successfully', paymentId: razorpay_payment_id });
    } else {
      return res.status(400).json({ message: 'Invalid signature' });
    }
  } catch (error) {
    console.error('Verification error:', error);
    res.status(500).json({ message: 'Internal Server Error' });
  }
});

// PORT CORRECTED TO 5004
const PORT = process.env.PORT || 5004;
app.listen(PORT, () => {
  console.log(`💳 Payment Service running on port ${PORT}`);
});