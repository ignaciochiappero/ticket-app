import { ApiError } from '@/api/client';
import type { Category, Page, Ticket, User } from '@/api/types';
import { AuthProvider } from '@/features/auth/AuthProvider';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { TicketDetailPage } from './TicketDetailPage';

const {
  getTicket,
  updateTicket,
  deleteTicket,
  takeTicket,
  releaseTicket,
  resolveTicket,
  listCategories,
  fetchCurrentUser,
} = vi.hoisted(() => ({
  getTicket: vi.fn(),
  updateTicket: vi.fn(),
  deleteTicket: vi.fn(),
  takeTicket: vi.fn(),
  releaseTicket: vi.fn(),
  resolveTicket: vi.fn(),
  listCategories: vi.fn(),
  fetchCurrentUser: vi.fn(),
}));

vi.mock('./api', () => ({
  getTicket,
  updateTicket,
  deleteTicket,
  takeTicket,
  releaseTicket,
  resolveTicket,
}));
vi.mock('@/features/categories/api', () => ({ listCategories }));
vi.mock('@/features/auth/api', () => ({ fetchCurrentUser, login: vi.fn() }));

const LUCIA: User = {
  id: 'requester-1',
  name: 'Lucía Fernández',
  role: 'requester',
};
const MARTIN: User = {
  id: 'requester-2',
  name: 'Martín Gómez',
  role: 'requester',
};
const CARLA: User = { id: 'agent-1', name: 'Carla Ruiz', role: 'agent' };
const DIEGO: User = { id: 'agent-2', name: 'Diego López', role: 'agent' };
const TAKEN_BY_CARLA = {
  state: 'in_progress' as const,
  assignee: { id: 'agent-1', name: 'Carla Ruiz' },
};

function ticket(overrides: Partial<Ticket> = {}): Ticket {
  return {
    id: 't1',
    code: 'TCK-1',
    title: 'Printer jammed',
    description: 'It jams on every double-sided job.',
    categoryId: 'c1',
    state: 'open',
    requester: { id: 'requester-1', name: 'Lucía Fernández' },
    assignee: null,
    createdAt: '2026-09-15T15:00:00.000Z',
    history: [
      {
        type: 'created',
        actor: { id: 'requester-1', name: 'Lucía Fernández' },
        at: '2026-09-15T15:00:00.000Z',
      },
    ],
    ...overrides,
  };
}

function renderDetail(user: User) {
  localStorage.setItem('ticket-app.token', 'a-token');
  fetchCurrentUser.mockResolvedValue(user);
  return render(
    <MemoryRouter initialEntries={['/tickets/t1']}>
      <AuthProvider>
        <Routes>
          <Route path="/tickets" element={<p>Board</p>} />
          <Route path="/tickets/:id" element={<TicketDetailPage />} />
        </Routes>
      </AuthProvider>
    </MemoryRouter>,
  );
}

