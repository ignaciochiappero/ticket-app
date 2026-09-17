import {
  ForbiddenException,
  Injectable,
  UnauthorizedException,
  type CanActivate,
  type ExecutionContext,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import type { UserRole } from '../users/user.schema.js';
import {
  IS_PUBLIC_KEY,
  ROLES_KEY,
  type ActingUser,
  type AuthenticatedRequest,
} from './auth.decorators.js';

interface SessionPayload {
  sub: string;
  role: UserRole;
}

// Reads the bearer token, verifies its signature and enforces @Roles.
// The token carries the id and the role, so no route costs a database lookup to know who is calling.
// Ownership rules need the resource itself, so they live in each service instead.
@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly jwtService: JwtService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const targets = [context.getHandler(), context.getClass()];
    if (this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, targets)) {
      return true;
    }

    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const token = this.readToken(request);
    const user = token ? await this.readSession(token) : null;
    if (!user) {
      throw new UnauthorizedException('Log in to continue');
    }

    const roles = this.reflector.getAllAndOverride<UserRole[] | undefined>(
      ROLES_KEY,
      targets,
    );
    if (roles && !roles.includes(user.role)) {
      throw new ForbiddenException(
        `This action requires the ${roles.join(' or ')} role`,
      );
    }

    request.user = user;
    return true;
  }

  // Only `Authorization: Bearer <token>`. The scheme comparison is case-insensitive,
  // as HTTP defines it, and anything else counts as no credential at all.
  private readToken(request: AuthenticatedRequest): string | null {
    const [scheme, value] = request.headers.authorization?.split(' ') ?? [];
    return scheme?.toLowerCase() === 'bearer' ? (value ?? null) : null;
  }

  // A tampered, expired or foreign token is not an error to report: it is simply not a credential.
  private async readSession(token: string): Promise<ActingUser | null> {
    try {
      const { sub, role } =
        await this.jwtService.verifyAsync<SessionPayload>(token);
      return { id: sub, role };
    } catch {
      return null;
    }
  }
}
