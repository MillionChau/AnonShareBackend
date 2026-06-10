import { IsString, IsNotEmpty, MaxLength, MinLength, IsOptional } from 'class-validator';

// ─── Request DTO ──────────────────────────────────────────────────────────────

export class CreateAnonymousSessionDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MinLength(8)
  @MaxLength(128)
  password?: string;
}

export class LoginAnonymousDto {
  @IsString()
  @IsNotEmpty()
  anonymousId: string;

  @IsString()
  @IsNotEmpty()
  @MinLength(8)
  @MaxLength(128)
  password: string;
}

// ─── Response DTO ─────────────────────────────────────────────────────────────

export class AnonymousSessionDto {
  /** Nhãn anonymousId hiển thị cho người dùng, ví dụ Anonymous12345678 */
  anonymousId: string;

  /** JWT Bearer token — lưu ở client (localStorage hoặc cookie) */
  token: string;

  /** true = tài khoản mới vừa được tạo, false = đã tồn tại */
  isNew: boolean;

  /** Thời điểm tạo anonymousId lần đầu */
  createdAt: Date;
}

// ─── Response khi bị banned ───────────────────────────────────────────────────

export class BannedResponseDto {
  message: string;
  banReason: string | null;
  bannedAt: Date | null;
}
