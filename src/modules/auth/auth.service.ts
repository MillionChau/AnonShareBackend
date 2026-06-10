import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  InternalServerErrorException,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { JwtService } from '@nestjs/jwt';
import { Model } from 'mongoose';
import { randomBytes, scryptSync, timingSafeEqual, createHash } from 'crypto';
import { Request } from 'express';

import {
  AnonymousUser,
  AnonymousUserDocument,
} from './schemas/anonymous-user.schema';
import { FingerprintService } from './fingerprint.service';
import { AnonymousSessionDto } from './dto/auth.dto';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    @InjectModel(AnonymousUser.name)
    private readonly userModel: Model<AnonymousUserDocument>,
    private readonly fingerprintService: FingerprintService,
    private readonly jwtService: JwtService,
  ) {}

  async getOrCreateSession(req: Request, password?: string): Promise<AnonymousSessionDto> {
    const fingerprint = this.fingerprintService.compute(req);

    // Tìm user đã tồn tại
    let user = await this.userModel.findOne({ deviceFingerprint: fingerprint });
    let isNew = false;

    if (user) {
      // Thiết bị đã bị ban → không cho tạo session
      if (user.isBanned) {
        this.logger.warn(
          `Banned device attempted access. Fingerprint: ${fingerprint.substring(0, 8)}...`,
        );
        throw new ForbiddenException({
          message: 'Thiết bị này đã bị khóa khỏi hệ thống.',
          banReason: user.banReason,
          bannedAt: user.bannedAt,
        });
      }

      if (!user.displayId) {
        this.logger.warn(
          `Existing anonymous user missing displayId; regenerating for fingerprint ${fingerprint.substring(0, 8)}...`,
        );
        user.displayId = await this.generateDisplayId();
        user.anonymousIdHash = this.hashAnonymousId(user.displayId);
        await user.save();
      }

      this.logger.log(`Returning session for existing user: ${user.displayId}`);
    } else {
      if (!password) {
        throw new BadRequestException('Password is required when creating a new anonymous user.');
      }

      // Lần đầu tiên thiết bị này truy cập → tạo mới
      const anonymousId = await this.generateDisplayId();
      const anonymousIdHash = this.hashAnonymousId(anonymousId);
      const passwordHash = this.hashPassword(password);
      const now = new Date();
      user = await this.userModel.create({
        displayId: anonymousId,
        anonymousIdHash,
        deviceFingerprint: fingerprint,
        passwordHash,
        throttleCount: 1,
        authRequestCount: 1,
        throttleWindowStart: now,
        authRequestWindowStart: now,
        lastSeenAt: now,
      });
      isNew = true;
      this.logger.log(`Created new anonymous user: ${anonymousId}`);
    }

    // Ký JWT — chỉ chứa displayId, KHÔNG chứa fingerprint
    const displayId = this.getDisplayId(user);
    const token = this.jwtService.sign({ sub: displayId });

    return {
      anonymousId: displayId,
      token,
      isNew,
      createdAt: user.createdAt,
    };
  }

  async trackFingerprintRequest(req: Request): Promise<void> {
    const fingerprint = this.fingerprintService.compute(req);
    const user = await this.userModel.findOne({ deviceFingerprint: fingerprint });
    if (!user) {
      return;
    }

    if (user.isBanned) {
      throw new ForbiddenException({
        message: 'Thiết bị này đã bị khóa khỏi hệ thống.',
        banReason: user.banReason,
        bannedAt: user.bannedAt,
      });
    }

    const now = new Date();
    const oneMinute = 60 * 1000;
    const oneHour = 60 * 60 * 1000;

    const throttleExpired =
      !user.throttleWindowStart ||
      now.getTime() - user.throttleWindowStart.getTime() > oneMinute;
    const authExpired =
      !user.authRequestWindowStart ||
      now.getTime() - user.authRequestWindowStart.getTime() > oneHour;

    const currentThrottleCount = user.throttleCount ?? 0;
    const currentAuthRequestCount = user.authRequestCount ?? 0;
    const nextThrottleCount = throttleExpired ? 1 : currentThrottleCount + 1;
    const nextAuthRequestCount = authExpired ? 1 : currentAuthRequestCount + 1;

    await this.userModel.updateOne(
      { _id: user._id },
      {
        throttleCount: nextThrottleCount,
        throttleWindowStart: throttleExpired ? now : user.throttleWindowStart,
        authRequestCount: nextAuthRequestCount,
        authRequestWindowStart: authExpired ? now : user.authRequestWindowStart,
        lastSeenAt: now,
      },
    );

    if (nextAuthRequestCount >= 10) {
      await this.banUserByFingerprint(
        fingerprint,
        'Auto-ban: vượt giới hạn 1 giờ.',
      );
      this.logger.warn(
        `Auto-banned device by fingerprint: ${fingerprint.substring(0, 8)}...`,
      );
      throw new ForbiddenException('Thiết bị bị khoá do hoạt động bất thường.');
    }
  }

  async login(anonymousId: string, password: string): Promise<AnonymousSessionDto> {
    const anonymousIdHash = this.hashAnonymousId(anonymousId);
    let user = await this.userModel.findOne({ anonymousIdHash });
    if (!user) {
      user = await this.userModel.findOne({ displayId: anonymousId });
    }

    if (!user) {
      throw new UnauthorizedException('anonymousId hoặc mật khẩu không đúng.');
    }

    if (user.isBanned) {
      this.logger.warn(`Banned user login attempt: ${anonymousId}`);
      throw new ForbiddenException({
        message: 'Tài khoản này đã bị khóa khỏi hệ thống.',
        banReason: user.banReason,
        bannedAt: user.bannedAt,
      });
    }

    if (!this.verifyPassword(password, user.passwordHash)) {
      throw new UnauthorizedException('anonymousId hoặc mật khẩu không đúng.');
    }

    const displayId = this.getDisplayId(user);
    if (!user.displayId) {
      user.displayId = displayId;
      user.anonymousIdHash = this.hashAnonymousId(displayId);
      await user.save();
    }

    const token = this.jwtService.sign({ sub: displayId });
    this.logger.log(`Authenticated anonymous user: ${anonymousId}`);

    return {
      anonymousId: displayId,
      token,
      isNew: false,
      createdAt: user.createdAt,
    };
  }

  private hashPassword(password: string): string {
    const salt = randomBytes(16).toString('hex');
    const derivedKey = scryptSync(password, salt, 64);
    return `${salt}:${derivedKey.toString('hex')}`;
  }

  private verifyPassword(password: string, storedHash: string): boolean {
    const [salt, key] = storedHash.split(':');
    if (!salt || !key) {
      return false;
    }

    const derivedKey = scryptSync(password, salt, 64);
    const storedKey = Buffer.from(key, 'hex');
    if (storedKey.length !== derivedKey.length) {
      return false;
    }

    return timingSafeEqual(storedKey, derivedKey);
  }

  private hashAnonymousId(anonymousId: string): string {
    return createHash('sha256').update(anonymousId).digest('hex');
  }

  private getDisplayId(user: AnonymousUserDocument): string {
    if (!user.displayId) {
      this.logger.error('Anonymous user is missing displayId in database.', user.toObject?.());
      throw new InternalServerErrorException('Internal anonymous account error.');
    }
    return user.displayId;
  }

  private async generateDisplayId(): Promise<string> {
    const candidate = `Anonymous${Math.floor(10000000 + Math.random() * 90000000)}`;
    const exists = await this.userModel.exists({ displayId: candidate });
    return exists ? this.generateDisplayId() : candidate;
  }

  /**
   * Verify anonymousId từ JWT payload.
   * Dùng trong AnonKeyGuard để inject vào request.
   */
  async findByAnonymousId(
    anonymousId: string,
  ): Promise<AnonymousUserDocument | null> {
    const anonymousIdHash = this.hashAnonymousId(anonymousId);
    return this.userModel.findOne({ anonymousIdHash, isBanned: false });
  }

  /**
   * Admin action: ban một thiết bị theo anonymousId.
   * Mọi session hiện tại của thiết bị đó đều bị từ chối ở guard.
   */
  async banUser(anonymousId: string, reason?: string): Promise<void> {
    const anonymousIdHash = this.hashAnonymousId(anonymousId);
    await this.userModel.findOneAndUpdate(
      { anonymousIdHash },
      {
        isBanned: true,
        bannedAt: new Date(),
        banReason: reason ?? null,
      },
    );
    this.logger.warn(`User banned: ${anonymousId}. Reason: ${reason}`);
  }

  /**
   * Ban user by device fingerprint.
   * Used by throttler to auto-ban when exceeding rate limit.
   */
  async banUserByFingerprint(fingerprint: string, reason?: string): Promise<void> {
    await this.userModel.findOneAndUpdate(
      { deviceFingerprint: fingerprint },
      {
        isBanned: true,
        bannedAt: new Date(),
        banReason: reason ?? null,
      },
    );
    this.logger.warn(
      `Device banned by fingerprint: ${fingerprint.substring(0, 8)}... Reason: ${reason}`,
    );
  }
}
