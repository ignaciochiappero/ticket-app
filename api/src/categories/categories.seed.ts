import { Injectable, type OnApplicationBootstrap } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import type { Model } from 'mongoose';
import { Category } from './category.schema.js';

const STARTER_CATEGORIES = ['Access', 'Hardware', 'Software', 'Other'];

// Seeds only an empty collection, so renamed or deleted starter categories do not come back on restart.
@Injectable()
export class CategoriesSeed implements OnApplicationBootstrap {
  constructor(
    @InjectModel(Category.name)
    private readonly categoryModel: Model<Category>,
  ) {}

  async onApplicationBootstrap(): Promise<void> {
    await this.categoryModel.init();
    if (await this.categoryModel.exists({})) {
      return;
    }
    await this.categoryModel.insertMany(
      STARTER_CATEGORIES.map((name) => ({ name })),
    );
  }
}
