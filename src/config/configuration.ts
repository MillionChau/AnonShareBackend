import { registerAs } from '@nestjs/config';

export const appConfig = registerAs('app', () => ({
  nodeEnv: process.env.NODE_ENV ?? 'development',
  port: parseInt(process.env.PORT ?? '3000', 10),
}));

export const mongoConfig = registerAs('mongo', () => ({
  uri: process.env.MONGO_URI,
}));

export const jwtConfig = registerAs('jwt', () => ({
  secret: process.env.JWT_SECRET,
  expiresIn: process.env.JWT_EXPIRES_IN ?? '90d',
}));

export const aiConfig = registerAs('ai', () => ({
  url: process.env.AI_SERVICE_URL ?? 'http://localhost:8000',
  timeout: parseInt(process.env.AI_SERVICE_TIMEOUT ?? '30000', 10),
}));

export const adminConfig = registerAs('admin', () => ({
  masterKey: process.env.ADMIN_MASTER_KEY,
  seedUsername: process.env.ADMIN_SEED_USERNAME,
  seedEmail: process.env.ADMIN_SEED_EMAIL,
  seedPassword: process.env.ADMIN_SEED_PASSWORD,
  seedTotpSecret: process.env.ADMIN_SEED_TOTP_SECRET,
  seedDisplayName: process.env.ADMIN_SEED_DISPLAY_NAME,
  mail: {
    host: process.env.SMTP_HOST,
    port: parseInt(process.env.SMTP_PORT ?? '587', 10),
    secure: process.env.SMTP_SECURE === 'true',
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
    from: process.env.SMTP_FROM || process.env.SMTP_USER,
  },
}));
