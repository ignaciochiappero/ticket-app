import type { Role } from '@/api/types';
import { Navigate } from 'react-router';
import type { ReactNode } from 'react';
import { useAuth } from './AuthContext';

/**
 * Keeps a route behind a session, and optionally behind a role. This is for the
 * interface only: the API enforces both on every request, so a user who edits
 * their way past this guard still gets a 401 or a 403.
 */
export function RequireAuth({
  role,
  children,
}: {
  role?: Role;
  children: ReactNode;
}) {
  const { status, user } = useAuth();

  if (status === 'loading') {
    return (
      <p className="p-8 text-sm text-muted-foreground">
        Checking your session…
      </p>
    );
  }
  if (status === 'signed-out' || !user) {
    return <Navigate to="/login" replace />;
  }
  if (role && user.role !== role) {
    return <Navigate to="/tickets" replace />;
  }
  return children;
}
