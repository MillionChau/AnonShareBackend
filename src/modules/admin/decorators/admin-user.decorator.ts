import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { AdminDocument } from '../schemas/admin.schema';

export const AdminUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): AdminDocument => {
    const request = ctx.switchToHttp().getRequest();
    return request.admin;
  },
);
