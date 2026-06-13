import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';

import { AdminService } from '../admin.service';

@Injectable()
export class AdminGuard implements CanActivate {
  constructor(private readonly adminService: AdminService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest();

    const authHeader = req.headers['authorization'] as string | undefined;
    if (!authHeader?.startsWith('Bearer ')) {
      throw new UnauthorizedException('Missing admin authorization token.');
    }

    const masterKey = req.headers['x-admin-master-key'] as string | undefined;
    if (!masterKey || !(await this.adminService.verifyMasterKey(masterKey))) {
      throw new ForbiddenException('Invalid admin master key.');
    }

    const admin = await this.adminService.validateAdminToken(
      authHeader.replace('Bearer ', '').trim(),
    );
    if (!admin) {
      throw new ForbiddenException('Admin session is not verified.');
    }

    req.admin = admin;
    return true;
  }
}
