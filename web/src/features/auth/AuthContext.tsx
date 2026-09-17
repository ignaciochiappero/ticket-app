import { readToken, writeToken } from '@/api/client';
import type { User } from '@/api/types';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { fetchCurrentUser, login } from './api';

type Status = 'loading' | 'signed-in' | 'signed-out';

interface AuthValue {
  status: Status;
  user: User | null;
  signIn: (username: string, password: string) => Promise<void>;
  signOut: () => void;
}

const AuthContext = createContext<AuthValue | null>(null);

// The token is the only thing kept in storage. Who it belongs to always comes
// from GET /auth/me, so the app never trusts anything it could have edited.
export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<Status>(() =>
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

export function useAuth(): AuthValue {
  const value = useContext(AuthContext);
  if (!value) {
    throw new Error('useAuth must be used inside AuthProvider');
  }
  return value;
}
