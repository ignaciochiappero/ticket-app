import { ApiError } from '@/api/client';
import type { Category, Page, TicketInput, TicketSummary } from '@/api/types';
import { icon } from '@/components/icons';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/features/auth/auth-context';
import { listCategories } from '@/features/categories/api';
import { useCallback, useEffect, useState } from 'react';
import {
  createTicket,
  listTickets,
  releaseTicket,
  resolveTicket,
  takeTicket,
} from './api';
import { Board } from './components/Board';
import { TicketForm } from './components/TicketForm';
import { ACTIVE_STATES } from './states';
import type { Move } from './transitions';

const RUN: Record<Move, (id: string) => Promise<unknown>> = {
  take: takeTicket,
  release: releaseTicket,
  resolve: resolveTicket,
};

/** How many resolved tickets the column shows, and grows by. */
const RESOLVED_STEP = 10;

// The API refuses a bigger page, on purpose: past this the answer is a filter,
// not a longer list. Until Phase 7 lands, the board says so instead of
// pretending the rest is not there.
const MAX_LIMIT = 100;

interface BoardData {
  active: Page<TicketSummary>;
  resolved: Page<TicketSummary>;
}

/**
 * One board for both roles. The API already scopes it (a requester gets their
 * own tickets, an agent every ticket), so the only things that differ here are
 * who gets the button to open one and whether a card names its requester.
 */
export function TicketsPage() {
  const { user } = useAuth();
  // Both columns are fetched together and drawn together, so they are one
  // piece of state: one null check then narrows both.
  const [board, setBoard] = useState<BoardData | null>(null);
  // How many resolved tickets to ask for. Pressing "Show more" raises it and
  // the board reloads that column: one request per press, no list to stitch
  // together, and the count survives the reload after a drag.
  const [resolvedLimit, setResolvedLimit] = useState(RESOLVED_STEP);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [moveError, setMoveError] = useState<string | null>(null);
  const [composing, setComposing] = useState(false);
  const [busy, setBusy] = useState(false);

  const isRequester = user?.role === 'requester';

  const load = useCallback(async () => {
    try {
      // One request per column rather than one page shared between them: a
      // single page of twenty could be spent entirely on `open` and leave
      // "In progress" looking empty while tickets sit in it.
      // Categories name the chip on each card and fill the form's dropdown.
      const [activePage, resolvedPage, categoryPage] = await Promise.all([
        listTickets(`?state=${ACTIVE_STATES.join(',')}&limit=${MAX_LIMIT}`),
        listTickets(`?state=resolved&limit=${resolvedLimit}`),
        listCategories(),
      ]);
      setBoard({ active: activePage, resolved: resolvedPage });
      setCategories(categoryPage.items);
      setLoadError(null);
    } catch {
      setLoadError('The tickets could not be loaded.');
    }
  }, [resolvedLimit]);

  useEffect(() => {
    // oxlint-disable-next-line react/set-state-in-effect
    void load();
  }, [load]);

  const open = async (values: TicketInput) => {
    await createTicket(values);
    setComposing(false);
    await load();
  };

  /**
   * A dropped card performs the move it stands for. It can still lose: another
   * agent took the ticket a moment earlier and the API answers 409. The
   * message is shown and the board reloaded either way, so what you see is
   * what the API holds rather than where the card was let go.
   */
  const move = async (ticket: TicketSummary, action: Move) => {
    setMoveError(null);
    setBusy(true);
    try {
      await RUN[action](ticket.id);
    } catch (caught) {
      setMoveError(
        caught instanceof ApiError
          ? caught.message
          : 'That move did not go through. Try again.',
      );
    } finally {
      setBusy(false);
      await load();
    }
  };

  return (
    <section className="space-y-6">
      <div className="flex items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-medium tracking-tight">Tickets</h1>
          <p className="mt-1 text-sm text-ink-muted">
            {board
              ? `${board.active.total + board.resolved.total} in total, newest first in each column.`
              : 'Loading…'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            disabled={busy}
            onClick={() => void load()}
          >
            <icon.refresh aria-hidden="true" />
            Refresh
          </Button>
          {isRequester && !composing && (
            <Button onClick={() => setComposing(true)}>
              <icon.add aria-hidden="true" />
              New ticket
            </Button>
          )}
        </div>
      </div>

      {composing && (
        <div className="rounded-panel bg-surface p-6">
          <h2 className="mb-5 text-lg font-medium">New ticket</h2>
          <TicketForm
            categories={categories}
            onSubmit={open}
            onCancel={() => setComposing(false)}
          />
        </div>
      )}

      {(loadError ?? moveError) && (
        <p
          role="alert"
          className="rounded-tile bg-destructive/10 px-3 py-2 text-sm text-destructive"
        >
          {loadError ?? moveError}
        </p>
      )}

      {/*
        A truncated board has to admit it. The live columns are asked for a
        hundred rows, and hiding the rest in silence is the same mistake as
        printing a total nobody can reach.
      */}
      {board && board.active.items.length < board.active.total && (
        <p
          role="status"
          className="rounded-tile bg-surface px-3 py-2 text-sm text-ink-muted"
        >
          Showing {board.active.items.length} of {board.active.total} active
          tickets. Narrowing the board is the way to see the rest.
        </p>
      )}

      {board && board.active.total + board.resolved.total === 0 && (
        <div className="rounded-panel bg-surface p-8 text-sm text-ink-muted">
          No tickets yet.{' '}
          {isRequester
            ? 'Open one and it will show up here.'
            : 'The queue is empty.'}
        </div>
      )}

      {board && board.active.total + board.resolved.total > 0 && (
        <Board
          tickets={[...board.active.items, ...board.resolved.items]}
          categories={categories}
          user={user}
          showRequester={!isRequester}
          onMove={move}
          resolvedTotal={board.resolved.total}
          // Capped: asking for more than the API allows comes back 400, which
          // would blank the board for somebody who only pressed a button.
          // Past a hundred the answer is a filter, not a longer column.
          canShowMore={
            board.resolved.items.length < board.resolved.total &&
            resolvedLimit < MAX_LIMIT
          }
          onShowMore={() =>
            setResolvedLimit((shown) =>
              Math.min(shown + RESOLVED_STEP, MAX_LIMIT),
            )
          }
        />
      )}
    </section>
  );
}
