# Proposal: API Pagination

## Intent

No list endpoint should be able to return an unbounded collection. Today `GET /categories` returns every category in one response, which is harmless with 4 rows and a problem the day an organization of 800 people has hundreds. The ticket queue, which lands next, has the same shape and grows far faster.

This change adds one pagination contract, applies it to the collections that grow, and leaves the ticket endpoints ready to use it from birth instead of being retrofitted.

## Scope

- A shared query contract: `?page=&limit=`, with defaults and a maximum page size.
- A shared response shape: the items plus the total, the page and the page size.
- Applied to `GET /categories`.
- `GET /tickets` adopts it when it is built (change `ticket-system-v1`, phase 3).

## Out of scope

| Left out                                | Why                                                                                                                                              |
| --------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| Cursor pagination                       | The agent queue needs a total and the ability to jump to a page, which cursors do not give. The offset cost is documented as debt                |
| Paginating `GET /users`                 | 8 seeded users that cannot grow in v1, read once to resolve names next to tickets. Paging a fixed reference list would only make the client loop |
| Filtering and sorting parameters        | Each list already has the order its screen needs. Filters arrive with the screens that require them                                              |
| Response envelopes for single resources | Only collections need the metadata                                                                                                               |

## Product rules

- A request with no parameters gets the first page: 20 items.
- `limit` accepts 1 to 100. Asking for more is an error, not a silently clamped result: a client that gets fewer items than it asked for cannot tell whether the list ended.
- A page past the end is a valid, empty page, not a 404. The total still tells the client how far the list goes.
- Every paginated query needs a deterministic total order, or the same row can show up on two pages.

## Affected areas

- `api/src/pagination/` (new): the query DTO, the response base and a pure helper.
- `api/src/categories/`: the list endpoint and its service.
- `api/test/ticket-categories.e2e-spec.ts`: the list assertions.
- `AGENTS.md`: the convention for which lists are paginated.

## Risks

| Risk                                                           | Mitigation                                                                                          |
| -------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| The response shape change breaks a consumer                    | No consumer exists yet: the web app is still the scaffold. This is the cheapest moment to change it |
| Deep offsets get slow on a large collection                    | Documented as conscious debt, with the cursor migration named in `DECISIONS.md`                     |
| The generic response shape does not document itself in Swagger | One concrete response DTO per feature, verified against `/docs-json` rather than assumed            |

## Rollback

Revert the branch. The contract is additive except for the `GET /categories` response shape, which has no consumer.

## Success criteria

- `GET /categories` answers with items, total, page and limit, and rejects an invalid page or limit with 400.
- The contract is documented in Swagger with descriptions and examples.
- The helper is unit tested, and the endpoint behavior is covered end to end.
