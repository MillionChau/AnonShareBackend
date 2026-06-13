import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  Query,
  HttpCode,
  HttpStatus,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { ReportService } from './report.service';
import { AdminGuard } from '../admin/guards/admin.guard';
import { AdminAuditInterceptor } from '../admin/interceptors/admin-audit.interceptor';
import { AdminUser } from '../admin/decorators/admin-user.decorator';
import { AdminDocument } from '../admin/schemas/admin.schema';
import {
  CreateReportDto,
  GetReportsQueryDto,
  ResolveReportDto,
  ReportDto,
  ReportListDto,
  CreateReportResponseDto,
} from './dto/report.dto';

/**
 * Lưu ý bảo mật:
 * - `reporterDisplayId` / `adminDisplayId` nên lấy từ JWT Guard thay vì URL param.
 * - Các route /admin/** nên bảo vệ bằng RolesGuard.
 */
@Controller('reports')
export class ReportController {
  constructor(private readonly reportService: ReportService) {}

  // ─── User Routes ───────────────────────────────────────────────────────────

  /**
   * POST /reports/:reporterDisplayId
   * Tạo báo cáo mới.
   */
  @Post(':reporterDisplayId')
  @HttpCode(HttpStatus.CREATED)
  async createReport(
    @Param('reporterDisplayId') reporterDisplayId: string,
    @Body() createReportDto: CreateReportDto,
  ): Promise<CreateReportResponseDto> {
    return this.reportService.createReport(reporterDisplayId, createReportDto);
  }

  /**
   * GET /reports/:reporterDisplayId/my
   * Lấy danh sách báo cáo mà user đã gửi.
   *
   * Query: status?, targetType?, page?, limit?
   */
  @Get(':reporterDisplayId/my')
  async getMyReports(
    @Param('reporterDisplayId') reporterDisplayId: string,
    @Query() query: GetReportsQueryDto,
  ): Promise<ReportListDto> {
    return this.reportService.getMyReports(reporterDisplayId, query);
  }

  // ─── Admin Routes ──────────────────────────────────────────────────────────

  /**
   * GET /reports/admin/all
   * Lấy toàn bộ danh sách báo cáo.
   *
   * Query: status?, targetType?, page?, limit?
   */
  @Get('admin/all')
  @UseGuards(AdminGuard)
  @UseInterceptors(AdminAuditInterceptor)
  async getAllReports(
    @Query() query: GetReportsQueryDto,
  ): Promise<ReportListDto> {
    return this.reportService.getAllReports(query);
  }

  /**
   * GET /reports/admin/:reportId
   * Lấy chi tiết một báo cáo.
   */
  @Get('admin/:reportId')
  @UseGuards(AdminGuard)
  @UseInterceptors(AdminAuditInterceptor)
  async getReportById(
    @Param('reportId') reportId: string,
  ): Promise<ReportDto> {
    return this.reportService.getReportById(reportId);
  }

  /**
   * PATCH /reports/admin/:adminDisplayId/review/:reportId
   * Đánh dấu báo cáo đang được xem xét (pending → reviewed).
   */
  @Patch('admin/:adminDisplayId/review/:reportId')
  @UseGuards(AdminGuard)
  @UseInterceptors(AdminAuditInterceptor)
  @HttpCode(HttpStatus.OK)
  async markAsReviewed(
    @AdminUser() admin: AdminDocument,
    @Param('reportId') reportId: string,
  ): Promise<ReportDto> {
    return this.reportService.markAsReviewed(reportId, admin.username);
  }

  /**
   * PATCH /reports/admin/:adminDisplayId/resolve
   * Xử lý báo cáo: resolved hoặc dismissed.
   *
   * Body: { reportId, action: 'resolved' | 'dismissed', adminNote? }
   */
  @Patch('admin/:adminDisplayId/resolve')
  @UseGuards(AdminGuard)
  @UseInterceptors(AdminAuditInterceptor)
  @HttpCode(HttpStatus.OK)
  async resolveReport(
    @AdminUser() admin: AdminDocument,
    @Body() resolveReportDto: ResolveReportDto,
  ): Promise<ReportDto> {
    return this.reportService.resolveReport(admin.username, resolveReportDto);
  }

  /**
   * DELETE /reports/admin/:reportId
   * Xóa vĩnh viễn một báo cáo.
   */
  @Delete('admin/:reportId')
  @UseGuards(AdminGuard)
  @UseInterceptors(AdminAuditInterceptor)
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteReport(
    @Param('reportId') reportId: string,
  ): Promise<void> {
    return this.reportService.deleteReport(reportId);
  }
}
