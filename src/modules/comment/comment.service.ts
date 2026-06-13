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

import { Comment, CommentDocument } from './schemas/comment.schema';
import { Post, PostDocument } from '../post/schemas/post.schema';
import {
  CreateCommentDto,
  UpdateCommentDto,
  GetCommentsQueryDto,
  CommentDto,
  CommentAnalysisDto,
  CreateCommentResponseDto,
  PaginatedCommentsDto,
  ToggleLikeCommentDto,
  UpdateCommentStatusDto,
  UpdateCommentStatusResponseDto,
  CommentStatus
} from './dto/comment.dto';
import { NotificationService } from '../notification/notification.service';
import { NotificationType } from '../notification/dto/notification.dto';

const MAX_DEPTH = 2;

@Injectable()
export class CommentService {
  private readonly logger = new Logger(CommentService.name);
  private readonly aiServiceUrl: string;
  private readonly aiTimeout: number;

  constructor(
    @InjectModel(Comment.name)
    private readonly commentModel: Model<CommentDocument>,

    @InjectModel(Post.name)
    private readonly postModel: Model<PostDocument>,

    private readonly notificationService: NotificationService,
    private readonly configService: ConfigService,
  ) {
    const configuredUrl = this.configService.get<string>('ai.url');
    this.aiServiceUrl = configuredUrl?.trim() ?? '';

    if (!this.aiServiceUrl) {
      this.logger.error('AI service URL is not configured.');
      throw new Error('AI service URL is required');
    }

    this.aiTimeout = this.configService.get<number>('ai.timeout') ?? 30000;
  }

  // ─── Create ───────────────────────────────────────────────────────────────

