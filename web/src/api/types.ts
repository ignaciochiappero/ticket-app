// Hand-written mirrors of the API's response DTOs. The API is the source of
// truth; these are kept in step by hand, which is the cost of not generating a
// client (see the design's "Validation library per side" decision).

export type Role = 'requester' | 'agent';

export interface User {
  id: string;
  name: string;
  role: Role;
}

export interface LoginResponse {
  token: string;
}

export interface Category {
  id: string;
  name: string;
  used: boolean;
}

/** Every list that can grow answers with this shape. */
export interface Page<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
}

export type TicketState = 'open' | 'in_progress' | 'resolved';

export interface Person {
  id: string;
  name: string;
}

/** What the board shows per row: no description, no history. */
export interface TicketSummary {
  id: string;
  code: string;
  title: string;
  categoryId: string;
  state: TicketState;
  requester: Person;
  assignee: Person | null;
  createdAt: string;
}

export type HistoryEventType =
  | 'created'
  | 'edited'
  | 'deleted'
  | 'taken'
  | 'released'
  | 'resolved'
  | 'commented';

export interface FieldChange {
  field: 'title' | 'description' | 'categoryId';
  from: string;
  to: string;
}

export interface HistoryEvent {
  type: HistoryEventType;
  actor: Person;
  at: string;
  changes?: FieldChange[];
  body?: string;
}

/** The detail view: the summary plus the parts worth a second request. */
export interface Ticket extends TicketSummary {
  description: string;
  history: HistoryEvent[];
}

export interface TicketInput {
  title: string;
  description: string;
  categoryId: string;
}
