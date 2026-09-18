import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import type { Model, Types } from 'mongoose';
import type { ActingUser } from '../auth/auth.decorators.js';
import { CategoriesService } from '../categories/categories.service.js';
import { CountersService } from '../counters/counters.service.js';
import { UsersService } from '../users/users.service.js';
import { resolvePage } from '../pagination/pagination.js';
import type { CreateCommentDto } from './dto/create-comment.dto.js';
import type { CreateTicketDto } from './dto/create-ticket.dto.js';
import type { PaginatedTicketsDto } from './dto/paginated-tickets.dto.js';
import type { PersonDto } from './dto/person.dto.js';
import type { TicketDto } from './dto/ticket.dto.js';
import type { TicketSummaryDto } from './dto/ticket-summary.dto.js';
import type { TicketQueryDto } from './dto/ticket-query.dto.js';
import type { UpdateTicketDto } from './dto/update-ticket.dto.js';
import { boardQuery } from './ticket-query.js';
import {
  assertCanAct,
  editChanges,
  type TicketAction,
} from './ticket-rules.js';
import {
  Ticket,
  type FieldChange,
  type HistoryEvent,
} from './ticket.schema.js';

type TicketRecord = Ticket & { _id: Types.ObjectId };

const EVENT_OF = {
  take: 'taken',
  release: 'released',
  resolve: 'resolved',
} as const satisfies Record<string, HistoryEvent['type']>;

@Injectable()
export class TicketsService {
  constructor(
    @InjectModel(Ticket.name) private readonly ticketModel: Model<Ticket>,
    private readonly categoriesService: CategoriesService,
    private readonly countersService: CountersService,
    private readonly usersService: UsersService,
  ) {}

  async create(dto: CreateTicketDto, user: ActingUser): Promise<TicketDto> {
    // The category is locked before the ticket exists. Fail here and nothing
    // was written; the other order could leave a ticket pointing at a category
    // that was deleted in between.
    await this.categoriesService.markUsed(dto.categoryId);

    // One instant for the ticket and its first event, so the timeline cannot
    // disagree with the ticket by a few milliseconds.
    const at = new Date();
    // Field by field rather than spreading the DTO: the validation pipe hands
    // over a class instance, and listing the fields says exactly what is stored.
    const ticket = await this.ticketModel.create({
      title: dto.title,
      description: dto.description,
      categoryId: dto.categoryId,
      code: `TCK-${await this.countersService.next('ticket')}`,
      state: 'open',
      requesterId: user.id,
      assigneeId: null,
      createdAt: at,
      deletedAt: null,
      history: [event('created', user, at)],
    });
    return this.toDto(ticket.toObject());
  }

  /**
   * The board: one page of the tickets this user is allowed to see, newest
   * first. A requester's scope is part of the filter rather than something the
   * caller passes, so no query string can widen it. Which states come back,
   * and in what order, is `boardQuery`'s decision.
   */
  async findAll(
    query: TicketQueryDto,
    user: ActingUser,
  ): Promise<PaginatedTicketsDto> {
    const { page, limit, skip } = resolvePage(query);
    // The scope goes in first, so no query string can widen it. Which states
    // to show and how to order them is `boardQuery`'s to decide, and it is
    // pure, so the rule is tested without a database.
    const { filter, sort } = boardQuery(query, scopeOf(user));

    const [tickets, total] = await Promise.all([
      this.ticketModel.find(filter).sort(sort).skip(skip).limit(limit).lean(),
      this.ticketModel.countDocuments(filter),
    ]);

    // One lookup for the whole page, not one per row.
    const person = await this.personLookup();
    return {
      items: tickets.map((ticket) => toSummary(ticket, person)),
      total,
      page,
      limit,
    };
  }

  async findOne(id: string, user: ActingUser): Promise<TicketDto> {
    return this.toDto(await this.read('view', id, user));
  }

