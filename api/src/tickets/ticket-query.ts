import type { TicketState } from './ticket.schema.js';

/** What a caller may ask the board for. The scope is never part of it. */
export interface BoardQuery {
  state?: TicketState[];
  q?: string;
  /** A user id, or `unassigned` for the tickets nobody has taken. */
  assignee?: string;
  /** A user id: whose tickets to show. An agent's filter; a requester already has one. */
  requester?: string;
  /** Oldest or newest first. Defaults to newest. */
  order?: 'asc' | 'desc';
}

/** What `?assignee=` means when it is not an id. */
export const UNASSIGNED = 'unassigned';

// A search term is data, not a pattern. Left unescaped, `.*` would match every
// ticket and `(a+)+$` would hang the server on a crafted title, so every
// regular expression metacharacter is neutralised before Mongo sees it.
function escapeRegex(term: string): string {
  return term.replace(/[.*+?^${}()|[\]\\-]/g, '\\$&');
}

// Plain objects rather than mongoose's own types, so this module stays pure
// and its test needs no database and no driver.
export type QueryFilter = Record<string, unknown>;

export interface BoardPlan {
  filter: QueryFilter;
  sort: Record<string, -1 | 1>;
}

/**
 * Turns a board request into the filter and sort the query runs with.
 *
 * The caller's scope goes in first and the query string can only narrow it:
 * a requester asking for every state still gets their own tickets and nothing
 * else. Asking for nothing is a plain paginated list of everything in scope;
 * the board composes its columns by asking twice instead.
 *
 * Both sorts end in `_id`, because two tickets written in the same
 * millisecond would otherwise be free to swap places between pages, and one
 * of them would appear on both or neither.
 */
export function boardQuery(query: BoardQuery, scope: QueryFilter): BoardPlan {
  // `?state=` with nothing after it arrives as an empty array. Passing that
  // to `$in` matches no document at all, which would answer an empty board
  // for what reads like "no filter".
  const states = query.state?.length ? query.state : undefined;

  // People quote a code whole ("is TCK-14 done?") and remember a title in
  // fragments, so the code is anchored and the title is a contains match.
  const term = query.q?.trim() ? escapeRegex(query.q.trim()) : undefined;
  const search = term
    ? {
        $or: [
          { code: { $regex: `^${term}`, $options: 'i' } },
          { title: { $regex: term, $options: 'i' } },
        ],
      }
    : {};

  // `unassigned` is the one value that is not an id: it is the queue nobody
  // has picked up, which is the question an agent actually asks.
  const assignee = query.assignee?.trim()
    ? {
        assigneeId:
          query.assignee.trim() === UNASSIGNED ? null : query.assignee.trim(),
      }
    : {};

  const requester = query.requester?.trim()
    ? { requesterId: query.requester.trim() }
    : {};

  const direction = query.order === 'asc' ? 1 : -1;

  return {
    filter: {
      ...(states ? { state: { $in: states } } : {}),
      ...search,
      ...assignee,
      // The scope goes in LAST on purpose. A requester's own id is part of it,
      // so `?requester=someone-else` is overwritten rather than obeyed: the
      // query string can narrow the board, never widen it.
      ...requester,
      ...scope,
    },
    // "The last ten completed" means the last ten to be completed. Only a
    // board asking for resolved tickets alone can mean that, and only while
    // nobody has asked for a different order; mixed with any other state it is
    // an ordinary queue, which reads by age.
    sort:
      !query.order && states?.length === 1 && states[0] === 'resolved'
        ? { resolvedAt: -1, _id: -1 }
        : { createdAt: direction, _id: direction },
  };
}
