import {
  IsString,
  IsNotEmpty,
  MaxLength,
  MinLength,
  IsOptional,
  IsEnum,
  IsMongoId,
} from 'class-validator';


export enum ReportTargetType {
  POST = 'post',
  COMMENT = 'comment',
}

export enum ReportReason {
  SPAM = 'spam',
  HATE_SPEECH = 'hate_speech',
  VIOLENCE = 'violence',
  HARASSMENT = 'harassment',
  MISINFORMATION = 'misinformation',
  INAPPROPRIATE = 'inappropriate',
  OTHER = 'other',
}

export enum ReportStatus {
  PENDING = 'pending',
  REVIEWED = 'reviewed',
  RESOLVED = 'resolved',
  DISMISSED = 'dismissed',
}

export class CreateReportDto {
  /** Loại đối tượng bị báo cáo */
  @IsEnum(ReportTargetType)
  @IsNotEmpty()
  targetType: ReportTargetType;

  /** ID của bài viết hoặc bình luận bị báo cáo */
  @IsString()
  @IsNotEmpty()
  @IsMongoId()
  targetId: string;

  /** Lý do báo cáo */
  @IsEnum(ReportReason)
  @IsNotEmpty()
  reason: ReportReason;

  /** Mô tả thêm (tùy chọn) */
  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;
}

export class GetReportsQueryDto {
  /** Lọc theo trạng thái */
  @IsOptional()
  @IsEnum(ReportStatus)
  status?: ReportStatus;

  /** Lọc theo loại đối tượng */
  @IsOptional()
  @IsEnum(ReportTargetType)
  targetType?: ReportTargetType;

  @IsOptional()
  page?: number;

  @IsOptional()
  limit?: number;
}

export class ResolveReportDto {
  /** ID báo cáo cần xử lý */
  @IsString()
  @IsNotEmpty()
  @IsMongoId()
  reportId: string;

  /** Kết quả xử lý */
  @IsEnum(['resolved', 'dismissed'])
  @IsNotEmpty()
  action: 'resolved' | 'dismissed';

  /** Ghi chú của admin */
  @IsOptional()
  @IsString()
  @MaxLength(500)
  adminNote?: string;
}

export class ReportDto {
  _id: string;

  /** Anonymous ID người gửi báo cáo */
  reporterDisplayId: string;

  // Tác giả bài viết/ bình luận bị báo cáo
  authorId: string;

  /** Loại đối tượng bị báo cáo */
  targetType: ReportTargetType;

  /** ID đối tượng bị báo cáo */
  targetId: string;

  /** Nội dung snapshot của đối tượng tại thời điểm báo cáo */
  targetSnapshot?: string;

  /** Lý do báo cáo */
  reason: ReportReason;

  /** Mô tả thêm */
  description?: string | null;

  /** Trạng thái xử lý */
  status: ReportStatus;

  /** Ghi chú của admin khi xử lý */
  adminNote?: string | null;

  /** Thời điểm tạo */
  createdAt: Date;

  /** Thời điểm xử lý */
  resolvedAt?: Date | null;
}

export class CreateReportResponseDto {
  report: ReportDto;
  message: string;
}

export class ReportListDto {
  reports: ReportDto[];
  total: number;
  page: number;
  limit: number;
  hasMore: boolean;
}