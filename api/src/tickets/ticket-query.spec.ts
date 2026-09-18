import { boardQuery } from './ticket-query.js';

// The scope is the caller's own rule (a requester only ever sees their own
// tickets). The builder must never drop it, whatever the query string says.
const SCOPE = { deletedAt: null, requesterId: 'requester-1' };

describe('boardQuery', () => {
  it('with nothing asked, the filter is the caller scope and nothing else', () => {
    const { filter } = boardQuery({}, SCOPE);

    expect(filter).toEqual(SCOPE);
  });

  it('an asked-for state narrows the filter', () => {
    const { filter } = boardQuery({ state: ['resolved'] }, SCOPE);

    expect(filter).toEqual({ ...SCOPE, state: { $in: ['resolved'] } });
  });

  it('several states are combined into one clause', () => {
    const { filter } = boardQuery({ state: ['open', 'in_progress'] }, SCOPE);

    expect(filter).toEqual({
      ...SCOPE,
      state: { $in: ['open', 'in_progress'] },
    });
  });

  it('a state filter cannot widen the caller scope', () => {
    const { filter } = boardQuery({ state: ['open'] }, SCOPE);

    expect(filter.deletedAt).toBe(null);
    expect(filter.requesterId).toBe('requester-1');
  });

  it('a resolved-only board is sorted by when the ticket was resolved', () => {
    // "The last ten completed" means the last ten to be completed. Sorting
    // these by creation date would bury a six-month-old ticket resolved today.
    const { sort } = boardQuery({ state: ['resolved'] }, SCOPE);

    expect(sort).toEqual({ resolvedAt: -1, _id: -1 });
  });

  it('any other board is sorted by creation date', () => {
    expect(boardQuery({}, SCOPE).sort).toEqual({ createdAt: -1, _id: -1 });
    expect(boardQuery({ state: ['open'] }, SCOPE).sort).toEqual({
      createdAt: -1,
      _id: -1,
    });
    // Resolved alongside anything else is a mixed board, so it reads by age.
    expect(boardQuery({ state: ['open', 'resolved'] }, SCOPE).sort).toEqual({
      createdAt: -1,
      _id: -1,
    });
  });

  it('every sort carries a tiebreak, so a record cannot land on two pages', () => {
    for (const state of [undefined, ['open'], ['resolved']] as const) {
      const { sort } = boardQuery(state ? { state: [...state] } : {}, SCOPE);

      expect(Object.keys(sort)).toHaveLength(2);
      expect(Object.keys(sort)[1]).toBe('_id');
    }
  });

  it('an empty state list is treated as no filter at all', () => {
    // ?state= with nothing after it must not ask Mongo for `$in: []`, which
    // matches no document and would answer an empty board.
    const { filter } = boardQuery({ state: [] }, SCOPE);

    expect(filter).toEqual(SCOPE);
  });
});
