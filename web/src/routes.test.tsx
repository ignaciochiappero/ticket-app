import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthProvider } from '@/features/auth/AuthContext';
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
    expect(screen.getByRole('link', { name: 'Sign in' })).toBeDefined();
  });

  it('sends a visitor with no session to the login screen', () => {
    renderAt('/tickets');

    expect(screen.getByRole('heading', { name: 'Sign in' })).toBeDefined();
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
    expect(screen.getByRole('link', { name: 'Categories' })).toBeDefined();
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
    expect(screen.queryByRole('link', { name: 'Categories' })).toBe(null);
  });

  it('takes an unknown path back to the front door', () => {
    renderAt('/nowhere');

    expect(screen.getByRole('link', { name: 'Sign in' })).toBeDefined();
  });
});
