import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { catchError, Observable, tap, throwError } from 'rxjs';

import { AdminService } from '../admin.service';

@Injectable()
export class AdminAuditInterceptor implements NestInterceptor {
  constructor(private readonly adminService: AdminService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const startedAt = Date.now();
    const req = context.switchToHttp().getRequest<Request & { admin?: any }>();
    const res = context.switchToHttp().getResponse<Response>();

    return next.handle().pipe(
      tap(() => {
        void this.writeLog(req, res.statusCode, null, Date.now() - startedAt);
      }),
      catchError((error) => {
        void this.writeLog(
          req,
          error?.status ?? res.statusCode ?? 500,
          error?.message ?? 'Unknown admin error',
          Date.now() - startedAt,
        );
        return throwError(() => error);
      }),
    );
  }

  private async writeLog(
    req: Request & { admin?: any },
    statusCode: number,
    errorMessage: string | null,
    durationMs: number,
  ): Promise<void> {
    if (!req.admin) {
      return;
    }

    await this.adminService.writeAuditLog({
      adminId: req.admin._id?.toString?.() ?? String(req.admin._id),
      username: req.admin.username,
      method: req.method,
      path: req.originalUrl ?? req.url,
      action: `${req.method} ${req.route?.path ?? req.path}`,
      params: req.params,
      query: req.query as Record<string, unknown>,
      body: req.body as Record<string, unknown>,
      ip: req.ip ?? null,
      userAgent: req.get('user-agent') ?? null,
      statusCode,
      errorMessage,
      durationMs,
    });
  }
}
