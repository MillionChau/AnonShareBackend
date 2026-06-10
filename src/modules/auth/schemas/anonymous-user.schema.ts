import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type AnonymousUserDocument = HydratedDocument<AnonymousUser>;

@Schema({
  timestamps: true,         
  collection: 'anonymous_users',
})
export class AnonymousUser {
  @Prop({ required: true, unique: true, index: true })
  displayId: string;

  @Prop({ required: true, unique: true, index: true })
  anonymousIdHash: string;

  @Prop({ required: true, unique: true, index: true })
  deviceFingerprint: string;

  @Prop({ required: true })
  passwordHash: string;

  @Prop({ default: 0 })
  postCount: number;

  @Prop({ default: 0 })
  commentCount: number;

  @Prop({ default: 0 })
  authRequestCount: number;

  @Prop({ default: 0 })
  throttleCount: number;

  @Prop({ type: Date, default: null })
  throttleWindowStart: Date | null;

  @Prop({ type: Date, default: null })
  authRequestWindowStart: Date | null;

  @Prop({ type: Date, default: null })
  lastSeenAt: Date | null;

  @Prop({ default: false })
  isBanned: boolean;

  @Prop({ type: Date, default: null })
  bannedAt: Date | null;

  @Prop({ type: String, default: null })
  banReason: string | null;

  createdAt: Date;
  updatedAt: Date;
}

export const AnonymousUserSchema = SchemaFactory.createForClass(AnonymousUser);

AnonymousUserSchema.index({ displayId: 1 }, { unique: true });
AnonymousUserSchema.index({ anonymousIdHash: 1 }, { unique: true });
AnonymousUserSchema.index({ deviceFingerprint: 1 }, { unique: true });
AnonymousUserSchema.index({ isBanned: 1, createdAt: -1 });
