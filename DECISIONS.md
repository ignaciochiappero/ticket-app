# Decisions

Why this system is shaped the way it is, what it costs, and how to keep
building on it. [`README.md`](README.md) says how to run it;
[`AGENTS.md`](AGENTS.md) holds the conventions. This file is the reasoning.

## 1. The data model

**One ticket document carries its own history.** A ticket holds its fields and
an append-only `history` array of events (`created`, `edited`, `taken`,
`released`, `resolved`, `deleted`, `commented`). Users and categories are
separate collections; the audit trail is not.

The reason is atomicity. A state change and the event that records it are
written by a single `findOneAndUpdate`, so the two can never disagree:

```ts
{ $set: { state: 'in_progress', assigneeId: user.id },
  $push: { history: { type: 'taken', actorId: user.id, at } } }
```

With the history in its own collection, that is two writes and MongoDB gives
no transaction across them without a replica set. A crash between the two
leaves a ticket whose state nobody can explain — which is the one thing an
audit history exists to prevent.

The cost is the document growing forever. At a few hundred events per ticket
that is nothing against MongoDB's 16 MB limit; the section on scale says when
it stops being nothing.

**Ids are stored as strings, not `ObjectId`, for people.** `requesterId` and
`assigneeId` hold the seeded ids (`agent-1`, `requester-2`). Names are resolved
once per page through `UsersService`, never one lookup per row. Category ids
are real `ObjectId`s, because they are created at runtime.

**Deletion is a flag, never a delete.** `deletedAt` hides a ticket from every
query. A deleted ticket keeps its history, and its category stays locked. You
cannot audit what you have thrown away.

## 2. The state machine

Three states, `open → in_progress → resolved`, and one way back:
`in_progress → open` (release). `resolved` is final.

The states were chosen by asking who is waiting. **Open** means the queue owes
somebody an answer. **In progress** means a named agent owes it. **Resolved**
means nobody does. A fourth state like "waiting on the requester" would be
useful in a real product, but it does not change who is accountable in a way
this exercise tests, so it was left out.

Reopening was left out deliberately. If a resolved ticket can go back to open,
"resolved" stops meaning anything and the board's terminal column stops being
terminal. The answer in a real product is a new ticket linked to the old one,
which is a feature, not a state.

**The rule is enforced twice, on purpose.** `ticket-rules.ts` is pure and
decides _which error to report_; the conditional write decides _what actually
happens_:

```ts
findOneAndUpdate({ _id: id, state: 'open', assigneeId: null }, ...)
```

Four agents taking the same ticket in the same millisecond all pass the pure
check — it cannot see the race. Exactly one update matches the filter. The
other three find nothing and get a 409. This was measured, not assumed: four
concurrent takes answered `[200, 409, 409, 409]` over six runs, with exactly
one `taken` event in the history.

## 3. What was built, and what was not

The exercise asked for two optional features on top of the mandatory ones.

**Search and filters replaced a metrics dashboard.** With thousands of tickets
the daily pain is finding one, not counting them. The AI proposed the dashboard
and pushed back with the exercise's own context paragraph, which names three
questions a dashboard answers; the swap was kept, and what it costs is written
down here: nobody can see the aggregate time a ticket spends in each state.

**Comments were the second.** They are history events rather than a collection
of their own, for the same atomicity reason as section 1, and because a comment
genuinely is one more thing that happened to the ticket.

Deliberately absent, and each one for a reason rather than an oversight:

| Not built           | Why                                                                       |
| ------------------- | ------------------------------------------------------------------------- |
| Attachments         | Storage, virus scanning and access control are their own project          |
| Email notifications | Needs a queue and retries to be worth anything; a fake one proves nothing |
| Ticket priority     | A field with no behaviour behind it is decoration                         |
| Date-range filters  | Planned, dropped to the deadline; the query builder has the shape for it  |
| Reopening a ticket  | See section 2                                                             |

## 4. Environment, and running it your way

Every variable has a working default, so a fresh clone runs with no
configuration. That is the point: nothing is required, everything is
overridable.

