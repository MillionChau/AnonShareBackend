import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type AdminMasterKeyDocument = HydratedDocument<AdminMasterKey>;

@Schema({
  timestamps: true,
  collection: 'admin_master_keys',
})
export class AdminMasterKey {
  @Prop({ required: true, unique: true, index: true })
  keyId: string;

  @Prop({ required: true })
  keyHash: string;

  @Prop({ default: true, index: true })
  isActive: boolean;

  @Prop({ type: Date, default: null })
  lastVerifiedAt: Date | null;

  createdAt: Date;
  updatedAt: Date;
}

export const AdminMasterKeySchema = SchemaFactory.createForClass(AdminMasterKey);

AdminMasterKeySchema.index({ keyId: 1 }, { unique: true });
