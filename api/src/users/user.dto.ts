import type { UserRole } from './user.schema.js';

export class UserDto {
  id: string;
  name: string;
  role: UserRole;
}
