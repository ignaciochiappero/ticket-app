import type { HistoryEventType } from '../ticket.schema.js';
import { FieldChangeDto } from './field-change.dto.js';
import { PersonDto } from './person.dto.js';

export class HistoryEventDto {
  /**
   * What happened. A comment is an event like any other, so the timeline is one list.
   * @example "taken"
   */
  type: HistoryEventType;

  /** Who did it. */
  actor: PersonDto;

  /**
   * When it happened.
   * @example "2026-09-17T14:31:00.000Z"
   */
  at: Date;

  /** Present on an edit only: the previous and new value of each changed field. */
  changes?: FieldChangeDto[];

  /**
   * Present on a comment only.
   * @example "Ordered a replacement drum, arriving Monday."
   */
  body?: string;
}
