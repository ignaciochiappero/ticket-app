import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { CategoriesController } from './categories.controller.js';
import { CategoriesSeed } from './categories.seed.js';
import { CategoriesService } from './categories.service.js';
import { Category, CategorySchema } from './category.schema.js';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Category.name, schema: CategorySchema },
    ]),
  ],
  controllers: [CategoriesController],
  providers: [CategoriesService, CategoriesSeed],
  exports: [CategoriesService],
})
export class CategoriesModule {}
