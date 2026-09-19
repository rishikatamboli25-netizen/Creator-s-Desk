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
const ADMIN_INTERNAL_SECRET = process.env.ADMIN_INTERNAL_SECRET || '';

const twilioClient = DEV_MODE
  ? null
  : twilio(
      process.env.TWILIO_ACCOUNT_SID,
      process.env.TWILIO_AUTH_TOKEN
    );

mongoose
  .connect(
    process.env.MONGO_URI_AUTH ||
      'mongodb://localhost:27017/creatorsdesk_auth'
  )
  .then(() => console.log('✅ Auth Service DB Connected'))
  .catch((err) =>
    console.error('❌ Auth DB Connection Error:', err)
  );

const otpStore = new Map();

const requireAdminInternalSecret = (req, res, next) => {
  if (!ADMIN_INTERNAL_SECRET) {
    return res.status(503).json({
      error: 'Admin internal access is not configured.',
    });
  }

  if (
    req.headers['x-admin-internal-secret'] !==
    ADMIN_INTERNAL_SECRET
  ) {
    return res.status(401).json({
      error: 'Unauthorized internal request.',
    });
  }

  next();
};

// --- Routes ---

// 1. Generate & Send OTP
app.post('/send-code', async (req, res) => {
  const { phone } = req.body;

  if (!phone) {
    return res.status(400).json({
      error: 'Phone number is required',
    });
  }

  const otp = Math.floor(
    100000 + Math.random() * 900000
  ).toString();

  otpStore.set(phone, {
    code: otp,
    expires: Date.now() + 5 * 60000,
  });

  if (DEV_MODE) {
    console.log(
      `\n🛠️  DEV MODE: Your OTP for ${phone} is: [ ${otp} ]\n`
    );

    return res.status(200).json({
      message: 'OTP logged to terminal',
      step: 'verify',
    });
  }

  try {
    await twilioClient.messages.create({
      body: `Your Creator's Desk login code is: ${otp}`,
      from: process.env.TWILIO_PHONE_NUMBER,
      to: phone,
    });

    res.status(200).json({
      message: 'OTP sent via SMS',
      step: 'verify',
    });
  } catch (error) {
    console.error('Twilio Error:', error);

    res.status(500).json({
      error: 'Failed to send SMS',
    });
  }
});

// 2. Verify OTP & Issue Token
app.post('/verify-code', async (req, res) => {
  const { phone, code } = req.body;

  const record = otpStore.get(phone);

  if (
    !record ||
    record.code !== code ||
    Date.now() > record.expires
  ) {
    return res.status(401).json({
      error: 'Invalid or expired code',
    });
  }

  try {
    otpStore.delete(phone);

    let user = await User.findOne({ phone });

    if (!user) {
      user = await User.create({ phone });
      console.log(`New user created: ${phone}`);
    }

    const token = jwt.sign(
      {
        userId: user._id,
        role: user.role,
      },
      JWT_SECRET,
      {
        expiresIn: '7d',
      }
    );

    res.status(200).json({
      message: 'Login successful',
      token,
      user: {
        id: user._id,
        phone: user.phone,
        role: user.role,
      },
    });
  } catch (error) {
    console.error('Database Error:', error);

    res.status(500).json({
      error: 'Internal server error during verification',
    });
  }
});

// --- User Profile Routes ---

// 3. Get Current User Profile
app.get('/me', requireAuth, async (req, res) => {
  try {
    const user = await User.findById(
      req.user.userId
    ).select('-__v');

    if (!user) {
      return res.status(404).json({
        error: 'User not found',
      });
    }

    res.status(200).json(user);
  } catch (error) {
    res.status(500).json({
      error: 'Server error fetching profile',
    });
  }
});

// 4. Update User Profile
app.put('/me', requireAuth, async (req, res) => {
  try {
    const { name, email } = req.body;

    const updatedUser = await User.findByIdAndUpdate(
      req.user.userId,
      { name, email },
      {
        new: true,
        runValidators: true,
      }
    ).select('-__v');

    res.status(200).json({
      message: 'Profile updated',
      user: updatedUser,
    });
  } catch (error) {
    res.status(500).json({
      error: 'Failed to update profile',
    });
  }
});

// --- Admin Customer Adapter ---

app.get(
  '/admin/customers',
  requireAdminInternalSecret,
  async (req, res) => {
    try {
      const page = Math.max(
        1,
        Number(req.query.page || 1)
      );

      const limit = Math.min(
        50,
        Math.max(1, Number(req.query.limit || 20))
      );

      const search = String(
        req.query.search || ''
      ).trim();

      const query = {};

      if (search) {
        const escapedSearch = search.replace(
          /[.*+?^${}()|[\]\\]/g,
          '\\$&'
        );

        const pattern = new RegExp(
          escapedSearch,
          'i'
        );

        query.$or = [
          { name: pattern },
          { email: pattern },
          { phone: pattern },
        ];
      }

      const skip = (page - 1) * limit;

      const [customers, total] =
        await Promise.all([
          User.find(query)
            .select(
              '_id phone name email role createdAt updatedAt'
            )
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit)
            .lean(),

          User.countDocuments(query),
        ]);

      return res.status(200).json({
        customers,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.max(
            1,
            Math.ceil(total / limit)
          ),
        },
      });
    } catch (error) {
      console.error(
        '[Auth] Admin customer list error:',
        error.message
      );

      return res.status(500).json({
        error: 'Unable to fetch customer directory.',
      });
    }
  }
);

app.get(
  '/admin/customers/:customerId',
  requireAdminInternalSecret,
  async (req, res) => {
    try {
      const customer = await User.findById(
        req.params.customerId
      )
        .select(
          '_id phone name email role createdAt updatedAt'
        )
        .lean();

      if (!customer) {
        return res.status(404).json({
          error: 'Customer not found.',
        });
      }

      return res.status(200).json({
        customer,
      });
    } catch (error) {
      console.error(
        '[Auth] Admin customer detail error:',
        error.message
      );

      return res.status(500).json({
        error: 'Unable to fetch customer.',
      });
    }
  }
);

// Health Check
app.get('/health', (req, res) => {
  res.status(200).json({
    service: 'auth-service',
    status: 'healthy',
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
  });
});

app.listen(PORT, '0.0.0.0', () =>
  console.log(
    `🔐 Auth Service running on port ${PORT}`
  )
);
