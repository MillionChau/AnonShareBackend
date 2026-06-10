import { Schema, Prop, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type ReportDocument = HydratedDocument<Report>;

@Schema({
    timestamps: true,
    collection: 'reports',
})

export class Report {
    @Prop({ required: true, index: true })
    reporterDisplayId: string;

    @Prop({ required: true, index: true})
    authorId: string;

    @Prop({ required: true, enum: ['post', 'comment'], index: true })
    targetType: string;

    @Prop({ required: true, type: Types.ObjectId, index: true })
    targetId: Types.ObjectId;

    @Prop({ required: true, default: null })
    targetSnapshot: string | null;

    @Prop({
        required: true,
        enum: [
            'spam',
            'hate_speech',
            'violence',
            'harassment',
            'misinformation',
            'inappropriate',
            'other',
        ],
    })
    reason: string;
    @Prop({ type: String, maxlength: 500, default: null })
    description: string | null;

    @Prop({
        enum: ['pending', 'reviewed', 'resolved', 'dismissed'],
        default: 'pending',
        index: true,
    })
    status: string;

    @Prop({ type: String, default: null })
    adminNote: string | null;

    @Prop({ type: Date, default: null })
    resolvedAt: Date | null;

    @Prop({ default: null })
    updatedAt: Date | null;

    @Prop({ default: null })
    createdAt: Date | null;
}

export const ReportSchema = SchemaFactory.createForClass(Report);

ReportSchema.index({ targetType: 1, targetId: 1 });
ReportSchema.index({ status: 1, createdAt: -1 });
ReportSchema.index({ reporterDisplayId: 1, targetId: 1 }, { unique: true });