describe('TicketDetailPage', () => {
  beforeEach(() => {
    localStorage.clear();
    getTicket.mockReset().mockResolvedValue(ticket());
    updateTicket.mockReset().mockResolvedValue(ticket());
    deleteTicket.mockReset().mockResolvedValue(undefined);
    takeTicket.mockReset().mockResolvedValue(ticket(TAKEN_BY_CARLA));
    releaseTicket.mockReset().mockResolvedValue(ticket());
    resolveTicket.mockReset().mockResolvedValue(ticket());
    listCategories.mockReset().mockResolvedValue({
      items: [{ id: 'c1', name: 'Hardware', used: true }],
      total: 1,
      page: 1,
      limit: 100,
    } satisfies Page<Category>);
    fetchCurrentUser.mockReset();
  });

  it('shows the ticket with its code, state, description and timeline', async () => {
    renderDetail(LUCIA);

    expect(
      await screen.findByRole('heading', { name: 'Printer jammed' }),
    ).toBeDefined();
    expect(screen.getByText('TCK-1')).toBeDefined();
    expect(screen.getByText('Abierto')).toBeDefined();
    expect(
      screen.getByText('It jams on every double-sided job.'),
    ).toBeDefined();
    expect(screen.getByText(/abrió el ticket/)).toBeDefined();
  });

  it('offers the owner edit and delete while the ticket is open', async () => {
    renderDetail(LUCIA);
    await screen.findByRole('heading', { name: 'Printer jammed' });

    expect(screen.getByRole('button', { name: 'Editar' })).toBeDefined();
    expect(screen.getByRole('button', { name: 'Eliminar' })).toBeDefined();
  });

  it("takes the owner's actions away once the ticket is taken", async () => {
    getTicket.mockResolvedValue(
      ticket({
        state: 'in_progress',
        assignee: { id: 'agent-1', name: 'Carla Ruiz' },
      }),
    );
    renderDetail(LUCIA);
    await screen.findByRole('heading', { name: 'Printer jammed' });

    // The API would answer 409; the interface simply stops offering it, and
    // says why.
    expect(screen.queryByRole('button', { name: 'Editar' })).toBe(null);
    expect(screen.queryByRole('button', { name: 'Eliminar' })).toBe(null);
    expect(screen.getByText(/Carla Ruiz/)).toBeDefined();
  });

  it('tells a stranger the ticket is not theirs', async () => {
    getTicket.mockRejectedValue(
      new ApiError(403, 'This ticket belongs to someone else'),
    );
    renderDetail(MARTIN);

    expect(
      await screen.findByText('This ticket belongs to someone else'),
    ).toBeDefined();
  });

  it('edits the ticket in place and reloads it', async () => {
    renderDetail(LUCIA);
    await screen.findByRole('heading', { name: 'Printer jammed' });

    fireEvent.click(screen.getByRole('button', { name: 'Editar' }));
    const title = (await screen.findByLabelText('Título')) as HTMLInputElement;
    expect(title.value).toBe('Printer jammed');

    fireEvent.change(title, { target: { value: 'Printer on floor 3 jammed' } });
    fireEvent.click(screen.getByRole('button', { name: 'Guardar' }));

    await waitFor(() =>
      expect(updateTicket).toHaveBeenCalledWith('t1', {
        title: 'Printer on floor 3 jammed',
        description: 'It jams on every double-sided job.',
        categoryId: 'c1',
      }),
    );
    await waitFor(() => expect(getTicket).toHaveBeenCalledTimes(2));
  });

  it('deletes only after a second click, then returns to the board', async () => {
    renderDetail(LUCIA);
    await screen.findByRole('heading', { name: 'Printer jammed' });

    fireEvent.click(screen.getByRole('button', { name: 'Eliminar' }));
    expect(deleteTicket).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: 'Confirmar borrado' }));

    await waitFor(() => expect(deleteTicket).toHaveBeenCalledWith('t1'));
    expect(await screen.findByText('Board')).toBeDefined();
  });

  it('offers any agent the take action on an open ticket, then reloads it', async () => {
    renderDetail(CARLA);
    await screen.findByRole('heading', { name: 'Printer jammed' });

    fireEvent.click(screen.getByRole('button', { name: 'Tomar' }));

    await waitFor(() => expect(takeTicket).toHaveBeenCalledWith('t1'));
    // The page shows what the API now holds, not what the click assumed.
    await waitFor(() => expect(getTicket).toHaveBeenCalledTimes(2));
  });

  it('offers release and resolve only to the agent who took it', async () => {
    getTicket.mockResolvedValue(ticket(TAKEN_BY_CARLA));

    const { unmount } = renderDetail(CARLA);
    await screen.findByRole('heading', { name: 'Printer jammed' });
    expect(
      screen.getByRole('button', { name: 'Devolver a la cola' }),
    ).toBeDefined();
    expect(screen.getByRole('button', { name: 'Resolver' })).toBeDefined();
    expect(screen.queryByRole('button', { name: 'Tomar' })).toBe(null);
    unmount();

    renderDetail(DIEGO);
    await screen.findByRole('heading', { name: 'Printer jammed' });
    // Another agent sees whose it is, and nothing to press.
    expect(screen.queryByRole('button', { name: 'Devolver a la cola' })).toBe(
      null,
    );
    expect(screen.queryByRole('button', { name: 'Resolver' })).toBe(null);
    expect(screen.getByText(/Asignado a Carla Ruiz/)).toBeDefined();
  });

  it('resolves and releases through the API', async () => {
    getTicket.mockResolvedValue(ticket(TAKEN_BY_CARLA));
    renderDetail(CARLA);
    await screen.findByRole('heading', { name: 'Printer jammed' });

    fireEvent.click(screen.getByRole('button', { name: 'Resolver' }));
    await waitFor(() => expect(resolveTicket).toHaveBeenCalledWith('t1'));
  });

  it('offers nothing on a resolved ticket, to anyone', async () => {
    getTicket.mockResolvedValue(
      ticket({ ...TAKEN_BY_CARLA, state: 'resolved' }),
    );

    const { unmount } = renderDetail(CARLA);
    await screen.findByRole('heading', { name: 'Printer jammed' });
    for (const name of ['Tomar', 'Devolver a la cola', 'Resolver']) {
      expect(screen.queryByRole('button', { name })).toBe(null);
    }
    unmount();

    renderDetail(LUCIA);
    await screen.findByRole('heading', { name: 'Printer jammed' });
    expect(screen.queryByRole('button', { name: 'Editar' })).toBe(null);
    expect(screen.queryByRole('button', { name: 'Eliminar' })).toBe(null);
  });

  it('never offers the agent actions to a requester', async () => {
    renderDetail(LUCIA);
    await screen.findByRole('heading', { name: 'Printer jammed' });

    expect(screen.queryByRole('button', { name: 'Tomar' })).toBe(null);
  });

  it('says so when another agent got there first, and shows the real state', async () => {
    takeTicket.mockRejectedValue(
      new ApiError(409, 'Another agent took it first'),
    );
    // What the API holds by the time the page asks again.
    getTicket.mockResolvedValueOnce(ticket()).mockResolvedValue(
      ticket({
        state: 'in_progress',
        assignee: { id: 'agent-2', name: 'Diego López' },
      }),
    );
    renderDetail(CARLA);
    await screen.findByRole('heading', { name: 'Printer jammed' });

    fireEvent.click(screen.getByRole('button', { name: 'Tomar' }));

    expect(
      await screen.findByText('Another agent took it first'),
    ).toBeDefined();
    expect(await screen.findByText(/Asignado a Diego López/)).toBeDefined();
    expect(screen.queryByRole('button', { name: 'Tomar' })).toBe(null);
  });
});
