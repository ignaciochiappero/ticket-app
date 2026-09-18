import { ApiError } from '@/api/client';
import type { Category, Ticket, TicketInput } from '@/api/types';
import { icon } from '@/components/icons';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/features/auth/auth-context';
import { listCategories } from '@/features/categories/api';
import { formatDateTime, timeAgo } from '@/helpers/datetime';
import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import {
  deleteTicket,
  getTicket,
  releaseTicket,
  resolveTicket,
  takeTicket,
  updateTicket,
} from './api';
import { StateBadge } from './components/StateBadge';
import { TicketForm } from './components/TicketForm';
import { Timeline } from './components/Timeline';

export function TicketDetailPage() {
  const { id = '' } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [ticket, setTicket] = useState<Ticket | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      // The categories resolve the ids in the timeline and fill the edit form.
      const [loaded, page] = await Promise.all([
        getTicket(id),
        listCategories(),
      ]);
      setTicket(loaded);
      setCategories(page.items);
      setError(null);
    } catch (caught) {
      // A 403 or 404 is the API being precise about why; say exactly that.
      setError(
        caught instanceof ApiError
          ? caught.message
          : 'The ticket could not be loaded.',
      );
    }
  }, [id]);

  useEffect(() => {
    // oxlint-disable-next-line react/set-state-in-effect
    void load();
  }, [load]);

  const save = async (values: TicketInput) => {
    await updateTicket(id, values);
    setEditing(false);
    await load();
  };

  const remove = async () => {
    await deleteTicket(id);
    void navigate('/tickets');
  };

  /**
   * A transition can lose: another agent takes the ticket a moment earlier and
   * the API answers 409. The message is shown, and the ticket is reloaded
   * either way, so the page shows what the API holds rather than what the
   * click assumed.
   */
  const transition = async (run: (ticketId: string) => Promise<Ticket>) => {
    setActionError(null);
    setBusy(true);
    try {
      await run(id);
    } catch (caught) {
      setActionError(
        caught instanceof ApiError
          ? caught.message
          : 'Something went wrong. Try again.',
      );
    } finally {
      setBusy(false);
      await load();
    }
  };

  if (error) {
    return (
      <section className="space-y-4">
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
        <Link to="/tickets" className="text-sm text-ink-muted hover:text-ink">
          Back to the board
        </Link>
      </section>
    );
  }
  if (!ticket) {
    return <p className="text-sm text-ink-dim">Loading…</p>;
  }

  // The interface offers only what the API would accept. The rules live in
  // the API; this mirrors them so nobody is offered a button that will fail.
  const isOwner = user?.role === 'requester' && ticket.requester.id === user.id;
  const ownerCanAct = isOwner && ticket.state === 'open';
  const isAgent = user?.role === 'agent';
  const isAssignee = isAgent && ticket.assignee?.id === user.id;
  const canTake = isAgent && ticket.state === 'open';
  const canWork = isAssignee && ticket.state === 'in_progress';

  return (
    <section className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <Link
          to="/tickets"
          className="inline-flex items-center gap-1.5 text-sm text-ink-muted hover:text-ink"
        >
          <icon.back className="size-4" aria-hidden="true" />
          Board
        </Link>
        <Button
          variant="ghost"
          size="sm"
          disabled={busy}
          onClick={() => void load()}
        >
          <icon.refresh aria-hidden="true" />
          Refresh
        </Button>
      </div>

      {editing ? (
        <div className="rounded-panel bg-surface p-6">
          <h2 className="mb-5 text-lg font-medium">Edit {ticket.code}</h2>
          <TicketForm
            categories={categories}
            initial={{
              title: ticket.title,
              description: ticket.description,
              categoryId: ticket.categoryId,
            }}
            onSubmit={save}
            onCancel={() => setEditing(false)}
          />
        </div>
      ) : (
        <header className="space-y-3">
          <div className="flex flex-wrap items-center gap-3">
            <span className="font-medium text-accent-300">{ticket.code}</span>
            <StateBadge state={ticket.state} />
          </div>
          <h1 className="text-2xl font-medium tracking-tight">
            {ticket.title}
          </h1>
          <p className="text-sm text-ink-muted">
            Opened by {ticket.requester.name}{' '}
            <time
              dateTime={ticket.createdAt}
              title={formatDateTime(ticket.createdAt)}
            >
              {timeAgo(ticket.createdAt)}
            </time>
            {' · '}
            {ticket.assignee ? (
              <>Assigned to {ticket.assignee.name}</>
            ) : (
              <span className="text-ink-dim">Unassigned</span>
            )}
          </p>

          {ownerCanAct && (
            <div className="flex gap-2 pt-1">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => {
                  setConfirming(false);
                  setEditing(true);
                }}
              >
                <icon.edit aria-hidden="true" />
                Edit
              </Button>
              {confirming ? (
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => void remove()}
                >
                  <icon.delete aria-hidden="true" />
                  Confirm delete
                </Button>
              ) : (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setConfirming(true)}
                >
                  <icon.delete aria-hidden="true" />
                  Delete
                </Button>
              )}
            </div>
          )}
          {isOwner && !ownerCanAct && (
            <p className="text-sm text-ink-dim">
              Once an agent takes a ticket, only they can change it.
            </p>
          )}

          {canTake && (
            <div className="pt-1">
              <Button
                size="sm"
                disabled={busy}
                onClick={() => void transition(takeTicket)}
              >
                <icon.take aria-hidden="true" />
                Take
              </Button>
            </div>
          )}
          {canWork && (
            <div className="flex gap-2 pt-1">
              <Button
                size="sm"
                disabled={busy}
                onClick={() => void transition(resolveTicket)}
              >
                <icon.resolve aria-hidden="true" />
                Resolve
              </Button>
              <Button
                variant="secondary"
                size="sm"
                disabled={busy}
                onClick={() => void transition(releaseTicket)}
              >
                <icon.release aria-hidden="true" />
                Release
              </Button>
            </div>
          )}
          {isAgent && ticket.state === 'in_progress' && !isAssignee && (
            <p className="text-sm text-ink-dim">
              Only the agent who took it can release or resolve it.
            </p>
          )}

          {actionError && (
            <p
              role="alert"
              className="rounded-tile bg-destructive/10 px-3 py-2 text-sm text-destructive"
            >
              {actionError}
            </p>
          )}
        </header>
      )}

      {!editing && (
        <div className="rounded-panel bg-surface p-6">
          <h2 className="mb-3 text-xs tracking-widest text-ink-dim uppercase">
            Description
          </h2>
          <p className="whitespace-pre-wrap text-ink">{ticket.description}</p>
        </div>
      )}

      <div className="rounded-panel bg-surface p-6">
        <h2 className="mb-5 text-xs tracking-widest text-ink-dim uppercase">
          History
        </h2>
        <Timeline history={ticket.history} categories={categories} />
      </div>
    </section>
  );
}
