import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';

export type UserRole = 'requester' | 'agent';

// autoIndex is off so the seed can write usernames before the unique index is built.
@Schema({ autoIndex: false })
export class User {
  @Prop({ type: String, required: true })
  _id: string;

  @Prop({ required: true, unique: true })
  username: string;

  @Prop({ required: true })
  name: string;

  @Prop({ type: String, required: true, enum: ['requester', 'agent'] })
  role: UserRole;

  // scrypt hash as `salt:key`; the plain password is never stored.
  @Prop({ required: true })
  passwordHash: string;
}

export const UserSchema = SchemaFactory.createForClass(User);
