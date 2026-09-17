import {
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { Types } from 'mongoose';
import type { ActingUser } from '../auth/auth.decorators.js';
import {
  assertCanAct,
  editChanges,
  type ActingTicket,
  type TicketAction,
} from './ticket-rules.js';

const OWNER: ActingUser = { id: 'requester-1', role: 'requester' };
const OTHER_REQUESTER: ActingUser = { id: 'requester-2', role: 'requester' };
const ASSIGNEE: ActingUser = { id: 'agent-1', role: 'agent' };
const OTHER_AGENT: ActingUser = { id: 'agent-2', role: 'agent' };

function ticket(overrides: Partial<ActingTicket> = {}): ActingTicket {
  return {
    state: 'open',
    requesterId: OWNER.id,
    assigneeId: null,
    deletedAt: null,
    ...overrides,
  };
}

const inProgress = () =>
  ticket({ state: 'in_progress', assigneeId: ASSIGNEE.id });
const resolved = () => ticket({ state: 'resolved', assigneeId: ASSIGNEE.id });

function rejects(
  action: TicketAction,
  subject: ActingTicket,
  user: ActingUser,
): unknown {
  try {
    assertCanAct(action, subject, user);
  } catch (error) {
    return error;
  }
  throw new Error(`${action} was allowed and should not have been`);
}

function allows(
  action: TicketAction,
  subject: ActingTicket,
  user: ActingUser,
): void {
  expect(() => assertCanAct(action, subject, user)).not.toThrow();
}

describe('assertCanAct', () => {
  it('A requester cannot modify a ticket created by another requester', () => {
    const someone_elses = ticket();

    for (const action of ['view', 'edit', 'delete', 'comment'] as const) {
      expect(rejects(action, someone_elses, OTHER_REQUESTER)).toBeInstanceOf(
        ForbiddenException,
      );
    }
  });

  it('lets the owner edit and delete only while the ticket is open', () => {
    allows('edit', ticket(), OWNER);
    allows('delete', ticket(), OWNER);

    for (const action of ['edit', 'delete'] as const) {
      expect(rejects(action, inProgress(), OWNER)).toBeInstanceOf(
        ConflictException,
      );
      expect(rejects(action, resolved(), OWNER)).toBeInstanceOf(
        ConflictException,
      );
    }
  });

  it('treats a soft-deleted ticket as gone, whoever asks', () => {
    const gone = ticket({ deletedAt: new Date() });

    for (const user of [OWNER, ASSIGNEE]) {
      for (const action of ['view', 'edit', 'delete', 'take'] as const) {
        expect(rejects(action, gone, user)).toBeInstanceOf(NotFoundException);
      }
    }
  });

  it('lets any agent take an open ticket, and nobody take it twice', () => {
    allows('take', ticket(), ASSIGNEE);
    allows('take', ticket(), OTHER_AGENT);

    // A requester has no business in the queue.
    expect(rejects('take', ticket(), OWNER)).toBeInstanceOf(ForbiddenException);
    // Already taken: the state is what stops it, not who is asking.
    expect(rejects('take', inProgress(), OTHER_AGENT)).toBeInstanceOf(
      ConflictException,
    );
    expect(rejects('take', resolved(), OTHER_AGENT)).toBeInstanceOf(
      ConflictException,
    );
  });

  it('lets only the assigned agent release or resolve', () => {
    for (const action of ['release', 'resolve'] as const) {
      allows(action, inProgress(), ASSIGNEE);

      expect(rejects(action, inProgress(), OTHER_AGENT)).toBeInstanceOf(
        ForbiddenException,
      );
      expect(rejects(action, inProgress(), OWNER)).toBeInstanceOf(
        ForbiddenException,
      );
      // An open ticket has no assignee to be, so the state answers first.
      expect(rejects(action, ticket(), ASSIGNEE)).toBeInstanceOf(
        ConflictException,
      );
      expect(rejects(action, resolved(), ASSIGNEE)).toBeInstanceOf(
        ConflictException,
      );
    }
  });

  it('allows comments from the owner and any agent until the ticket is resolved', () => {
    allows('comment', ticket(), OWNER);
    allows('comment', ticket(), OTHER_AGENT);
    allows('comment', inProgress(), OWNER);
    allows('comment', inProgress(), OTHER_AGENT);

    expect(rejects('comment', resolved(), OWNER)).toBeInstanceOf(
      ConflictException,
    );
    expect(rejects('comment', resolved(), OTHER_AGENT)).toBeInstanceOf(
      ConflictException,
    );
  });

  it('lets an agent view any ticket', () => {
    allows('view', ticket(), OTHER_AGENT);
    allows('view', resolved(), OTHER_AGENT);
  });

  it('answers ownership before state, and state before assignee', () => {
    // A requester asking about somebody else's in-progress ticket learns
    // "not yours", never "not open": the second answer would confirm the
    // ticket exists and leak its state.
    expect(rejects('edit', inProgress(), OTHER_REQUESTER)).toBeInstanceOf(
      ForbiddenException,
    );

    // An agent already sees every ticket, so the state is the useful answer:
    // "this is not in progress" rather than "you are not the assignee".
    expect(rejects('resolve', ticket(), OTHER_AGENT)).toBeInstanceOf(
      ConflictException,
    );
  });
});

describe('editChanges', () => {
  const categoryId = new Types.ObjectId('66e9b1f2a3c4d5e6f7a8b9c1');
  const other = new Types.ObjectId('66e9b1f2a3c4d5e6f7a8b9c2');
  const current = {
    title: 'Printer jammed',
    description: 'On floor 3',
    categoryId,
  };

  it('Editing a ticket records the previous and new values of changed fields', () => {
    const changes = editChanges(current, {
      title: 'Printer jammed again',
      categoryId: other.toString(),
    });

    expect(changes).toEqual([
      { field: 'title', from: 'Printer jammed', to: 'Printer jammed again' },
      {
        field: 'categoryId',
        from: categoryId.toString(),
        to: other.toString(),
      },
    ]);
  });

  it('reports nothing when the edit changes nothing', () => {
    // The service turns this into a no-op: no write, and no event in the
    // history saying something happened when nothing did.
    expect(editChanges(current, { title: 'Printer jammed' })).toEqual([]);
    expect(editChanges(current, {})).toEqual([]);
    expect(editChanges(current, { categoryId: categoryId.toString() })).toEqual(
      [],
    );
  });

  it('leaves out the fields the edit did not send', () => {
    const changes = editChanges(current, { description: 'On floor 4' });

    expect(changes.map((change) => change.field)).toEqual(['description']);
  });
});
