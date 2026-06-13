import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { MongooseModule } from '@nestjs/mongoose';

import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';
import { AdminMailService } from './admin-mail.service';
import { TotpService } from './totp.service';
import { AdminGuard } from './guards/admin.guard';
import { AdminMasterKeyGuard } from './guards/admin-master-key.guard';
import { AdminAuditInterceptor } from './interceptors/admin-audit.interceptor';
import { Admin, AdminSchema } from './schemas/admin.schema';
import {
  AdminMasterKey,
  AdminMasterKeySchema,
} from './schemas/admin-master-key.schema';
import {
  AdminAuditLog,
  AdminAuditLogSchema,
} from './schemas/admin-audit-log.schema';

@Module({
  imports: [
    ConfigModule,
    MongooseModule.forFeature([
      { name: Admin.name, schema: AdminSchema },
      { name: AdminMasterKey.name, schema: AdminMasterKeySchema },
      { name: AdminAuditLog.name, schema: AdminAuditLogSchema },
    ]),
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
  controllers: [AdminController],
  providers: [
    AdminService,
    AdminMailService,
    TotpService,
    AdminGuard,
    AdminMasterKeyGuard,
    AdminAuditInterceptor,
  ],
  exports: [
    AdminService,
    AdminMailService,
    AdminGuard,
    AdminMasterKeyGuard,
    AdminAuditInterceptor,
  ],
})
export class AdminModule {}
