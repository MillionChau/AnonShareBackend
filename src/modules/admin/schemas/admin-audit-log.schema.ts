import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type AdminAuditLogDocument = HydratedDocument<AdminAuditLog>;

@Schema({
  timestamps: true,
  collection: 'admin_audit_logs',
})
export class AdminAuditLog {
  @Prop({ required: true, index: true })
  adminId: string;

  @Prop({ required: true, index: true })
  username: string;

  @Prop({ required: true, index: true })
  method: string;

  @Prop({ required: true, index: true })
  path: string;

  @Prop({ required: true })
  action: string;

  @Prop({ type: Object, default: {} })
  params: Record<string, unknown>;

  @Prop({ type: Object, default: {} })
  query: Record<string, unknown>;

  @Prop({ type: Object, default: {} })
  body: Record<string, unknown>;

  @Prop({ default: null })
  ip: string | null;

  @Prop({ default: null })
  userAgent: string | null;

  @Prop({ default: null })
  statusCode: number | null;

  @Prop({ default: null })
  errorMessage: string | null;

  @Prop({ default: 0 })
  durationMs: number;
}

export const AdminAuditLogSchema = SchemaFactory.createForClass(AdminAuditLog);

AdminAuditLogSchema.index({ adminId: 1, createdAt: -1 });
AdminAuditLogSchema.index({ path: 1, createdAt: -1 });
