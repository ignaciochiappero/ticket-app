import { apiFetch } from '@/api/client';
import type { User } from '@/api/types';

/**
 * Everyone, for the filter dropdowns. A fixed reference list rather than a
 * growing one, so it is not paginated: eight people, one request.
 */
export function listUsers(): Promise<User[]> {
  return apiFetch('/users');
}
