import {
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import type { Types } from 'mongoose';
import type { ActingUser } from '../auth/auth.decorators.js';
import type { UpdateTicketDto } from './dto/update-ticket.dto.js';
import {
  EDITABLE_FIELDS,
  type FieldChange,
  type TicketState,
} from './ticket.schema.js';

export type TicketAction =
  'view' | 'edit' | 'delete' | 'take' | 'release' | 'resolve' | 'comment';

/** The parts of a ticket a rule needs. Anything else is none of its business. */
export interface ActingTicket {
  state: TicketState;
  requesterId: string;
  assigneeId: string | null;
  deletedAt: Date | null;
}

const OWNER_ACTIONS = new Set<TicketAction>(['edit', 'delete']);
const ASSIGNEE_ACTIONS = new Set<TicketAction>(['release', 'resolve']);

/**
 * Decides whether an action is allowed, and with which status code it is not.
 * Pure: no database, no clock, so every combination of role, ownership, state
 * and deletion is cheap to cover in a test.
 *
 * The service still runs the same rule as a filter on its update, because two
 * agents can take one ticket in the same millisecond and this check cannot see
 * that. This function decides *which error to report*; the conditional write
 * decides *what actually happens*.
 */
export function assertCanAct(
  action: TicketAction,
  ticket: ActingTicket,
  user: ActingUser,
): void {
  // A deleted ticket is gone for everyone: no role sees it, no action touches it.
  if (ticket.deletedAt) {
    throw new NotFoundException('Ticket not found');
  }

  return user.role === 'requester'
    ? assertRequesterCanAct(action, ticket, user)
    : assertAgentCanAct(action, ticket, user);
}

// Ownership comes before state on purpose. Told "this ticket is not open", a
// requester would learn that somebody else's ticket exists and what state it is
// in; "not yours" tells them only what they already knew.
function assertRequesterCanAct(
  action: TicketAction,
  ticket: ActingTicket,
  user: ActingUser,
): void {
  if (ticket.requesterId !== user.id) {
    throw new ForbiddenException('This ticket belongs to someone else');
  }
  if (action === 'take' || ASSIGNEE_ACTIONS.has(action)) {
    throw new ForbiddenException('Only agents work the queue');
  }
  if (OWNER_ACTIONS.has(action) && ticket.state !== 'open') {
    throw new ConflictException(
      'A ticket can only be changed while it is open',
    );
  }
  if (action === 'comment') {
    assertNotResolved(ticket);
  }
}

// State comes before the assignee here, the other way round from a requester.
// An agent already sees every ticket, so nothing leaks, and "this is not in
// progress" is the answer that explains what to do next.
function assertAgentCanAct(
  action: TicketAction,
  ticket: ActingTicket,
  user: ActingUser,
): void {
  if (OWNER_ACTIONS.has(action)) {
    throw new ForbiddenException('Only the requester can change their ticket');
  }
  if (action === 'take' && ticket.state !== 'open') {
    throw new ConflictException('This ticket has already been taken');
  }
  if (ASSIGNEE_ACTIONS.has(action)) {
    if (ticket.state !== 'in_progress') {
      throw new ConflictException('This ticket is not in progress');
    }
    if (ticket.assigneeId !== user.id) {
      throw new ForbiddenException('This ticket is assigned to another agent');
    }
  }
  if (action === 'comment') {
    assertNotResolved(ticket);
  }
}

function assertNotResolved(ticket: ActingTicket): void {
  if (ticket.state === 'resolved') {
    throw new ConflictException('This ticket is resolved');
  }
}

/**
 * What an edit actually changes, in the order the fields are declared. Values
 * are compared and stored as strings, ids included, so the history has one
 * shape for every field. An empty result means the edit is a no-op: the
 * service then writes nothing, rather than recording that something happened.
 */
export function editChanges(
  ticket: { title: string; description: string; categoryId: Types.ObjectId },
  update: UpdateTicketDto,
): FieldChange[] {
  const changes: FieldChange[] = [];

  for (const field of EDITABLE_FIELDS) {
    const to = update[field];
    if (to === undefined) {
      continue;
    }
    const from =
      field === 'categoryId' ? ticket.categoryId.toString() : ticket[field];
    if (from !== to) {
      changes.push({ field, from, to });
    }
  }

  return changes;
}
