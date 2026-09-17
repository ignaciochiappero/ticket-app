import { PaginatedDto } from '../../pagination/dto/paginated.dto.js';
import { CategoryDto } from './category.dto.js';

export class PaginatedCategoriesDto extends PaginatedDto {
  /** The categories on this page, sorted by name. */
  items: CategoryDto[];
}
