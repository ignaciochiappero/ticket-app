import { Transform } from 'class-transformer';
import { IsString, Length } from 'class-validator';

export class SaveCategoryDto {
  /**
   * Category name, 1 to 50 characters. Leading and trailing spaces are removed, and it must not match an existing name regardless of letter case.
   * @example "Printers"
   */
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @Length(1, 50)
  name: string;
}
