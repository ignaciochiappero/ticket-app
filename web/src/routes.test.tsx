import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthProvider } from '@/features/auth/AuthProvider';
import { AppRoutes } from '@/routes';

const { login, fetchCurrentUser } = vi.hoisted(() => ({
  login: vi.fn(),
  fetchCurrentUser: vi.fn(),
}));

vi.mock('@/features/auth/api', () => ({ login, fetchCurrentUser }));

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </MemoryRouter>,
  );
}

describe('routes', () => {
  beforeEach(() => {
    localStorage.clear();
    fetchCurrentUser.mockReset();
  });

  it('offers the way in from the front door', () => {
    renderAt('/');

    expect(screen.getByRole('heading', { name: 'Ticket App' })).toBeDefined();
    expect(screen.getByRole('link', { name: 'Ingresar' })).toBeDefined();
  });

  it('sends a visitor with no session to the login screen', () => {
    renderAt('/tickets');

    expect(screen.getByRole('heading', { name: 'Ingresar' })).toBeDefined();
  });

  it('shows the shell to a signed-in user', async () => {
    localStorage.setItem('ticket-app.token', 'a-token');
    fetchCurrentUser.mockResolvedValue({
      id: 'agent-1',
      name: 'Carla Ruiz',
      role: 'agent',
    });

    renderAt('/tickets');

    expect(await screen.findByText('Carla Ruiz')).toBeDefined();
    expect(screen.getByRole('link', { name: 'Categorías' })).toBeDefined();
  });

  it('hides the agent-only navigation from a requester', async () => {
    localStorage.setItem('ticket-app.token', 'a-token');
    fetchCurrentUser.mockResolvedValue({
      id: 'requester-1',
      name: 'Lucía Fernández',
      role: 'requester',
    });

    renderAt('/tickets');

    expect(await screen.findByText('Lucía Fernández')).toBeDefined();
    expect(screen.queryByRole('link', { name: 'Categorías' })).toBe(null);
  });

  it('keeps a requester out of the agent-only back office', async () => {
    localStorage.setItem('ticket-app.token', 'a-token');
    fetchCurrentUser.mockResolvedValue({
      id: 'requester-1',
      name: 'Lucía Fernández',
      role: 'requester',
    });

    renderAt('/categories');

    // Bounced to their own board rather than shown an empty screen.
    expect(
      await screen.findByRole('heading', { name: 'Tickets' }),
    ).toBeDefined();
    expect(screen.queryByRole('heading', { name: 'Categorías' })).toBe(null);
  });

  it('takes an unknown path back to the front door', () => {
    renderAt('/nowhere');

    expect(screen.getByRole('link', { name: 'Ingresar' })).toBeDefined();
  });
});
