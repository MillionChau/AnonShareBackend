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
});
