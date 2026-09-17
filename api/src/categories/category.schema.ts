import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';

// Case-insensitive comparison: "Hardware" and "hardware" are the same category.
export const CATEGORY_NAME_COLLATION = { locale: 'en', strength: 2 };

@Schema()
export class Category {
  @Prop({ required: true })
  name: string;

  // Set when a ticket first uses the category and never cleared: used categories are locked.
  @Prop({ default: false })
  used: boolean;
}

export const CategorySchema = SchemaFactory.createForClass(Category);

CategorySchema.index(
  { name: 1 },
  { unique: true, collation: CATEGORY_NAME_COLLATION },
);
