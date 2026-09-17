import {
  ForbiddenException,
  UnauthorizedException,
  type ExecutionContext,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import type { ActingUser } from './auth.decorators.js';
import { Public, Roles } from './auth.decorators.js';
import { AuthGuard } from './auth.guard.js';

const jwtService = new JwtService({ secret: 'test-secret' });
const otherDeployment = new JwtService({ secret: 'another-secret' });

const agentToken = jwtService.sign(
  { sub: 'agent-1', role: 'agent' },
  { expiresIn: '8h' },
);
const requesterToken = jwtService.sign({
  sub: 'requester-1',
  role: 'requester',
});

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
  const request: { headers: Record<string, string>; user?: ActingUser } = {
    headers,
  };
  const context = {
    getHandler: () => TestController.prototype[handler],
    getClass: () => TestController,
    switchToHttp: () => ({ getRequest: () => request }),
  } as unknown as ExecutionContext;
  return { context, request };
}

describe('AuthGuard', () => {
  const guard = new AuthGuard(new Reflector(), jwtService);

  it('rejects a request without an Authorization header with 401', async () => {
    const { context } = contextFor('anyUserRoute');

    await expect(guard.canActivate(context)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it('rejects an Authorization header that is not a bearer token with 401', async () => {
    const basic = contextFor('anyUserRoute', {
      authorization: 'Basic dXNlcjpwYXNz',
    });
    const noValue = contextFor('anyUserRoute', { authorization: 'Bearer' });

    await expect(guard.canActivate(basic.context)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
    await expect(guard.canActivate(noValue.context)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it('rejects a token signed with another secret with 401', async () => {
    const { context } = contextFor('anyUserRoute', {
      authorization: `Bearer ${otherDeployment.sign({ sub: 'agent-1', role: 'agent' })}`,
    });

    await expect(guard.canActivate(context)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it('rejects an expired token with 401', async () => {
    const expired = jwtService.sign(
      { sub: 'agent-1', role: 'agent' },
      { expiresIn: '-1s' },
    );
    const { context } = contextFor('anyUserRoute', {
      authorization: `Bearer ${expired}`,
    });

    await expect(guard.canActivate(context)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it('rejects a user whose role is not allowed with 403', async () => {
    const { context } = contextFor('agentOnlyRoute', {
      authorization: `Bearer ${requesterToken}`,
    });

    await expect(guard.canActivate(context)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  it('lets an allowed role through and attaches the user from the token', async () => {
    const { context, request } = contextFor('agentOnlyRoute', {
      authorization: `Bearer ${agentToken}`,
    });

    await expect(guard.canActivate(context)).resolves.toBe(true);
    expect(request.user).toEqual({ id: 'agent-1', role: 'agent' });
  });

  it('reads the bearer scheme regardless of letter case, as HTTP defines it', async () => {
    const { context, request } = contextFor('anyUserRoute', {
      authorization: `bearer ${agentToken}`,
    });

    await expect(guard.canActivate(context)).resolves.toBe(true);
    expect(request.user).toEqual({ id: 'agent-1', role: 'agent' });
  });

  it('lets any logged-in user through when the route requires no role', async () => {
    const { context } = contextFor('anyUserRoute', {
      authorization: `Bearer ${requesterToken}`,
    });

    await expect(guard.canActivate(context)).resolves.toBe(true);
  });

  it('skips the token check on public routes', async () => {
    const { context } = contextFor('publicRoute');

    await expect(guard.canActivate(context)).resolves.toBe(true);
  });
});
