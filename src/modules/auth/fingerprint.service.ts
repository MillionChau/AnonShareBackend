import { Injectable, Logger } from '@nestjs/common';
import { createHash } from 'crypto';
import { Request } from 'express';

/**
 * Tính device fingerprint từ các HTTP headers phía server.
 *
 * Nguyên tắc:
 * - Không lưu IP thô — chỉ hash kết hợp với các headers khác
 * - Kết quả là SHA-256 hex string — không thể reverse lại thông tin gốc
 * - Đủ ổn định để nhận dạng lại cùng thiết bị sau khi đổi tab/session
 * - Đủ khác biệt để phân biệt các thiết bị khác nhau trên cùng mạng
 */
@Injectable()
export class FingerprintService {
  private readonly logger = new Logger(FingerprintService.name);

  compute(req: Request): string {
    const components = this.extractComponents(req);
    const raw = components.join('||');
    const hash = createHash('sha256').update(raw).digest('hex');

    this.logger.debug(`Fingerprint computed: ${hash.substring(0, 8)}...`);
    return hash;
  }

  private extractComponents(req: Request): string[] {
    return [
      // Browser identity — rất khác nhau giữa Chrome/Firefox/Safari
      this.sanitize(req.headers['user-agent']),

      // Ngôn ngữ hệ thống — ổn định, khó giả mạo hàng loạt
      this.sanitize(req.headers['accept-language']),

      // Encoding support — khác nhau theo browser version
      this.sanitize(req.headers['accept-encoding']),

      // Accept header — browser-specific defaults
      this.sanitize(req.headers['accept']),

      // Chrome 90+ hints — rất cụ thể (brand, version, platform)
      this.sanitize(req.headers['sec-ch-ua']),
      this.sanitize(req.headers['sec-ch-ua-platform']),
      this.sanitize(req.headers['sec-ch-ua-mobile']),

      // Fetch mode hints — thêm entropy
      this.sanitize(req.headers['sec-fetch-site']),
      this.sanitize(req.headers['sec-fetch-mode']),

      // IP đã normalize — không dùng một mình nhưng góp entropy
      // VPN đổi IP thì fingerprint đổi → user cần gọi lại /auth/anonymous để lấy token mới
      // nhưng anonymousId cũ vẫn được tái sử dụng nếu họ còn giữ token
      this.normalizeIp(req.ip ?? req.socket?.remoteAddress ?? ''),
    ];
  }

  /**
   * Normalize IP address:
   * - IPv6 mapped IPv4 (::ffff:192.168.1.1) → 192.168.1.1
   * - Loopback addresses đều map về 'localhost' (giúp test local)
   */
  private normalizeIp(ip: string): string {
    const cleaned = ip.replace(/^::ffff:/, '').trim();

    // Normalize loopback — tránh '::1' vs '127.0.0.1' tạo ra fingerprint khác nhau
    if (cleaned === '::1' || cleaned === '127.0.0.1') {
      return 'localhost';
    }

    return cleaned;
  }

  /** Null-safe lowercase trim — tránh undefined làm lỗi hash */
  private sanitize(value: string | string[] | undefined): string {
    if (!value) return '';
    const str = Array.isArray(value) ? value[0] : value;
    return str.toLowerCase().trim();
  }
}
