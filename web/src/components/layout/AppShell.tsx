import { useAuth } from '@/features/auth/AuthContext';
import { Button } from '@/components/ui/button';
import { NavLink, Outlet } from 'react-router';
import { cn } from '@/lib/utils';

const LINK_BASE =
  'rounded-tile px-3 py-1.5 text-sm transition-colors hover:bg-accent';

function NavItem({ to, children }: { to: string; children: string }) {
  return (
    <NavLink
      to={to}
      className={({ isActive }) =>
        cn(LINK_BASE, isActive ? 'bg-accent text-ink' : 'text-ink-muted')
      }
    >
      {children}
    </NavLink>
  );
}

/** The frame every signed-in screen sits in: who you are, where you can go, and out. */
export function AppShell() {
  const { user, signOut } = useAuth();

  return (
    <div className="min-h-dvh bg-ground">
      {/* Separated from the page by luminance, not by a rule. */}
      <header className="bg-surface">
        <div className="mx-auto flex max-w-5xl items-center gap-6 px-6 py-3">
          <span className="font-medium tracking-tight">Ticket App</span>
          <nav className="flex items-center gap-1">
            <NavItem to="/tickets">Tickets</NavItem>
            {user?.role === 'agent' && (
              <NavItem to="/categories">Categories</NavItem>
            )}
          </nav>
          <div className="ml-auto flex items-center gap-3">
            <span className="text-sm text-ink-muted">
              {user?.name}
              <span className="text-ink-dim"> · {user?.role}</span>
            </span>
            <Button variant="ghost" size="sm" onClick={signOut}>
              Sign out
            </Button>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-6 py-8">
        <Outlet />
      </main>
    </div>
  );
}
