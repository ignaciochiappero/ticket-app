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

const ACTIVE = TICKETS.filter((ticket) => ticket.state !== 'resolved');

function page<T>(items: T[], total = items.length): Page<T> {
  return { items, total, page: 1, limit: 20 };
}

// What the resolved column has to draw from. A test that cares about "Show
// more" replaces this with a pool bigger than one page.
let resolvedPool: TicketSummary[] = TICKETS.filter(
  (ticket) => ticket.state === 'resolved',
);

function resolvedTicket(n: number): TicketSummary {
  return {
    id: `r${n}`,
    code: `TCK-${100 + n}`,
    title: `Resolved ${n}`,
    categoryId: 'c1',
    state: 'resolved',
    requester: { id: 'requester-1', name: 'Lucía Fernández' },
    assignee: { id: 'agent-1', name: 'Carla Ruiz' },
    createdAt: new Date(Date.now() - n * DAY).toISOString(),
  };
}

/**
 * Stands in for the API: one answer per column, and the resolved one honours
 * the limit it was asked for. A mock that ignored the limit would let "Show
 * more" look like it worked while asking for nothing new.
 */
function answer(query = ''): Promise<Page<TicketSummary>> {
  if (String(query).includes('state=resolved')) {
    const limit = Number(/limit=(\d+)/.exec(String(query))?.[1] ?? 20);
    return Promise.resolve(
      page(resolvedPool.slice(0, limit), resolvedPool.length),
    );
  }
  return Promise.resolve(page(ACTIVE));
}

/** The search terms the board has actually asked the API for. */
function searches(): string[] {
  return listTickets.mock.calls
    .map(([query]) => /[?&]q=([^&]*)/.exec(String(query))?.[1])
    .filter((term): term is string => term !== undefined)
    .map((term) => decodeURIComponent(term));
}

/** The board asks once per column, so one reload is two calls, not one. */
function loads(): number {
  return listTickets.mock.calls.filter(([query]) =>
    String(query).includes('state=open'),
  ).length;
}

