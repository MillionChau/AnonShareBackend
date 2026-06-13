import { ExecutionContext, Injectable, Logger } from '@nestjs/common';
import {
  InjectThrottlerOptions,
  InjectThrottlerStorage,
  ThrottlerGuard,
} from '@nestjs/throttler';
import { Reflector } from '@nestjs/core';
import { Request } from 'express';
import { AuthService } from '../auth.service';
import { FingerprintService } from '../fingerprint.service';

@Injectable()
export class DeviceThrottlerGuard extends ThrottlerGuard {
  private readonly logger = new Logger(DeviceThrottlerGuard.name);
  private readonly routeThrottlerNames = new Map<string, string>([
    ['AuthController.getAnonymousSession', 'auth'],
    ['PostController.createPost', 'postCreate'],
    ['CommentController.createComment', 'commentCreate'],
    ['ReportController.createReport', 'reportCreate'],
  ]);

  constructor(
    @InjectThrottlerOptions() options: any,
    @InjectThrottlerStorage() storageService: any,
    reflector: Reflector,
    private readonly authService: AuthService,
    private readonly fingerprintService: FingerprintService,
  ) {
    super(options, storageService, reflector);
  }

  async getTracker(req: Record<string, any>, context?: ExecutionContext): Promise<string> {
    if (context && this.getRouteThrottlerName(context)) {
      return this.fingerprintService.compute(req as Request);
    }

    return super.getTracker(req);
  }

  async handleRequest(requestProps: any): Promise<boolean> {
    const expectedThrottlerName = this.getRouteThrottlerName(requestProps.context);
    if (!expectedThrottlerName || requestProps.throttler?.name !== expectedThrottlerName) {
      return true;
    }

    if (expectedThrottlerName === 'auth') {
      const { req } = this.getRequestResponse(requestProps.context);
      await this.authService.trackFingerprintRequest(req as Request);
    }

    return super.handleRequest(requestProps);
  }

  private getRouteThrottlerName(context?: ExecutionContext): string | undefined {
    if (!context) {
      return undefined;
    }

    const routeKey = `${context.getClass?.()?.name}.${context.getHandler?.()?.name}`;
    return this.routeThrottlerNames.get(routeKey);
  }
}