| Variable       | Default                             | Read by    | When it is read   |
| -------------- | ----------------------------------- | ---------- | ----------------- |
| `MONGODB_URI`  | `mongodb://localhost:27017/tickets` | API        | at startup        |
| `PORT`         | `3000`                              | API        | at startup        |
| `WEB_ORIGIN`   | `http://localhost:5173`             | API (CORS) | at startup        |
| `JWT_SECRET`   | a random one per start              | API        | at startup        |
| `VITE_API_URL` | `http://localhost:3000`             | web        | **at build time** |

Each project ships a template: copy `api/.env.example` to `api/.env`, and
`web/.env.example` to `web/.env.local`. Neither file is required and neither is
committed.

**There is no config library.** The API reads `process.env` directly, and a
single `process.loadEnvFile()` at the top of `main.ts` makes `api/.env` work —
native to Node 22, no dependency. It does **not** overwrite a variable the
environment already holds, which is the property that matters: Docker and CI
keep winning, and a `.env` forgotten on a laptop cannot quietly redirect a
deployed API. That was verified rather than assumed.

Everything is read early enough. The database uri and the session secret are
read inside factories that Nest calls while it builds the app, not while the
files are imported, so loading the file before `bootstrap` covers all four.

**The web inlines its variables at build time.** Vite reads `.env` files
natively, but `VITE_API_URL` is baked into the bundle when `vite build` runs:
changing it means rebuilding, not restarting. `web/Dockerfile` takes no build
argument for it today, so the published image always points at
`http://localhost:3000`.

### Running against a cloud database, without Docker

This is the common case: MongoDB Atlas, everything else local.

Start only the API with the connection string. PowerShell:

```powershell
$env:MONGODB_URI = "mongodb+srv://user:pass@cluster.mongodb.net/tickets"
$env:JWT_SECRET  = "any-long-random-string"
pnpm -C api dev
```

Or from git-bash:

```bash
MONGODB_URI="mongodb+srv://user:pass@cluster.mongodb.net/tickets" JWT_SECRET="any-long-random-string" pnpm -C api dev
```

Then the web, in another terminal:

```bash
pnpm -C web dev
```

This was run and verified: against an empty Atlas cluster the seed created the
eight users and four categories on startup, the first ticket came out `TCK-1`,
and a second agent taking a ticket already taken still got a 409 — the
conditional write behaves the same against a cloud replica set as against a
local MongoDB. No code changes, only the variable.

Three things to know before the first run:

- **Allow your IP in Atlas** (Network Access), or the API hangs on startup
  waiting for a connection that never opens.
- **Set `JWT_SECRET`.** Without it the API generates a random one and logs a
  warning, so every restart invalidates every token and you get logged out.
- **If it fails with `querySrv ECONNREFUSED`, the network is refusing SRV
  lookups, not rejecting your password.** The `mongodb+srv://` scheme resolves
  a DNS SRV record first, and plenty of home routers answer ordinary records
  while refusing these. Windows itself may resolve them fine and Node still
  fail, because Node does not use the Windows resolver — so a successful
  `nslookup` proves nothing here. Either point the adapter at a public DNS
  server, or skip the lookup altogether by using the non-SRV string, which
  Atlas gives you by turning off the **SRV Connection String** toggle on the
  same Connect screen. It names the hosts instead of discovering them:

  ```
  mongodb://user:pass@host-00.xxxxx.mongodb.net:27017,host-01...:27017,host-02...:27017/tickets?ssl=true&replicaSet=atlas-xxxxxx-shard-0&authSource=admin
  ```

- **The seed runs on startup**, and the two halves behave differently on
  purpose. Users are upserted by id with `$set`, so every restart rewrites
  their name, role and password hash: the demo credentials are guaranteed to
  work, and an edited user is overwritten. Categories are inserted only when
  the collection is empty, so a renamed or deleted starter category never comes
  back. Pointing at an empty cloud database gives you the eight demo users and
  the starter categories straight away.

If the API is not on port 3000, the web needs to be told at build time:

