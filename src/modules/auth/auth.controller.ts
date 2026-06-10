import {
  Controller,
  Post,
  Req,
  Body,
  HttpCode,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request } from 'express';
import { AuthService } from './auth.service';
import {
  AnonymousSessionDto,
  CreateAnonymousSessionDto,
  LoginAnonymousDto,
} from './dto/auth.dto';
import { Throttle } from '@nestjs/throttler';

@Controller('auth')
export class AuthController {
  private readonly logger = new Logger(AuthController.name);

  constructor(private readonly authService: AuthService) {}

  @Post('anonymous')
  @Throttle({ auth: { ttl: 60_000, limit: 5 } })
  @HttpCode(HttpStatus.OK)
  async getAnonymousSession(
    @Req() req: Request,
    @Body() body: CreateAnonymousSessionDto,
  ): Promise<AnonymousSessionDto> {
    this.logger.log(`Anonymous session request from ${req.ip}`);
    return this.authService.getOrCreateSession(req, body.password);
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  async loginAnonymous(
    @Body() body: LoginAnonymousDto,
  ): Promise<AnonymousSessionDto> {
    this.logger.log(`Anonymous login attempt for ${body.anonymousId}`);
    return this.authService.login(body.anonymousId, body.password);
  }
}
