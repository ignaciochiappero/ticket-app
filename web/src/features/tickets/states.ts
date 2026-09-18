import type { TicketState } from '@/api/types';

/** The workflow in order. The board draws one column per entry. */
export const STATES: TicketState[] = ['open', 'in_progress', 'resolved'];

// Live work. These columns bound themselves: nobody keeps five hundred
// tickets in progress, so they are asked for in one go.
export const ACTIVE_STATES: TicketState[] = ['open', 'in_progress'];

/** The API names states for machines; a heading is read by people. */
export const STATE_LABEL: Record<TicketState, string> = {
  open: 'Open',
  in_progress: 'In progress',
  resolved: 'Resolved',
};