  async createComment(
    authorDisplayId: string,
    createCommentDto: CreateCommentDto,
  ): Promise<CreateCommentResponseDto> {
    try {
      if (!createCommentDto.content || createCommentDto.content.trim().length === 0) {
        throw new BadRequestException('Nội dung bình luận không được để trống');
      }

      if (!Types.ObjectId.isValid(createCommentDto.postId)) {
        throw new BadRequestException('Invalid post ID format');
      }

      const post = await this.postModel
        .findOne({
          _id: new Types.ObjectId(createCommentDto.postId),
          isDeleted: false,
          contentStatus: 'approved',
        })
        .lean();

      if (!post) {
        throw new NotFoundException('Bài viết không tồn tại hoặc đã bị xóa');
      }

      let parentId: Types.ObjectId | null = null;
      let depth = 0;

      let parentComment = await this.commentModel
        .findOne({
          _id: parentId
        })

      if (createCommentDto.parentId) {
        if (!Types.ObjectId.isValid(createCommentDto.parentId)) {
          throw new BadRequestException('Invalid parent comment ID format');
        }

        const parentComment = await this.commentModel
          .findOne({
            _id: new Types.ObjectId(createCommentDto.parentId),
            postId: new Types.ObjectId(createCommentDto.postId),
            isDeleted: false,
            contentStatus: 'approved',
          })
          .lean();

        if (!parentComment) {
          throw new NotFoundException('Bình luận gốc không tồn tại hoặc đã bị xóa');
        }

        if (parentComment.depth >= MAX_DEPTH) {
          throw new BadRequestException(
            `Chỉ hỗ trợ tối đa ${MAX_DEPTH} cấp độ reply`,
          );
        }

        parentId = new Types.ObjectId(createCommentDto.parentId);
        depth = parentComment.depth + 1;
      }

      const aiAnalysis = await this.analyzeContentWithAI(
        createCommentDto.content,
        authorDisplayId,
      );

      const contentStatus =
        aiAnalysis.moderate === 'REJECTED'
          ? 'rejected'
          : aiAnalysis.moderate === 'APPROVED'
          ? 'approved'
          : 'pending';

      const rejectionReason =
        contentStatus === 'rejected'
          ? 'Nội dung vi phạm chính sách cộng đồng'
          : null;

      const comment = await this.commentModel.create({
        postId: new Types.ObjectId(createCommentDto.postId),
        parentId,
        depth,
        authorDisplayId,
        content: createCommentDto.content.trim(),
        contentStatus,
        rejectionReason,
        aiAnalysis,
        likeCount: 0,
        replyCount: 0,
      });

      void this.notificationService.createNotification({
        recipientDisplayId: authorDisplayId,
        type: contentStatus === 'approved'
          ? NotificationType.CONTENT_APPROVED
          : NotificationType.CONTENT_REJECTED,
        title: contentStatus === 'approved'
          ? 'Bình luận của bạn đã được thông qua'
          : 'Bình luận của bạn bị từ chối',
        body: contentStatus === 'approved'
          ? 'Nội dung bình luận của bạn đã được chấp nhận'
          : 'Nội dung vi phạm chính sách cộng đồng',
        metadata: { commentId: comment._id.toString(), postId: createCommentDto.postId },
      });

      if (contentStatus === 'approved' && post.authorDisplayId !== authorDisplayId) {
        void this.notificationService.createNotification({
          recipientDisplayId: post.authorDisplayId,
          type: NotificationType.NEW_COMMENT,
          title: 'Bài viết của bạn có bình luận mới',
          body: 'Có người vừa bình luận vào bài viết của bạn',
          metadata: { commentId: comment._id.toString(), postId: createCommentDto.postId },
        });
      }

      if (parentComment && parentComment.authorDisplayId !== authorDisplayId) {
        void this.notificationService.createNotification({
          recipientDisplayId: parentComment.authorDisplayId,
          type: NotificationType.NEW_COMMENT,
          title: 'Bình luận của bạn được phản hồi',
          body: 'Có người vừa reply vào bình luận của bạn',
          metadata: { commentId: comment._id.toString(), postId: createCommentDto.postId },
        });
      }

      // Tăng replyCount của parent nếu là reply
      if (parentId && contentStatus === 'approved') {
        await this.commentModel.findByIdAndUpdate(parentId, {
          $inc: { replyCount: 1 },
        });
      }
      if (contentStatus === 'approved') {
        await this.postModel.findByIdAndUpdate(createCommentDto.postId, {
          $inc: { commentCount: 1 },
        });
      }

      this.logger.log(
        `Comment created: ${comment._id} by ${authorDisplayId} | depth=${depth} | status=${contentStatus}`,
      );

      const commentResponse = this.formatCommentResponse(comment, authorDisplayId);
      this.notificationService.emitAdminEvent('comment:created', commentResponse);
      if (contentStatus === 'approved') {
        this.notificationService.emitPostEvent(
          createCommentDto.postId,
          'comment:created',
          commentResponse,
        );
        this.notificationService.emitFeedEvent('comment:created', {
          postId: createCommentDto.postId,
          comment: commentResponse,
        });
      }

      return {
        comment: commentResponse,
        message:
          contentStatus === 'approved'
            ? 'Bình luận đã được đăng thành công'
            : contentStatus === 'rejected'
            ? 'Bình luận vi phạm chính sách và đã bị từ chối'
            : 'Bình luận đang chờ kiểm duyệt',
        status:
          contentStatus === 'approved'
            ? 'published'
            : contentStatus === 'rejected'
            ? 'rejected'
            : 'pending',
        rejectionReason,
      };
    } catch (error: any) {
      this.logger.error(
        `Failed to create comment: ${error?.message || String(error)}`,
        error?.stack,
      );
      throw error;
    }
  }

  // ─── Read ─────────────────────────────────────────────────────────────────

