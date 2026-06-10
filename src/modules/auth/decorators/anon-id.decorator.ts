import { createParamDecorator, ExecutionContext } from '@nestjs/common';

/**
 * Decorator lấy anonymousId từ request sau khi AnonKeyGuard đã verify.
 *
 * Dùng thay cho @Req() để controller gọn hơn:
 *
 * @example
 * @Post()
 * @UseGuards(AnonKeyGuard)
 * createPost(@AnonId() anonId: string, @Body() dto: CreatePostDto) {
 *   return this.postService.create(anonId, dto);
 * }
 */
export const AnonId = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): string => {
    const request = ctx.switchToHttp().getRequest();
    return request.anonymousId;
  },
);
