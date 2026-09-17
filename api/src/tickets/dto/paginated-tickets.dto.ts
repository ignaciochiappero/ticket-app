import { PaginatedDto } from '../../pagination/dto/paginated.dto.js';
import { TicketSummaryDto } from './ticket-summary.dto.js';

export class PaginatedTicketsDto extends PaginatedDto {
  /** The tickets on this page, in the order that was asked for. */
  items: TicketSummaryDto[];
}
