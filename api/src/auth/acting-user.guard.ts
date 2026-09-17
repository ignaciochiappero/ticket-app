import {
  ForbiddenException,
  Injectable,
  UnauthorizedException,
  type CanActivate,
  type ExecutionContext,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { UserRole } from '../users/user.schema.js';
import { UsersService } from '../users/users.service.js';
import {
  IS_PUBLIC_KEY,
  ROLES_KEY,
  type ActingUserRequest,
} from './acting-user.decorators.js';

// Resolves the acting user from the X-User-Id header and enforces @Roles.
// Ownership rules need the resource, so they live in each service instead.
@Injectable()
export class ActingUserGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly usersService: UsersService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const targets = [context.getHandler(), context.getClass()];
    if (this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, targets)) {
      return true;
    }

    const request = context.switchToHttp().getRequest<ActingUserRequest>();
    const userId = request.headers['x-user-id'];
    const user =
      typeof userId === 'string'
        ? await this.usersService.findById(userId)
        : null;
    if (!user) {
      throw new UnauthorizedException(
        'Send a valid X-User-Id header to identify the acting user',
      );
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
}
