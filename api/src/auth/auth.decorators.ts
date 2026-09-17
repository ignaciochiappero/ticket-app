import {
  createParamDecorator,
  SetMetadata,
  type ExecutionContext,
} from '@nestjs/common';
import type { Request } from 'express';
import type { UserRole } from '../users/user.schema.js';

export const IS_PUBLIC_KEY = 'isPublic';
export const ROLES_KEY = 'roles';

// Who is making the request, read from the bearer token. Anything else (the name,
// for example) is a database lookup, so services ask for it only when they need it.
export interface ActingUser {
  id: string;
  role: UserRole;
}

export interface AuthenticatedRequest extends Request {
  user?: ActingUser;
}

// Opts a route out of the global AuthGuard.
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);

// Restricts a route or controller to the given roles.
export const Roles = (...roles: UserRole[]) => SetMetadata(ROLES_KEY, roles);

// Injects the acting user that AuthGuard attached to the request.
export const CurrentUser = createParamDecorator(
  (_data: unknown, context: ExecutionContext) =>
    context.switchToHttp().getRequest<AuthenticatedRequest>().user,
);
