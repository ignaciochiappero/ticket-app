import { Transform } from 'class-transformer';
import { IsIn, IsOptional } from 'class-validator';
import { PaginationQueryDto } from '../../pagination/dto/pagination-query.dto.js';
import { TICKET_STATES, type TicketState } from '../ticket.schema.js';

export class TicketQueryDto extends PaginationQueryDto {
  /**
   * States to return, comma separated. Defaults to every state you can see.
   * The board asks twice, once for `open,in_progress` and once for `resolved`,
   * so each column pages on its own.
   * @example "open,in_progress"
   */
  @IsOptional()
  // A repeated `?state=open&state=resolved` arrives as an array and a comma
  // separated one as a string, so both are normalised to the same list here,
  // before the validator decides whether the names are real.
  @Transform(({ value }) =>
    value === undefined
      ? undefined
      : (Array.isArray(value) ? value : String(value).split(','))
          .map((entry) => String(entry).trim())
          .filter(Boolean),
  )
  @IsIn(TICKET_STATES, { each: true })
  state?: TicketState[];
}
