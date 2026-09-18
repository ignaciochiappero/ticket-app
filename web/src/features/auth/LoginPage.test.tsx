import { ApiError } from '@/api/client';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthProvider } from './AuthProvider';
import { LoginPage } from './LoginPage';

const { login, fetchCurrentUser } = vi.hoisted(() => ({
  login: vi.fn(),
  fetchCurrentUser: vi.fn(),
}));

vi.mock('./api', () => ({ login, fetchCurrentUser }));

function renderLogin() {
  return render(
    <MemoryRouter>
      <AuthProvider>
        <LoginPage />
      </AuthProvider>
    </MemoryRouter>,
  );
}

function fillIn(username: string, password: string) {
  fireEvent.change(screen.getByLabelText('Username'), {
    target: { value: username },
  });
  fireEvent.change(screen.getByLabelText('Password'), {
    target: { value: password },
  });
}

function submit() {
  fireEvent.click(screen.getByRole('button', { name: 'Sign in' }));
}

describe('LoginPage', () => {
  beforeEach(() => {
    localStorage.clear();
    login.mockReset();
    fetchCurrentUser.mockReset();
  });

  it('asks for the missing fields instead of calling the API', async () => {
    renderLogin();

    submit();

    expect(await screen.findByText('Enter your username')).toBeDefined();
    expect(screen.getByText('Enter your password')).toBeDefined();
    expect(login).not.toHaveBeenCalled();
  });

  it('shows what the API said when the credentials are wrong', async () => {
    login.mockRejectedValue(new ApiError(401, 'Wrong username or password'));
    renderLogin();

    fillIn('carla.ruiz', 'nope');
    submit();

    expect(await screen.findByText('Wrong username or password')).toBeDefined();
  });

  it('signs in with the credentials as typed', async () => {
    login.mockResolvedValue({ token: 'a-token' });
    fetchCurrentUser.mockResolvedValue({
      id: 'agent-1',
      name: 'Carla Ruiz',
      role: 'agent',
    });
    renderLogin();

    fillIn('  carla.ruiz  ', 'ticket-demo');
    submit();

    // Trimmed: a username pasted with a trailing space is not a wrong username.
    await waitFor(() =>
      expect(login).toHaveBeenCalledWith({
        username: 'carla.ruiz',
        password: 'ticket-demo',
      }),
    );
  });
});
