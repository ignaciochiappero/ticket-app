import type { TicketState } from '@/api/types';

/** The workflow in order. The board draws one column per entry. */
export const STATES: TicketState[] = ['open', 'in_progress', 'resolved'];

/** The API names states for machines; a heading is read by people. */
export const STATE_LABEL: Record<TicketState, string> = {
  open: 'Open',
  in_progress: 'In progress',
  resolved: 'Resolved',
};
