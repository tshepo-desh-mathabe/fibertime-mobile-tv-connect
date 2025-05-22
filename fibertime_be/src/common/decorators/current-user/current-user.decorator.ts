import { createParamDecorator, ExecutionContext } from '@nestjs/common';

/**
 * `@CurrentUser()` is a custom parameter decorator that extracts the authenticated user from the request object.
 * It allows you to access the `request.user` directly (instead of using @Req)
 * in route handlers, after a guard (e.g., JwtAuthGuard) has attached the user info.
 *
 * @param data - Not used, but available for passing additional metadata.
 * @param ctx - The execution context which provides access to the HTTP request.
 * @returns The user object attached to the request (i.e., `request.user`).
 */
export const CurrentUser = createParamDecorator(
  (data: unknown, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    return request.user;
  },
);
