import type { User } from '@/api/types';
import { createContext, useContext } from 'react';

export type AuthStatus = 'loading' | 'signed-in' | 'signed-out';

export interface AuthValue {
  status: AuthStatus;
  user: User | null;
  signIn: (username: string, password: string) => Promise<void>;
  signOut: () => void;
}

// The context and its hook live apart from the provider on purpose: a module
// that exports both a component and a plain value loses Fast Refresh, so
// editing the provider would remount every screen under it.
export const AuthContext = createContext<AuthValue | null>(null);

/** How every screen below AuthProvider reads the session. */
export function useAuth(): AuthValue {
  const value = useContext(AuthContext);
  if (!value) {
    throw new Error('useAuth must be used inside AuthProvider');
  }
  return value;
}
