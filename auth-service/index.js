import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import mongoose from 'mongoose';
import twilio from 'twilio';
import jwt from 'jsonwebtoken';
import User from './models/user.js'; 
import { requireAuth } from './middleware/authMiddleware.js'; 

dotenv.config();
const app = express();
app.use(cors());
app.use(express.json());

// --- Configuration ---
const PORT = process.env.PORT || 5001;
const JWT_SECRET = process.env.JWT_SECRET || 'super_secret_fallback_key';
const DEV_MODE = false;

const twilioClient = DEV_MODE ? null : twilio(
  process.env.TWILIO_ACCOUNT_SID, 
  process.env.TWILIO_AUTH_TOKEN
);

mongoose.connect(process.env.MONGO_URI_AUTH || 'mongodb://localhost:27017/creatorsdesk_auth')
  .then(() => console.log('✅ Auth Service DB Connected'))
  .catch((err) => console.error('❌ Auth DB Connection Error:', err));

const otpStore = new Map();

// --- Routes ---

// 1. Generate & Send OTP (Prefix dropped)
app.post('/send-code', async (req, res) => {
  const { phone } = req.body;
  if (!phone) return res.status(400).json({ error: 'Phone number is required' });

  const otp = Math.floor(100000 + Math.random() * 900000).toString();
  otpStore.set(phone, { code: otp, expires: Date.now() + 5 * 60000 });

  if (DEV_MODE) {
    console.log(`\n🛠️  DEV MODE: Your OTP for ${phone} is: [ ${otp} ]\n`);
    return res.status(200).json({ message: 'OTP logged to terminal', step: 'verify' });
  }

  try {
    await twilioClient.messages.create({
      body: `Your Creator's Desk login code is: ${otp}`,
      from: process.env.TWILIO_PHONE_NUMBER,
      to: phone
    });
    res.status(200).json({ message: 'OTP sent via SMS', step: 'verify' });
  } catch (error) {
    console.error('Twilio Error:', error);
    res.status(500).json({ error: 'Failed to send SMS' });
  }
});

// 2. Verify OTP & Issue Token (Prefix dropped)
app.post('/verify-code', async (req, res) => {
  const { phone, code } = req.body;

  const record = otpStore.get(phone);
  
  if (!record || record.code !== code || Date.now() > record.expires) {
    return res.status(401).json({ error: 'Invalid or expired code' });
  }

  try {
    otpStore.delete(phone);

    let user = await User.findOne({ phone });
    if (!user) {
      user = await User.create({ phone });
      console.log(`New user created: ${phone}`);
    }

    const token = jwt.sign(
      { userId: user._id, role: user.role }, 
      JWT_SECRET, 
      { expiresIn: '7d' }
    );

    res.status(200).json({ 
      message: 'Login successful', 
      token,
      user: { id: user._id, phone: user.phone, role: user.role }
    });

  } catch (error) {
    console.error('Database Error:', error);
    res.status(500).json({ error: 'Internal server error during verification' });
  }
});

// --- User Profile Routes ---

// 3. Get Current User Profile (Prefix dropped)
app.get('/me', requireAuth, async (req, res) => {
  try {
    const user = await User.findById(req.user.userId).select('-__v'); 
    if (!user) return res.status(404).json({ error: 'User not found' });
    
    res.status(200).json(user);
  } catch (error) {
    res.status(500).json({ error: 'Server error fetching profile' });
  }
});

// 4. Update User Profile (Prefix dropped)
app.put('/me', requireAuth, async (req, res) => {
  try {
    const { name, email } = req.body;
    
    const updatedUser = await User.findByIdAndUpdate(
      req.user.userId,
      { name, email },
      { new: true, runValidators: true }
    ).select('-__v');

    res.status(200).json({ message: 'Profile updated', user: updatedUser });
  } catch (error) {
    res.status(500).json({ error: 'Failed to update profile' });
  }
});

// Health Check
app.get('/health', (req, res) => {
  res.status(200).json({
    service: 'auth-service',
    status: 'healthy',
    uptime: process.uptime(),
    timestamp: new Date().toISOString()
  });
});

app.listen(PORT, '0.0.0.0', () => console.log(`🔐 Auth Service running on port ${PORT}`));