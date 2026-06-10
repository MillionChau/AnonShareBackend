import {
  Injectable,
  BadRequestException,
  NotFoundException,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { ConfigService } from '@nestjs/config';
import axios, { AxiosError } from 'axios';

import { Post, PostDocument } from './schemas/post.schema';
import {
  CreatePostDto,
  UpdatePostDto,
  PostResponseDto,
  PaginatedPostsDto,
  PostAnalysisDto,
  UpdatePostStatusResponseDto,
  UpdatePostStatusDto,
  PostStatus
} from './dto/post.dto';
import { NotificationService } from '../notification/notification.service';
import { NotificationType } from '../notification/dto/notification.dto';

@Injectable()
export class PostService {
  private readonly logger = new Logger(PostService.name);
  private readonly aiServiceUrl: string;
  private readonly aiTimeout: number;

  constructor(
    @InjectModel(Post.name)
    private readonly postModel: Model<PostDocument>,

    private readonly notificationService: NotificationService,
    private readonly configService: ConfigService,
  ) {
    const configuredUrl = this.configService.get<string>('ai.url');
    this.aiServiceUrl = configuredUrl?.trim() ?? '';
    if (!this.aiServiceUrl) {
      this.logger.error(
        'AI service URL is not configured. Please set AI_SERVICE_URL in .env and ensure ConfigModule loads aiConfig.',
      );
      throw new Error('AI service URL is required');
    }

    this.aiTimeout =
      this.configService.get<number>('ai.timeout') ??
      10000;
  }

  /**
   * Tạo bài viết mới
   * 1. Gọi AI Service để phân tích nội dung
   * 2. Lưu vào database với trạng thái từ AI
   */
  async createPost(
    authorDisplayId: string,
    createPostDto: CreatePostDto,
  ): Promise<PostResponseDto> {
    try {
      // Validate input
      if (!createPostDto.content || createPostDto.content.trim().length === 0) {
        throw new BadRequestException('Nội dung bài viết không được để trống');
      }

      // Gọi AI Service để phân tích nội dung và chờ kết quả trước khi tạo post
      const aiAnalysis = await this.analyzeContentWithAI(
        createPostDto.content,
        authorDisplayId,
      );

      const contentStatus =
        aiAnalysis.moderate === 'REJECTED'
          ? 'rejected'
          : aiAnalysis.moderate === 'APPROVED'
            ? 'approved'
            : 'pending';

      if (contentStatus === 'rejected') {
        await this.notificationService.createNotification({
          recipientDisplayId: authorDisplayId,
          type: NotificationType.SYSTEM,
          title: 'Đăng bài viết thành công!',
          body: 'Bài viết của bạn đã được chấp nhận bởi AI'
        })
      } else {
        await this.notificationService.createNotification({
          recipientDisplayId: authorDisplayId,
          type: NotificationType.SYSTEM,
          title: 'Nội dung của bạn không được chấp nhận!',
          body: 'Bài viết của bạn đã bị từ chối bởi AI'
        })
      }

      // Tạo bài viết
      const post = await this.postModel.create({
        authorDisplayId,
        content: createPostDto.content.trim(),
        imageUrls: createPostDto.imageUrls || [],
        visibility: createPostDto.visibility || 'public',
        contentStatus,
        aiAnalysis: aiAnalysis ?? {},
        likeCount: 0,
        commentCount: 0,
        viewCount: 0,
      });

      this.logger.log(
        `Post created: ${post._id} by ${authorDisplayId} with status ${contentStatus}`,
      );

      return this.formatPostResponse(post);
    } catch (error: any) {
      this.logger.error(`Failed to create post: ${error?.message || String(error)}`, error?.stack);
      throw error;
    }
  }

  /**
   * Lấy danh sách bài viết với phân trang
   */
  async getPosts(
    page: number = 1,
    limit: number = 10,
    status?: string | string[],
    visibility?: string | string[],
  ): Promise<PaginatedPostsDto> {
    try {
      page = Math.max(1, page);
      limit = Math.max(1, Math.min(limit, 100));
      const skip = (page - 1) * limit;

      const query: Record<string, any> = {
        isDeleted: false,
      };

      // Nếu không truyền status thì mặc định lấy approved
      if (status) {
        query.contentStatus = Array.isArray(status)
          ? { $in: status }
          : status;
      } else {
        query.contentStatus = 'approved';
      }

      if (visibility) {
        query.visibility = Array.isArray(visibility)
          ? { $in: visibility }
          : visibility;
      } else {
        query.visibility = { $in: ['public', 'private'] };
      }

      const [posts, total] = await Promise.all([
        this.postModel
          .find(query)
          .sort({ createdAt: -1 })
          .skip(skip)
          .limit(limit)
          .lean(),
        this.postModel.countDocuments(query),
      ]);

      const data = posts.map((post) =>
        this.formatPostResponse(post as any),
      );

      return {
        data,
        total,
        page,
        limit,
        hasMore: skip + limit < total,
      };
    } catch (error: any) {
      this.logger.error(`Failed to get posts: ${error?.message || String(error)}`);
      throw error;
    }
  }

  /**
   * Lấy bài viết theo ID
   */
  async getPostById(
    postId: string,
  ): Promise<PostResponseDto> {
    try {
      // Validate MongoDB ObjectId
      if (!Types.ObjectId.isValid(postId)) {
        throw new BadRequestException('Invalid post ID format');
      }

      const post = await this.postModel.findById(postId);

      if (!post) {
        throw new NotFoundException('Bài viết không tìm thấy');
      }

      if (post.isDeleted) {
        throw new NotFoundException('Bài viết đã bị xóa');
      }

      // Tăng view count (không await, chạy background)
      this.incrementViewCount(postId);

      return this.formatPostResponse(post);
    } catch (error: any) {
      this.logger.error(`Failed to get post ${postId}: ${error?.message || String(error)}`);
      throw error;
    }
  }

  /**
   * Lấy bài viết của một người dùng
   */
  async getUserPosts(
    authorDisplayId: string,
    page: number = 1,
    limit: number = 10,
    currentUserDisplayId?: string,
  ): Promise<PaginatedPostsDto> {
    try {
      page = Math.max(1, page);
      limit = Math.max(1, Math.min(limit, 100));
      const skip = (page - 1) * limit;

      const query = {
        authorDisplayId,
        isDeleted: false,
        contentStatus: 'approved',
      };

      const [posts, total] = await Promise.all([
        this.postModel
          .find(query)
          .sort({ createdAt: -1 })
          .skip(skip)
          .limit(limit)
          .lean(),
        this.postModel.countDocuments(query),
      ]);

      const data = posts.map((post) =>
        this.formatPostResponse(post as any),
      );

      return {
        data,
        total,
        page,
        limit,
        hasMore: skip + limit < total,
      };
    } catch (error: any) {
      this.logger.error(
        `Failed to get posts for ${authorDisplayId}: ${error?.message || String(error)}`,
      );
      throw error;
    }
  }

  /**
   * Cập nhật bài viết
   */
  async updatePost(
    postId: string,
    authorDisplayId: string,
    updatePostDto: UpdatePostDto,
  ): Promise<PostResponseDto> {
    try {
      if (!Types.ObjectId.isValid(postId)) {
        throw new BadRequestException('Invalid post ID format');
      }

      const post = await this.postModel.findById(postId);

      if (!post) {
        throw new NotFoundException('Bài viết không tìm thấy');
      }

      // Chỉ author mới được edit
      if (post.authorDisplayId !== authorDisplayId) {
        throw new HttpException(
          'Bạn không có quyền chỉnh sửa bài viết này',
          HttpStatus.FORBIDDEN,
        );
      }

      if (post.isDeleted) {
        throw new BadRequestException('Không thể chỉnh sửa bài viết đã xóa');
      }

      // Update fields
      if (updatePostDto.content) {
        post.content = updatePostDto.content.trim();
      }
      if (updatePostDto.imageUrls) {
        post.imageUrls = updatePostDto.imageUrls;
      }
      if (updatePostDto.visibility) {
        post.visibility = updatePostDto.visibility;
      }

      const aiAnalysis = await this.analyzeContentWithAI(
        updatePostDto.content,
        authorDisplayId,
      );

      const contentStatus =
        aiAnalysis.moderate === 'REJECTED'
          ? 'rejected'
          : aiAnalysis.moderate === 'APPROVED'
            ? 'approved'
            : 'pending';

      if (contentStatus === 'rejected') {
        await this.notificationService.createNotification({
          recipientDisplayId: authorDisplayId,
          type: NotificationType.SYSTEM,
          title: 'Đăng bài viết thành công!',
          body: 'Bài viết của bạn đã được chấp nhận bởi AI'
        })
      } else {
        await this.notificationService.createNotification({
          recipientDisplayId: authorDisplayId,
          type: NotificationType.SYSTEM,
          title: 'Nội dung của bạn không được chấp nhận!',
          body: 'Bài viết của bạn đã bị từ chối bởi AI'
        })
      }

      post.contentStatus = contentStatus
      post.aiAnalysis = aiAnalysis

      await post.save();

      this.logger.log(`Post ${postId} updated by ${authorDisplayId}`);

      return this.formatPostResponse(post);
    } catch (error: any) {
      this.logger.error(`Failed to update post ${postId}: ${error?.message || String(error)}`);
      throw error;
    }
  }

  async updatePostStatus(
    postId: string,
    dto: UpdatePostStatusDto
  ): Promise<UpdatePostStatusResponseDto> {
    if (!Types.ObjectId.isValid(postId)) {
      throw new BadRequestException('Invalid post Id format')
    }

    const post = await this.postModel.findById(postId)

    if (!post) {
      throw new NotFoundException('Bài viết không tìm thấy')
    }

    post.contentStatus = dto.status
    await post.save()

    this.logger.log(`Post: ${postId} status update to ${dto.status}`)

    const aiFeedback = await this.sendFeedbackToAI(
      postId,
      dto.content ?? post.content,
      dto.status,
    )

    return {
      post: this.formatPostResponse(post),
      aiFeedback,
    }
  }

  private async sendFeedbackToAI(
    postId: string,
    content: string,
    status: PostStatus,
  ): Promise<any | null> {
    const endpoint = `${this.aiServiceUrl.replace(/\/+$/, '')}/ai/feedback/learn`;
    this.logger.log(`Sending AI feedback: ${endpoint} | postId=${postId} | label=${status}`);

    const sentimentMap: Record<PostStatus, string> = {
      [PostStatus.APPROVED]: 'APPROVED',
      [PostStatus.REJECTED]: 'REJECTED'
    };

    try {
      const response = await axios.post(
        endpoint,
        {
          content,
          human_label: sentimentMap[status],
          type: 'moderation',
        },
        {
          timeout: this.aiTimeout,
          headers: { 'Content-Type': 'application/json' },
        },
      );

      this.logger.log(`AI feedback accepted for post ${postId}`);
      return response.data ?? null;
    } catch (error: any) {
      const axiosError = error as AxiosError;
      this.logger.warn(
        `AI feedback failed for post ${postId}: ${axiosError?.code || 'UNKNOWN'} - ${axiosError?.message || String(error)}`,
      );
      return null;
    }
  }
  /**
   * Xóa mềm bài viết (soft delete)
   */
  async deletePost(
    postId: string,
    authorDisplayId: string,
  ): Promise<{ message: string }> {
    try {
      if (!Types.ObjectId.isValid(postId)) {
        throw new BadRequestException('Invalid post ID format');
      }

      const post = await this.postModel.findById(postId);

      if (!post) {
        throw new NotFoundException('Bài viết không tìm thấy');
      }

      // Chỉ author mới được xóa
      if (post.authorDisplayId !== authorDisplayId) {
        throw new HttpException(
          'Bạn không có quyền xóa bài viết này',
          HttpStatus.FORBIDDEN,
        );
      }

      post.isDeleted = true;
      post.deletedAt = new Date();
      await post.save();

      this.logger.log(`Post ${postId} deleted by ${authorDisplayId}`);

      return { message: 'Bài viết đã được xóa' };
    } catch (error: any) {
      this.logger.error(`Failed to delete post ${postId}: ${error?.message || String(error)}`);
      throw error;
    }
  }

  /**
   * Like hoặc unlike bài viết
   */
  async toggleLike(
    postId: string,
    userDisplayId: string,
  ): Promise<{ isLiked: boolean; likeCount: number }> {
    try {
      if (!Types.ObjectId.isValid(postId)) {
        throw new BadRequestException('Invalid post ID format');
      }

      const post = await this.postModel.findById(postId);

      if (!post) {
        throw new NotFoundException('Bài viết không tìm thấy');
      }

      const likedIndex = post.likedBy.indexOf(userDisplayId);
      const isLiked = likedIndex !== -1;

      if (isLiked) {
        // Unlike
        post.likedBy.splice(likedIndex, 1);
        post.likeCount = Math.max(0, post.likeCount - 1);
      } else {
        // Like
        post.likedBy.push(userDisplayId);
        post.likeCount += 1;
      }

      await post.save();

      this.logger.log(
        `Post ${postId} ${isLiked ? 'unliked' : 'liked'} by ${userDisplayId}`,
      );

      await this.notificationService.createNotification({
        recipientDisplayId: post.authorDisplayId,
        type: NotificationType.SYSTEM,
        title: 'Bạn đã nhận được thêm một lượt like',
        body: `Bài viết đã nhận được thêm một lượt like bởi ${userDisplayId}, Tổng lượt like: ${post.likeCount}`
      })

      return {
        isLiked: !isLiked,
        likeCount: post.likeCount,
      };
    } catch (error: any) {
      this.logger.error(`Failed to toggle like on post ${postId}: ${error?.message || String(error)}`);
      throw error;
    }
  }

  /**
   * Gọi AI Service để phân tích nội dung
   */
  private async analyzeContentWithAI(
    content: string,
    anonymousId: string,
  ): Promise<PostAnalysisDto> {
    const endpoint = `${this.aiServiceUrl.replace(/\/+$/, '')}/ai/analyze`;
    this.logger.log(
      `Calling AI service: ${endpoint} | timeout=${this.aiTimeout}ms | anonymousId=${anonymousId}`,
    );

    try {
      const response = await axios.post(
        endpoint,
        {
          text: content,
          content_type: 'post',
          anonymous_id: anonymousId,
        },
        {
          timeout: this.aiTimeout,
          headers: {
            'Content-Type': 'application/json',
          },
        },
      );

      const { accepted, moderation, sentiment, confidence, categories } =
        response.data || {};

      const normalizedModerate = this.normalizeModerateResult(
        accepted,
        moderation,
      );
      const normalizedSentiment = this.normalizeSentimentResult(sentiment);

      return {
        isSpam: false,
        isMalicious: false,
        confidence: Number(confidence || 0),
        categories: categories || [],
        moderate: normalizedModerate,
        sentiment: normalizedSentiment,
      };
    } catch (error: any) {
      const axiosError = error as AxiosError;
      const message = axiosError?.message || String(error);
      const code = axiosError?.code || 'UNKNOWN';
      this.logger.error(
        `AI Service request failed: ${code} - ${message}`,
        error?.stack,
      );

      if (axiosError?.code === 'ECONNABORTED') {
        throw new Error(
          `AI Service timeout after ${this.aiTimeout}ms. Check AI_SERVICE_URL and service availability.`,
        );
      }

      throw new Error(`AI Service unavailable: ${message}`);
    }
  }

  private normalizeModerateResult(
    accepted: unknown,
    moderation: unknown,
  ): 'REJECTED' | 'FLAGGED' | 'APPROVED' {
    if (accepted === false) {
      return 'REJECTED';
    }

    if (typeof moderation === 'string') {
      const label = moderation.toUpperCase();
      if (label.includes('REJECT') || label.includes('DENY') || label.includes('UNSAFE')) {
        return 'REJECTED';
      }
      if (label.includes('FLAG') || label.includes('REVIEW') || label.includes('WARNING')) {
        return 'FLAGGED';
      }
      if (label.includes('APPROVE') || label.includes('SAFE')) {
        return 'APPROVED';
      }
    }

    if (typeof moderation === 'object' && moderation !== null) {
      const normalized = JSON.stringify(moderation).toUpperCase();
      if (normalized.includes('REJECT') || normalized.includes('DENY') || normalized.includes('UNSAFE')) {
        return 'REJECTED';
      }
      if (normalized.includes('FLAG') || normalized.includes('REVIEW') || normalized.includes('WARNING')) {
        return 'FLAGGED';
      }
      if (normalized.includes('APPROVE') || normalized.includes('SAFE')) {
        return 'APPROVED';
      }
    }

    return 'APPROVED';
  }

  private normalizeSentimentResult(
    sentiment: unknown,
  ): 'NEGATIVE' | 'NEUTRAL' | 'POSITIVE' {
    if (typeof sentiment === 'string') {
      const label = sentiment.toUpperCase();
      if (label.includes('NEGATIVE')) return 'NEGATIVE';
      if (label.includes('POSITIVE')) return 'POSITIVE';
      return 'NEUTRAL';
    }

    if (typeof sentiment === 'object' && sentiment !== null) {
      const normalized = JSON.stringify(sentiment).toUpperCase();
      if (normalized.includes('NEGATIVE') || normalized.includes('NEG')) return 'NEGATIVE';
      if (normalized.includes('POSITIVE') || normalized.includes('POS')) return 'POSITIVE';
      return 'NEUTRAL';
    }

    return 'NEUTRAL';
  }

  /**
   * Tăng lượt xem (background task)
   */
  private async incrementViewCount(postId: string): Promise<void> {
    try {
      await this.postModel.findByIdAndUpdate(
        postId,
        { $inc: { viewCount: 1 } },
        { new: false }, // Không cần kết quả
      );
    } catch (error) {
      this.logger.warn(`Failed to increment view count for ${postId}`);
    }
  }

  /**
   * Format post object cho response
   */
  private formatPostResponse(
    post: Post | any,
    currentUserDisplayId?: string,
  ): PostResponseDto {
    return {
      _id: post._id?.toString() || post._id,
      authorDisplayId: post.authorDisplayId,
      content: post.content,
      imageUrls: post.imageUrls || [],
      contentStatus: post.contentStatus,
      aiAnalysis: post.aiAnalysis || undefined,
      likeCount: post.likeCount || 0,
      commentCount: post.commentCount || 0,
      viewCount: post.viewCount || 0,
      isLiked: false,
      visibility: post.visibility,
      createdAt: post.createdAt,
      updatedAt: post.updatedAt,
    };
  }
}
