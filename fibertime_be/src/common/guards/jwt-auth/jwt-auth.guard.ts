import { Injectable, CanActivate, ExecutionContext } from '@nestjs/common';
import { Observable } from 'rxjs';
import { JwtService } from '@nestjs/jwt';
import { Reflector } from '@nestjs/core';
import { IS_PUBLIC_KEY } from '../../../common/decorators/public.decorator';

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly jwtService: JwtService,
    private readonly reflector: Reflector
  ) {}

  /**
   * Determines whether the current request can proceed based on the presence and validity of a JWT.
   * It extracts the token from the request, verifies it using the JwtService, and attaches the payload to the request object.
   *
   * @param context - The execution context containing request details.
   * @returns A boolean, Promise<boolean>, or Observable<boolean> indicating if the request is authorized.
   */
  canActivate(context: ExecutionContext): boolean | Promise<boolean> | Observable<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    
    const contextType = context.getType();
    // Skip auth for WebSocket connections
    if (contextType === 'ws') {
      return true;
    }

    if (isPublic) return true;

    const request = context.switchToHttp().getRequest();
    const token = this.extractToken(request);

    if (!token) return false;

    try {
      const payload = this.jwtService.verify(token);
      // Attach user to request
      request.user = payload;
      return true;
    } catch (e) {
      return false;
    }
  }

  /**
   * Extracts the JWT token from the Authorization header of the request.
   *
   * @param request - The HTTP request object.
   * @returns The JWT token if present and valid, otherwise null.
   */
  private extractToken(request): string | null {
    const [type, token] = request.headers.authorization?.split(' ') ?? [];
    return type === 'Bearer' ? token : null;
  }
}
