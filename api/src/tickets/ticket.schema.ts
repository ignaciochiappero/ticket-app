import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Types } from 'mongoose';

export const TICKET_STATES = ['open', 'in_progress', 'resolved'] as const;
export type TicketState = (typeof TICKET_STATES)[number];

export const HISTORY_EVENT_TYPES = [
  'created',
  'edited',
  'deleted',
  'taken',
  'released',
  'resolved',
  'commented',
] as const;
export type HistoryEventType = (typeof HISTORY_EVENT_TYPES)[number];

export const EDITABLE_FIELDS = ['title', 'description', 'categoryId'] as const;
export type EditableField = (typeof EDITABLE_FIELDS)[number];

// What an edit changed. Values are stored as strings, ids included, so one
// shape covers every field and the timeline needs no per-field handling.
@Schema({ _id: false })
export class FieldChange {
  // `type: String` is required on a string union: the emitted metadata for a
  // union is Object, so the decorator cannot work the Mongo type out on its own.
  @Prop({ type: String, required: true, enum: EDITABLE_FIELDS })
  field: EditableField;

  @Prop({ required: true })
  from: string;

  @Prop({ required: true })
  to: string;
}

const FieldChangeSchema = SchemaFactory.createForClass(FieldChange);

// The audit trail, append-only. Comments are events too: a comment is
// something that happened to the ticket, in order, like every other event.
@Schema({ _id: false })
export class HistoryEvent {
  @Prop({ type: String, required: true, enum: HISTORY_EVENT_TYPES })
  type: HistoryEventType;

  @Prop({ required: true })
  actorId: string;

  @Prop({ required: true })
  at: Date;

  @Prop({ type: [FieldChangeSchema], default: undefined })
  changes?: FieldChange[];

  @Prop()
  body?: string;
}

const HistoryEventSchema = SchemaFactory.createForClass(HistoryEvent);

@Schema()
export class Ticket {
  // 'TCK-142', from the ticket counter. People quote it, and the search matches it.
  @Prop({ required: true })
  code: string;

  @Prop({ required: true })
  title: string;

  @Prop({ required: true })
  description: string;

  @Prop({ type: Types.ObjectId, required: true })
  categoryId: Types.ObjectId;

  @Prop({ type: String, required: true, enum: TICKET_STATES, default: 'open' })
  state: TicketState;

  @Prop({ required: true })
  requesterId: string;

  // null exactly when the state is 'open': taking assigns, releasing clears.
  @Prop({ type: String, default: null })
  assigneeId: string | null;

  // Set by hand rather than by timestamps, so it is the same instant as the
  // first history event and the timeline cannot disagree with the ticket.
  @Prop({ required: true })
  createdAt: Date;

  @Prop({ type: Date, default: null })
  deletedAt: Date | null;

  @Prop({ type: [HistoryEventSchema], required: true })
  history: HistoryEvent[];
}

export const TicketSchema = SchemaFactory.createForClass(Ticket);

// The code is the public handle, so two tickets can never share one.
TicketSchema.index({ code: 1 }, { unique: true });

// A requester only ever reads their own tickets, oldest or newest first.
TicketSchema.index({ requesterId: 1, createdAt: 1 });
