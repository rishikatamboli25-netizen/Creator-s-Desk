import 'dotenv/config';

const splitCsv = (value, fallback = []) => {
  if (!value) return fallback;

  return value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
};

export const config = {
  port: Number(process.env.PORT || 5010),
  nodeEnv: process.env.NODE_ENV || 'development',

  mongoUri:
    process.env.MONGO_URI_ADMIN ||
    'mongodb://localhost:27017/creatorsdesk_admin',

  adminFrontendOrigins: splitCsv(
    process.env.ADMIN_FRONTEND_ORIGINS,
    ['http://localhost:5174']
  ),

  cookieName:
    process.env.ADMIN_COOKIE_NAME ||
    'cd_admin_session',

  cookieSecure:
    process.env.ADMIN_COOKIE_SECURE === 'true' ||
    process.env.NODE_ENV === 'production',

  cookieSameSite: (
    process.env.ADMIN_COOKIE_SAMESITE ||
    (process.env.NODE_ENV === 'production'
      ? 'none'
      : 'lax')
  ).toLowerCase(),

  sessionHours: Math.max(
    1,
    Number(process.env.ADMIN_SESSION_HOURS || 8)
  ),

  productServiceUrl:
    process.env.PRODUCT_SERVICE_URL ||
    'http://localhost:5002',

  orderServiceUrl:
    process.env.ORDER_SERVICE_URL ||
    'http://localhost:5003',

  authServiceUrl:
    process.env.AUTH_SERVICE_URL ||
    'http://localhost:5001',

  paymentServiceUrl:
    process.env.PAYMENT_SERVICE_URL ||
    'http://localhost:5004',

  adminInternalSecret:
    process.env.ADMIN_INTERNAL_SECRET || '',
};
