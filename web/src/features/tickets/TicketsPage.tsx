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
import type { Move } from './transitions';

const RUN: Record<Move, (id: string) => Promise<unknown>> = {
  take: takeTicket,
  release: releaseTicket,
  resolve: resolveTicket,
};

/**
 * One board for both roles. The API already scopes it (a requester gets their
 * own tickets, an agent every ticket), so the only things that differ here are
 * who gets the button to open one and whether a card names its requester.
 */
export function TicketsPage() {
  const { user } = useAuth();
  const [board, setBoard] = useState<Page<TicketSummary> | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [moveError, setMoveError] = useState<string | null>(null);
  const [composing, setComposing] = useState(false);
  const [busy, setBusy] = useState(false);

  const isRequester = user?.role === 'requester';

  const load = useCallback(async () => {
    try {
      // Categories name the chip on each card and fill the form's dropdown.
      const [tickets, page] = await Promise.all([
        listTickets(),
        listCategories(),
      ]);
      setBoard(tickets);
      setCategories(page.items);
      setLoadError(null);
    } catch {
      setLoadError('The tickets could not be loaded.');
    }
  }, []);

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
            {board ? `${board.total} in total, newest first.` : 'Loading…'}
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

      {board && board.items.length === 0 && (
        <div className="rounded-panel bg-surface p-8 text-sm text-ink-muted">
          No tickets yet.{' '}
          {isRequester
            ? 'Open one and it will show up here.'
            : 'The queue is empty.'}
        </div>
      )}

      {board && board.items.length > 0 && (
        <Board
          tickets={board.items}
          categories={categories}
          user={user}
          showRequester={!isRequester}
          onMove={move}
        />
      )}
    </section>
  );
}
