import { HistoryEventDto } from './history-event.dto.js';
import { TicketSummaryDto } from './ticket-summary.dto.js';

// One ticket in full: the summary the board shows, plus the parts worth a
// second request. The board returns summaries; this is the detail view.
export class TicketDto extends TicketSummaryDto {
  /**
   * @example "It jams on every double-sided job. Tried the manual feed, same result."
   */
  description: string;

  /** Everything that happened to the ticket, oldest first, comments included. */
  history: HistoryEventDto[];
}