  async getCommentsByPost(
    postId: string,
    query: GetCommentsQueryDto,
    currentUserDisplayId?: string,
  ): Promise<PaginatedCommentsDto> {
    try {
      if (!Types.ObjectId.isValid(postId)) {
        throw new BadRequestException('Invalid post ID format');
      }

      const page = Math.max(1, query.page ?? 1);
      const limit = Math.max(1, Math.min(query.limit ?? 20, 100));
      const skip = (page - 1) * limit;

      // Chỉ lấy root comments (depth = 0)
      const filter = {
        postId: new Types.ObjectId(postId),
        parentId: null,
        isDeleted: false,
        contentStatus: 'approved',
      };

      const [rootComments, total] = await Promise.all([
        this.commentModel
          .find(filter)
          .sort({ createdAt: -1 })
          .skip(skip)
          .limit(limit)
          .lean(),
        this.commentModel.countDocuments(filter),
      ]);

      // Lấy replies depth=1 cho từng root comment
      const rootIds = rootComments.map((c) => c._id);

      const depth1Replies = await this.commentModel
        .find({
          parentId: { $in: rootIds },
          isDeleted: false,
          contentStatus: 'approved',
        })
        .sort({ createdAt: 1 })
        .lean();

      // Lấy replies depth=2 cho từng depth=1
      const depth1Ids = depth1Replies.map((c) => c._id);

      const depth2Replies = await this.commentModel
        .find({
          parentId: { $in: depth1Ids },
          isDeleted: false,
          contentStatus: 'approved',
        })
        .sort({ createdAt: 1 })
        .lean();

      // Build tree
      const depth2ByParent = this.groupByParent(depth2Replies);
      const depth1ByParent = this.groupByParent(depth1Replies);

      const data = rootComments.map((root) => {
        const rootDto = this.formatCommentResponse(root as any, currentUserDisplayId);

        rootDto.replies = (depth1ByParent[root._id.toString()] ?? []).map((d1) => {
          const d1Dto = this.formatCommentResponse(d1 as any, currentUserDisplayId);
          d1Dto.replies = (depth2ByParent[d1._id.toString()] ?? []).map((d2) =>
            this.formatCommentResponse(d2 as any, currentUserDisplayId),
          );
          return d1Dto;
        });

        return rootDto;
      });

      return { data, total, page, limit, hasMore: skip + limit < total };
    } catch (error: any) {
      this.logger.error(
        `Failed to get comments for post ${postId}: ${error?.message || String(error)}`,
      );
      throw error;
    }
  }

  async getReplies(
    commentId: string,
    query: GetCommentsQueryDto,
    currentUserDisplayId?: string,
  ): Promise<PaginatedCommentsDto> {
    try {
      if (!Types.ObjectId.isValid(commentId)) {
        throw new BadRequestException('Invalid comment ID format');
      }

      const page = Math.max(1, query.page ?? 1);
      const limit = Math.max(1, Math.min(query.limit ?? 20, 100));
      const skip = (page - 1) * limit;

      const filter = {
        parentId: new Types.ObjectId(commentId),
        isDeleted: false,
        contentStatus: 'approved',
      };

      const [replies, total] = await Promise.all([
        this.commentModel
          .find(filter)
          .sort({ createdAt: 1 })
          .skip(skip)
          .limit(limit)
          .lean(),
        this.commentModel.countDocuments(filter),
      ]);

      return {
        data: replies.map((r) =>
          this.formatCommentResponse(r as any, currentUserDisplayId),
        ),
        total,
        page,
        limit,
        hasMore: skip + limit < total,
      };
    } catch (error: any) {
      this.logger.error(
        `Failed to get replies for comment ${commentId}: ${error?.message || String(error)}`,
      );
      throw error;
    }
  }

  async getCommentById(
    commentId: string,
    currentUserDisplayId?: string,
  ): Promise<CommentDto> {
    try {
      if (!Types.ObjectId.isValid(commentId)) {
        throw new BadRequestException('Invalid comment ID format');
      }

      const comment = await this.commentModel.findById(commentId);

      if (!comment || comment.isDeleted) {
        throw new NotFoundException('Bình luận không tìm thấy');
      }

      return this.formatCommentResponse(comment, currentUserDisplayId);
    } catch (error: any) {
      this.logger.error(
        `Failed to get comment ${commentId}: ${error?.message || String(error)}`,
      );
      throw error;
    }
  }

