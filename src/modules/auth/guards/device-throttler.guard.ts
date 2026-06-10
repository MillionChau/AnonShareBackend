import { Injectable, Logger } from '@nestjs/common';
import {
  InjectThrottlerOptions,
  InjectThrottlerStorage,
  ThrottlerException,
  ThrottlerGuard,
} from '@nestjs/throttler';
import { Reflector } from '@nestjs/core';
import { Request } from 'express';
import { AuthService } from '../auth.service';
import { FingerprintService } from '../fingerprint.service';

@Injectable()
export class DeviceThrottlerGuard extends ThrottlerGuard {
  private readonly logger = new Logger(DeviceThrottlerGuard.name);

  constructor(
    @InjectThrottlerOptions() options: any,
    @InjectThrottlerStorage() storageService: any,
    reflector: Reflector,
    private readonly authService: AuthService,
    private readonly fingerprintService: FingerprintService,
  ) {
    super(options, storageService, reflector);
  }

  async getTracker(req: Record<string, any>, context?: any): Promise<string> {
    const isAnonymousCreateRoute =
      context?.getClass?.()?.name === 'AuthController' &&
      context?.getHandler?.()?.name === 'getAnonymousSession';

    if (isAnonymousCreateRoute) {
      return this.fingerprintService.compute(req as Request);
    }

    return super.getTracker(req);
  }

  async handleRequest(requestProps: any): Promise<boolean> {
    const isAnonymousCreateRoute =
      requestProps.context?.getClass?.()?.name === 'AuthController' &&
      requestProps.context?.getHandler?.()?.name === 'getAnonymousSession';

    if (isAnonymousCreateRoute) {
      const { req } = this.getRequestResponse(requestProps.context);
      await this.authService.trackFingerprintRequest(req as Request);
    }

    return super.handleRequest(requestProps);
  }
}
