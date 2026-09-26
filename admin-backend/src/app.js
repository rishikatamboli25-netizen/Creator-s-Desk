import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import rateLimit from 'express-rate-limit';

import { config } from './config/index.js';

import authRoutes from './routes/authRoutes.js';
import systemRoutes from './routes/systemRoutes.js';
import pricingRoutes from './routes/pricingRoutes.js';
import catalogRoutes from './routes/catalogRoutes.js';
import orderRoutes from './routes/orderRoutes.js';
import customerRoutes from './routes/customerRoutes.js';
import paymentRoutes from './routes/paymentRoutes.js';
import invoiceRoutes from './routes/invoiceRoutes.js';
import adminUserRoutes from './routes/adminUserRoutes.js';
import invitationRoutes from './routes/invitationRoutes.js';
import auditRoutes from './routes/auditRoutes.js';
import settingsRoutes from './routes/settingsRoutes.js';
import { requestIdMiddleware } from './middleware/requestId.js';
import { csrfMiddleware } from './middleware/csrfMiddleware.js';

const app = express();

app.set('trust proxy', 1);

app.use(requestIdMiddleware);

app.use(
  cors({
    origin(origin, callback) {
      if (!origin || config.adminFrontendOrigins.includes(origin)) {
        return callback(null, true);
      }

      return callback(
        new Error('Origin not allowed by CD_ADMIN CORS policy.')
      );
    },

    credentials: true,

    methods: [
      'GET',
      'POST',
      'PUT',
      'PATCH',
      'DELETE',
      'OPTIONS',
    ],

    allowedHeaders: [
      'Content-Type',
      'Accept',
      'X-CSRF-Token',
    ],
  })
);

app.use(
  express.json({
    limit: '1mb',
  })
);

app.use(cookieParser());
app.use(
  csrfMiddleware({
    secure: config.cookieSecure,
    sameSite: config.cookieSameSite,
  })
);

app.get('/health', (_req, res) => {
  res.status(200).json({
    status: 'CD_ADMIN backend is online.',
    service: 'cd-admin-backend',
  });
});

app.use(
  '/auth/login',
  rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 10,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    message: {
      error:
        'Too many admin login attempts. Please try again later.',
    },
  })
);

app.use('/auth', authRoutes);
app.use('/system', systemRoutes);
app.use('/pricing', pricingRoutes);
app.use('/catalog', catalogRoutes);
app.use('/orders', orderRoutes);
app.use('/customers', customerRoutes);
app.use('/payments', paymentRoutes);
app.use('/invoices', invoiceRoutes);
app.use('/admin-users', adminUserRoutes);
app.use('/auth/invitations', invitationRoutes);
app.use('/audit-logs', auditRoutes);
app.use('/settings', settingsRoutes);

app.use((err, _req, res, _next) => {
  console.error(
    '[CD_ADMIN] Unhandled application error:',
    err.message
  );

  if (res.headersSent) return;

  res.status(500).json({
    error: 'Internal admin service error.',
  });
});

app.use((_req, res) => {
  res.status(404).json({
    error: 'CD_ADMIN route not found.',
  });
});

export default app;
