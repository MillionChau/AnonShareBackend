import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type PostDocument = HydratedDocument<Post>;

@Schema({
  timestamps: true,
  collection: 'posts',
})
export class Post {
  /** Người tạo bài viết (displayId của anonymous user) */
  @Prop({ required: true, index: true })
  authorDisplayId: string;

  /** Nội dung chính của bài viết */
  @Prop({ required: true, maxlength: 5000 })
  content: string;

  /** URL hình ảnh (nếu có) */
  @Prop({ type: [String], default: [] })
  imageUrls: string[];

  /** Trạng thái duyệt nội dung từ AI */
  @Prop({ enum: ['pending', 'approved', 'rejected'], default: 'pending' })
  contentStatus: string;

  /** Lý do từ chối (nếu rejected) */
  @Prop({ type: String, default: null })
  rejectionReason: string | null;

  /** Kết quả phân tích từ AI Service */
  @Prop({ type: Object, default: {} })
  aiAnalysis: {
    isSpam?: boolean;
    isMalicious?: boolean;
    confidence?: number;
    categories?: string[];
    moderate?: 'REJECTED' | 'FLAGGED' | 'APPROVED';
    sentiment?: 'NEGATIVE' | 'NEUTRAL' | 'POSITIVE';
  };

  /** Số lượt thích */
  @Prop({ default: 0 })
  likeCount: number;

  /** Số bình luận */
  @Prop({ default: 0 })
  commentCount: number;

  /** Số lượt xem */
  @Prop({ default: 0 })
  viewCount: number;

  /** Danh sách displayId đã like */
  @Prop({ type: [String], default: [] })
  likedBy: string[];

  /** Cấp độ hiển thị */
  @Prop({ enum: ['public', 'private', 'hidden'], default: 'public' })
  visibility: string;

  /** Bài viết có bị xóa mềm không */
  @Prop({ default: false })
  isDeleted: boolean;

  /** Thời điểm xóa mềm */
  @Prop({ type: Date, default: null })
  deletedAt: Date | null;

  @Prop({ default: null })
  updatedAt: Date | null;

  @Prop({ default: null })
  createdAt: Date | null;
}

export const PostSchema = SchemaFactory.createForClass(Post);

// Index để tối ưu query
PostSchema.index({ authorDisplayId: 1, createdAt: -1 });
PostSchema.index({ contentStatus: 1, isDeleted: 1 });
PostSchema.index({ createdAt: -1 });
