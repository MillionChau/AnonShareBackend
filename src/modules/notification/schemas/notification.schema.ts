import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type NotificationDocument = HydratedDocument<Notification>;

@Schema({
  timestamps: true,
  collection: 'notifications',
})
export class Notification {
  /** Anonymous display ID người nhận thông báo */
  @Prop({ required: true, index: true })
  recipientDisplayId: string;

  /** Loại thông báo */
  @Prop({
    required: true,
    enum: [
      'content_rejected',
      'content_approved',
      'new_comment',
      'report_resolved',
      'remove_request',
      'system',
    ],
    index: true,
  })
  type: string;

  /** Tiêu đề hiển thị */
  @Prop({ required: true, maxlength: 200 })
  title: string;

  /** Nội dung thông báo */
  @Prop({ required: true, maxlength: 1000 })
  body: string;

  /** Trạng thái đã đọc */
  @Prop({ enum: ['unread', 'read'], default: 'unread', index: true })
  status: string;

  @Prop({ type: Object, default: {} })
  metadata: Record<string, unknown>;

  /** Thời điểm người dùng đọc thông báo */
  @Prop({ type: Date, default: null })
  readAt: Date | null;

  @Prop({ default: null })
  updatedAt: Date | null;

  @Prop({ default: null })
  createdAt: Date | null;
}

export const NotificationSchema = SchemaFactory.createForClass(Notification);

NotificationSchema.index({ recipientDisplayId: 1, createdAt: -1 });
NotificationSchema.index({ recipientDisplayId: 1, status: 1 });
NotificationSchema.index({ type: 1, createdAt: -1 });