import {
  IsString,
  IsNotEmpty,
  MaxLength,
  MinLength,
  IsOptional,
  IsEnum,
  IsMongoId,
} from 'class-validator';

export enum NotificationType {
  /** Bài viết / bình luận của bạn bị từ chối bởi AI */
  CONTENT_REJECTED = 'content_rejected',

  /** Bài viết / bình luận được duyệt sau khi chờ */
  CONTENT_APPROVED = 'content_approved',

  /** Bình luận của người khác được đăng vào bài viết của bạn */
  NEW_COMMENT = 'new_comment',

  /** Báo cáo của bạn đã được admin xử lý */
  REPORT_RESOLVED = 'report_resolved',

  /** Admin yêu cầu bạn xóa nội dung */
  REMOVE_REQUEST = 'remove_request',

  /** Thông báo hệ thống tổng quát */
  SYSTEM = 'system',
}

export enum NotificationStatus {
  UNREAD = 'unread',
  READ = 'read',
}

// ─── Request DTOs ─────────────────────────────────────────────────────────────

export class GetNotificationsQueryDto {
  /** Lọc theo trạng thái đã đọc / chưa đọc */
  @IsOptional()
  @IsEnum(NotificationStatus)
  status?: NotificationStatus;

  @IsOptional()
  page?: number;

  @IsOptional()
  limit?: number;
}

export class MarkNotificationReadDto {
  /** ID thông báo cần đánh dấu đã đọc */
  @IsString()
  @IsNotEmpty()
  @IsMongoId()
  notificationId: string;
}

export class MarkAllNotificationsReadDto {
  /** Xác nhận đánh dấu tất cả (phòng call nhầm) */
  confirm: true;
}

// ─── Response DTOs ────────────────────────────────────────────────────────────

export class NotificationDto {
  notificationId: string;

  /** Anonymous ID người nhận thông báo */
  recipientDisplayId: string;

  /** Loại thông báo */
  type: NotificationType;

  /** Tiêu đề hiển thị */
  title: string;

  /** Nội dung thông báo */
  body: string;

  /** Trạng thái đã đọc */
  status: NotificationStatus;

  /**
   * Metadata liên quan đến thông báo, ví dụ:
   * { postId, commentId, reportId, rejectionReason }
   */
  metadata?: Record<string, unknown>;

  /** Thời điểm tạo */
  createdAt: Date;

  /** Thời điểm đọc */
  readAt?: Date | null;
}

export class NotificationListDto {
  notifications: NotificationDto[];
  total: number;
  unreadCount: number;
  page: number;
  limit: number;
  hasMore: boolean;
}

export class NotificationBadgeDto {
  /** Số thông báo chưa đọc (dùng cho badge icon) */
  unreadCount: number;
}