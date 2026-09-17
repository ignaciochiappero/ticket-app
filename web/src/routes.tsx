import { AppShell } from '@/components/layout/AppShell';
import { LoginPage } from '@/features/auth/LoginPage';
import { CategoriesPage } from '@/features/categories/CategoriesPage';
import { RequireAuth } from '@/features/auth/RequireAuth';
import { LandingPage } from '@/features/landing/LandingPage';
import { TicketsPage } from '@/features/tickets/TicketsPage';
import { Navigate, useRoutes, type RouteObject } from 'react-router';

// Every route the app has, in one place: what is public, what needs a session,
// and what needs a role. Screens are added here as they land.
const routes: RouteObject[] = [
  { path: '/', element: <LandingPage /> },
  { path: '/login', element: <LoginPage /> },
  {
    element: (
      <RequireAuth>
        <AppShell />
      </RequireAuth>
    ),
    children: [
      { path: '/tickets', element: <TicketsPage /> },
      {
        path: '/categories',
        element: (
          <RequireAuth role="agent">
            <CategoriesPage />
          </RequireAuth>
        ),
      },
    ],
  },
  { path: '*', element: <Navigate to="/" replace /> },
];

export function AppRoutes() {
  return useRoutes(routes);
}
