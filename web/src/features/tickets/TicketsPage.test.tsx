import { ApiError } from '@/api/client';
import type { Category, Page, TicketSummary, User } from '@/api/types';
import { AuthProvider } from '@/features/auth/AuthProvider';
import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { TicketsPage } from './TicketsPage';

const {
  listTickets,
  createTicket,
  takeTicket,
  releaseTicket,
  resolveTicket,
  listCategories,
  fetchCurrentUser,
} = vi.hoisted(() => ({
  listTickets: vi.fn(),
  createTicket: vi.fn(),
  takeTicket: vi.fn(),
  releaseTicket: vi.fn(),
  resolveTicket: vi.fn(),
  listCategories: vi.fn(),
  fetchCurrentUser: vi.fn(),
}));

vi.mock('./api', () => ({
  listTickets,
  createTicket,
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
const CARLA: User = { id: 'agent-1', name: 'Carla Ruiz', role: 'agent' };

const DAY = 86_400_000;

const TICKETS: TicketSummary[] = [
  {
    id: 't3',
    code: 'TCK-3',
    title: 'VPN drops every hour',
    categoryId: 'c2',
    state: 'resolved',
    requester: { id: 'requester-2', name: 'Martín Gómez' },
    assignee: { id: 'agent-1', name: 'Carla Ruiz' },
    createdAt: new Date(Date.now() - DAY).toISOString(),
  },
  {
    id: 't2',
    code: 'TCK-2',
    title: 'Badge reader broken',
    categoryId: 'c1',
    state: 'in_progress',
    requester: { id: 'requester-1', name: 'Lucía Fernández' },
    assignee: { id: 'agent-1', name: 'Carla Ruiz' },
    createdAt: new Date(Date.now() - 2 * DAY).toISOString(),
  },
  {
    id: 't1',
    code: 'TCK-1',
    title: 'Printer jammed',
    categoryId: 'c1',
    state: 'open',
    requester: { id: 'requester-1', name: 'Lucía Fernández' },
    assignee: null,
    createdAt: new Date(Date.now() - 5 * DAY).toISOString(),
  },
];

const CATEGORIES: Category[] = [
  { id: 'c1', name: 'Hardware', used: true },
  { id: 'c2', name: 'Access', used: true },
];

function page<T>(items: T[]): Page<T> {
  return { items, total: items.length, page: 1, limit: 20 };
}

function renderBoard(user: User) {
  localStorage.setItem('ticket-app.token', 'a-token');
  fetchCurrentUser.mockResolvedValue(user);
  return render(
    <MemoryRouter initialEntries={['/tickets']}>
      <AuthProvider>
        <Routes>
          <Route path="/tickets" element={<TicketsPage />} />
        </Routes>
      </AuthProvider>
    </MemoryRouter>,
  );
}

function column(name: RegExp) {
  return within(screen.getByRole('region', { name }));
}

describe('TicketsPage', () => {
  beforeEach(() => {
    localStorage.clear();
    listTickets.mockReset().mockResolvedValue(page(TICKETS));
    createTicket.mockReset().mockResolvedValue(undefined);
    takeTicket.mockReset().mockResolvedValue(undefined);
    releaseTicket.mockReset().mockResolvedValue(undefined);
    resolveTicket.mockReset().mockResolvedValue(undefined);
    listCategories.mockReset().mockResolvedValue(page(CATEGORIES));
    fetchCurrentUser.mockReset();
  });

  it('lays the tickets out in one column per state, with a count', async () => {
    renderBoard(CARLA);
    await screen.findByText('Printer jammed');

    // A board, not a report: the column is the state, so the card needs no badge.
    expect(column(/^Open/).getByText('Printer jammed')).toBeDefined();
    expect(
      column(/^In progress/).getByText('Badge reader broken'),
    ).toBeDefined();
    expect(column(/^Resolved/).getByText('VPN drops every hour')).toBeDefined();
    expect(screen.getByRole('heading', { name: 'Open 1' })).toBeDefined();
    expect(
      screen.getByRole('heading', { name: 'In progress 1' }),
    ).toBeDefined();
  });

  it('shows on each card who it is for, who has it, and how long it has waited', async () => {
    renderBoard(CARLA);
    await screen.findByText('Printer jammed');

    const taken = within(screen.getByRole('link', { name: /TCK-2/ }));
    expect(taken.getByText('Hardware')).toBeDefined();
    expect(taken.getByText('Lucía Fernández')).toBeDefined();
    expect(taken.getByTitle('Carla Ruiz')).toBeDefined();
    expect(taken.getByText('2 days ago')).toBeDefined();

    const open = within(screen.getByRole('link', { name: /TCK-1/ }));
    expect(open.getByText('Unassigned')).toBeDefined();
  });

  it('links each card to its ticket', async () => {
    renderBoard(CARLA);

    const card = await screen.findByRole('link', { name: /TCK-1/ });

    expect(card.getAttribute('href')).toBe('/tickets/t1');
  });

  it('lets a requester open a ticket without leaving the board', async () => {
    renderBoard(LUCIA);
    await screen.findByText('Printer jammed');

    fireEvent.click(screen.getByRole('button', { name: 'New ticket' }));
    fireEvent.change(await screen.findByLabelText('Title'), {
      target: { value: 'Monitor flickers' },
    });
    fireEvent.change(screen.getByLabelText('Description'), {
      target: { value: 'Every few seconds' },
    });
    fireEvent.change(screen.getByLabelText('Category'), {
      target: { value: 'c1' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Open ticket' }));

    await waitFor(() =>
      expect(createTicket).toHaveBeenCalledWith({
        title: 'Monitor flickers',
        description: 'Every few seconds',
        categoryId: 'c1',
      }),
    );
    await waitFor(() => expect(listTickets).toHaveBeenCalledTimes(2));
  });

  it('does not offer the new-ticket form to an agent', async () => {
    renderBoard(CARLA);
    await screen.findByText('Printer jammed');

    expect(screen.queryByRole('button', { name: 'New ticket' })).toBe(null);
  });

  it('keeps a requester from seeing who opened their own tickets', async () => {
    // Every card on a requester's board is theirs: the name would be noise.
    renderBoard(LUCIA);
    await screen.findByText('Printer jammed');

    const card = within(screen.getByRole('link', { name: /TCK-1/ }));
    expect(card.queryByText('Lucía Fernández')).toBe(null);
  });

  it('says so when there are no tickets', async () => {
    listTickets.mockResolvedValue(page<TicketSummary>([]));
    renderBoard(LUCIA);

    expect(await screen.findByText(/no tickets/i)).toBeDefined();
  });

  /** jsdom has no DataTransfer, so the drag carries the id through a stub. */
  function drag(from: string, toColumn: RegExp) {
    const data = new Map<string, string>();
    const dataTransfer = {
      setData: (key: string, value: string) => void data.set(key, value),
      getData: (key: string) => data.get(key) ?? '',
      effectAllowed: '',
      dropEffect: '',
    };
    const card = screen.getByRole('link', { name: new RegExp(from) });
    const target = screen.getByRole('region', { name: toColumn });
    fireEvent.dragStart(card, { dataTransfer });
    fireEvent.dragOver(target, { dataTransfer });
    fireEvent.drop(target, { dataTransfer });
    return target;
  }

  it('refreshes the board on demand', async () => {
    renderBoard(CARLA);
    await screen.findByText('Printer jammed');
    expect(listTickets).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole('button', { name: 'Refresh' }));

    // Nothing polls, and two agents share the queue: this is how you find out.
    await waitFor(() => expect(listTickets).toHaveBeenCalledTimes(2));
  });

  it('takes a ticket when an agent drags it into In progress', async () => {
    renderBoard(CARLA);
    await screen.findByText('Printer jammed');

    drag('TCK-1', /^In progress/);

    await waitFor(() => expect(takeTicket).toHaveBeenCalledWith('t1'));
    await waitFor(() => expect(listTickets).toHaveBeenCalledTimes(2));
  });

  it('resolves a ticket dragged from In progress to Resolved', async () => {
    renderBoard(CARLA);
    await screen.findByText('Badge reader broken');

    drag('TCK-2', /^Resolved/);

    await waitFor(() => expect(resolveTicket).toHaveBeenCalledWith('t2'));
  });

  it('releases a ticket dragged back to Open', async () => {
    renderBoard(CARLA);
    await screen.findByText('Badge reader broken');

    drag('TCK-2', /^Open/);

    await waitFor(() => expect(releaseTicket).toHaveBeenCalledWith('t2'));
  });

  it('refuses a drop that would skip a step', async () => {
    renderBoard(CARLA);
    await screen.findByText('Printer jammed');

    // Open straight to Resolved: the API would refuse, so the board does not
    // even pretend to accept it.
    drag('TCK-1', /^Resolved/);

    await waitFor(() => expect(resolveTicket).not.toHaveBeenCalled());
    expect(takeTicket).not.toHaveBeenCalled();
  });

  it('does not let a requester drag anything', async () => {
    renderBoard(LUCIA);
    await screen.findByText('Printer jammed');

    const card = screen.getByRole('link', { name: /TCK-1/ });
    expect(card.getAttribute('draggable')).not.toBe('true');

    drag('TCK-1', /^In progress/);
    await waitFor(() => expect(takeTicket).not.toHaveBeenCalled());
  });

  it("shows the API's message when a drag loses the race", async () => {
    takeTicket.mockRejectedValue(
      new ApiError(409, 'This ticket has already been taken'),
    );
    renderBoard(CARLA);
    await screen.findByText('Printer jammed');

    drag('TCK-1', /^In progress/);

    expect(
      await screen.findByText('This ticket has already been taken'),
    ).toBeDefined();
    // Reloaded anyway, so the board shows what the API holds.
    await waitFor(() => expect(listTickets).toHaveBeenCalledTimes(2));
  });
});
