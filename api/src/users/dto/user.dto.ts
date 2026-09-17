import type { UserRole } from '../user.schema.js';

export class UserDto {
  /**
   * User id. Send it in the X-User-Id header (Authorize button) to act as this user.
   * @example "agent-1"
   */
  id: string;

  /**
   * Display name.
   * @example "Carla Ruiz"
   */
  name: string;

  /**
   * Requesters create and follow their own tickets; agents work the queue and manage categories.
   * @example "agent"
   */
  role: UserRole;
}
