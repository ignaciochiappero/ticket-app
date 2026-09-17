import { Transform } from 'class-transformer';
import { IsMongoId, IsString, Length } from 'class-validator';

const trim = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;

export class CreateTicketDto {
  /**
   * What the problem is, in one line, 1 to 120 characters. Leading and trailing spaces are removed.
   * @example "Printer on floor 3 is jammed"
   */
  @Transform(trim)
  @IsString()
  @Length(1, 120)
  title: string;

  /**
   * The detail an agent needs to start, 1 to 5000 characters.
   * @example "It jams on every double-sided job. Tried the manual feed, same result."
   */
  @Transform(trim)
  @IsString()
  @Length(1, 5000)
  description: string;

  /**
   * Id of an existing category, as returned by GET /categories.
   * @example "66e9b1f2a3c4d5e6f7a8b9c1"
   */
  @IsMongoId()
  categoryId: string;
}
