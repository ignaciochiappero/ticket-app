// Hand-written mirrors of the API's response DTOs. The API is the source of
// truth; these are kept in step by hand, which is the cost of not generating a
// client (see the design's "Validation library per side" decision).

export type Role = 'requester' | 'agent';

export interface User {
  id: string;
  name: string;
  role: Role;
}

export interface LoginResponse {
  token: string;
}

export interface Category {
  id: string;
  name: string;
  used: boolean;
}

/** Every list that can grow answers with this shape. */
export interface Page<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
}
