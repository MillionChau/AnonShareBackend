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
} from '@nestjs/common';
import { ReportService } from './report.service';
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
  @HttpCode(HttpStatus.OK)
  async markAsReviewed(
    @Param('adminDisplayId') adminDisplayId: string,
    @Param('reportId') reportId: string,
  ): Promise<ReportDto> {
    return this.reportService.markAsReviewed(reportId, adminDisplayId);
  }

  /**
   * PATCH /reports/admin/:adminDisplayId/resolve
   * Xử lý báo cáo: resolved hoặc dismissed.
   *
   * Body: { reportId, action: 'resolved' | 'dismissed', adminNote? }
   */
  @Patch('admin/:adminDisplayId/resolve')
  @HttpCode(HttpStatus.OK)
  async resolveReport(
    @Param('adminDisplayId') adminDisplayId: string,
    @Body() resolveReportDto: ResolveReportDto,
  ): Promise<ReportDto> {
    return this.reportService.resolveReport(adminDisplayId, resolveReportDto);
  }

  /**
   * DELETE /reports/admin/:reportId
   * Xóa vĩnh viễn một báo cáo.
   */
  @Delete('admin/:reportId')
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteReport(
    @Param('reportId') reportId: string,
  ): Promise<void> {
    return this.reportService.deleteReport(reportId);
  }
}