  /**
   * Adds a comment, which is a history event like any other: a comment is
   * something that happened to the ticket, in order, beside the takes and the
   * edits. There is no route to change or remove one, so the trail stays
   * append-only and the timeline can be read as a record.
   */
  async comment(
    id: string,
    dto: CreateCommentDto,
    user: ActingUser,
  ): Promise<TicketDto> {
    await this.read('comment', id, user);

    const at = new Date();
    const commented = await this.ticketModel
      .findOneAndUpdate(
        // The state is repeated in the filter, not just checked above: a
        // ticket resolved a moment ago must not collect a comment anyway.
        { ...activeFilter(id, user), state: { $ne: 'resolved' } },
        {
          // Written out rather than spread from `event`, because a comment is
          // the one event that carries a body.
          $push: {
            history: {
              type: 'commented',
              actorId: user.id,
              at,
              body: dto.body,
            },
          },
        },
        { returnDocument: 'after' },
      )
      .lean();
    return this.toDto(commented ?? (await this.lostRace('comment', id, user)));
  }

  async update(
    id: string,
    dto: UpdateTicketDto,
    user: ActingUser,
  ): Promise<TicketDto> {
    const ticket = await this.read('edit', id, user);
    const changes = editChanges(ticket, dto);
    if (changes.length === 0) {
      // Nothing changed, so nothing is written and the history stays honest.
      return this.toDto(ticket);
    }

    const toCategory = changes.find((change) => change.field === 'categoryId');
    if (toCategory) {
      await this.categoriesService.markUsed(toCategory.to);
    }

    const at = new Date();
    // Compare-and-set: the filter repeats the values that were just read, so
    // two tabs editing at once cannot both win, and the recorded `from` values
    // are the ones that were really replaced.
    const updated = await this.ticketModel
      .findOneAndUpdate(
        {
          ...activeFilter(id, user),
          state: 'open',
          ...valuesOf(changes, 'from'),
        },
        {
          $set: valuesOf(changes, 'to'),
          $push: { history: event('edited', user, at, changes) },
        },
        { returnDocument: 'after' },
      )
      .lean();
    return this.toDto(updated ?? (await this.lostRace('edit', id, user)));
  }

  /**
   * Takes a ticket for the agent asking. The filter is the rule: `state: 'open'`
   * and `assigneeId: null` mean that when four agents arrive together, exactly
   * one update matches and the other three find nothing to change. The pure
   * check before it cannot see the race; this is what decides the winner.
   */
  async take(id: string, user: ActingUser): Promise<TicketDto> {
    return this.transition(id, user, {
      action: 'take',
      from: { state: 'open', assigneeId: null },
      to: { state: 'in_progress', assigneeId: user.id },
    });
  }

  /** Puts the ticket back in the queue, unassigned. Not a reassignment: anybody can take it next. */
  async release(id: string, user: ActingUser): Promise<TicketDto> {
    return this.transition(id, user, {
      action: 'release',
      from: { state: 'in_progress', assigneeId: user.id },
      to: { state: 'open', assigneeId: null },
    });
  }

  /** Resolves the ticket, keeping the assignee: the history has to say who did it. */
  async resolve(id: string, user: ActingUser): Promise<TicketDto> {
    return this.transition(id, user, {
      action: 'resolve',
      from: { state: 'in_progress', assigneeId: user.id },
      to: { state: 'resolved' },
    });
  }

  /**
   * Every transition is the same shape: check the rule for a precise status,
   * then one conditional write that changes the state and appends its event
   * together. One document, one update: the state and its history cannot end
   * up disagreeing, and no two callers can both win.
   */
  private async transition(
    id: string,
    user: ActingUser,
    move: {
      action: Extract<TicketAction, 'take' | 'release' | 'resolve'>;
      from: Partial<Pick<Ticket, 'state' | 'assigneeId'>>;
      to: Partial<Pick<Ticket, 'state' | 'assigneeId'>>;
    },
  ): Promise<TicketDto> {
    await this.read(move.action, id, user);

    const at = new Date();
    const moved = await this.ticketModel
      .findOneAndUpdate(
        { ...activeFilter(id, user), ...move.from },
        {
          $set: {
            ...move.to,
            // Stamped with the same instant as the event pushed beside it, so
            // the board and the timeline can never tell different stories
            // about when the ticket was finished.
            ...(move.action === 'resolve' ? { resolvedAt: at } : {}),
          },
          $push: { history: event(EVENT_OF[move.action], user, at) },
        },
        { returnDocument: 'after' },
      )
      .lean();
    return this.toDto(moved ?? (await this.lostRace(move.action, id, user)));
  }

