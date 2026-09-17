import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import type { Model, Types } from 'mongoose';
import type { PaginationQueryDto } from '../pagination/dto/pagination-query.dto.js';
import { resolvePage } from '../pagination/pagination.js';
import { Category, CATEGORY_NAME_COLLATION } from './category.schema.js';
import type { CategoryDto } from './dto/category.dto.js';
import type { PaginatedCategoriesDto } from './dto/paginated-categories.dto.js';
import type { SaveCategoryDto } from './dto/save-category.dto.js';

type CategoryRecord = Category & { _id: Types.ObjectId };

@Injectable()
export class CategoriesService {
  constructor(
    @InjectModel(Category.name)
    private readonly categoryModel: Model<Category>,
  ) {}

  // Names are unique, so sorting by name is a total order and no category can land
  // on two pages. The count uses the same (empty) filter as the page it describes.
  async findAll(query: PaginationQueryDto): Promise<PaginatedCategoriesDto> {
    const { page, limit, skip } = resolvePage(query);
    const [categories, total] = await Promise.all([
      this.categoryModel
        .find()
        .collation(CATEGORY_NAME_COLLATION)
        .sort({ name: 1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      this.categoryModel.countDocuments(),
    ]);
    return { items: categories.map(toCategoryDto), total, page, limit };
  }

  async create({ name }: SaveCategoryDto): Promise<CategoryDto> {
    try {
      const category = await this.categoryModel.create({ name });
      return toCategoryDto(category);
    } catch (error) {
      throw toDuplicateNameConflict(error);
    }
  }

  // The `used: false` filter makes the lock check and the write a single atomic operation.
  async rename(id: string, { name }: SaveCategoryDto): Promise<CategoryDto> {
    let category: CategoryRecord | null;
    try {
      category = await this.categoryModel
        .findOneAndUpdate(
          { _id: id, used: false },
          { $set: { name } },
          { returnDocument: 'after' },
        )
        .lean();
    } catch (error) {
      throw toDuplicateNameConflict(error);
    }
    if (!category) {
      throw await this.lockedOrMissing(id);
    }
    return toCategoryDto(category);
  }

  async remove(id: string): Promise<void> {
    const { deletedCount } = await this.categoryModel.deleteOne({
      _id: id,
      used: false,
    });
    if (deletedCount === 0) {
      throw await this.lockedOrMissing(id);
    }
  }

  private async lockedOrMissing(id: string): Promise<Error> {
    return (await this.categoryModel.exists({ _id: id }))
      ? new ConflictException(
          'This category was used by a ticket and can no longer be edited or deleted',
        )
      : new NotFoundException('Category not found');
  }
}

function toCategoryDto(category: CategoryRecord): CategoryDto {
  return {
    id: category._id.toString(),
    name: category.name,
    used: category.used,
  };
}

function toDuplicateNameConflict(error: unknown): unknown {
  const isDuplicateKey =
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    error.code === 11000;
  return isDuplicateKey
    ? new ConflictException('A category with this name already exists')
    : error;
}
