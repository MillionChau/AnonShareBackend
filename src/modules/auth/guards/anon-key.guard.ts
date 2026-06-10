import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
  ForbiddenException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { AuthService } from '../auth.service';

@Injectable()
export class AnonKeyGuard implements CanActivate {
  constructor(
    private readonly jwtService: JwtService,
    private readonly authService: AuthService,
    private readonly config: ConfigService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest();

    // Lấy token từ header Authorization: Bearer <token>
    const authHeader = req.headers['authorization'] as string;
    if (!authHeader?.startsWith('Bearer ')) {
      throw new UnauthorizedException('Missing authorization token.');
    }

    const token = authHeader.replace('Bearer ', '').trim();

    // Verify JWT
    let payload: { sub: string };
    try {
      payload = this.jwtService.verify(token, {
        secret: this.config.get<string>('jwt.secret'),
      });
    } catch {
      throw new UnauthorizedException('Invalid or expired token. Please re-authenticate.');
    }

    // Kiểm tra user vẫn tồn tại và không bị ban
    // (Admin có thể ban sau khi JWT được cấp)
    const user = await this.authService.findByAnonymousId(payload.sub);
    if (!user) {
      throw new UnauthorizedException('Anonymous session not found.');
    }
    if (user.isBanned) {
      throw new ForbiddenException('This device has been banned.');
    }

    // Inject anonymousId vào request để các controller dùng
    req.anonymousId = user.displayId;

    return true;
  }
}
