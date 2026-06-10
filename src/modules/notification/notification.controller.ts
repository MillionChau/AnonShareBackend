import {
  Controller,
  Get,
  Patch,
  Delete,
  Param,
  Body,
  Query,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { NotificationService } from './notification.service';
import {
  GetNotificationsQueryDto,
  MarkNotificationReadDto,
  MarkAllNotificationsReadDto,
  NotificationDto,
  NotificationListDto,
  NotificationBadgeDto,
} from './dto/notification.dto';

/**
 * Tất cả các route đều scoped theo `recipientDisplayId` lấy từ param.
 *
 * Trong thực tế bạn nên lấy `recipientDisplayId` từ JWT / session guard
 * thay vì truyền qua URL để tránh người dùng xem thông báo của nhau.
 * Ví dụ dùng custom decorator: @CurrentUser() user: UserPayload
 * rồi dùng user.displayId thay cho :recipientId.
 */
@Controller('notifications')
export class NotificationController {
  constructor(private readonly notificationService: NotificationService) {}

  // ─── GET /notifications/:recipientId ──────────────────────────────────────
  /**
   * Lấy danh sách thông báo (phân trang, lọc theo status).
   *
   * Query params:
   *   - status?: 'unread' | 'read'
   *   - page?: number  (default 1)
   *   - limit?: number (default 20, max 50)
   */
  @Get(':recipientId')
  async getNotifications(
    @Param('recipientId') recipientId: string,
    @Query() query: GetNotificationsQueryDto,
  ): Promise<NotificationListDto> {
    return this.notificationService.getNotifications(recipientId, query);
  }

  // ─── GET /notifications/:recipientId/badge ────────────────────────────────
  /**
   * Lấy số thông báo chưa đọc để hiển thị badge icon.
   */
  @Get(':recipientId/badge')
  async getBadge(
    @Param('recipientId') recipientId: string,
  ): Promise<NotificationBadgeDto> {
    return this.notificationService.getBadge(recipientId);
  }

  // ─── GET /notifications/:recipientId/:notificationId ──────────────────────
  /**
   * Lấy chi tiết một thông báo.
   */
  @Get(':recipientId/:notificationId')
  async getNotificationById(
    @Param('recipientId') recipientId: string,
    @Param('notificationId') notificationId: string,
  ): Promise<NotificationDto> {
    return this.notificationService.getNotificationById(
      recipientId,
      notificationId,
    );
  }

  // ─── PATCH /notifications/:recipientId/read ───────────────────────────────
  /**
   * Đánh dấu một thông báo là đã đọc.
   *
   * Body: { notificationId: string }
   */
  @Patch(':recipientId/read')
  @HttpCode(HttpStatus.OK)
  async markAsRead(
    @Param('recipientId') recipientId: string,
    @Body() dto: MarkNotificationReadDto,
  ): Promise<NotificationDto> {
    return this.notificationService.markAsRead(recipientId, dto);
  }

  // ─── PATCH /notifications/:recipientId/read-all ───────────────────────────
  /**
   * Đánh dấu TẤT CẢ thông báo chưa đọc là đã đọc.
   *
   * Body: { confirm: true }
   */
  @Patch(':recipientId/read-all')
  @HttpCode(HttpStatus.OK)
  async markAllAsRead(
    @Param('recipientId') recipientId: string,
    @Body() _dto: MarkAllNotificationsReadDto,
  ): Promise<{ updatedCount: number }> {
    return this.notificationService.markAllAsRead(recipientId);
  }

  // ─── DELETE /notifications/:recipientId/:notificationId ───────────────────
  /**
   * Xóa một thông báo.
   */
  @Delete(':recipientId/:notificationId')
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteNotification(
    @Param('recipientId') recipientId: string,
    @Param('notificationId') notificationId: string,
  ): Promise<void> {
    return this.notificationService.deleteNotification(
      recipientId,
      notificationId,
    );
  }

  // ─── DELETE /notifications/:recipientId/read ──────────────────────────────
  /**
   * Xóa tất cả thông báo đã đọc (dọn dẹp inbox).
   */
  @Delete(':recipientId/read')
  @HttpCode(HttpStatus.OK)
  async deleteReadNotifications(
    @Param('recipientId') recipientId: string,
  ): Promise<{ deletedCount: number }> {
    return this.notificationService.deleteReadNotifications(recipientId);
  }
}