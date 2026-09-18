import { Transform } from 'class-transformer';
import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';
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

  /**
   * Finds a ticket by its code or by part of its title, ignoring case.
   * The term is matched literally: it is text somebody typed, not a pattern.
   * @example "TCK-14"
   */
  @IsOptional()
  @IsString()
  // Long enough for any real title fragment. The cap exists because the term
  // becomes a regular expression, and an unbounded one is a denial of service
  // even after every metacharacter is escaped.
  @MaxLength(100)
  q?: string;

  /**
   * Whose queue to look at: an agent's user id, or `unassigned` for the
   * tickets nobody has taken yet.
   * @example "agent-1"
   */
  @IsOptional()
  @IsString()
  @MaxLength(64)
  assignee?: string;

  /**
   * Show only the tickets opened by this user id. A requester already sees
   * only their own, so this narrows an agent's board.
   * @example "requester-1"
   */
  @IsOptional()
  @IsString()
  @MaxLength(64)
  requester?: string;

  /**
   * Oldest or newest first, by creation date. Defaults to newest.
   * @example "asc"
   */
  @IsOptional()
  @IsIn(['asc', 'desc'])
  order?: 'asc' | 'desc';
}
