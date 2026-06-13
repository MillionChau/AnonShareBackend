import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';

import { AdminService } from '../admin.service';

@Injectable()
export class AdminMasterKeyGuard implements CanActivate {
  constructor(private readonly adminService: AdminService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest();
    const masterKey = req.headers['x-admin-master-key'] as string | undefined;

    if (!masterKey || !(await this.adminService.verifyMasterKey(masterKey))) {
      throw new ForbiddenException('Invalid admin master key.');
    }

    return true;
  }
}
