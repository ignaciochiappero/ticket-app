import type { TicketState } from '@/api/types';

/** The workflow in order. The board draws one column per entry. */
export const STATES: TicketState[] = ['open', 'in_progress', 'resolved'];

// Live work. These columns bound themselves: nobody keeps five hundred
// tickets in progress, so they are asked for in one go.
export const ACTIVE_STATES: TicketState[] = ['open', 'in_progress'];

/**
 * Column headings, which name a pile of tickets and so read as plurals.
 * Separate from the singular below because Spanish agrees in number: a column
 * of many is "Abiertos" while one ticket is "Abierto", and using a single set
 * for both is guaranteed to get one of them wrong.
 */
export const STATE_LABEL: Record<TicketState, string> = {
  open: 'Abiertos',
  in_progress: 'En curso',
  resolved: 'Resueltos',
};

/** One ticket's state, for the badge that labels a single ticket. */
export const STATE_NAME: Record<TicketState, string> = {
  open: 'Abierto',
  in_progress: 'En curso',
  resolved: 'Resuelto',
};
