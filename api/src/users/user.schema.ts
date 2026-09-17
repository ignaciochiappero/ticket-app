import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';

export type UserRole = 'requester' | 'agent';

@Schema()
export class User {
  @Prop({ type: String, required: true })
  _id: string;

  @Prop({ required: true })
  name: string;

  @Prop({ type: String, required: true, enum: ['requester', 'agent'] })
  role: UserRole;
}

export const UserSchema = SchemaFactory.createForClass(User);
