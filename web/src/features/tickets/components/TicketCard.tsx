import type { TicketSummary } from '@/api/types';
import { icon } from '@/components/icons';
import { formatDateTime, timeAgo } from '@/helpers/datetime';
import { cn } from '@/lib/utils';
import { Link } from 'react-router';

/** The key a drag carries. jsdom has no DataTransfer, so tests stub one. */
export const TICKET_DRAG_TYPE = 'application/x-ticket-id';

interface Props {
  ticket: TicketSummary;
  categoryName?: string;
  /** Agents need to see who the ticket is for; a requester's cards are all theirs. */
  showRequester: boolean;
  draggable: boolean;
}

/**
 * One card on the board, the way Jira draws an issue: the key, the title, and
 * at the bottom who it is for and who has it. The whole card is the link, so
 * there is nothing small to aim at.
 */
export function TicketCard({
  ticket,
  categoryName,
  showRequester,
  draggable,
}: Props) {
  return (
    <Link
      to={`/tickets/${ticket.id}`}
      draggable={draggable}
      onDragStart={(event) => {
        // Without this the browser drags the link's href instead of the card.
        event.dataTransfer.setData(TICKET_DRAG_TYPE, ticket.id);
        event.dataTransfer.effectAllowed = 'move';
      }}
      className={cn(
        'group/card block rounded-tile bg-raised p-3 transition-colors hover:bg-tile focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none',
        draggable && 'cursor-grab active:cursor-grabbing',
      )}
    >
      <div className="flex items-center justify-between gap-2 text-xs">
        <span className="flex items-center gap-1 font-medium text-accent-300">
          {draggable && (
            <icon.drag
              className="-ml-1 size-3.5 text-ink-dim opacity-0 transition-opacity group-hover/card:opacity-100"
              aria-hidden="true"
            />
          )}
          {ticket.code}
        </span>
        <time
          dateTime={ticket.createdAt}
          title={formatDateTime(ticket.createdAt)}
          className="text-ink-dim"
        >
          {timeAgo(ticket.createdAt)}
        </time>
      </div>

      <p className="mt-1.5 line-clamp-2 text-sm leading-snug text-ink">
        {ticket.title}
      </p>

      <div className="mt-3 flex items-center justify-between gap-2 text-xs text-ink-muted">
        <span className="flex min-w-0 items-center gap-2">
          {categoryName && (
            <span className="flex shrink-0 items-center gap-1 rounded-pill bg-surface px-2 py-0.5 text-ink-dim">
              <icon.category className="size-3" aria-hidden="true" />
              {categoryName}
            </span>
          )}
          {showRequester && (
            <span className="truncate">{ticket.requester.name}</span>
          )}
        </span>
        {ticket.assignee ? (
          <Initials name={ticket.assignee.name} />
        ) : (
          <span className="shrink-0 text-ink-dim">Unassigned</span>
        )}
      </div>
    </Link>
  );
}

/** Two letters standing in for an avatar; the full name is one hover away. */
function Initials({ name }: { name: string }) {
  const initials = name
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('');
  return (
    <span
      title={name}
      aria-label={name}
      className="grid size-6 shrink-0 place-items-center rounded-full bg-tile text-[10px] font-medium text-ink"
    >
      {initials}
    </span>
  );
}
