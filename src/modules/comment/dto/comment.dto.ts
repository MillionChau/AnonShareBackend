// dto/comment.dto.ts

import {
    IsString,
    IsNotEmpty,
    MaxLength,
    MinLength,
    IsOptional,
    IsMongoId,
    IsNumber,
    IsEnum,
    IsIn,
    Min,
    Max,
} from 'class-validator';
import { Type } from 'class-transformer';

export enum ContentStatus {
    PENDING = 'pending',
    APPROVED = 'approved',
    REJECTED = 'rejected',
}

export class CreateCommentDto {
    @IsString()
    @IsNotEmpty()
    @IsMongoId()
    postId: string;

    @IsOptional()
    @IsString()
    @IsMongoId()
    parentId?: string;

    @IsString()
    @IsNotEmpty()
    @MinLength(1)
    @MaxLength(2000)
    content: string;
}

export class UpdateCommentDto {
    @IsOptional()
    @IsString()
    @MinLength(1)
    @MaxLength(2000)
    content?: string;
}

export class GetCommentsQueryDto {
    @IsOptional()
    @Type(() => Number)
    @IsNumber()
    @Min(1)
    page?: number = 1;

    @IsOptional()
    @Type(() => Number)
    @IsNumber()
    @Min(1)
    @Max(100)
    limit?: number = 20;

    @IsOptional()
    @IsEnum(ContentStatus)
    contentStatus?: ContentStatus;

    @IsOptional()
    @IsMongoId()
    postId?: string;

    @IsOptional()
    @IsIn(['flagged'])
    moderation?: 'flagged';
}

export enum CommentStatus {
  APPROVED = 'approved',
  REJECTED = 'rejected'
}

export class UpdateCommentStatusDto {
  @IsEnum(CommentStatus)
  status: CommentStatus

  @IsOptional()
  @IsString()
  content?: string
}


export class CommentAnalysisDto {
    isSpam: boolean;
    isMalicious: boolean;
    confidence: number;
    moderationSource?: string | null;
    categories: string[];
    moderate: 'REJECTED' | 'FLAGGED' | 'APPROVED';
    sentiment: 'NEGATIVE' | 'NEUTRAL' | 'POSITIVE';
    sentimentConfidence?: number | null;
    sentimentSource?: string | null;
}

export class CommentDto {
    _id: string;
    postId: string;
    parentId: string | null;
    depth: number;
    authorDisplayId: string;
    content: string;
    contentStatus: string;
    rejectionReason: string | null;
    aiAnalysis?: CommentAnalysisDto;
    likeCount: number;
    replyCount: number;
    isLiked: boolean;
    isOwner: boolean;
    replies?: CommentDto[];
    createdAt: Date;
    updatedAt: Date;
}

export class CreateCommentResponseDto {
    comment: CommentDto;
    message: string;
    status: 'published' | 'pending' | 'rejected';
    rejectionReason?: string | null;
}

export class PaginatedCommentsDto {
    data: CommentDto[];
    total: number;
    page: number;
    limit: number;
    hasMore: boolean;
}

export class ToggleLikeCommentDto {
    isLiked: boolean;
    likeCount: number;
}

export class UpdateCommentStatusResponseDto {
    comment: CreateCommentDto
    aiFeedback: any | null
}
