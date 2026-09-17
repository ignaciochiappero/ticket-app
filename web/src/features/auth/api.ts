import { apiFetch } from '@/api/client';
import type { LoginResponse, User } from '@/api/types';

export function login(credentials: {
  username: string;
  password: string;
}): Promise<LoginResponse> {
  return apiFetch('/auth/login', {
    method: 'POST',
    body: JSON.stringify(credentials),
  });
}

export function fetchCurrentUser(): Promise<User> {
  return apiFetch('/auth/me');
}
