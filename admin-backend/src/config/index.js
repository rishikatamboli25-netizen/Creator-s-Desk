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

  groqApiKey:
    process.env.GROQ_API_KEY || '',
  groqModel:
    process.env.GROQ_MODEL || 'openai/gpt-oss-120b',
  aiRequestTimeoutMs: Math.max(5000, Math.min(60000, Number(process.env.AI_REQUEST_TIMEOUT_MS || 30000))),
  aiProviderRetries: Math.max(0, Math.min(2, Number(process.env.AI_PROVIDER_RETRIES || 1))),

  serpApiKey:
    process.env.SERPAPI_KEY || '',
  researchCountry:
    process.env.RESEARCH_COUNTRY || 'IN',
  catalogResearchMaxProducts: Math.max(1, Math.min(50, Number(process.env.CATALOG_RESEARCH_MAX_PRODUCTS || 30))),

  cloudinaryCloudName:
    process.env.CLOUDINARY_CLOUD_NAME || '',
  cloudinaryApiKey:
    process.env.CLOUDINARY_API_KEY || '',
  cloudinaryApiSecret:
    process.env.CLOUDINARY_API_SECRET || '',
  cloudinaryFolder:
    process.env.CLOUDINARY_FOLDER || 'creators-desk/catalog',

  mfaEncryptionKey:
    process.env.ADMIN_MFA_ENCRYPTION_KEY || '',
};
