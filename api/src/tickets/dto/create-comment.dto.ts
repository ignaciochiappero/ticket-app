import { Transform } from 'class-transformer';
import { IsString, MaxLength, MinLength } from 'class-validator';

export class CreateCommentDto {
  /**
   * What you want to say about the ticket. Kept forever: the history is
   * append-only, so a comment can never be edited or taken back.
   * @example "I tried the other cable and it still jams."
   */
  @IsString()
  // Trimmed before the length rules run, so a comment of spaces is empty
  // rather than valid.
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @MinLength(1)
  @MaxLength(2000)
  body: string;
}
