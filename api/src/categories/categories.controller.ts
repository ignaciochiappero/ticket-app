import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
} from '@nestjs/common';
import { IsObjectIdPipe } from '@nestjs/mongoose';
import {
  ApiBadRequestResponse,
  ApiConflictResponse,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiParam,
  ApiSecurity,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { Roles } from '../auth/acting-user.decorators.js';
import { CategoriesService } from './categories.service.js';
import { CategoryDto } from './dto/category.dto.js';
import { SaveCategoryDto } from './dto/save-category.dto.js';

const CATEGORY_ID_PARAM = {
  name: 'id',
  description: 'Category id, as returned by GET /categories',
  example: '66e9b1f2a3c4d5e6f7a8b9c0',
};

@ApiTags('Categories')
@ApiSecurity('acting-user')
@ApiUnauthorizedResponse({ description: 'Missing or unknown X-User-Id' })
@Controller('categories')
export class CategoriesController {
  constructor(private readonly categoriesService: CategoriesService) {}

  /** List all categories sorted by name (any user) */
  @Get()
  findAll(): Promise<CategoryDto[]> {
    return this.categoriesService.findAll();
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
