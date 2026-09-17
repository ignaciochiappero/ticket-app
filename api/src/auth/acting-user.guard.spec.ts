import {
  ForbiddenException,
  UnauthorizedException,
  type ExecutionContext,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { UserDto } from '../users/user.dto.js';
import type { UsersService } from '../users/users.service.js';
import { Public, Roles } from './acting-user.decorators.js';
import { ActingUserGuard } from './acting-user.guard.js';

const knownUsers: Record<string, UserDto> = {
  'requester-1': { id: 'requester-1', name: 'Requester', role: 'requester' },
  'agent-1': { id: 'agent-1', name: 'Agent', role: 'agent' },
};

class TestController {
  @Public()
  publicRoute() {}

  @Roles('agent')
  agentOnlyRoute() {}

  anyUserRoute() {}
}

function contextFor(
  handler: keyof TestController,
  headers: Record<string, string> = {},
) {
  const request: { headers: Record<string, string>; user?: UserDto } = {
    headers,
  };
  const context = {
    getHandler: () => TestController.prototype[handler],
    getClass: () => TestController,
    switchToHttp: () => ({ getRequest: () => request }),
  } as unknown as ExecutionContext;
  return { context, request };
}

describe('ActingUserGuard', () => {
  const usersService = {
    findById: (id: string) => Promise.resolve(knownUsers[id] ?? null),
  } as unknown as UsersService;
  const guard = new ActingUserGuard(new Reflector(), usersService);

  it('rejects a request without the X-User-Id header with 401', async () => {
    const { context } = contextFor('anyUserRoute');

    await expect(guard.canActivate(context)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it('rejects an unknown user id with 401', async () => {
    const { context } = contextFor('anyUserRoute', {
      'x-user-id': 'nobody',
    });

    await expect(guard.canActivate(context)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it('rejects a user whose role is not allowed with 403', async () => {
    const { context } = contextFor('agentOnlyRoute', {
      'x-user-id': 'requester-1',
    });

    await expect(guard.canActivate(context)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  it('lets a user with an allowed role through and attaches it to the request', async () => {
    const { context, request } = contextFor('agentOnlyRoute', {
      'x-user-id': 'agent-1',
    });

    await expect(guard.canActivate(context)).resolves.toBe(true);
    expect(request.user).toEqual(knownUsers['agent-1']);
  });

  it('lets any known user through when the route requires no role', async () => {
    const { context } = contextFor('anyUserRoute', {
      'x-user-id': 'requester-1',
    });

    await expect(guard.canActivate(context)).resolves.toBe(true);
  });

  it('skips the user check on public routes', async () => {
    const { context } = contextFor('publicRoute');

    await expect(guard.canActivate(context)).resolves.toBe(true);
  });
});
