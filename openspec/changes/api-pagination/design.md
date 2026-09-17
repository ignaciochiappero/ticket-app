# Design: API Pagination

## 1. Contract

|                |                                                               |
| -------------- | ------------------------------------------------------------- |
| Query          | `?page=1&limit=20`                                            |
| Defaults       | `page` 1, `limit` 20                                          |
| Limits         | `page` ≥ 1, `limit` 1 to 100, both whole numbers              |
| Response       | `{ items: T[], total: number, page: number, limit: number }`  |
| Invalid values | 400 from the global `ValidationPipe`, before the service runs |

`total` is the number of records matching the same filter as the page, not the number returned, so a client can tell how many pages exist (`ceil(total / limit)`) without another call. The page count itself is left out: it is one division, and a field that can disagree with the other three is a field that will.

## 2. Offset, not cursor

| Decision        | Chosen                                    | Alternative                                | Why                                                                                                                                                                                      |
| --------------- | ----------------------------------------- | ------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Paging strategy | Offset (`page` + `limit`), with the total | Cursor (`after` + `limit`) on the sort key | The agent queue is a screen with page numbers and a count, which a cursor cannot serve: it gives "load more" and no total. Offset also keeps the query trivial and the contract readable |

The cost is real and goes into `DECISIONS.md`: MongoDB's `skip` walks the skipped documents, so a deep page degrades linearly. At 50,000 tickets a month, page 500 of the full history is a scan. The migration is a cursor on the sort key (`{ createdAt, _id }` for tickets), keeping offset for the first pages the UI actually serves. Nothing in this contract blocks that: `items` stays, and `after` replaces `page`.

## 3. Stable order

Offset paging is only correct over a deterministic total order. Two records that compare equal can swap between two queries, and then one of them shows up twice while the other is never seen.

- **Categories**: sorted by `name` with the collation of the unique index. Names are unique, so the order is total.
- **Tickets** (phase 3): sorted by `{ createdAt: 1, _id: 1 }`. `createdAt` alone is not unique, so `_id` is the tiebreaker.

## 4. Where it applies

| Endpoint                 | Paginated | Why                                                                                                                                            |
| ------------------------ | --------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| `GET /categories`        | Yes       | Agents create categories freely, so the list grows                                                                                             |
| `GET /tickets` (phase 3) | Yes       | The collection that actually grows                                                                                                             |
| `GET /users`             | No        | 8 seeded users, immutable in v1, read once to resolve names next to tickets. Paging a fixed reference list would only force the client to loop |

The rule, which goes into `AGENTS.md`: **lists that can grow are paginated; fixed reference lists are not.** Stated as a rule it is a decision; left unstated it reads as an inconsistency.

The category dropdown in the ticket form asks for `?limit=100`: one bounded request, no loop, and it stays correct as long as an organization keeps its categories under a hundred, which is a product limit worth having.

## 5. Files

| Path                                                    | Change | Why                                                                     |
| ------------------------------------------------------- | ------ | ----------------------------------------------------------------------- |
| `api/src/pagination/dto/pagination-query.dto.ts`        | Create | The shared query contract, documented for Swagger                       |
| `api/src/pagination/dto/paginated.dto.ts`               | Create | `PaginatedDto`, the response base with `total`, `page` and `limit`      |
| `api/src/pagination/pagination.ts` (+ `.spec.ts`)       | Create | `resolvePage()`: defaults and the `skip` arithmetic, as a pure function |
| `api/src/categories/dto/paginated-categories.dto.ts`    | Create | `extends PaginatedDto` and adds `items: CategoryDto[]`                  |
| `api/src/categories/categories.{service,controller}.ts` | Modify | Page the query, count with the same filter                              |
| `api/test/ticket-categories.e2e-spec.ts`                | Modify | The list helper reads `items`; new pagination scenarios                 |
| `AGENTS.md`                                             | Modify | The convention above                                                    |

`pagination/` has no Nest module: there is nothing to inject, only types and a pure function. Its DTOs sit in `dto/`, like every other folder's.

## 6. Why a concrete response DTO per feature

A generic `PaginatedDto<T>` does not document itself: OpenAPI has no generics, so Nest needs `@ApiExtraModels` plus a hand-written `allOf` schema on every route. One small class per feature (`PaginatedCategoriesDto extends PaginatedDto`) gets the same types, is inferred by the Swagger CLI plugin with no decorators, and shows the tester the real response. The cost is one four-line file per paginated list.

Inherited properties are verified against `/docs-json`, not assumed: the plugin generates metadata per class, and the schema factory has to walk the base class for `total`, `page` and `limit` to appear.

## 7. Why the maximum is an error, not a clamp

`?limit=1000` returns 400. Clamping to 100 silently gives the client fewer items than it asked for, and a client that pages by "did I get a full page?" would stop early or loop forever. An explicit error is one line in the DTO and removes the guessing.

## 8. Testing

| Level                                | What                                                                                                                              |
| ------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------- |
| Unit, `pagination.spec.ts`           | `resolvePage`: defaults with no values, `skip` arithmetic for page 1 and page 3, and that a given page and size survive untouched |
| E2E, `ticket-categories.e2e-spec.ts` | The four bounded-list scenarios plus the stable-order walk, against the real starter categories                                   |

The e2e scenarios use categories because they are seeded and few: with 4 starters, `limit=2` gives exactly two pages, so the arithmetic is checked against data a reader can hold in their head.
