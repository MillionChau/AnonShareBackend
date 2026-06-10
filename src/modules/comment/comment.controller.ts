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
  Req,
  HttpCode,
  HttpStatus,
  UseGuards,
} from '@nestjs/common';
import { Request } from 'express';

import { CommentService } from './comment.service';
import {
  CreateCommentDto,
  UpdateCommentDto,
  GetCommentsQueryDto,
  CommentDto,
  CreateCommentResponseDto,
  PaginatedCommentsDto,
  ToggleLikeCommentDto,
} from './dto/comment.dto';
import { AnonKeyGuard } from '../auth/guards/anon-key.guard';
import { AnonId } from '../auth/decorators/anon-id.decorator';

interface AuthRequest extends Request {
  user: { displayId: string };
}

@Controller('comments')
@UseGuards(AnonKeyGuard)
export class CommentController {
  constructor(private readonly commentService: CommentService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async createComment(
    @AnonId() authorDisplayId: string,
    @Body() createCommentDto: CreateCommentDto,
  ): Promise<CreateCommentResponseDto> {
    return this.commentService.createComment(authorDisplayId, createCommentDto);
  }

  @Get('post/:postId')
  @HttpCode(HttpStatus.OK)
  async getCommentsByPost(
    @Param('postId') postId: string,
    @Query() query: GetCommentsQueryDto,
    @AnonId() authorDisplayId: string,
  ): Promise<PaginatedCommentsDto> {
    return this.commentService.getCommentsByPost(postId, query, authorDisplayId);
  }

  @Get(':commentId/replies')
  @HttpCode(HttpStatus.OK)
  async getReplies(
    @Param('commentId') commentId: string,
    @Query() query: GetCommentsQueryDto,
    @AnonId() authorDisplayId: string,
  ): Promise<PaginatedCommentsDto> {
    return this.commentService.getReplies(commentId, query, authorDisplayId);
  }

  @Get(':commentId')
  @HttpCode(HttpStatus.OK)
  async getCommentById(
    @Param('commentId') commentId: string,
    @AnonId() authorDisplayId: string,
  ): Promise<CommentDto> {
    return this.commentService.getCommentById(commentId, authorDisplayId);
  }

  @Put(':commentId')
  @HttpCode(HttpStatus.OK)
  async updateComment(
    @Param('commentId') commentId: string,
    @AnonId() authorDisplayId: string,
    @Body() updateCommentDto: UpdateCommentDto,
  ): Promise<CommentDto> {
    return this.commentService.updateComment(commentId, authorDisplayId, updateCommentDto);
  }

  @Delete(':commentId')
  @HttpCode(HttpStatus.OK)
  async deleteComment(
    @Param('commentId') commentId: string,
    @AnonId() authorDisplayId: string,
  ): Promise<{ message: string }> {
    return this.commentService.deleteComment(commentId, authorDisplayId);
  }

  @Patch(':commentId/like')
  @HttpCode(HttpStatus.OK)
  async toggleLike(
    @Param('commentId') commentId: string,
    @AnonId() authorDisplayId: string,
  ): Promise<ToggleLikeCommentDto> {
    return this.commentService.toggleLike(commentId, authorDisplayId);
  }
}