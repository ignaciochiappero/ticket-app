import { readToken, writeToken } from '@/api/client';
import type { User } from '@/api/types';
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { fetchCurrentUser, login } from './api';
import { AuthContext, type AuthStatus } from './auth-context';

// The token is the only thing kept in storage. Who it belongs to always comes
// from GET /auth/me, so the app never trusts anything it could have edited.
export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<AuthStatus>(() =>
    readToken() ? 'loading' : 'signed-out',
  );
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    if (!readToken()) {
      return;
    }
    // A token that no longer works is cleared by the client, so landing here
    // with an expired session shows the login screen rather than an error.
    fetchCurrentUser()
      .then((current) => {
        setUser(current);
        setStatus('signed-in');
      })
      .catch(() => {
        setUser(null);
        setStatus('signed-out');
      });
  }, []);

  const signIn = useCallback(async (username: string, password: string) => {
    const { token } = await login({ username, password });
    writeToken(token);
    setUser(await fetchCurrentUser());
    setStatus('signed-in');
  }, []);

  const signOut = useCallback(() => {
    writeToken(null);
    setUser(null);
    setStatus('signed-out');
  }, []);

  const value = useMemo(
    () => ({ status, user, signIn, signOut }),
    [status, user, signIn, signOut],
  );
  return <AuthContext value={value}>{children}</AuthContext>;
}
