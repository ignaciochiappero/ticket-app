import type { EditableField } from '../ticket.schema.js';

export class FieldChangeDto {
  /**
   * Which field the edit changed.
   * @example "title"
   */
  field: EditableField;

  /**
   * The value before the edit. Ids are strings here too, so one shape fits every field.
   * @example "Printer on floor 2 is jammed"
   */
  from: string;

  /**
   * The value after the edit.
   * @example "Printer on floor 3 is jammed"
   */
  to: string;
}
