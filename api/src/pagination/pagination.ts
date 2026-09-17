export const DEFAULT_PAGE = 1;
export const DEFAULT_LIMIT = 20;
export const MAX_LIMIT = 100;

export interface PageRequest {
  page: number;
  limit: number;
  skip: number;
}

// Turns what the client asked for into what the query needs. It takes a plain shape
// instead of the DTO, so the contract can import the limits without an import cycle.
export function resolvePage(query: {
  page?: number;
  limit?: number;
}): PageRequest {
  const page = query.page ?? DEFAULT_PAGE;
  const limit = query.limit ?? DEFAULT_LIMIT;
  return { page, limit, skip: (page - 1) * limit };
}
