import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';

import { AdminService } from './admin.service';
import {
  AdminLoginDto,
  AdminLoginResponseDto,
  AdminSessionResponseDto,
  AdminVerifyTotpDto,
} from './dto/admin.dto';
import { AdminGuard } from './guards/admin.guard';
import { AdminMasterKeyGuard } from './guards/admin-master-key.guard';
import { AdminAuditInterceptor } from './interceptors/admin-audit.interceptor';
import { AdminUser } from './decorators/admin-user.decorator';
import { AdminDocument } from './schemas/admin.schema';

@Controller('admin')
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  @Post('login')
  @UseGuards(AdminMasterKeyGuard)
  @HttpCode(HttpStatus.OK)
  async login(@Body() dto: AdminLoginDto): Promise<AdminLoginResponseDto> {
    return this.adminService.login(dto);
  }

  @Post('verify-2fa')
  @UseGuards(AdminMasterKeyGuard)
  @HttpCode(HttpStatus.OK)
  async verify2FA(
    @Body() dto: AdminVerifyTotpDto,
  ): Promise<AdminSessionResponseDto> {
    return this.adminService.verifyTotp(dto);
  }

  @Get('me')
  @UseGuards(AdminGuard)
  @UseInterceptors(AdminAuditInterceptor)
  async me(@AdminUser() admin: AdminDocument): Promise<AdminSessionResponseDto['admin']> {
    return {
      id: admin._id.toString(),
      username: admin.username,
      email: admin.email,
      displayName: admin.displayName,
      roles: admin.roles ?? [],
    };
  }
}
