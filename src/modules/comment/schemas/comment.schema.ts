import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type CommentDocument = HydratedDocument<Comment>;

@Schema({
  timestamps: true,
  collection: 'comments',
})
export class Comment {
  @Prop({ required: true, type: Types.ObjectId, ref: 'Post', index: true })
  postId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Comment', default: null, index: true })
  parentId: Types.ObjectId | null;

  @Prop({ type: Number, default: 0 })
  depth: number;

  @Prop({ required: true, index: true })
  authorDisplayId: string;

  @Prop({ required: true, maxlength: 2000 })
  content: string;

  @Prop({ enum: ['pending', 'approved', 'rejected'], default: 'pending' })
  contentStatus: string;

  @Prop({ type: String, default: null })
  rejectionReason: string | null;

  @Prop({ type: Object, default: {} })
  aiAnalysis: {
    isSpam?: boolean;
    isMalicious?: boolean;
    confidence?: number;
    moderationSource?: string | null;
    categories?: string[];
    moderate?: 'REJECTED' | 'FLAGGED' | 'APPROVED';
    sentiment?: 'NEGATIVE' | 'NEUTRAL' | 'POSITIVE';
    sentimentConfidence?: number | null;
    sentimentSource?: string | null;
  };

  @Prop({ default: 0 })
  likeCount: number;

  @Prop({ type: [String], default: [] })
  likedBy: string[];

  @Prop({ default: 0 })
  replyCount: number;

  @Prop({ default: false })
  isDeleted: boolean;

  @Prop({ type: Date, default: null })
  deletedAt: Date | null;

  @Prop({ type: String, default: null })
  deletedBy: string | null;
}

export const CommentSchema = SchemaFactory.createForClass(Comment);

CommentSchema.index({ postId: 1, parentId: 1, createdAt: -1 });
CommentSchema.index({ parentId: 1, createdAt: 1 });
CommentSchema.index({ authorDisplayId: 1, createdAt: -1 });
CommentSchema.index({ contentStatus: 1, isDeleted: 1 });