```bash
echo "VITE_API_URL=https://your-api.example.com" > web/.env.local
```

and the API needs to allow that origin back, or CORS refuses the browser:

```bash
WEB_ORIGIN="http://localhost:5173" pnpm -C api dev
```

### Running it in Docker against a cloud database

`compose.yaml` sets `MONGODB_URI` for the API to the `mongo` service. Override
it, and drop the local database, with a `compose.override.yaml`:

```yaml
services:
  api:
    environment:
      MONGODB_URI: mongodb+srv://user:pass@cluster.mongodb.net/tickets
      JWT_SECRET: any-long-random-string
```

Compose merges it automatically. `.env` is git-ignored, and no secret is
committed anywhere in this repository.

## 5. Adding a feature

The structure is meant to make the next feature obvious rather than clever.
A new one, end to end, touches these places and no others.

**On the API**, a feature is a folder under `api/src/`, named for the thing it
serves rather than for a technical layer. One responsibility per file:

```
api/src/<feature>/
  <feature>.schema.ts      what MongoDB stores
  <feature>.service.ts     the rules and the queries
  <feature>.controller.ts  the HTTP routes
  <feature>.module.ts      the Nest wiring
  <feature>.seed.ts        startup data, if it owns any
  <feature>-rules.ts       pure decisions, if they are worth testing alone
  dto/                     the contract, one class per file
```

Register the module in `app.module.ts` and it is live. The guard is global, so
a new route is protected by default: opt out with `@Public()`, restrict with
`@Roles('agent')`, read the caller with `@CurrentUser()`.

**On the web**, a feature is a folder under `web/src/features/`:

```
web/src/features/<feature>/
  <Feature>Page.tsx        the screen
  api.ts                   one typed function per endpoint
  validation.ts            the zod schema its forms use
  components/              the pieces only this feature uses
```

Add the route in `routes.tsx`. Anything shared by two features moves up to
`web/src/components/` or `web/src/helpers/`.

Four conventions are worth knowing before starting, because working against
them is more effort than working with them:

1. **Lists that can grow are paginated.** Take `PaginationQueryDto`, build the
   query with `resolvePage()`, answer with a class extending `PaginatedDto`,
   and give every query a deterministic total order or a record lands on two
   pages. Fixed reference lists, like `GET /users`, return everything instead.
2. **Filtering, sorting and paging are the API's job.** The web never narrows a
   list it already holds, and never queries while somebody is typing.
3. **Board state lives in the URL**, so a filtered board is a link.
4. **The caller's scope goes into the filter last**, so a query string can
   narrow what somebody sees and never widen it. `boardQuery` shows the shape;
   there is a test that fixes it.

Then: write the test first, run `pnpm run check`, and add an entry to
`AI-USAGE.md` if you corrected something the AI proposed.

## 6. What breaks at fifty thousand tickets a month

That is roughly 2,500 a day across five support areas, so figures below assume
a year of that.

**The board query stops being cheap.** Offset pagination walks everything it
skips: `skip(20000)` reads twenty thousand documents to return twenty. Page one
stays fast, deep pages degrade linearly. The fix is a cursor on the sort key
(`createdAt` plus `_id`, which is already the sort order) instead of `skip`.

**The text search stops being a search.** `?q=` becomes a case-insensitive
regular expression, and a contains match on `title` cannot use an index. At
this size it is a collection scan per keystroke of a user's patience. The fix
is a MongoDB text index, or Atlas Search if the deployment allows it.

**Indexes run out.** A ticket has three: unique `code`, `{ requesterId,
createdAt }`, and `{ state, resolvedAt }` for the resolved column. Filtering by
assignee and by requester together wants a compound index, and every filter
combination the product adds wants another. They need to be chosen from real
query patterns, not guessed.

**The ticket document stops being small.** A long-lived ticket with hundreds of
comments approaches the 16 MB limit, and every read of the board deserialises
history it does not display. The fix is to split the history into its own
collection and give up the single-write atomicity of section 1 — paid for with
either a replica-set transaction or an outbox.

