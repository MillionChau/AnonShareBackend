import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

import { validationSchema } from './config/validation.schema';
import { appConfig, mongoConfig, jwtConfig, aiConfig, adminConfig } from './config/configuration';
import { DatabaseModule } from './database/database.module';
import { AuthModule } from './modules/auth/auth.module';
import { PostModule } from './modules/post/post.module';
import { ThrottlerModule } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';
import { DeviceThrottlerGuard } from './modules/auth/guards/device-throttler.guard';
import { CommentModule } from './modules/comment/comment.module';
import { NotificationModule } from './modules/notification/notification.module';
import { ReportModule } from './modules/report/report.module';
import { AdminModule } from './modules/admin/admin.module';

@Module({
  imports: [
    // Config phải load đầu tiên — các module khác phụ thuộc vào nó
    ConfigModule.forRoot({
      isGlobal: true,           
      envFilePath: '.env',
      load: [appConfig, mongoConfig, jwtConfig, aiConfig, adminConfig],
      validationSchema,      
      validationOptions: {
        abortEarly: true,  
      },
    }),
    ThrottlerModule.forRoot([
      {
        name: 'auth',
        ttl: 60_000,
        limit: 5,
      },
      {
        name: 'postCreate',
        ttl: 15 * 60_000,
        limit: 1,
      },
      {
        name: 'commentCreate',
        ttl: 60_000,
        limit: 8,
      },
      {
        name: 'reportCreate',
        ttl: 60 * 60_000,
        limit: 1,
      },
    ]),

    DatabaseModule,
    AuthModule,
    PostModule,
    CommentModule,
    NotificationModule,
    ReportModule,
    AdminModule,
  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: DeviceThrottlerGuard,
    },
  ],
})
export class AppModule {}
