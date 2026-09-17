import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';

// One document per sequence, named by its `_id`: 'ticket' issues the ticket codes.
@Schema()
export class Counter {
  @Prop({ type: String, required: true })
  _id: string;

  @Prop({ required: true, default: 0 })
  seq: number;
}

export const CounterSchema = SchemaFactory.createForClass(Counter);
