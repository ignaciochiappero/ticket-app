import { Type } from 'class-transformer';
import { IsInt, IsOptional, Max, Min } from 'class-validator';
import { MAX_LIMIT } from '../pagination.js';

// Query strings are text, so @Type converts before the validators run:
// ?page=abc becomes NaN and fails @IsInt instead of reaching the database.
export class PaginationQueryDto {
  /**
   * Page to return, counting from 1. Defaults to 1.
   * @example 1
   */
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  /**
   * How many records the page holds, from 1 to 100. Defaults to 20.
   * Asking for more than 100 is rejected, so a short page always means the list ended.
   * @example 20
   */
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(MAX_LIMIT)
  limit?: number;
}
