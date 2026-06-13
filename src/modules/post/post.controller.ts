import {
  Controller,
  Post as PostDecorator,
  Get,
  Put,
  Delete,
  Param,
  Body,
  Query,
  UseGuards,
  UseInterceptors,
  HttpCode,
  HttpStatus,
  Patch,
} from '@nestjs/common';
import { AnonKeyGuard } from '../auth/guards/anon-key.guard';
import { AnonId } from '../auth/decorators/anon-id.decorator';
import { AdminGuard } from '../admin/guards/admin.guard';
import { AdminAuditInterceptor } from '../admin/interceptors/admin-audit.interceptor';
import { PostService } from './post.service';
import {
  CreatePostDto,
  UpdatePostDto,
  PostResponseDto,
  PaginatedPostsDto,
  UpdatePostStatusDto,
  UpdatePostStatusResponseDto,
} from './dto/post.dto';

@Controller('posts')
export class PostController {
  constructor(private readonly postService: PostService) {}

  /**
   * POST /posts
   * Tạo bài viết mới (yêu cầu token)
   */
  @PostDecorator()
  @UseGuards(AnonKeyGuard)
  @HttpCode(HttpStatus.CREATED)
  async createPost(
    @AnonId() authorDisplayId: string,
    @Body() createPostDto: CreatePostDto,
  ): Promise<PostResponseDto> {
    return this.postService.createPost(authorDisplayId, createPostDto);
  }

  /**
   * GET /posts
   * Lấy danh sách bài viết (phân trang)
   * Query: page=1&limit=10
   */
  @Get()
  async getPosts(
    @Query('page') page: number = 1,
    @Query('limit') limit: number = 10,
    @Query('contentStatus') contentStatus?: string | string[],
    @Query('status') status?: string | string[],
    @Query('visibility') visibility?: string | string[],
  ): Promise<PaginatedPostsDto> {
    return this.postService.getPosts(
      +page,
      +limit,
      contentStatus ?? status,
      visibility,
    );
  }

  /**
   * GET /posts/:id
   * Lấy chi tiết một bài viết
   */
  @Get(':id')
  async getPostById(
    @Param('id') postId: string,
  ): Promise<PostResponseDto> {
    return this.postService.getPostById(postId);
  }

  /**
   * GET /posts/user/:displayId
   * Lấy bài viết của một người dùng
   * Query: page=1&limit=10
   */
  @Get('user/:displayId')
  async getUserPosts(
    @Param('displayId') authorDisplayId: string,
    @Query('page') page: number = 1,
    @Query('limit') limit: number = 10,
  ): Promise<PaginatedPostsDto> {
    return this.postService.getUserPosts(authorDisplayId, +page, +limit);
  }

  /**
   * PUT /posts/:id
   * Cập nhật bài viết (chỉ author)
   */
  @Put(':id')
  @UseGuards(AnonKeyGuard)
  @HttpCode(HttpStatus.OK)
  async updatePost(
    @Param('id') postId: string,
    @AnonId() authorDisplayId: string,
    @Body() updatePostDto: UpdatePostDto,
  ): Promise<PostResponseDto> {
    return this.postService.updatePost(postId, authorDisplayId, updatePostDto);
  }

  @Patch(':id/status')
  @UseGuards(AdminGuard)
  @UseInterceptors(AdminAuditInterceptor)
  async updatePostStatus(
    @Param('id') id: string,
    @Body() dto: UpdatePostStatusDto,
  ): Promise<UpdatePostStatusResponseDto> {
    return this.postService.updatePostStatus(id, dto);
  }

  /**
   * DELETE /posts/:id
   * Xóa bài viết (soft delete, chỉ author)
   */
  @Delete(':id')
  @UseGuards(AnonKeyGuard)
  @HttpCode(HttpStatus.OK)
  async deletePost(
    @Param('id') postId: string,
    @AnonId() authorDisplayId: string,
  ): Promise<{ message: string }> {
    return this.postService.deletePost(postId, authorDisplayId);
  }

  /**
   * POST /posts/:id/like
   * Like hoặc unlike bài viết
   */
  @PostDecorator(':id/like')
  @UseGuards(AnonKeyGuard)
  @HttpCode(HttpStatus.OK)
  async toggleLike(
    @Param('id') postId: string,
    @AnonId() userDisplayId: string,
  ): Promise<{ isLiked: boolean; likeCount: number }> {
    return this.postService.toggleLike(postId, userDisplayId);
  }
}
