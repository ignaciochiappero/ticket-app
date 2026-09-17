import {
  createParamDecorator,
  SetMetadata,
  type ExecutionContext,
} from '@nestjs/common';
import type { Request } from 'express';
import type { UserDto } from '../users/user.dto.js';
import type { UserRole } from '../users/user.schema.js';

export const IS_PUBLIC_KEY = 'isPublic';
export const ROLES_KEY = 'roles';

export interface ActingUserRequest extends Request {
  user?: UserDto;
}

// Opts a route out of the global ActingUserGuard.
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);

// Restricts a route or controller to the given roles.
export const Roles = (...roles: UserRole[]) => SetMetadata(ROLES_KEY, roles);

// Injects the acting user that ActingUserGuard attached to the request.
export const CurrentUser = createParamDecorator(
  (_data: unknown, context: ExecutionContext) =>
    context.switchToHttp().getRequest<ActingUserRequest>().user,
);
