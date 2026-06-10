import {
  IsString,
  IsNotEmpty,
  MaxLength,
  MinLength,
  IsOptional,
  IsArray,
  IsUrl,
  IsEnum,
} from 'class-validator';

// ─── Request DTOs ────────────────────────────────────────────────────────────

export class CreatePostDto {
  @IsString()
  @IsNotEmpty()
  @MinLength(1)
  @MaxLength(5000)
  content: string;

  @IsOptional()
  @IsArray()
  @IsUrl({}, { each: true })
  imageUrls?: string[];

  @IsOptional()
  @IsEnum(['public', 'private', 'hidden'])
  visibility?: string = 'public';
}

export class UpdatePostDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(5000)
  content?: string;

  @IsOptional()
  @IsArray()
  @IsUrl({}, { each: true })
  imageUrls?: string[];

  @IsOptional()
  @IsEnum(['public', 'private', 'hidden'])
  visibility?: string;
}

export enum PostStatus {
  APPROVED = 'approved',
  REJECTED = 'rejected'
}

export class UpdatePostStatusDto {
  @IsEnum(PostStatus)
  status: PostStatus

  @IsOptional()
  @IsString()
  content?: string
}

// ─── Response DTOs ───────────────────────────────────────────────────────────

export class PostResponseDto {
  _id: string;
  authorDisplayId: string;
  content: string;
  imageUrls: string[];
  contentStatus: string;
  aiAnalysis?: PostAnalysisDto;
  likeCount: number;
  commentCount: number;
  viewCount: number;
  isLiked: boolean; 
  visibility: string;
  createdAt: Date;
  updatedAt: Date;
}

export class CreatePostResponseDto {
  _id: string;
  authorDisplayId: string;
  content: string;
  imageUrls: string[];
  contentStatus: string;
  visibility: string;
  createdAt: Date;
  message: string;
}

export class PaginatedPostsDto {
  data: PostResponseDto[];
  total: number;
  page: number;
  limit: number;
  hasMore: boolean;
}

export class PostAnalysisDto {
  isSpam: boolean;
  isMalicious: boolean;
  confidence: number;
  categories: string[];
  moderate: 'REJECTED' | 'FLAGGED' | 'APPROVED';
  sentiment: 'NEGATIVE' | 'NEUTRAL' | 'POSITIVE';
}

export class UpdatePostStatusResponseDto {
  post: PostResponseDto;
  aiFeedback: any | null;
}