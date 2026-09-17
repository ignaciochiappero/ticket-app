import type { TicketState } from '../ticket.schema.js';
import { PersonDto } from './person.dto.js';

export class TicketSummaryDto {
  /**
   * Internal id, used in the endpoint paths.
   * @example "66e9b1f2a3c4d5e6f7a8b9c0"
   */
  id: string;

  /**
   * The handle people use out loud, and what the search box matches.
   * @example "TCK-142"
   */
  code: string;

  /**
   * @example "Printer on floor 3 is jammed"
   */
  title: string;

  /**
   * Category id, as returned by GET /categories.
   * @example "66e9b1f2a3c4d5e6f7a8b9c1"
   */
  categoryId: string;

  /**
   * Where the ticket is: open and unassigned, in progress with an assignee, or resolved.
   * @example "in_progress"
   */
  state: TicketState;

  /** Who opened it. */
  requester: PersonDto;

  /** The agent working on it, or null while the ticket is open. */
  assignee: PersonDto | null;

  /**
   * When it was opened. Sorting oldest first shows what has waited longest.
   * @example "2026-09-17T14:28:00.000Z"
   */
  createdAt: Date;
}
