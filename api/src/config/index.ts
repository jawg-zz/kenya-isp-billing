import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

export const config = {
  env: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT || '3000', 10),
  apiPrefix: process.env.API_PREFIX || '/api/v1',
  corsOrigin: process.env.CORS_ORIGIN || 'http://localhost:3001',

  database: {
    url: process.env.DATABASE_URL!,
  },

  redis: {
    url: process.env.REDIS_URL || 'redis://localhost:6379',
  },

  jwt: {
    secret: process.env.JWT_SECRET!,
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
    refreshSecret: process.env.JWT_REFRESH_SECRET!,
    refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '30d',
  },

  mpesa: {
    consumerKey: process.env.MPESA_CONSUMER_KEY || '',
    consumerSecret: process.env.MPESA_CONSUMER_SECRET || '',
    passkey: process.env.MPESA_PASSKEY || '',
    shortcode: process.env.MPESA_SHORTCODE || '174379',
    environment: process.env.MPESA_ENVIRONMENT || 'sandbox',
    callbackUrl: process.env.MPESA_CALLBACK_URL || '',
    timeoutUrl: process.env.MPESA_TIMEOUT_URL || '',
  },

  airtel: {
    clientId: process.env.AIRTEL_CLIENT_ID || '',
    clientSecret: process.env.AIRTEL_CLIENT_SECRET || '',
    shortcode: process.env.AIRTEL_SHORTCODE || '',
    environment: process.env.AIRTEL_ENVIRONMENT || 'sandbox',
    callbackUrl: process.env.AIRTEL_CALLBACK_URL || '',
  },

  sms: {
    apiKey: process.env.AT_API_KEY || '',
    username: process.env.AT_USERNAME || '',
    senderId: process.env.AT_SENDER_ID || 'ISPBILLING',
  },

  radius: {
    secret: process.env.RADIUS_SECRET!,
    host: process.env.RADIUS_HOST || '127.0.0.1',
    port: parseInt(process.env.RADIUS_PORT || '1812', 10),
    accountingPort: parseInt(process.env.RADIUS_ACCOUNTING_PORT || '1813', 10),
  },

  invoice: {
    companyName: process.env.INVOICE_COMPANY_NAME || 'Your ISP Limited',
    companyAddress: process.env.INVOICE_COMPANY_ADDRESS || 'P.O. Box 12345, Nairobi, Kenya',
    companyPhone: process.env.INVOICE_COMPANY_PHONE || '+254 700 123456',
    companyEmail: process.env.INVOICE_COMPANY_EMAIL || 'billing@yourisp.co.ke',
    companyKraPin: process.env.INVOICE_COMPANY_KRA_PIN || 'P051234567A',
  },

  logging: {
    level: process.env.LOG_LEVEL || 'info',
    filePath: process.env.LOG_FILE_PATH || './logs',
  },

  rateLimit: {
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000', 10),
    maxRequests: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '100', 10),
  },

  business: {
    defaultCurrency: process.env.DEFAULT_CURRENCY || 'KES',
    taxRate: parseFloat(process.env.TAX_RATE || '0.16'),
    taxName: process.env.TAX_NAME || 'VAT',
    fupEnabled: process.env.FUP_ENABLED === 'true',
    gracePeriodDays: parseInt(process.env.GRACE_PERIOD_DAYS || '3', 10),
  },
};

// Validate required environment variables
export const validateConfig = (): void => {
  const required = ['DATABASE_URL', 'JWT_SECRET', 'JWT_REFRESH_SECRET'];
  const missing = required.filter((key) => !process.env[key]);

  if (missing.length > 0) {
    console.error(`Missing required environment variables: ${missing.join(', ')}`);
    process.exit(1);
  }
};

export default config;
