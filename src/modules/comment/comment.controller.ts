// comment.controller.ts

import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Patch,
  Body,
  Param,
  Query,
  HttpCode,
  HttpStatus,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';

import { CommentService } from './comment.service';
import {
  CreateCommentDto,
  UpdateCommentDto,
  GetCommentsQueryDto,
  CommentDto,
  CreateCommentResponseDto,
  PaginatedCommentsDto,
  ToggleLikeCommentDto,
  UpdateCommentStatusDto,
  UpdateCommentStatusResponseDto,
} from './dto/comment.dto';
import { AnonKeyGuard } from '../auth/guards/anon-key.guard';
import { AnonId } from '../auth/decorators/anon-id.decorator';
import { AdminGuard } from '../admin/guards/admin.guard';
import { AdminAuditInterceptor } from '../admin/interceptors/admin-audit.interceptor';

@Controller('comments')
export class CommentController {
  constructor(private readonly commentService: CommentService) {}

  @Post()
  @UseGuards(AnonKeyGuard)
  @HttpCode(HttpStatus.CREATED)
  async createComment(
    @AnonId() authorDisplayId: string,
    @Body() createCommentDto: CreateCommentDto,
  ): Promise<CreateCommentResponseDto> {
    return this.commentService.createComment(authorDisplayId, createCommentDto);
  }

  @Get('post/:postId')
  @UseGuards(AnonKeyGuard)
  @HttpCode(HttpStatus.OK)
  async getCommentsByPost(
    @Param('postId') postId: string,
    @Query() query: GetCommentsQueryDto,
    @AnonId() authorDisplayId: string,
  ): Promise<PaginatedCommentsDto> {
    return this.commentService.getCommentsByPost(postId, query, authorDisplayId);
  }

  @Get(':commentId/replies')
  @UseGuards(AnonKeyGuard)
  @HttpCode(HttpStatus.OK)
  async getReplies(
    @Param('commentId') commentId: string,
    @Query() query: GetCommentsQueryDto,
    @AnonId() authorDisplayId: string,
  ): Promise<PaginatedCommentsDto> {
    return this.commentService.getReplies(commentId, query, authorDisplayId);
  }

  @Get(':commentId')
  @UseGuards(AnonKeyGuard)
  @HttpCode(HttpStatus.OK)
  async getCommentById(
    @Param('commentId') commentId: string,
    @AnonId() authorDisplayId: string,
  ): Promise<CommentDto> {
    return this.commentService.getCommentById(commentId, authorDisplayId);
  }

  @Put(':commentId')
  @UseGuards(AnonKeyGuard)
  @HttpCode(HttpStatus.OK)
  async updateComment(
    @Param('commentId') commentId: string,
    @AnonId() authorDisplayId: string,
    @Body() updateCommentDto: UpdateCommentDto,
  ): Promise<CommentDto> {
    return this.commentService.updateComment(commentId, authorDisplayId, updateCommentDto);
  }

  @Delete(':commentId')
  @UseGuards(AnonKeyGuard)
  @HttpCode(HttpStatus.OK)
  async deleteComment(
    @Param('commentId') commentId: string,
    @AnonId() authorDisplayId: string,
  ): Promise<{ message: string }> {
    return this.commentService.deleteComment(commentId, authorDisplayId);
  }

  @Patch(':commentId/like')
  @UseGuards(AnonKeyGuard)
  @HttpCode(HttpStatus.OK)
  async toggleLike(
    @Param('commentId') commentId: string,
    @AnonId() authorDisplayId: string,
  ): Promise<ToggleLikeCommentDto> {
    return this.commentService.toggleLike(commentId, authorDisplayId);
  }

  @Patch(':commentId/status')
  @UseGuards(AdminGuard)
  @UseInterceptors(AdminAuditInterceptor)
  @HttpCode(HttpStatus.OK)
  async updateCommentStatus(
    @Param('commentId') commentId: string,
    @Body() dto: UpdateCommentStatusDto,
  ): Promise<UpdateCommentStatusResponseDto> {
    return this.commentService.updateCommentStatus(commentId, dto);
  }
}