  // ─── Update ───────────────────────────────────────────────────────────────

  async updateComment(
    commentId: string,
    authorDisplayId: string,
    updateCommentDto: UpdateCommentDto,
  ): Promise<CommentDto> {
    try {
      if (!Types.ObjectId.isValid(commentId)) {
        throw new BadRequestException('Invalid comment ID format');
      }

      const comment = await this.commentModel.findById(commentId);

      if (!comment || comment.isDeleted) {
        throw new NotFoundException('Bình luận không tìm thấy');
      }

      if (comment.authorDisplayId !== authorDisplayId) {
        throw new HttpException(
          'Bạn không có quyền chỉnh sửa bình luận này',
          HttpStatus.FORBIDDEN,
        );
      }

      if (updateCommentDto.content) {
        const aiAnalysis = await this.analyzeContentWithAI(
          updateCommentDto.content.trim(),
          authorDisplayId,
        );

        const contentStatus =
          aiAnalysis.moderate === 'REJECTED'
            ? 'rejected'
            : aiAnalysis.moderate === 'APPROVED'
            ? 'approved'
            : 'pending';

        comment.content = updateCommentDto.content.trim();
        comment.aiAnalysis = aiAnalysis;
        comment.contentStatus = contentStatus;
        comment.rejectionReason =
          contentStatus === 'rejected'
            ? 'Nội dung vi phạm chính sách cộng đồng'
            : null;
      }

      await comment.save();

      this.logger.log(`Comment ${commentId} updated by ${authorDisplayId}`);

      const commentResponse = this.formatCommentResponse(comment, authorDisplayId);
      this.notificationService.emitAdminEvent('comment:updated', commentResponse);
      this.notificationService.emitPostEvent(
        comment.postId.toString(),
        'comment:updated',
        commentResponse,
      );

      return commentResponse;
    } catch (error: any) {
      this.logger.error(
        `Failed to update comment ${commentId}: ${error?.message || String(error)}`,
      );
      throw error;
    }
  }

  async updateCommentStatus(
    commentId: string,
    dto: UpdateCommentStatusDto
  ): Promise<UpdateCommentStatusResponseDto> {
    if (!Types.ObjectId.isValid(commentId)) {
      throw new BadRequestException('Invalid comment Id format')
    }

    const comment = await this.commentModel.findById(commentId)

    if (!comment) {
      throw new NotFoundException('Không tìm thấy bình luận')
    }

    const previousStatus = comment.contentStatus
    comment.contentStatus = dto.status
    await comment.save()

    if (previousStatus !== 'approved' && dto.status === 'approved') {
      await this.postModel.findByIdAndUpdate(comment.postId, {
        $inc: { commentCount: 1 },
      })
    }
    if (previousStatus === 'approved' && dto.status !== 'approved') {
      await this.postModel.findByIdAndUpdate(comment.postId, {
        $inc: { commentCount: -1 },
      })
    }

    this.logger.log(`Comment: ${commentId} status update to ${dto.status}`)

    const aiFeedback = await this.sendFeedbackToAI(
      commentId,
      dto.content ?? comment.content,
      dto.status,
    )

    const commentResponse = this.formatCommentResponse(comment)
    this.notificationService.emitAdminEvent('comment:status_updated', commentResponse)
    this.notificationService.emitPostEvent(
      comment.postId.toString(),
      'comment:status_updated',
      commentResponse,
    )
    this.notificationService.emitFeedEvent('comment:status_updated', {
      postId: comment.postId.toString(),
      comment: commentResponse,
    })

    return {
      comment: commentResponse,
      aiFeedback,
    }
  }

  // ─── Delete ───────────────────────────────────────────────────────────────