  async remove(id: string, user: ActingUser): Promise<void> {
    await this.read('delete', id, user);

    const at = new Date();
    const deleted = await this.ticketModel
      .findOneAndUpdate(
        { ...activeFilter(id, user), state: 'open' },
        {
          $set: { deletedAt: at },
          $push: { history: event('deleted', user, at) },
        },
      )
      .lean();
    if (!deleted) {
      await this.lostRace('delete', id, user);
    }
  }

  /** Reads a live ticket and checks the rule, so the caller gets a precise status. */
  private async read(
    action: TicketAction,
    id: string,
    user: ActingUser,
  ): Promise<TicketRecord> {
    const ticket = await this.ticketModel.findById(id).lean();
    if (!ticket) {
      throw new NotFoundException('Ticket not found');
    }
    assertCanAct(action, ticket, user);
    return ticket;
  }

  /**
   * The conditional write matched nothing, so the ticket changed between the
   * read and the write. Re-read and let the rule name the reason; if the rule
   * is happy now, somebody else got there first.
   */
  private async lostRace(
    action: TicketAction,
    id: string,
    user: ActingUser,
  ): Promise<never> {
    await this.read(action, id, user);
    throw new ConflictException(
      'This ticket changed while you were editing it',
    );
  }

  private async toDto(ticket: TicketRecord): Promise<TicketDto> {
    return toTicketDto(ticket, await this.personLookup());
  }

  /**
   * Turns an id into `{ id, name }`. Names are never stored on a ticket, so a
   * renamed user cannot leave a stale copy behind; the cost is this lookup,
   * which at scale becomes a `$lookup` or a denormalized name.
   */
  private async personLookup(): Promise<(id: string) => PersonDto> {
    const names = await this.usersService.namesById();
    // A missing name means the user was removed: show the id rather than an
    // empty space, and never fail a read over it.
    return (id) => ({ id, name: names.get(id) ?? id });
  }
}

type Person = (id: string) => PersonDto;

function toSummary(ticket: TicketRecord, person: Person): TicketSummaryDto {
  return {
    id: ticket._id.toString(),
    code: ticket.code,
    title: ticket.title,
    categoryId: ticket.categoryId.toString(),
    state: ticket.state,
    requester: person(ticket.requesterId),
    assignee: ticket.assigneeId ? person(ticket.assigneeId) : null,
    createdAt: ticket.createdAt,
  };
}

function toTicketDto(ticket: TicketRecord, person: Person): TicketDto {
  // Object.assign rather than a spread: the summary is a class only because
  // Swagger documents classes, and spreading a class-typed value is a warning
  // waiting to be ignored. The detail view is the summary plus two fields.
  return Object.assign(toSummary(ticket, person), {
    description: ticket.description,
    history: ticket.history.map((entry) => ({
      type: entry.type,
      actor: person(entry.actorId),
      at: entry.at,
      ...(entry.changes ? { changes: entry.changes } : {}),
      ...(entry.body === undefined ? {} : { body: entry.body }),
    })),
  });
}

function event(
  type: HistoryEvent['type'],
  user: ActingUser,
  at: Date,
  changes?: FieldChange[],
): HistoryEvent {
  return changes
    ? { type, actorId: user.id, at, changes }
    : { type, actorId: user.id, at };
}

/**
 * What this user is allowed to touch: live tickets, and only their own when
 * they are a requester. Every read and every write starts from here, so a
 * requester's scope cannot be forgotten in one place and enforced in another.
 */
function scopeOf(user: ActingUser) {
  return {
    deletedAt: null,
    ...(user.role === 'requester' ? { requesterId: user.id } : {}),
  };
}

function activeFilter(id: string, user: ActingUser) {
  return { _id: id, ...scopeOf(user) };
}

// Mongoose casts the category string to an ObjectId against the schema path,
// so one shape serves both the compare-and-set filter and the update.
function valuesOf(
  changes: FieldChange[],
  side: 'from' | 'to',
): Record<string, string> {
  return Object.fromEntries(
    changes.map((change) => [change.field, change[side]]),
  );
}
