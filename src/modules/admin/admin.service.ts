import {
  ConflictException,
  Injectable,
  Logger,
  OnModuleInit,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import * as bcrypt from 'bcrypt';

import { Admin, AdminDocument } from './schemas/admin.schema';
import {
  AdminMasterKey,
  AdminMasterKeyDocument,
} from './schemas/admin-master-key.schema';
import {
  AdminAuditLog,
  AdminAuditLogDocument,
} from './schemas/admin-audit-log.schema';
import {
  AdminLoginDto,
  AdminLoginResponseDto,
  AdminSeedDto,
  AdminSeedResponseDto,
  AdminSessionResponseDto,
  AdminVerifyTotpDto,
} from './dto/admin.dto';
import { TotpService } from './totp.service';
import { AdminMailService } from './admin-mail.service';

export interface AdminJwtPayload {
  sub: string;
  username: string;
  roles: string[];
  adminVerified: boolean;
  tokenType: 'admin' | 'admin-login';
}

export interface AuditLogInput {
  adminId: string;
  username: string;
  method: string;
  path: string;
  action: string;
  params?: Record<string, unknown>;
  query?: Record<string, unknown>;
  body?: Record<string, unknown>;
  ip?: string | null;
  userAgent?: string | null;
  statusCode?: number | null;
  errorMessage?: string | null;
  durationMs?: number;
}

@Injectable()
export class AdminService implements OnModuleInit {
  private static initialized = false;
  private static seedWarningLogged = false;
  private readonly logger = new Logger(AdminService.name);
  private readonly bcryptRounds = 12;
  private readonly masterKeyId = 'default';

  constructor(
    @InjectModel(Admin.name)
    private readonly adminModel: Model<AdminDocument>,
    @InjectModel(AdminMasterKey.name)
    private readonly masterKeyModel: Model<AdminMasterKeyDocument>,
    @InjectModel(AdminAuditLog.name)
    private readonly auditLogModel: Model<AdminAuditLogDocument>,
    private readonly configService: ConfigService,
    private readonly jwtService: JwtService,
    private readonly totpService: TotpService,
    private readonly adminMailService: AdminMailService,
  ) {}

  async onModuleInit(): Promise<void> {
    if (AdminService.initialized) {
      return;
    }
    AdminService.initialized = true;
    await this.syncMasterKeyHash();
    await this.seedAdminFromEnvironment();
  }

  async login(dto: AdminLoginDto): Promise<AdminLoginResponseDto> {
    const admin = await this.adminModel.findOne({
      username: dto.username.trim().toLowerCase(),
      isActive: true,
    });

    if (!admin || !(await bcrypt.compare(dto.password, admin.passwordHash))) {
      throw new UnauthorizedException('Admin credentials are invalid.');
    }

    const loginToken = this.jwtService.sign(
      {
        sub: admin._id.toString(),
        username: admin.username,
        roles: admin.roles ?? [],
        adminVerified: false,
        tokenType: 'admin-login',
      } satisfies AdminJwtPayload,
      { expiresIn: '5m' },
    );

    const totpCode = this.totpService.generateToken(admin.totpSecret);
    await this.adminMailService.sendTotpCode(admin.email, totpCode);

    return {
      loginToken,
      requires2FA: true,
      delivery: 'email',
      emailMasked: this.maskEmail(admin.email),
    };
  }

  async verifyTotp(dto: AdminVerifyTotpDto): Promise<AdminSessionResponseDto> {
    let payload: AdminJwtPayload;
    try {
      payload = this.jwtService.verify<AdminJwtPayload>(dto.loginToken, {
        secret: this.configService.get<string>('jwt.secret'),
      });
    } catch {
      throw new UnauthorizedException('Invalid or expired admin login token.');
    }

    if (payload.tokenType !== 'admin-login' || payload.adminVerified) {
      throw new UnauthorizedException('Invalid admin login token.');
    }

    const admin = await this.adminModel.findOne({
      _id: payload.sub,
      username: payload.username,
      isActive: true,
    });

    if (!admin) {
      throw new UnauthorizedException('Admin account is not active.');
    }

    if (!this.totpService.verifyToken(admin.totpSecret, dto.totpCode)) {
      throw new UnauthorizedException('Invalid 2FA code.');
    }

    admin.lastLoginAt = new Date();
    await admin.save();

    const token = this.jwtService.sign({
      sub: admin._id.toString(),
      username: admin.username,
      roles: admin.roles ?? [],
      adminVerified: true,
      tokenType: 'admin',
    } satisfies AdminJwtPayload);

    return {
      token,
      admin: this.toSessionAdmin(admin),
    };
  }

  async createSeedAdmin(dto: AdminSeedDto): Promise<AdminSeedResponseDto> {
    const username = dto.username.trim().toLowerCase();
    const email = dto.email.trim().toLowerCase();
    const exists = await this.adminModel.exists({ username });
    if (exists) {
      throw new ConflictException('Admin already exists.');
    }

    const totpSecret = dto.totpSecret?.trim() || this.totpService.generateSecret();
    const admin = await this.adminModel.create({
      username,
      email,
      passwordHash: await bcrypt.hash(dto.password, this.bcryptRounds),
      totpSecret,
      displayName: dto.displayName?.trim() || null,
      roles: ['admin'],
      isActive: true,
    });

    return {
      id: admin._id.toString(),
      username: admin.username,
      email: admin.email,
      displayName: admin.displayName,
      totpSecret,
      message: 'Seed admin created. Store the TOTP secret securely.',
    };
  }

  async validateAdminByPayload(payload: AdminJwtPayload): Promise<AdminDocument | null> {
    if (
      payload.tokenType !== 'admin' ||
      payload.adminVerified !== true ||
      !Types.ObjectId.isValid(payload.sub)
    ) {
      return null;
    }

    return this.adminModel.findOne({
      _id: payload.sub,
      username: payload.username,
      isActive: true,
    });
  }

  async validateAdminToken(token: string): Promise<AdminDocument | null> {
    let payload: AdminJwtPayload;
    try {
      payload = this.jwtService.verify<AdminJwtPayload>(token, {
        secret: this.configService.get<string>('jwt.secret'),
      });
    } catch {
      return null;
    }

    return this.validateAdminByPayload(payload);
  }

  async verifyMasterKey(rawMasterKey: string): Promise<boolean> {
    const record = await this.masterKeyModel.findOne({
      keyId: this.masterKeyId,
      isActive: true,
    });

    if (!record) {
      return false;
    }

    const isValid = await bcrypt.compare(rawMasterKey, record.keyHash);
    if (isValid) {
      record.lastVerifiedAt = new Date();
      await record.save();
    }

    return isValid;
  }

  async writeAuditLog(input: AuditLogInput): Promise<void> {
    await this.auditLogModel.create({
      adminId: input.adminId,
      username: input.username,
      method: input.method,
      path: input.path,
      action: input.action,
      params: input.params ?? {},
      query: input.query ?? {},
      body: this.sanitizeBody(input.body ?? {}),
      ip: input.ip ?? null,
      userAgent: input.userAgent ?? null,
      statusCode: input.statusCode ?? null,
      errorMessage: input.errorMessage ?? null,
      durationMs: input.durationMs ?? 0,
    });
  }

  private async syncMasterKeyHash(): Promise<void> {
    const rawMasterKey = this.configService.get<string>('admin.masterKey');
    if (!rawMasterKey) {
      throw new Error('ADMIN_MASTER_KEY is required.');
    }

    const record = await this.masterKeyModel.findOne({ keyId: this.masterKeyId });
    if (!record) {
      await this.masterKeyModel.create({
        keyId: this.masterKeyId,
        keyHash: await bcrypt.hash(rawMasterKey, this.bcryptRounds),
        isActive: true,
      });
      this.logger.log('Admin master key hash initialized.');
      return;
    }

    if (!(await bcrypt.compare(rawMasterKey, record.keyHash))) {
      record.keyHash = await bcrypt.hash(rawMasterKey, this.bcryptRounds);
      record.isActive = true;
      await record.save();
      this.logger.log('Admin master key hash rotated from ADMIN_MASTER_KEY.');
    }
  }

  private async seedAdminFromEnvironment(): Promise<void> {
    const username = this.configService.get<string>('admin.seedUsername');
    const email = this.configService.get<string>('admin.seedEmail');
    const password = this.configService.get<string>('admin.seedPassword');
    const displayName = this.configService.get<string>('admin.seedDisplayName');
    const totpSecret = this.configService.get<string>('admin.seedTotpSecret');

    if (!username || !email || !password || !totpSecret) {
      if (!AdminService.seedWarningLogged) {
        AdminService.seedWarningLogged = true;
        this.logger.warn(
          'No admin seed configured. Create admin accounts directly in DB or set ADMIN_SEED_USERNAME, ADMIN_SEED_EMAIL, ADMIN_SEED_PASSWORD, and ADMIN_SEED_TOTP_SECRET for seed.',
        );
      }
      return;
    }

    const existing = await this.adminModel.findOne({
      username: username.trim().toLowerCase(),
    });
    if (existing) {
      const normalizedEmail = email.trim().toLowerCase();
      if (existing.email !== normalizedEmail) {
        existing.email = normalizedEmail;
        await existing.save();
        this.logger.log(`Seed admin email synchronized: ${existing.username}.`);
      }
      return;
    }

    const created = await this.createSeedAdmin({
      username,
      email,
      password,
      displayName,
      totpSecret,
    });

    this.logger.warn(`Seed admin created: ${created.username}. Store the TOTP secret securely.`);
  }

  private toSessionAdmin(admin: AdminDocument): AdminSessionResponseDto['admin'] {
    return {
      id: admin._id.toString(),
      username: admin.username,
      email: admin.email,
      displayName: admin.displayName,
      roles: admin.roles ?? [],
    };
  }

  private maskEmail(email: string): string {
    const [localPart, domain] = email.split('@');
    if (!localPart || !domain) return email;
    const visible = localPart.slice(0, Math.min(2, localPart.length));
    return `${visible}${'*'.repeat(Math.max(2, localPart.length - visible.length))}@${domain}`;
  }

  private sanitizeBody(body: Record<string, unknown>): Record<string, unknown> {
    const sensitiveKeys = new Set([
      'password',
      'totpCode',
      'totpSecret',
      'loginToken',
      'token',
      'masterKey',
      'adminMasterKey',
    ]);

    return Object.entries(body).reduce<Record<string, unknown>>((acc, [key, value]) => {
      acc[key] = sensitiveKeys.has(key) ? '[REDACTED]' : value;
      return acc;
    }, {});
  }
}
