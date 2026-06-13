import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Notification, NotificationDocument } from './schemas/notification.schema';
import {
  GetNotificationsQueryDto,
  MarkNotificationReadDto,
  NotificationDto,
  NotificationListDto,
  NotificationBadgeDto,
  NotificationStatus,
  NotificationType,
} from './dto/notification.dto';
import { NotificationGateway } from './notification.gateway';

@Injectable()
export class NotificationService {
  constructor(
    @InjectModel(Notification.name)
    private readonly notificationModel: Model<NotificationDocument>,
    private readonly notificationGateway: NotificationGateway,
  ) {}

  // ─── Helpers ───────────────────────────────────────────────────────────────

  private toDto(doc: NotificationDocument): NotificationDto {
    return {
      notificationId: (doc._id as Types.ObjectId).toHexString(),
      recipientDisplayId: doc.recipientDisplayId,
      type: doc.type as NotificationType,
      title: doc.title,
      body: doc.body,
      status: doc.status as NotificationStatus,
      metadata: doc.metadata ?? {},
      createdAt: doc.createdAt as Date,
      readAt: doc.readAt ?? null,
    };
  }

  // ─── Queries ───────────────────────────────────────────────────────────────

  /**
   * Lấy danh sách thông báo của một người dùng (phân trang, lọc theo status).
   */
  async getNotifications(
    recipientDisplayId: string,
    query: GetNotificationsQueryDto,
  ): Promise<NotificationListDto> {
    const page = Math.max(1, Number(query.page) || 1);
    const limit = Math.min(50, Math.max(1, Number(query.limit) || 20));
    const skip = (page - 1) * limit;

    const filter: Record<string, unknown> = { recipientDisplayId };
    if (query.status) {
      filter.status = query.status;
    }

    const [docs, total, unreadCount] = await Promise.all([
      this.notificationModel
        .find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean<NotificationDocument[]>()
        .exec(),
      this.notificationModel.countDocuments(filter).exec(),
      this.notificationModel
        .countDocuments({ recipientDisplayId, status: NotificationStatus.UNREAD })
        .exec(),
    ]);

    return {
      notifications: docs.map((d) => this.toDto(d as unknown as NotificationDocument)),
      total,
      unreadCount,
      page,
      limit,
      hasMore: skip + docs.length < total,
    };
  }

  /**
   * Lấy số thông báo chưa đọc (dùng cho badge icon).
   */
  async getBadge(recipientDisplayId: string): Promise<NotificationBadgeDto> {
    const unreadCount = await this.notificationModel
      .countDocuments({ recipientDisplayId, status: NotificationStatus.UNREAD })
      .exec();

    return { unreadCount };
  }

  /**
   * Lấy chi tiết một thông báo theo ID.
   */
  async getNotificationById(
    recipientDisplayId: string,
    notificationId: string,
  ): Promise<NotificationDto> {
    this.assertObjectId(notificationId);

    const doc = await this.notificationModel
      .findOne({ _id: notificationId, recipientDisplayId })
      .exec();

    if (!doc) {
      throw new NotFoundException('Không tìm thấy thông báo.');
    }

    return this.toDto(doc);
  }

  // ─── Mutations ─────────────────────────────────────────────────────────────

  /**
   * Đánh dấu một thông báo là đã đọc.
   */
  async markAsRead(
    recipientDisplayId: string,
    dto: MarkNotificationReadDto,
  ): Promise<NotificationDto> {
    const doc = await this.notificationModel
      .findOneAndUpdate(
        { _id: dto.notificationId, recipientDisplayId },
        {
          $set: {
            status: NotificationStatus.READ,
            readAt: new Date(),
          },
        },
        { new: true },
      )
      .exec();

    if (!doc) {
      throw new NotFoundException('Không tìm thấy thông báo.');
    }

    return this.toDto(doc);
  }

  /**
   * Đánh dấu tất cả thông báo chưa đọc của user là đã đọc.
   */
  async markAllAsRead(recipientDisplayId: string): Promise<{ updatedCount: number }> {
    const result = await this.notificationModel
      .updateMany(
        { recipientDisplayId, status: NotificationStatus.UNREAD },
        {
          $set: {
            status: NotificationStatus.READ,
            readAt: new Date(),
          },
        },
      )
      .exec();

    return { updatedCount: result.modifiedCount };
  }

  /**
   * Xóa một thông báo.
   */
  async deleteNotification(
    recipientDisplayId: string,
    notificationId: string,
  ): Promise<void> {
    this.assertObjectId(notificationId);

    const result = await this.notificationModel
      .deleteOne({ _id: notificationId, recipientDisplayId })
      .exec();

    if (result.deletedCount === 0) {
      throw new NotFoundException('Không tìm thấy thông báo.');
    }
  }

  /**
   * Xóa tất cả thông báo đã đọc của user.
   */
  async deleteReadNotifications(
    recipientDisplayId: string,
  ): Promise<{ deletedCount: number }> {
    const result = await this.notificationModel
      .deleteMany({ recipientDisplayId, status: NotificationStatus.READ })
      .exec();

    return { deletedCount: result.deletedCount };
  }

  // ─── Internal / Admin ──────────────────────────────────────────────────────

  /**
   * Tạo thông báo mới (gọi nội bộ từ các module khác hoặc admin).
   */
  async createNotification(payload: {
    recipientDisplayId: string;
    type: NotificationType;
    title: string;
    body: string;
    metadata?: Record<string, unknown>;
  }): Promise<NotificationDto> {
    const doc = await this.notificationModel.create({
      recipientDisplayId: payload.recipientDisplayId,
      type: payload.type,
      title: payload.title,
      body: payload.body,
      metadata: payload.metadata ?? {},
      status: NotificationStatus.UNREAD,
      readAt: null,
    });

    const dto = this.toDto(doc)

    this.notificationGateway.sendToUser(payload.recipientDisplayId, dto)

    return dto
  }

  // ─── Private Utils ─────────────────────────────────────────────────────────

  emitFeedEvent(event: string, payload: unknown): void {
    this.notificationGateway.emitFeedEvent(event, payload);
  }

  emitPostEvent(postId: string, event: string, payload: unknown): void {
    this.notificationGateway.emitPostEvent(postId, event, payload);
  }

  emitAdminEvent(event: string, payload: unknown): void {
    this.notificationGateway.emitAdminEvent(event, payload);
  }

  private assertObjectId(id: string): void {
    if (!Types.ObjectId.isValid(id)) {
      throw new BadRequestException('ID thông báo không hợp lệ.');
    }
  }
}
