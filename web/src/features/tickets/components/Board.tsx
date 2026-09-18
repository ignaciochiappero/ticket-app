import type { Category, TicketState, TicketSummary, User } from '@/api/types';
import { icon } from '@/components/icons';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useState } from 'react';
import { TICKET_DRAG_TYPE, TicketCard } from './TicketCard';
import { STATE_LABEL, STATES } from '../states';
import { moveFor, type Move } from '../transitions';

interface Props {
  tickets: TicketSummary[];
  categories: Category[];
  user: User | null;
  showRequester: boolean;
  onMove: (ticket: TicketSummary, move: Move) => Promise<void>;
  /**
   * How many resolved tickets exist, which is not how many are drawn. Open
   * and In progress hold live work and bound themselves; Resolved is the one
   * column that only ever grows, so it arrives ten at a time.
   */
  resolvedTotal: number;
  /** False once the column holds everything, or everything the API will give. */
  canShowMore: boolean;
  onShowMore: () => void;
}

/**
 * One column per state, cards inside in the order the API gave them. The
 * column is the grouping and the order within it is the sort, so the two
 * never fight: a filter decides which columns have anything in them.
 *
 * Dragging a card to another column performs that state change. Only the
 * legal moves accept a drop, so a column that would refuse never lights up.
 */
export function Board({
  tickets,
  categories,
  user,
  showRequester,
  onMove,
  resolvedTotal,
  canShowMore,
  onShowMore,
}: Props) {
  const [dragging, setDragging] = useState<TicketSummary | null>(null);
  const [over, setOver] = useState<TicketState | null>(null);

  const categoryName = (id: string) =>
    categories.find((category) => category.id === id)?.name;
  const canDrag = (ticket: TicketSummary) =>
    STATES.some((state) => moveFor(ticket, state, user) !== null);

  return (
    <div
      className="grid gap-4 md:grid-cols-3"
      onDragEnd={() => {
        setDragging(null);
        setOver(null);
      }}
    >
      {STATES.map((state) => {
        const cards = tickets.filter((ticket) => ticket.state === state);
        const headingId = `column-${state}`;
        const move = dragging ? moveFor(dragging, state, user) : null;

        return (
          <section
            key={state}
            aria-labelledby={headingId}
            // Preventing the default is what marks a valid drop target, so an
            // illegal move is refused by simply not doing it.
            onDragOver={(event) => {
              if (!move) {
                return;
              }
              event.preventDefault();
              event.dataTransfer.dropEffect = 'move';
              setOver(state);
            }}
            onDragLeave={() =>
              setOver((current) => (current === state ? null : current))
            }
            onDrop={(event) => {
              event.preventDefault();
              const id = event.dataTransfer.getData(TICKET_DRAG_TYPE);
              const ticket = tickets.find((candidate) => candidate.id === id);
              const action = ticket ? moveFor(ticket, state, user) : null;
              setDragging(null);
              setOver(null);
              if (ticket && action) {
                void onMove(ticket, action);
              }
            }}
            className={cn(
              'rounded-panel bg-surface p-3 transition-colors',
              // Only a column that would accept the drop reacts to it.
              move && 'outline-2 outline-dashed outline-tile',
              over === state && move && 'bg-raised outline-accent-500',
            )}
          >
            <h2
              id={headingId}
              className="mb-3 flex items-center justify-between px-1 text-sm font-medium"
            >
              {STATE_LABEL[state]}{' '}
              <span className="rounded-pill bg-tile px-2 py-0.5 text-xs font-normal text-ink-muted">
                {/* How many there are, not how many fit on screen. */}
                {state === 'resolved' ? resolvedTotal : cards.length}
              </span>
            </h2>
            <div className="space-y-2">
              {cards.map((ticket) => (
                <div key={ticket.id} onDragStart={() => setDragging(ticket)}>
                  <TicketCard
                    ticket={ticket}
                    categoryName={categoryName(ticket.categoryId)}
                    showRequester={showRequester}
                    draggable={canDrag(ticket)}
                  />
                </div>
              ))}
              {cards.length === 0 && (
                <p className="px-1 py-6 text-center text-xs text-ink-dim">
                  Nada por acá
                </p>
              )}
              {state === 'resolved' && canShowMore && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="w-full text-ink-muted"
                  onClick={onShowMore}
                >
                  <icon.more aria-hidden="true" />
                  Ver más
                </Button>
              )}
            </div>
          </section>
        );
      })}
    </div>
  );
}
