import { randomBytes } from 'node:crypto';
import { Logger } from '@nestjs/common';

export const SESSION_MAX_AGE_MS = 8 * 60 * 60 * 1000;

// No secret is ever committed. Without JWT_SECRET the API still runs with a random one,
// so a fresh clone works with no setup; the cost is that tokens stop working on every restart.
export function resolveSessionSecret(): string {
  const fromEnvironment = process.env.JWT_SECRET;
  if (fromEnvironment) {
    return fromEnvironment;
  }

  new Logger('Auth').warn(
    'JWT_SECRET is not set: using a random secret, so tokens stop working when the API restarts',
  );
  return randomBytes(32).toString('hex');
}
