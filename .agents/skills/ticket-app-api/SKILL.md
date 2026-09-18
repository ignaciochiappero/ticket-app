---
name: ticket-app-api
description: How to add or change an endpoint in this repository's NestJS API — folder layout, DTOs, the global guard, pagination, concurrency-safe writes and Swagger. Use when touching anything under api/.
metadata:
  author: ticket-app
  scope: api/
---

Standards for this API. Written from the mistakes that were actually made
here, so the sections are ordered by how expensive the mistake is.

Read [`.agents/context/data-model.md`](../../context/data-model.md) before
changing a schema and
[`.agents/context/domain.md`](../../context/domain.md) before changing a rule.

## ESM: relative imports end in `.js`

```ts
import { TicketsService } from './tickets.service.js'; // ✅
import { TicketsService } from './tickets.service';    // ❌ fails at runtime
```

It compiles either way and dies when the app boots. Package imports have no
extension.

## Where a feature goes

By feature, never by layer. One responsibility per file, named by suffix:

```
api/src/<feature>/
  <feature>.schema.ts      what MongoDB stores
  <feature>.service.ts     rules and queries
  <feature>.controller.ts  HTTP routes
  <feature>.module.ts      Nest wiring
  <feature>.seed.ts        startup data it owns
  <feature>-rules.ts       pure decisions worth testing alone
  <feature>-query.ts       pure query building, same reason
  dto/                     the contract, one class per file
```

Register the module in `app.module.ts`. Cross-cutting concerns get their own
folder — `auth/` owns login, hashing and the guard, and is the only place an
SSO migration would touch.

## Two rules that keep concurrency correct

This is the part to get right; everything else is recoverable.

**1. A pure function decides which error. A conditional write decides what
happens.**

```ts
// The rule: precise status codes, no I/O, exhaustively testable.
assertCanAct('take', ticket, user);

// The write: the filter repeats the rule, and that is what settles the race.
await this.ticketModel.findOneAndUpdate(
  { ...activeFilter(id, user), state: 'open', assigneeId: null },
  { $set: { ... }, $push: { history: event('taken', user, at) } },
);
```

The pure check cannot see a race — four agents arriving in the same
millisecond all pass it. Exactly one update matches the filter; the others
find nothing and are answered by `lostRace()`. **Never** replace the filter
with a read-then-write.

**2. A state change and its history event are one write.** Always `$set` and
`$push` together. Two calls can be interrupted between them, and a ticket
whose state nobody can explain is the one thing the audit history exists to
prevent.

## Authorization

The guard is global, so **a new route is protected by default**.

```ts
@Public()                     // opt out entirely
@Roles('agent')               // restrict by role
@CurrentUser() user: ActingUser  // read the caller
@ApiBearerAuth()              // declare it on the controller, for /docs
```

Ownership checks ("this ticket is yours") live in **services**, because they
need the resource. Role checks live on the route, because they do not.

**The caller's scope goes into the filter, and goes in last.** `scopeOf(user)`
pins a requester to their own tickets; spread it after anything the query
string contributed, so `?requester=someone-else` is overwritten rather than
obeyed. A filter may narrow what somebody sees, never widen it.

## Lists that can grow are paginated

```ts
@Query() query: TicketQueryDto            // extends PaginationQueryDto
const { page, limit, skip } = resolvePage(query);
```

Answer with a class extending `PaginatedDto`, so the body is
`{ items, total, page, limit }`. Count with **the same filter** as the page.

**Every paginated query needs a deterministic total order**, or a record lands
on two pages: end every sort with `_id` in the same direction. Two documents
written in the same millisecond are otherwise free to swap places.

Fixed reference lists — `GET /users` — return everything instead.

## DTOs

One class per file under `dto/`. The API contract, so treat it as published.

```ts
export class CreateCommentDto {
  /**
   * What you want to say about the ticket. Kept forever.
   * @example "Probé con el otro cable y sigue trabándose."
   */
  @IsString()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @MinLength(1)
  @MaxLength(2000)
  body: string;
}
```

- **JSDoc plus `@example` on every property**, and a JSDoc summary on every
  route. The Swagger plugin runs with `introspectComments`, so this is what
  `/docs` shows somebody testing the API. Note that the plugin runs only in
  the Nest compiler — never under Vitest, so a unit test cannot see it.
- **Trim before the length rules run**, or a body of spaces passes `@MinLength(1)`.
- **A query parameter that may repeat** needs a `@Transform` that accepts both
  `?state=a&state=b` and `?state=a,b`, and must guard `value === undefined` or
  it will read the string `"undefined"`.
- Add `@ApiParam` for path parameters and `@Api*Response` for each error code.

## POST that changes rather than creates

Nest answers 201 for POST. `take`, `release` and `resolve` change a ticket, so
they declare `@HttpCode(200)`. A POST that genuinely creates something — a
comment — keeps 201.

## Building a Mongo filter from a query string

Keep it pure and in `<feature>-query.ts`, taking the query and the scope and
returning `{ filter, sort }`. No mongoose types: plain objects, so the test
needs no database.

Two traps already hit here:

- **An empty list is not "no filter".** `?state=` arrives as `[]`, and
  `$in: []` matches nothing, so the board answers empty for what reads like no
  filter. Normalise it to `undefined`.
- **A search term is data, not a pattern.** Escape every regex metacharacter
  before it reaches `$regex`, and cap the length. Unescaped, `.*` matches
  every row and `(a+)+$` hangs the server on a crafted title.

## Tests

See the `ticket-app-testing` skill. In short: pure rules get unit tests, HTTP
behaviour gets e2e against a real MongoDB, and each e2e file gets its own
database through `createTestApp()`.

## Before you commit

```bash
pnpm run check
```

Lint is type-aware here and has caught real bugs: a `.sort()` with no
comparator, and spreading a class instance (a validated DTO is an instance —
list its fields or use `Object.assign`).
