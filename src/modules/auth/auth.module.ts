import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';

import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { FingerprintService } from './fingerprint.service';
import { AnonKeyGuard } from './guards/anon-key.guard';
import {
  AnonymousUser,
  AnonymousUserSchema,
} from './schemas/anonymous-user.schema';

@Module({
  imports: [
    // Đăng ký schema với Mongoose
    MongooseModule.forFeature([
      { name: AnonymousUser.name, schema: AnonymousUserSchema },
    ]),

    // JWT config lấy từ env qua ConfigService
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.get<string>('jwt.secret'),
        signOptions: {
          expiresIn: config.get<string>('jwt.expiresIn'),
        },
      }),
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, FingerprintService, AnonKeyGuard],

  // Export để các module khác (Post, Comment...) dùng được
  exports: [AuthService, FingerprintService, AnonKeyGuard, JwtModule],
})
export class AuthModule {}
