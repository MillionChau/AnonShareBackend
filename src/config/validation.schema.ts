import * as Joi from 'joi';

export const validationSchema = Joi.object({
  NODE_ENV: Joi.string()
    .valid('development', 'production', 'test')
    .default('development'),

  PORT: Joi.number().default(3000),

  // Bắt buộc — app không khởi động nếu thiếu
  MONGO_URI: Joi.string().required().messages({
    'any.required': 'MONGO_URI is required. Check your .env file.',
  }),

  JWT_SECRET: Joi.string().min(16).required().messages({
    'any.required': 'JWT_SECRET is required.',
    'string.min': 'JWT_SECRET must be at least 16 characters.',
  }),

  JWT_EXPIRES_IN: Joi.string().default('90d'),

  AI_SERVICE_URL: Joi.string().uri().default('https://anon-share-ai-service-latest.onrender.com'),
  AI_SERVICE_TIMEOUT: Joi.number().default(30000),

  ADMIN_MASTER_KEY: Joi.string().min(32).required().messages({
    'any.required': 'ADMIN_MASTER_KEY is required.',
    'string.min': 'ADMIN_MASTER_KEY must be at least 32 characters.',
  }),
  ADMIN_SEED_USERNAME: Joi.string().optional(),
  ADMIN_SEED_EMAIL: Joi.string().email().optional(),
  ADMIN_SEED_PASSWORD: Joi.string().min(12).optional(),
  ADMIN_SEED_TOTP_SECRET: Joi.string().optional(),
  ADMIN_SEED_DISPLAY_NAME: Joi.string().optional(),

  SMTP_HOST: Joi.string().hostname().optional(),
  SMTP_PORT: Joi.number().port().default(587),
  SMTP_SECURE: Joi.boolean().default(false),
  SMTP_USER: Joi.string().optional(),
  SMTP_PASS: Joi.string().optional(),
  SMTP_FROM: Joi.string().email().optional(),
})
  .and('ADMIN_SEED_USERNAME', 'ADMIN_SEED_EMAIL', 'ADMIN_SEED_PASSWORD', 'ADMIN_SEED_TOTP_SECRET')
  .and('SMTP_HOST', 'SMTP_USER', 'SMTP_PASS');
