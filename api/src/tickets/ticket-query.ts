import type { TicketState } from './ticket.schema.js';

/** What a caller may ask the board for. The scope is never part of it. */
export interface BoardQuery {
  state?: TicketState[];
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

  return {
    filter: { ...scope, ...(states ? { state: { $in: states } } : {}) },
    // "The last ten completed" means the last ten to be completed. Only a
    // board asking for resolved tickets alone can mean that; mixed with any
    // other state it is an ordinary queue, which reads oldest-last by age.
    sort:
      states?.length === 1 && states[0] === 'resolved'
        ? { resolvedAt: -1, _id: -1 }
        : { createdAt: -1, _id: -1 },
  };
}