**Five support areas want routing.** Categories are a flat list today. Areas
mean teams, queues per team, and a rule for who may see what: `scopeOf` is the
one function that would change, which is the reason it is one function.

## 7. Conscious technical debt

Things known to be wrong, left in knowingly, worst first.

- **A category stays locked after a failed write.** `markUsed` runs before the
  ticket is created, so a ticket that then fails to save leaves the category
  undeletable. Locking after the write is worse — a ticket pointing at a
  deleted category — so the trade is deliberate, and the fix is an outbox or a
  transaction.
- **No transactions anywhere.** Single-document atomicity carries the whole
  design. The moment two documents must change together, this stops being
  enough.
- **The token lives in `localStorage`** and cannot be revoked. A role change or
  a dismissal takes effect when the token expires, up to eight hours later.
  There is no refresh and no server-side logout: logging out is the client
  discarding its token. A short-lived token with a refresh endpoint and a
  denylist is the real answer.
- **Validation limits are mirrored by hand.** `class-validator` on the API and
  zod on the web state the same rules twice, and nothing keeps them in step.
  A shared schema package, or generating one from the OpenAPI document, would.
- **Tickets resolved before `resolvedAt` existed sort last** in the resolved
  column, because the field is absent and MongoDB orders that as null. It
  corrects itself as tickets are resolved; a backfill from the `resolved`
  history event would fix it now.
- **Demo credentials are in the seed**, in plain sight, and every user shares
  one password. Correct for an exercise, unacceptable anywhere else.
- **Drag and drop does not work on touch devices.** Native HTML5 drag events do
  not fire there. Every move is also a button on the detail page, so nothing is
  reachable only by dragging.
- **The web image hardcodes the API URL** at build time, as section 4 explains.

## 8. Quality strategy

**What is tested, and where.**

| Level              | Covers                                                     | Count |
| ------------------ | ---------------------------------------------------------- | ----- |
| Pure unit          | Rules with no I/O: permissions, query building, pagination | 41    |
| Component (jsdom)  | Screens and forms against a faked API                      | 81    |
| End-to-end (Mongo) | Real HTTP through the real app, one database per test file | 70    |

The shape is deliberate: **the rules that are hard to reason about are pure**,
so they are covered exhaustively for the price of a function call.
`ticket-rules.ts` and `ticket-query.ts` take no database and no clock, so every
combination of role, ownership, state and deletion is cheap. The expensive
tests are spent where only a real database can answer.

**What was prioritised, and why.** Concurrency and authorization first, because
those are the failures nobody notices until they matter: a ticket taken twice,
or a requester reading somebody else's queue. The four-agent race and the
category-delete race are covered end to end against a real database.

**What is not tested, and what that risks.**

- **Filtering by order, requester and assignee has no automated test.** It was
  written under deadline pressure with tests explicitly dropped, and verified
  by hand against the running stack instead (ten checks, including that a
  requester cannot filter into another requester's tickets). A regression there
  would not be caught. This is the first debt to pay.
- **Comments have no automated test either**, verified the same way with eleven
  checks. Same risk, same priority.
- **No browser tests.** Component tests run in jsdom, which is not a browser:
  they cannot see a layout break, and they do not run the drag-and-drop
  handlers the way a real pointer would.
- **No load testing** beyond the four-agent race. Section 6 is reasoning about
  scale, not measurement of it.
- **The seed's idempotency is tested; a migration path is not**, because there
  are no migrations yet. The first schema change will need one.

**How to know it still works**, in the order the hooks run it:

```bash
pnpm run check
```

Format, lint, typecheck and unit tests — about ten seconds without the tests,
which is what runs before every commit; the full run happens before a push.
The end-to-end suite needs a database and is separate:

```bash
docker compose up -d mongo && pnpm -C api test:e2e
```

One warning about reading the output. If a run reports
`Test Files 6 passed (8)`, the numbers disagree and it is lying: workers died
before starting and their files were never run. It is a memory failure, not a
pass. The web suite runs one worker at a time to make it rare.
