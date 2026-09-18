import type { TicketState, TicketSummary, User } from '@/api/types';

export type Move = 'take' | 'release' | 'resolve';

/**
 * Which action, if any, dragging a ticket into a column stands for. The board's
 * columns are states, so a drop is a state change, and the state machine has
 * only three legal edges:
 *
 *     open ──take──▶ in_progress ──resolve──▶ resolved
 *          ◀─release─┘
 *
 * Returns null for everything else, which is what stops a column from lighting
 * up as a drop target. This mirrors `ticket-rules.ts` in the API, which is the
 * side that actually decides: a refused drop still comes back as a 403 or 409
 * and the board reloads. Mirroring it here means nobody is invited to make a
 * move that was never going to work.
 */
export function moveFor(
  ticket: TicketSummary,
  to: TicketState,
  user: User | null,
): Move | null {
  // Working the queue is an agent's job; a requester drags nothing.
  if (user?.role !== 'agent' || ticket.state === to) {
    return null;
  }

  if (ticket.state === 'open') {
    // Only into progress: resolving a ticket nobody picked up would leave no
    // assignee to answer for it.
    return to === 'in_progress' ? 'take' : null;
  }

  if (ticket.state === 'in_progress') {
    // Whoever took it owns it until they let go.
    if (ticket.assignee?.id !== user.id) {
      return null;
    }
    return to === 'open' ? 'release' : 'resolve';
  }

  // Resolved is final. A recurring problem becomes a new ticket.
  return null;
}