function renderBoard(user: User, at = '/tickets') {
  localStorage.setItem('ticket-app.token', 'a-token');
  fetchCurrentUser.mockResolvedValue(user);
  return render(
    <MemoryRouter initialEntries={[at]}>
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
    resolvedPool = TICKETS.filter((ticket) => ticket.state === 'resolved');
    listTickets.mockReset().mockImplementation(answer);
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
    await waitFor(() => expect(loads()).toBe(2));
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
    resolvedPool = [];
    listTickets.mockImplementation(() =>
      Promise.resolve(page<TicketSummary>([])),
    );
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
    expect(loads()).toBe(1);

    fireEvent.click(screen.getByRole('button', { name: 'Refresh' }));

    // Nothing polls, and two agents share the queue: this is how you find out.
    await waitFor(() => expect(loads()).toBe(2));
  });

  it('takes a ticket when an agent drags it into In progress', async () => {
    renderBoard(CARLA);
    await screen.findByText('Printer jammed');

    drag('TCK-1', /^In progress/);

    await waitFor(() => expect(takeTicket).toHaveBeenCalledWith('t1'));
    await waitFor(() => expect(loads()).toBe(2));
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
    await waitFor(() => expect(loads()).toBe(2));
  });

  function manyResolved(count: number) {
    resolvedPool = Array.from({ length: count }, (_, index) =>
      resolvedTicket(index + 1),
    );
  }

  it('asks once per column, so a full column cannot empty another', async () => {
    renderBoard(CARLA);
    await screen.findByText('Printer jammed');

    const queries = listTickets.mock.calls.map(([query]) => String(query));

    // One page shared by three columns could spend all twenty rows on `open`
    // and leave "In progress" looking empty while tickets sit in it.
    expect(queries).toContain('?state=open,in_progress&limit=100');
    expect(queries).toContain('?state=resolved&limit=10');
  });

  it('starts the resolved column at ten and says how many there are', async () => {
    manyResolved(25);
    renderBoard(CARLA);

    await waitFor(() =>
      expect(column(/^Resolved/).getAllByRole('link')).toHaveLength(10),
    );
    // The heading counts every resolved ticket, not the ten on screen.
    expect(screen.getByRole('heading', { name: 'Resolved 25' })).toBeDefined();
  });

  it('brings the next ten without touching the other columns', async () => {
    manyResolved(25);
    renderBoard(CARLA);
    await waitFor(() =>
      expect(column(/^Resolved/).getAllByRole('link')).toHaveLength(10),
    );

    fireEvent.click(screen.getByRole('button', { name: /show more/i }));

    await waitFor(() =>
      expect(column(/^Resolved/).getAllByRole('link')).toHaveLength(20),
    );
    expect(column(/^Open/).getAllByRole('link')).toHaveLength(1);
    expect(column(/^In progress/).getAllByRole('link')).toHaveLength(1);
  });

  it('stops at the biggest page the API allows', async () => {
    manyResolved(150);
    renderBoard(CARLA);
    await waitFor(() =>
      expect(column(/^Resolved/).getAllByRole('link')).toHaveLength(10),
    );

    for (let shown = 20; shown <= 100; shown += 10) {
      fireEvent.click(screen.getByRole('button', { name: /show more/i }));
      await waitFor(() =>
        expect(column(/^Resolved/).getAllByRole('link')).toHaveLength(shown),
      );
    }

    // Asking for 110 comes back 400 and would blank the board for somebody who
    // only pressed a button. The heading still says how many there really are.
    expect(screen.queryByRole('button', { name: /show more/i })).toBe(null);
    expect(screen.getByRole('heading', { name: 'Resolved 150' })).toBeDefined();
  });

  it('drops the button once every resolved ticket is on screen', async () => {
    renderBoard(CARLA);
    await screen.findByText('VPN drops every hour');

    // One resolved ticket, already drawn: there is nothing left to ask for.
    expect(screen.queryByRole('button', { name: /show more/i })).toBe(null);
  });

  it('asks the API for the search term instead of sifting what it holds', async () => {
    renderBoard(CARLA);
    await screen.findByText('Printer jammed');

    fireEvent.change(screen.getByLabelText('Search'), {
      target: { value: 'printer' },
    });

    // Nothing goes out while somebody is still typing: a board of thousands
    // would be a request per keystroke.
    expect(searches()).toEqual([]);

    fireEvent.submit(screen.getByRole('search'));

    // Both columns carry the term, so neither shows tickets the other filtered.
    await waitFor(() => expect(searches()).toEqual(['printer', 'printer']));
  });

  it('reads the search term from the URL, so a filtered board is a link', async () => {
    renderBoard(CARLA, '/tickets?q=vpn');

    await waitFor(() => expect(searches()).toEqual(['vpn', 'vpn']));
  });

  it('brings the whole board back when the box is cleared', async () => {
    renderBoard(CARLA, '/tickets?q=vpn');
    await waitFor(() => expect(searches()).toHaveLength(2));

    fireEvent.change(screen.getByLabelText('Search'), {
      target: { value: '' },
    });
    fireEvent.submit(screen.getByRole('search'));

    // Asked again, this time without the term, rather than reusing the old page.
    await waitFor(() => expect(loads()).toBe(2));
    expect(searches()).toHaveLength(2);
  });

  it('says so when it cannot show every active ticket', async () => {
    // The live columns are asked for a hundred rows. Past that the board is
    // truncated, and a board that hides tickets in silence is worse than one
    // that admits it.
    listTickets.mockImplementation((query = '') =>
      String(query).includes('state=resolved')
        ? Promise.resolve(page<TicketSummary>([]))
        : Promise.resolve(page(ACTIVE, 137)),
    );
    renderBoard(CARLA);

    const notice = await screen.findByRole('status');

    expect(notice.textContent).toMatch(/2 of 137 active/i);
  });
});
