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