  async deleteComment(
    commentId: string,
    authorDisplayId: string,
  ): Promise<{ message: string }> {
    try {
      if (!Types.ObjectId.isValid(commentId)) {
        throw new BadRequestException('Invalid comment ID format');
      }

      const comment = await this.commentModel.findById(commentId);

      if (!comment || comment.isDeleted) {
        throw new NotFoundException('Bình luận không tìm thấy');
      }

      if (comment.authorDisplayId !== authorDisplayId) {
        throw new HttpException(
          'Bạn không có quyền xóa bình luận này',
          HttpStatus.FORBIDDEN,
        );
      }

      comment.isDeleted = true;
      comment.deletedAt = new Date();
      comment.deletedBy = authorDisplayId;
      await comment.save();

      // Giảm replyCount của parent nếu là reply
      if (comment.parentId) {
        await this.commentModel.findByIdAndUpdate(comment.parentId, {
          $inc: { replyCount: -1 },
        });
      }

      if (comment.contentStatus === 'approved') {
        await this.postModel.findByIdAndUpdate(comment.postId, {
          $inc: { commentCount: -1 },
        });
      }

      this.logger.log(`Comment ${commentId} deleted by ${authorDisplayId}`);
      const payload = { commentId, postId: comment.postId.toString() };
      this.notificationService.emitAdminEvent('comment:deleted', payload);
      this.notificationService.emitPostEvent(
        comment.postId.toString(),
        'comment:deleted',
        payload,
      );
      this.notificationService.emitFeedEvent('comment:deleted', payload);

      return { message: 'Bình luận đã được xóa' };
    } catch (error: any) {
      this.logger.error(
        `Failed to delete comment ${commentId}: ${error?.message || String(error)}`,
      );
      throw error;
    }
  }

  // ─── Like ─────────────────────────────────────────────────────────────────

  async toggleLike(
    commentId: string,
    userDisplayId: string,
  ): Promise<ToggleLikeCommentDto> {
    try {
      if (!Types.ObjectId.isValid(commentId)) {
        throw new BadRequestException('Invalid comment ID format');
      }

      const comment = await this.commentModel.findById(commentId);

      if (!comment || comment.isDeleted) {
        throw new NotFoundException('Bình luận không tìm thấy');
      }

      const likedIndex = comment.likedBy.indexOf(userDisplayId);
      const isLiked = likedIndex !== -1;

      if (isLiked) {
        comment.likedBy.splice(likedIndex, 1);
        comment.likeCount = Math.max(0, comment.likeCount - 1);
      } else {
        comment.likedBy.push(userDisplayId);
        comment.likeCount += 1;
      }

      await comment.save();

      this.logger.log(
        `Comment ${commentId} ${isLiked ? 'unliked' : 'liked'} by ${userDisplayId}`,
      );

      const likePayload = {
        commentId,
        postId: comment.postId.toString(),
        isLiked: !isLiked,
        likeCount: comment.likeCount,
        actorDisplayId: userDisplayId,
      };
      this.notificationService.emitPostEvent(
        comment.postId.toString(),
        'comment:liked',
        likePayload,
      );

      return { isLiked: !isLiked, likeCount: comment.likeCount };
    } catch (error: any) {
      this.logger.error(
        `Failed to toggle like on comment ${commentId}: ${error?.message || String(error)}`,
      );
      throw error;
    }
  }

  // ─── AI ───────────────────────────────────────────────────────────────────

  private async analyzeContentWithAI(
    content: string,
    anonymousId: string,
  ): Promise<CommentAnalysisDto> {
    const endpoint = `${this.aiServiceUrl.replace(/\/+$/, '')}/ai/analyze`;

    try {
      const response = await axios.post(
        endpoint,
        { text: content, content_type: 'comment', anonymous_id: anonymousId },
        { timeout: this.aiTimeout, headers: { 'Content-Type': 'application/json' } },
      );

      const { accepted, moderation, sentiment, confidence, categories } =
        response.data || {};

      return {
        isSpam: false,
        isMalicious: false,
        confidence: Number(confidence || 0),
        categories: categories || [],
        moderate: this.normalizeModerateResult(accepted, moderation),
        sentiment: this.normalizeSentimentResult(sentiment),
      };
    } catch (error: any) {
      const axiosError = error as AxiosError;
      const message = axiosError?.message || String(error);

      this.logger.error(
        `AI Service failed: ${axiosError?.code} - ${message}`,
        error?.stack,
      );

      if (axiosError?.code === 'ECONNABORTED') {
        throw new Error(`AI Service timeout after ${this.aiTimeout}ms`);
      }

      throw new Error(`AI Service unavailable: ${message}`);
    }
  }

