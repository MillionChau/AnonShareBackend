import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
  ConflictException,
  ForbiddenException,
  HttpException,
  InternalServerErrorException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';

import { Report, ReportDocument } from './schemas/report.schema';
import {
  ReportTargetType,
  ReportStatus,
  CreateReportDto,
  GetReportsQueryDto,
  ResolveReportDto,
  ReportDto,
  ReportListDto,
  CreateReportResponseDto,
} from './dto/report.dto';
import { NotificationService } from '../notification/notification.service';
import { NotificationType } from '../notification/dto/notification.dto';
import { PostService } from '../post/post.service';
import { CommentService } from '../comment/comment.service';

@Injectable()
export class ReportService {
  private readonly logger = new Logger(ReportService.name);

  constructor(
    @InjectModel(Report.name)
    private readonly reportModel: Model<ReportDocument>,
    private readonly notificationService: NotificationService,
    private readonly postService: PostService,
    private readonly commentService: CommentService,
  ) {}

  // ─── Helpers ───────────────────────────────────────────────────────────────

  private toDto(doc: ReportDocument): ReportDto {
    return {
      _id: (doc._id as Types.ObjectId).toHexString(),
      reporterDisplayId: doc.reporterDisplayId,
      authorId: doc.authorId,
      targetType: doc.targetType as ReportTargetType,
      targetId: doc.targetId.toString(),
      targetSnapshot: doc.targetSnapshot ?? undefined,
      reason: doc.reason as any,
      description: doc.description ?? null,
      status: doc.status as ReportStatus,
      adminNote: doc.adminNote ?? null,
      createdAt: doc.createdAt as Date,
      resolvedAt: doc.resolvedAt ?? null,
    };
  }

  private assertObjectId(id: string, field = 'ID'): void {
    if (!Types.ObjectId.isValid(id)) {
      throw new BadRequestException(`${field} không hợp lệ.`);
    }
  }

  // ─── User Actions ──────────────────────────────────────────────────────────
  async createReport(
    reporterDisplayId: string,
    dto: CreateReportDto,
  ): Promise<CreateReportResponseDto> {
    const { targetType, targetId, reason, description } = dto;

    try {
      // 1. Fetch target
      let authorId: string;
      let targetSnapshot: string;

      if (targetType === ReportTargetType.POST) {
        const post = await this.postService.getPostById(
          targetId,
          undefined,
          { allowNonApproved: true },
        );
        if (!post) throw new NotFoundException('Bài viết không tồn tại.');
        authorId = post.authorDisplayId;
        targetSnapshot = post.content;
      } else {
        const comment = await this.commentService.getCommentById(
          targetId,
          undefined,
          { allowNonApproved: true },
        );
        if (!comment) throw new NotFoundException('Bình luận không tồn tại.');
        authorId = comment.authorDisplayId;
        targetSnapshot = comment.content;
      }

      // 2. Không tự báo cáo mình
      if (authorId === reporterDisplayId) {
        throw new BadRequestException(
          'Bạn không thể báo cáo nội dung của chính mình.',
        );
      }

      // 3. Tạo report
      const report = await this.reportModel.create({
        reporterDisplayId,
        authorId,
        targetId: new Types.ObjectId(targetId),
        targetType,
        targetSnapshot,
        reason,
        description: description ?? null,
        status: ReportStatus.PENDING,
      });

      this.logger.log(
        `Report created: ${report._id} by ${reporterDisplayId} → ${targetType}:${targetId}`,
      );

      // 4. Thông báo tác giả (fire-and-forget)
      void this.notificationService.createNotification({
        recipientDisplayId: authorId,
        type: NotificationType.SYSTEM,
        title: 'Nội dung của bạn bị báo cáo',
        body: `${targetType === ReportTargetType.POST ? 'Bài viết' : 'Bình luận'} của bạn vừa bị báo cáo.`,
        metadata: {
          reportId: (report._id as Types.ObjectId).toHexString(),
          targetId,
          targetType,
          reason,
        },
      });

      const reportDto = this.toDto(report);
      this.notificationService.emitAdminEvent('report:created', reportDto);
      this.notificationService.emitPostEvent(targetId, 'report:created', reportDto);

      return {
        report: reportDto,
        message: 'Báo cáo đã gửi thành công!',
      };
    } catch (error) {
      this.logger.error('Failed to create report', error);

      if ((error as any)?.code === 11000) {
        throw new ConflictException('Bạn đã báo cáo nội dung này rồi.');
      }

      if (error instanceof HttpException) throw error;
      throw new InternalServerErrorException('Không thể tạo báo cáo.');
    }
  }

