import { useAuth } from '@/features/auth/auth-context';
import { icon, type IconName } from '@/components/icons';
import { Button } from '@/components/ui/button';
import { NavLink, Outlet } from 'react-router';
import { cn } from '@/lib/utils';

const LINK_BASE =
  'rounded-tile px-3 py-1.5 text-sm transition-colors hover:bg-accent';

function NavItem({
  to,
  icon: name,
  children,
}: {
  to: string;
  icon: IconName;
  children: string;
}) {
  const Glyph = icon[name];
  return (
    <NavLink
      to={to}
      className={({ isActive }) =>
        cn(
          LINK_BASE,
          'inline-flex items-center gap-1.5',
          isActive ? 'bg-accent text-ink' : 'text-ink-muted',
        )
      }
    >
      <Glyph className="size-3.5" aria-hidden="true" />
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
            <NavItem to="/tickets" icon="tickets">
              Tickets
            </NavItem>
            {user?.role === 'agent' && (
              <NavItem to="/categories" icon="categories">
                Categories
              </NavItem>
            )}
          </nav>
          <div className="ml-auto flex items-center gap-3">
            <span className="text-sm text-ink-muted">
              {user?.name}
              <span className="text-ink-dim"> · {user?.role}</span>
            </span>
            <Button variant="ghost" size="sm" onClick={signOut}>
              <icon.signOut aria-hidden="true" />
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