  private normalizeModerateResult(
    accepted: unknown,
    moderation: unknown,
  ): 'REJECTED' | 'FLAGGED' | 'APPROVED' {
    if (accepted === false) return 'REJECTED';

    if (typeof moderation === 'string') {
      const label = moderation.toUpperCase();
      if (label.includes('REJECT') || label.includes('DENY') || label.includes('UNSAFE'))
        return 'REJECTED';
      if (label.includes('FLAG') || label.includes('REVIEW') || label.includes('WARNING'))
        return 'FLAGGED';
      if (label.includes('APPROVE') || label.includes('SAFE'))
        return 'APPROVED';
    }

    if (typeof moderation === 'object' && moderation !== null) {
      const normalized = JSON.stringify(moderation).toUpperCase();
      if (normalized.includes('REJECT') || normalized.includes('DENY') || normalized.includes('UNSAFE'))
        return 'REJECTED';
      if (normalized.includes('FLAG') || normalized.includes('REVIEW') || normalized.includes('WARNING'))
        return 'FLAGGED';
      if (normalized.includes('APPROVE') || normalized.includes('SAFE'))
        return 'APPROVED';
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

  private async sendFeedbackToAI(
    commentId: string,
    content: string,
    status: CommentStatus,
  ): Promise<any | null> {
    const endpoint = `${this.aiServiceUrl.replace(/\/+$/, '')}/ai/feedback/learn`;
    this.logger.log(`Sending AI feedback: ${endpoint} | commentId=${commentId} | label=${status}`);

    const sentimentMap: Record<CommentStatus, string> = {
      [CommentStatus.APPROVED]: 'APPROVED',
      [CommentStatus.REJECTED]: 'REJECTED'
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

      this.logger.log(`AI feedback accepted for post ${commentId}`);
      return response.data ?? null;
    } catch (error: any) {
      const axiosError = error as AxiosError;
      this.logger.warn(
        `AI feedback failed for post ${commentId}: ${axiosError?.code || 'UNKNOWN'} - ${axiosError?.message || String(error)}`,
      );
      return null;
    }
  }

  // ─── Helpers ──────────────────────────────────────────────────────────────

  private groupByParent(comments: any[]): Record<string, any[]> {
    return comments.reduce((acc, comment) => {
      const key = comment.parentId?.toString();
      if (!key) return acc;
      if (!acc[key]) acc[key] = [];
      acc[key].push(comment);
      return acc;
    }, {} as Record<string, any[]>);
  }

  private formatCommentResponse(
    comment: Comment | any,
    currentUserDisplayId?: string,
  ): CommentDto {
    return {
      _id: comment._id?.toString(),
      postId: comment.postId?.toString(),
      parentId: comment.parentId?.toString() ?? null,
      depth: comment.depth ?? 0,
      authorDisplayId: comment.authorDisplayId,
      content: comment.content,
      contentStatus: comment.contentStatus,
      rejectionReason: comment.rejectionReason ?? null,
      aiAnalysis: comment.aiAnalysis || undefined,
      likeCount: comment.likeCount || 0,
      replyCount: comment.replyCount || 0,
      isLiked: currentUserDisplayId
        ? (comment.likedBy ?? []).includes(currentUserDisplayId)
        : false,
      isOwner: currentUserDisplayId
        ? comment.authorDisplayId === currentUserDisplayId
        : false,
      replies: [],
      createdAt: comment.createdAt,
      updatedAt: comment.updatedAt,
    };
  }
}
