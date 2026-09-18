import { Button } from '@/components/ui/button';
import { useAuth } from '@/features/auth/auth-context';
import { Link, Navigate } from 'react-router';

/** The front door: what this is, and the way in. Nothing else. */
export function LandingPage() {
  const { status } = useAuth();

  if (status === 'signed-in') {
    return <Navigate to="/tickets" replace />;
  }

  return (
    <main className="grid min-h-dvh place-items-center bg-ground px-6">
      <div className="w-full max-w-md rounded-panel bg-surface p-10">
        <p className="text-xs tracking-widest text-ink-dim uppercase">
          Internal support
        </p>
        <h1 className="mt-3 text-3xl font-medium tracking-tight">Ticket App</h1>
        <p className="mt-4 text-sm leading-relaxed text-ink-muted">
          Open a support request and follow it to the end. Agents work the queue
          from the same board, and every change is recorded with who made it and
          when.
        </p>
        <Button asChild className="mt-8 w-full">
          <Link to="/login">Sign in</Link>
        </Button>
      </div>
    </main>
  );
}
