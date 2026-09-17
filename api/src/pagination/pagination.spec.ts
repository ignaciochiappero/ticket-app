import { DEFAULT_LIMIT, DEFAULT_PAGE, resolvePage } from './pagination.js';

describe('resolvePage', () => {
  it('falls back to the first page of the default size when nothing is asked', () => {
    expect(resolvePage({})).toEqual({
      page: DEFAULT_PAGE,
      limit: DEFAULT_LIMIT,
      skip: 0,
    });
  });

  it('keeps the page and size it is given', () => {
    expect(resolvePage({ page: 3, limit: 5 })).toMatchObject({
      page: 3,
      limit: 5,
    });
  });

  it('skips every record of the pages before', () => {
    expect(resolvePage({ page: 1, limit: 5 }).skip).toBe(0);
    expect(resolvePage({ page: 3, limit: 5 }).skip).toBe(10);
    expect(resolvePage({ page: 4, limit: 25 }).skip).toBe(75);
  });

  it('fills in only the value that is missing', () => {
    expect(resolvePage({ limit: 5 })).toEqual({
      page: DEFAULT_PAGE,
      limit: 5,
      skip: 0,
    });
    expect(resolvePage({ page: 2 })).toEqual({
      page: 2,
      limit: DEFAULT_LIMIT,
      skip: DEFAULT_LIMIT,
    });
  });
});