  /**
   * Lấy danh sách báo cáo mà user đã gửi (phân trang).
   */
  async getMyReports(
    reporterDisplayId: string,
    query: GetReportsQueryDto,
  ): Promise<ReportListDto> {
    const page = Math.max(1, Number(query.page) || 1);
    const limit = Math.min(50, Math.max(1, Number(query.limit) || 20));
    const skip = (page - 1) * limit;

    const filter: Record<string, unknown> = { reporterDisplayId };
    if (query.status) filter.status = query.status;
    if (query.targetType) filter.targetType = query.targetType;

    const [docs, total] = await Promise.all([
      this.reportModel
        .find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean<ReportDocument[]>(),
      this.reportModel.countDocuments(filter),
    ]);

    return {
      reports: docs.map((d) => this.toDto(d as unknown as ReportDocument)),
      total,
      page,
      limit,
      hasMore: skip + docs.length < total,
    };
  }

  // ─── Admin Actions ─────────────────────────────────────────────────────────

  /**
   * Lấy toàn bộ danh sách báo cáo (admin, phân trang).
   */
  async getAllReports(query: GetReportsQueryDto): Promise<ReportListDto> {
    const page = Math.max(1, Number(query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(query.limit) || 20));
    const skip = (page - 1) * limit;

    const filter: Record<string, unknown> = {};
    if (query.status) filter.status = query.status;
    if (query.targetType) filter.targetType = query.targetType;

    const [docs, total] = await Promise.all([
      this.reportModel
        .find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean<ReportDocument[]>(),
      this.reportModel.countDocuments(filter),
    ]);

    return {
      reports: docs.map((d) => this.toDto(d as unknown as ReportDocument)),
      total,
      page,
      limit,
      hasMore: skip + docs.length < total,
    };
  }

  /**
   * Lấy chi tiết một báo cáo theo _id (admin).
   */
  async getReportById(reportId: string): Promise<ReportDto> {
    this.assertObjectId(reportId, 'Report ID');

    const doc = await this.reportModel.findById(reportId).exec();
    if (!doc) throw new NotFoundException('Không tìm thấy báo cáo.');

    return this.toDto(doc);
  }

  /**
   * Chuyển báo cáo sang trạng thái "reviewed" (admin đang xem xét).
   */
  async markAsReviewed(
    reportId: string,
    adminDisplayId: string,
  ): Promise<ReportDto> {
    this.assertObjectId(reportId, 'Report ID');

    const doc = await this.reportModel
      .findOneAndUpdate(
        { _id: reportId, status: ReportStatus.PENDING },
        { $set: { status: ReportStatus.REVIEWED } },
        { new: true },
      )
      .exec();

    if (!doc) {
      throw new NotFoundException(
        'Không tìm thấy báo cáo ở trạng thái pending.',
      );
    }

    this.logger.log(
      `Report ${reportId} marked as reviewed by admin ${adminDisplayId}`,
    );

    const reportDto = this.toDto(doc);
    this.notificationService.emitAdminEvent('report:reviewed', reportDto);

    return reportDto;
  }

  /**
   * Xử lý báo cáo: resolved hoặc dismissed (admin).
   * Gửi thông báo REPORT_RESOLVED cho tác giả bị báo cáo.
   */
  async resolveReport(
    adminDisplayId: string,
    dto: ResolveReportDto,
  ): Promise<ReportDto> {
    this.assertObjectId(dto.reportId, 'Report ID');

    const doc = await this.reportModel.findById(dto.reportId).exec();
    if (!doc) throw new NotFoundException('Không tìm thấy báo cáo.');

    if (
      doc.status === ReportStatus.RESOLVED ||
      doc.status === ReportStatus.DISMISSED
    ) {
      throw new BadRequestException('Báo cáo này đã được xử lý trước đó.');
    }

    doc.status = dto.action as ReportStatus;
    doc.adminNote = dto.adminNote ?? null;
    doc.resolvedAt = new Date();
    await doc.save();

    this.logger.log(
      `Report ${dto.reportId} ${dto.action} by admin ${adminDisplayId}`,
    );

    // Thông báo cho tác giả bị báo cáo
    void this.notificationService.createNotification({
      recipientDisplayId: doc.authorId,
      type: NotificationType.REPORT_RESOLVED,
      title:
        dto.action === 'resolved'
          ? 'Báo cáo về nội dung của bạn đã được xử lý'
          : 'Báo cáo về nội dung của bạn đã bị bác bỏ',
      body: dto.adminNote ?? 'Nội dung của bạn đã được admin xem xét.',
      metadata: {
        reportId: dto.reportId,
        targetId: doc.targetId.toString(),
        targetType: doc.targetType,
        action: dto.action,
      },
    });

    const reportDto = this.toDto(doc);
    this.notificationService.emitAdminEvent('report:resolved', reportDto);
    this.notificationService.emitPostEvent(
      doc.targetId.toString(),
      'report:resolved',
      reportDto,
    );

    return reportDto;
  }

  /**
   * Xóa vĩnh viễn một báo cáo (admin).
   */
  async deleteReport(reportId: string): Promise<void> {
    this.assertObjectId(reportId, 'Report ID');

    const result = await this.reportModel
      .deleteOne({ _id: reportId })
      .exec();

    if (result.deletedCount === 0) {
      throw new NotFoundException('Không tìm thấy báo cáo.');
    }

    this.notificationService.emitAdminEvent('report:deleted', { reportId });
  }
}
