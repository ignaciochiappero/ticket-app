import { useAuth } from '@/features/auth/AuthContext';

// Placeholder until the ticket endpoints land: the board, its filters and the
// detail view replace this. It says what it is instead of pretending to load.
export function TicketsPage() {
  const { user } = useAuth();

  return (
    <section>
      <h1 className="text-2xl font-medium tracking-tight">Tickets</h1>
      <p className="mt-2 text-sm text-ink-muted">
        Signed in as {user?.name}, so the session, the role and the shell all
        work end to end.
      </p>
      <div className="mt-6 rounded-panel bg-surface p-8">
        <p className="text-sm text-ink-muted">
          The board arrives with the ticket endpoints:{' '}
          {user?.role === 'agent'
            ? 'every ticket, filterable by state, category, assignee and text.'
            : 'your own tickets, and the form to open a new one.'}
        </p>
      </div>
    </section>
  );
}
