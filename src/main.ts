import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AppModule } from './app.module';
import { setServers } from 'dns';

setServers(['8.8.8.8', '8.8.4.4']);

async function bootstrap() {
  const logger = new Logger('Bootstrap');
  const app = await NestFactory.create(AppModule);

  const config = app.get(ConfigService);
  const port = config.get<number>('app.port') ?? 3000;
  const nodeEnv = config.get<string>('app.nodeEnv');

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,          
      forbidNonWhitelisted: true, 
      transform: true,        
      transformOptions: {
        enableImplicitConversion: true,
      },
    }),
  );

  app.enableCors({
    origin: nodeEnv === 'production'
      ? ['https://your-frontend-domain.com'] 
      : '*',
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  });

  app.setGlobalPrefix('api/v1');

  await app.listen(port, '0.0.0.0');
  logger.log(`Server running on http://localhost:${port}/api/v1`);
  logger.log(`Environment: ${nodeEnv}`);
}

bootstrap();
