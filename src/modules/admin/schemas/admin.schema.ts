import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type AdminDocument = HydratedDocument<Admin>;

@Schema({
  timestamps: true,
  collection: 'admins',
})
export class Admin {
  @Prop({ required: true, unique: true, index: true, trim: true, lowercase: true })
  username: string;

  @Prop({ required: true, trim: true, lowercase: true })
  email: string;

  @Prop({ required: true })
  passwordHash: string;

  @Prop({ required: true })
  totpSecret: string;

  @Prop({ default: null })
  displayName: string | null;

  @Prop({ type: [String], default: ['admin'] })
  roles: string[];

  @Prop({ default: true, index: true })
  isActive: boolean;

  @Prop({ type: Date, default: null })
  lastLoginAt: Date | null;

  createdAt: Date;
  updatedAt: Date;
}

export const AdminSchema = SchemaFactory.createForClass(Admin);

AdminSchema.index({ username: 1 }, { unique: true });
AdminSchema.index({ email: 1 });
AdminSchema.index({ isActive: 1, createdAt: -1 });
