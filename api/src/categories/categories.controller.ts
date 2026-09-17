import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { IsObjectIdPipe } from '@nestjs/mongoose';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiConflictResponse,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiParam,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { Roles } from '../auth/auth.decorators.js';
import { PaginationQueryDto } from '../pagination/dto/pagination-query.dto.js';
import { CategoriesService } from './categories.service.js';
import { CategoryDto } from './dto/category.dto.js';
import { PaginatedCategoriesDto } from './dto/paginated-categories.dto.js';
import { SaveCategoryDto } from './dto/save-category.dto.js';

const CATEGORY_ID_PARAM = {
  name: 'id',
  description: 'Category id, as returned by GET /categories',
  example: '66e9b1f2a3c4d5e6f7a8b9c0',
};

@ApiTags('Categories')
@ApiBearerAuth()
@ApiUnauthorizedResponse({ description: 'No valid token: log in first' })
@Controller('categories')
export class CategoriesController {
  constructor(private readonly categoriesService: CategoriesService) {}

  /** List the categories one page at a time, sorted by name (any user) */
  @Get()
  @ApiBadRequestResponse({ description: 'Invalid page or limit' })
  findAll(@Query() query: PaginationQueryDto): Promise<PaginatedCategoriesDto> {
    return this.categoriesService.findAll(query);
  }

  /** Create a category (agents only) */
  @Roles('agent')
  @Post()
  @ApiBadRequestResponse({ description: 'Invalid name' })
  @ApiForbiddenResponse({ description: 'Only agents manage categories' })
  @ApiConflictResponse({ description: 'The name already exists' })
  create(@Body() dto: SaveCategoryDto): Promise<CategoryDto> {
    return this.categoriesService.create(dto);
  }

  /** Rename a category that no ticket has used (agents only) */
  @Roles('agent')
  @Patch(':id')
  @ApiParam(CATEGORY_ID_PARAM)
  @ApiBadRequestResponse({ description: 'Invalid id or name' })
  @ApiForbiddenResponse({ description: 'Only agents manage categories' })
  @ApiNotFoundResponse({ description: 'Category not found' })
  @ApiConflictResponse({
    description: 'The name already exists or a ticket used the category',
  })
  rename(
    @Param('id', IsObjectIdPipe) id: string,
    @Body() dto: SaveCategoryDto,
  ): Promise<CategoryDto> {
    return this.categoriesService.rename(id, dto);
  }

  /** Delete a category that no ticket has used (agents only) */
  @Roles('agent')
  @Delete(':id')
  @HttpCode(204)
  @ApiParam(CATEGORY_ID_PARAM)
  @ApiBadRequestResponse({ description: 'Invalid id' })
  @ApiForbiddenResponse({ description: 'Only agents manage categories' })
  @ApiNotFoundResponse({ description: 'Category not found' })
  @ApiConflictResponse({ description: 'A ticket used the category' })
  remove(@Param('id', IsObjectIdPipe) id: string): Promise<void> {
    return this.categoriesService.remove(id);
  }
}
