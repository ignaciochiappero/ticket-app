# Design: Ticket System v1

## Technical Approach

A NestJS modular monolith with one module per capability (`users`, `categories`, `tickets`, `dashboard`) over three MongoDB collections, plus a React SPA with no router, data or UI library, whose forms use react-hook-form with zod. The ticket is the aggregate: its audit history (comments included) is embedded, and every lifecycle action is one conditional `findOneAndUpdate` that checks the rule, changes the state and appends the event atomically. Users log in with username and password; a global guard verifies the signed JWT (user id and role) that every request sends as a bearer token. The specs (written in parallel) own behavior; this document owns the HOW.

## 1. Architecture

### API (`api/src/`)

| Module          | Responsibility                                                                                                                                                                                                            |
| --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `auth/`         | `POST /auth/login`, `GET /auth/me`; password hashing (`password.ts`, scrypt); signed JWT bearer tokens; global `AuthGuard` (`APP_GUARD`) with `@Public()`, `@Roles()`, `@CurrentUser()`. The only place to change for SSO |
| `users/`        | `User` schema (username, password hash), seed (`users.seed.ts`), `GET /users`, `UsersService` used by auth                                                                                                                |
| `categories/`   | `Category` schema, seed (`categories.seed.ts`), back-office CRUD, `markUsed()` for tickets                                                                                                                                |
| `tickets/`      | `Ticket` schema with embedded history, lifecycle and comment endpoints, `ticket-rules.ts` (pure role, owner, assignee and state checks)                                                                                   |
| `dashboard/`    | `GET /dashboard`, pure `computeDashboard()`; registers the `Ticket` model read-only (`forFeature` reuses the existing model)                                                                                              |
| `app.module.ts` | `MongooseModule.forRootAsync` (reads `MONGODB_URI` at init), `ValidationPipe` via `APP_PIPE` so e2e apps get production validation                                                                                        |
| `main.ts`       | CORS, Swagger with the bearer scheme, listen                                                                                                                                                                              |

`TicketsModule` imports `CategoriesModule`. Controllers stay thin; services own writes.

### Guarded action flow (take)

```
Web ─POST /tickets/:id/take + bearer token─▶ AuthGuard ─▶ 401 no valid token / 403 not agent
    ─▶ IsObjectIdPipe ─▶ 400 malformed id
    ─▶ TicketsService.take
         1. findActive(id) + assertCanAct('take', ticket, user)   ─▶ 404 / 409
         2. findOneAndUpdate(filter, $set state + $push event, { returnDocument: 'after' })
         3. null → re-read + assertCanAct (404 / 403 / 409), otherwise 409 "ticket changed"
◀─ 200 TicketDto
```

### Web (`web/src/`)

`App.tsx` reads the token from `localStorage` and asks `GET /auth/me`: without a valid token it renders `auth/LoginForm`; with one it renders a logout button (which discards the token) and the role layout: requester → `tickets/RequesterTickets`; agent → tabs `AgentTickets`, `categories/CategoriesAdmin`, `dashboard/Dashboard`. Folders mirror API modules. `api.ts` is the only module that calls `fetch`.

## 2. Data Model

```ts
// users: seeded, immutable in v1
{ _id: 'requester-1'..'requester-4' | 'agent-1'..'agent-4', username: string /* unique */, name: string,
  role: 'requester' | 'agent', passwordHash: string /* scrypt, 'salt:hash' in hex */ }

// categories: index { name: 1 } unique, collation { locale: 'en', strength: 2 }
{ _id: ObjectId, name: string, used: boolean /* sticky, default false */ }

// tickets: index { requesterId: 1, createdAt: 1 }
{
  _id: ObjectId,
  title: string,
  description: string,
  categoryId: ObjectId,        // -> categories
  state: 'open' | 'in_progress' | 'resolved',
  requesterId: string,         // -> users
  assigneeId: string | null,   // -> users; null exactly when state is 'open'
  createdAt: Date,             // same instant as history[0].at
  deletedAt: Date | null,      // soft delete
  history: HistoryEvent[],     // embedded, append-only, oldest first
}

// HistoryEvent: subdocument without _id
{
  type: 'created' | 'edited' | 'deleted' | 'taken' | 'released' | 'resolved' | 'commented',
  actorId: string,
  at: Date,
  changes?: { field: 'title' | 'description' | 'categoryId'; from: string; to: string }[], // edited only
  body?: string,                                                                          // commented only
}
```

| Relation                      | Choice                 | Why                                                                                                                          | Tradeoff                                                                                         |
| ----------------------------- | ---------------------- | ---------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| Ticket → history and comments | Embed                  | Always read with the ticket; state change and event share one atomic write; tens of events per ticket                        | Cross-ticket event queries scan tickets; very long threads grow the document (16 MB is far away) |
| Ticket → category             | Reference `categoryId` | Categories are managed on their own; the lock makes used names immutable, so ids in history always resolve to the right name | The web resolves names from `GET /categories`                                                    |
| Ticket and event → user       | Reference by id        | 8 immutable users that the web loads once from `GET /users` to show names                                                    | Responses carry ids, not names                                                                   |

- **Soft delete**: `deletedAt` is set together with a `deleted` event. Every ticket read and conditional write includes `deletedAt: null`, so deleted tickets return 404 and never reach lists or the dashboard.
- **Indexes**: only the requester list needs one. The agent list and the dashboard read every non-deleted ticket, which no index makes cheaper at v1 volume.

### Category lock ("ever used by a ticket")

- `used` is set **before** a ticket receives the category (create, or an edit that changes it): `updateOne({ _id: categoryId }, { $set: { used: true } })`. `matchedCount === 0` → 400 "category does not exist".
- Rename and delete are conditional: `updateOne({ _id, used: false }, …)` and `deleteOne({ _id, used: false })`. No match → re-read → 404 (missing) or 409 (in use). Duplicate name (E11000) → 409.
- The flag is never cleared, so previous categories and categories of deleted tickets stay locked.
- **Race, delete category vs create or edit ticket**: both are single-document writes on the same category, so MongoDB serializes them. Delete first → marking matches nothing → ticket rejected. Marking first → delete filter fails → 409. A ticket never points to a deleted category.
- If the ticket write fails after marking (lost edit race, crash), the category stays locked with no ticket: over-locking is the accepted, safe failure. Transactions are not an option: compose runs a standalone MongoDB and transactions need a replica set.

## 3. State Machine and Atomic Writes

`open ─take─▶ in_progress ─resolve─▶ resolved` (final), and `in_progress ─release─▶ open`. Edit, delete and comment do not change state.

Every action except create runs one service helper: pre-read (`deletedAt: null`) → `assertCanAct` (pure, precise status) → conditional `findOneAndUpdate` that also pushes the event → on `null`, re-read and classify again, else 409. The pure check gives the status code; the filter guarantees correctness under concurrency.

| Action  | Who                             | Filter (always `_id` and `deletedAt: null`)                                                                            | Update                                                       |
| ------- | ------------------------------- | ---------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------ |
| create  | requester                       | insert, after `markUsed`                                                                                               | `state: 'open'`, `assigneeId: null`, `history: [created]`    |
| edit    | ticket's requester              | `requesterId: me`, `state: 'open'`, plus the `title`, `description`, `categoryId` values read before (compare-and-set) | `$set` changed fields, `$push` `edited` with `changes`       |
| delete  | ticket's requester              | `requesterId: me`, `state: 'open'`                                                                                     | `$set deletedAt: now`, `$push` `deleted`                     |
| take    | any agent                       | `state: 'open'`, `assigneeId: null`                                                                                    | `$set state: 'in_progress', assigneeId: me`, `$push` `taken` |
| release | assigned agent                  | `state: 'in_progress'`, `assigneeId: me`                                                                               | `$set state: 'open', assigneeId: null`, `$push` `released`   |
| resolve | assigned agent                  | `state: 'in_progress'`, `assigneeId: me`                                                                               | `$set state: 'resolved'`, `$push` `resolved`                 |
| comment | ticket's requester or any agent | `state: { $in: ['open', 'in_progress'] }`, plus `requesterId: me` for requesters                                       | `$push` `commented` with `body`                              |

- **Concurrent take**: both writes target one document; only the first still matches `state: 'open'`; the other gets `null` → 409. The same filter shape resolves edit vs take, comment vs resolve, delete vs take and double clicks.
- **Edit**: the compare-and-set makes `from` values exact even with two tabs open. An edit with no real change returns the ticket with no write and no event.
- **Error order**: requester actions check ownership before state (nothing leaks about other requesters' tickets); agent transitions check state before assignee (agents already see every ticket).

## 4. Authentication and Status Codes

- **One credential, nothing else**: a bearer token. `POST /auth/login` returns `{ token }` and the client sends `Authorization: Bearer <token>` on every protected request. No cookie, no session store, no second transport to keep in sync: the API reads one header, and the same call works from Swagger, curl, the web app or a future mobile client.
- **Login**: `POST /auth/login` finds the user by `username` and verifies the password with `scrypt` and `timingSafeEqual`. Unknown usernames are checked against a dummy hash, so both failures take similar time and return the same 401. On success it signs `{ sub: id, role }` with `@nestjs/jwt` (8 h expiry) and returns only that token: identity comes from `GET /auth/me`, so the response body carries no user data and the client has no reason to decode the token.
- **Guard**: the global `AuthGuard` (`APP_GUARD`) takes the token from the `Authorization: Bearer` header, verifies signature and expiry, sets `request.user = { id, role }` from the claims and checks `@Roles(...)` (no decorator = any logged-in user). `@Public()` opts out: only login. Ownership and assignee checks live in services because they need the resource.
- **Current user**: `GET /auth/me` loads the user by the token's `sub` (401 if it no longer exists). It is how the web app learns the name and role, both right after login and after a page reload.
- **Logout**: no endpoint. The token is self-contained and the API keeps no session, so there is nothing to close server-side; the web app discards the token and shows the login screen. Real revocation would need a token blacklist or short-lived tokens with refresh, which v1 does not need (see "Conscious debt").
- **Signing secret**: `JWT_SECRET` from the environment. When it is missing, the API generates a random 32-byte secret at startup and logs a warning: tokens stop working when the API restarts, and no secret is ever committed.
- **Browser**: the web app keeps the token in `localStorage` and sends it on each request, so a reload keeps the user logged in. CORS allows the web origin; no credentials flag is needed, because nothing rides on cookies.
- **Swagger**: `addBearerAuth()` on guarded controllers. A tester runs `POST /auth/login`, copies `token` from the response and pastes it into Authorize; every protected endpoint then works from `/docs`.

| Case                                                                                | Status |
| ----------------------------------------------------------------------------------- | ------ |
| No Bearer token, invalid or expired token; wrong username or password on login      | 401    |
| Wrong role for the endpoint                                                         | 403    |
| Invalid body or malformed id (pipes); category in the body does not exist (service) | 400    |
| Ticket or category not found; ticket soft-deleted                                   | 404    |
| Requester is not the ticket's owner; agent is not the assignee                      | 403    |
| Invalid state, lost race, category in use, duplicate category name                  | 409    |

Order follows the Nest pipeline: guard (401, 403 role) → pipes (400) → service (404 → 403 → 409; unknown category 400 after the ticket checks).

## 5. API Endpoints

| Method and path            | Role           | Body               | Success                                                              | Errors                  |
| -------------------------- | -------------- | ------------------ | -------------------------------------------------------------------- | ----------------------- |
| POST /auth/login           | public         | `LoginDto`         | 200 `LoginResponseDto` (`token`)                                     | 400, 401                |
| GET /auth/me               | any            | none               | 200 `UserDto`                                                        | 401                     |
| GET /users                 | any            | none               | 200 `UserDto[]`, requesters first                                    | 401                     |
| GET /categories            | any            | none               | 200 `CategoryDto[]` by name                                          | 401                     |
| POST /categories           | agent          | `SaveCategoryDto`  | 201 `CategoryDto`                                                    | 400, 401, 403, 409      |
| PATCH /categories/:id      | agent          | `SaveCategoryDto`  | 200 `CategoryDto`                                                    | 400, 401, 403, 404, 409 |
| DELETE /categories/:id     | agent          | none               | 204                                                                  | 400, 401, 403, 404, 409 |
| GET /tickets               | any            | none               | 200 `TicketSummaryDto[]` oldest first; requesters get only their own | 401                     |
| POST /tickets              | requester      | `CreateTicketDto`  | 201 `TicketDto`                                                      | 400, 401, 403           |
| GET /tickets/:id           | owner or agent | none               | 200 `TicketDto`                                                      | 400, 401, 403, 404      |
| PATCH /tickets/:id         | owner          | `UpdateTicketDto`  | 200 `TicketDto`                                                      | 400, 401, 403, 404, 409 |
| DELETE /tickets/:id        | owner          | none               | 204                                                                  | 400, 401, 403, 404, 409 |
| POST /tickets/:id/take     | agent          | none               | 200 `TicketDto`                                                      | 400, 401, 403, 404, 409 |
| POST /tickets/:id/release  | assignee       | none               | 200 `TicketDto`                                                      | 400, 401, 403, 404, 409 |
| POST /tickets/:id/resolve  | assignee       | none               | 200 `TicketDto`                                                      | 400, 401, 403, 404, 409 |
| POST /tickets/:id/comments | owner or agent | `CreateCommentDto` | 201 `TicketDto`                                                      | 400, 401, 403, 404, 409 |
| GET /dashboard             | agent          | none               | 200 `DashboardDto`                                                   | 401, 403                |

```ts
// Requests: class-validator decorators, strings trimmed, unknown properties rejected
CreateTicketDto  { title: string /* 1-120 */; description: string /* 1-5000 */; categoryId: string /* ObjectId */ }
UpdateTicketDto  = PartialType(CreateTicketDto) // from @nestjs/swagger
CreateCommentDto { body: string /* 1-2000 */ }
SaveCategoryDto  { name: string /* 1-50 */ }
LoginDto         { username: string /* 1-50 */; password: string /* 1-100 */ }

// Responses
UserDto          { id; name; role }
LoginResponseDto { token: string /* JWT, send as `Authorization: Bearer <token>` */ }
CategoryDto      { id; name; used }
TicketSummaryDto { id; title; categoryId; state; requesterId; assigneeId: string | null; createdAt }
TicketDto        extends TicketSummaryDto { description; history: HistoryEventDto[] }
HistoryEventDto  { type; actorId; at; changes?: FieldChangeDto[]; body?: string }
DashboardDto     { counts: { open; in_progress; resolved };
                   medianTimeToTakeMs: number | null; medianTimeToResolveMs: number | null;
                   activeTickets: { id; title; state; assigneeId; timeInStateMs }[] }
```

Swagger: DTO classes live in each feature's `dto/` folder, one class per `*.dto.ts` file, so the CLI plugin documents them (string-literal unions become enums, class-validator limits are shimmed). The plugin runs with `introspectComments`: JSDoc on DTO properties becomes descriptions and `@example` values, JSDoc on routes becomes operation summaries. Controllers add `@ApiTags`, and `@ApiParam` with a description and example for path ids. Controllers declare return types. Transitions use `@HttpCode(200)` and deletes `@HttpCode(204)`. Non-2xx responses use `@Api*Response` decorators because the plugin cannot infer thrown exceptions. Small `to*Dto` mappers turn `_id` into `id` and never expose `deletedAt`.

## 6. Dashboard Computation

One query, `find({ deletedAt: null })` projecting `title`, `state`, `assigneeId`, `createdAt`, `history.type`, `history.at`, then pure `computeDashboard(tickets, now)`:

| Figure                 | Data used                                                                                                                                                 |
| ---------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Count per state        | `state`; the UI labels `open` as "Open (unassigned)"                                                                                                      |
| Median time to take    | Tickets with at least one `taken` event: first `taken.at` minus `createdAt`                                                                               |
| Median time to resolve | `resolved` tickets: `resolved.at` minus `createdAt`                                                                                                       |
| Time in current state  | `open` and `in_progress` tickets: `now` minus `at` of the last `created`, `taken` or `released` event (edits and comments do not reset it), longest first |

Median: sort ascending; odd count → middle value; even → mean of the two middle values; empty → `null`. Unfinished intervals never enter a median. Durations are milliseconds; the web formats them.

## 7. Seeding

A `*.seed.ts` provider in each owning feature (`OnApplicationBootstrap`), so it runs for `docker compose up --build`, `pnpm run dev` and every e2e app:

- **Users**: `bulkWrite` upserts by fixed `_id` with `$setOnInsert`, including `username` and a `passwordHash` of the shared demo password documented in the README; only the hash is stored, and re-runs change nothing.
- **Categories**: `await model.init()` (unique index ready), then insert Access, Hardware, Software and Other only when the collection is empty, so renamed or deleted starter categories do not come back on restart.

## 8. Web

| View                                       | Contents                                                                                                                                                                                                                                   |
| ------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Shell (`App.tsx`) and `auth/LoginForm.tsx` | Login form (username and password) without a valid token; otherwise the user's name, a logout button and the role layout, keyed by user id so a new login resets view state                                                                |
| `tickets/RequesterTickets.tsx`             | My tickets (title, category, state), new-ticket `TicketForm`, selected `TicketDetail`                                                                                                                                                      |
| `tickets/AgentTickets.tsx`                 | All tickets grouped Open (unassigned), In progress, Resolved, each with requester and assignee; selected `TicketDetail`                                                                                                                    |
| `tickets/TicketDetail.tsx`                 | Fields and assignee; edit (`TicketForm`) and delete for the owner while open; take, release, resolve for agents by state and assignee; `CommentForm` unless resolved; `Timeline` (who, what, when, edits as from → to with category names) |
| `categories/CategoriesAdmin.tsx`           | List with an "In use" badge; `CategoryForm` to create and to rename; rename and delete disabled when used                                                                                                                                  |
| `dashboard/Dashboard.tsx`                  | Three counts, two medians ("—" when `null`), time-in-state table with assignee                                                                                                                                                             |

- **API client**: one typed function per endpoint (`login`, `me`, …), each sending `Authorization: Bearer <token>` when a token is stored; non-2xx throws `ApiError(status, message)`, and a 401 clears the token and sends the user back to the login form. Components receive the client as a prop, so tests pass a fake client instead of mocking `fetch`. `types.ts` mirrors the DTOs by hand.
- **Data**: fetch on mount and after each own mutation; actions render the returned `TicketDto`; a 409 shows the message and reloads. Grouping and id → name maps are derived during render. Hidden buttons are convenience only; the API enforces every rule.
- **Forms**: `LoginForm`, `TicketForm` (create and edit), `CommentForm` and `CategoryForm` (create and rename) use react-hook-form with `zodResolver`. The zod schemas live next to their forms, in `auth/validation.ts` (login), `tickets/validation.ts` (ticket, comment) and `categories/validation.ts` (category name), and mirror the API DTO limits: strings trimmed before length checks, title 1-120, description 1-5000, category required, comment 1-2000, category name 1-50. Invalid input shows a message under the field and never reaches the API. zod stays in the web app; the API keeps class-validator, and no schema package is shared.
- **API errors after submit**: each form receives an async `onSubmit`; when it rejects with `ApiError` (400, 403, 404 or 409, such as a duplicate category name or a ticket that is no longer open), the form calls `setError('root.server', { message })`, keeps the typed values and shows the message next to the submit button. Ticket views still reload after a 409; an open form stays mounted until the user saves or cancels, so the message stays visible.
- **URLs and CORS**: `import.meta.env.VITE_API_URL ?? 'http://localhost:3000'`. The browser runs on the host in dev and Docker, and compose publishes the API on port 3000, so `compose.yaml` and the nginx image stay unchanged. The API calls `app.enableCors({ origin: process.env.WEB_ORIGIN ?? 'http://localhost:5173' })`.

## 9. Testing Strategy

Each spec scenario title becomes an identical `it()` name in the layer that owns the rule; tests are written first (strict TDD).

| Layer                                                                 | Command                | Proves                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| --------------------------------------------------------------------- | ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| API unit, `src/**/*.spec.ts`, no database                             | `pnpm run check`       | `ticket-rules`: role, owner, assignee, state and deleted checks per action, and the edit diff. `AuthGuard`: missing, malformed, invalid or expired bearer token → 401, wrong role → 403, `@Public`. `password.ts`: hash with a random salt, verify right and wrong passwords. `computeDashboard`: counts, medians (odd, even, empty), first take after a release, time in state reset only by state events                                                                                                                                                                                                                                                          |
| API e2e, `test/*.e2e-spec.ts`, real MongoDB, supertest on `AppModule` | `pnpm -C api test:e2e` | One file per capability. Login, wrong credentials (same response for an unknown username), bearer token accepted and current user; authorization matrix (no token, wrong role, wrong owner, not assignee); lifecycle and every 409; soft delete (404, hidden from lists and dashboard); exactly one history event per action with actor and time; category lock (current, previous, deleted ticket) and duplicate names; seeded data and seed idempotency. **Concurrent take**: the 4 agents take one ticket with `Promise.all` → exactly one 200, three 409, one `taken` event. **Category race**: concurrent delete category and create ticket never both succeed |
| Web, `*.test.tsx`, jsdom, fake client                                 | `pnpm run check`       | Login form and role layouts, grouping by state with assignee, actions by role and state, timeline, category controls disabled when used, dashboard figures, `formatDuration`, `api.ts` bearer header and error mapping. Forms (`LoginForm`, `TicketForm`, `CommentForm`, `CategoryForm`): empty or too-long input shows the field message and does not call `onSubmit`; valid input calls it; a rejected `onSubmit` shows the API message. Tests use Testing Library `fireEvent` and `findBy*` queries, since react-hook-form validates asynchronously (no `user-event` dependency)                                                                                 |

**E2E isolation**: `test/create-test-app.ts` sets `MONGODB_URI` to `mongodb://localhost:27017/tickets-e2e-<uuid>` before compiling `AppModule` (read lazily by `forRootAsync`) and drops that database on close. Files never share data and can run in parallel; the seed-idempotency test boots a second app on the same database. Needs `docker compose up -d mongo`. Tests authenticate with `test/auth.ts`: `loginAs(app, username)` logs in and returns a supertest client that sends that user's bearer token on every request.

**Swagger**: the CLI plugin runs only in `nest build` and `nest start`, not in Vitest, so verify checks `/docs` on the running API.

## 10. File Changes

| File                                                                                                                                                                                                                                              | Action | Description                                                                                                           |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------ | --------------------------------------------------------------------------------------------------------------------- |
| `api/package.json`                                                                                                                                                                                                                                | Modify | Add `class-validator` and `class-transformer` (required by `ValidationPipe`) and `@nestjs/jwt` (signed bearer tokens) |
| `api/src/main.ts`                                                                                                                                                                                                                                 | Modify | CORS, Swagger bearer scheme                                                                                           |
| `api/src/app.module.ts`                                                                                                                                                                                                                           | Modify | `forRootAsync`, `APP_PIPE`, feature modules                                                                           |
| `api/src/app.controller.ts`, `app.service.ts`, `app.controller.spec.ts`, `api/test/app.e2e-spec.ts`                                                                                                                                               | Delete | Hello-world scaffold; Swagger lists only product endpoints                                                            |
| `api/src/auth/` `auth.controller`, `auth.service`, `auth.guard` (+ `.spec`), `auth.decorators`, `password` (+ `.spec`), `session`, `dto/login.dto`, `dto/login-response.dto`, `auth.module` (`.ts`)                                               | Create | Login, sessions, global guard                                                                                         |
| `api/src/users/` `user.schema`, `dto/user.dto`, `users.controller`, `users.service`, `users.seed`, `users.module` (`.ts`)                                                                                                                         | Create | Users and seed                                                                                                        |
| `api/src/categories/` `category.schema`, `dto/category.dto`, `dto/save-category.dto`, `categories.controller`, `categories.service`, `categories.seed`, `categories.module` (`.ts`)                                                               | Create | Back office, lock, seed                                                                                               |
| `api/src/tickets/` `ticket.schema`, `dto/` (one file per DTO: ticket, ticket-summary, history-event, create-ticket, update-ticket, create-comment), `tickets.controller`, `tickets.service`, `tickets.module`, `ticket-rules` (+ `.spec`) (`.ts`) | Create | Lifecycle, history, comments                                                                                          |
| `api/src/dashboard/` `dto/dashboard.dto`, `dashboard.controller`, `dashboard.service` (+ `.spec`), `dashboard.module` (`.ts`)                                                                                                                     | Create | Metrics                                                                                                               |
| `api/test/create-test-app.ts`, `auth.ts`; `user-access`, `ticket-categories`, `ticket-lifecycle`, `ticket-history`, `ticket-comments`, `support-dashboard` (`.e2e-spec.ts`)                                                                       | Create | E2E helper and suites                                                                                                 |
| `web/package.json`                                                                                                                                                                                                                                | Modify | Add `react-hook-form`, `zod` and `@hookform/resolvers` (form state and client-side validation)                        |
| `web/src/api.ts`, `types.ts`, `format.ts` (+ `api.test.ts`, `format.test.ts`)                                                                                                                                                                     | Create | Client, types, duration and date formatting                                                                           |
| `web/src/App.tsx`, `App.test.tsx`                                                                                                                                                                                                                 | Modify | Shell: login or role layout, logout, agent tabs                                                                       |
| `web/src/auth/LoginForm.tsx` (with test), `web/src/auth/validation.ts`                                                                                                                                                                            | Create | Login form with react-hook-form and zod                                                                               |
| `web/src/tickets/` `RequesterTickets`, `AgentTickets`, `TicketDetail`, `TicketForm`, `CommentForm`, `Timeline` (`.tsx`, with tests)                                                                                                               | Create | Ticket views; `TicketForm` and `CommentForm` use react-hook-form                                                      |
| `web/src/tickets/validation.ts`                                                                                                                                                                                                                   | Create | zod schemas for ticket and comment forms, mirroring the API DTO limits                                                |
| `web/src/categories/CategoriesAdmin.tsx`, `CategoryForm.tsx`, `web/src/dashboard/Dashboard.tsx` (with tests)                                                                                                                                      | Create | Back office with a create and rename form, dashboard                                                                  |
| `web/src/categories/validation.ts`                                                                                                                                                                                                                | Create | zod schema for the category name, mirroring the API DTO limit                                                         |
| `README.md`, `DECISIONS.md`, `.agents/context/domain.md`, `.agents/context/data-model.md`                                                                                                                                                         | Create | Run steps, seeded usernames and the demo password, Swagger login; decisions (section 11); domain; data model          |
| `AGENTS.md`                                                                                                                                                                                                                                       | Modify | Structure, e2e database note, pointer to `DECISIONS.md`                                                               |

No change to `compose.yaml`, Dockerfiles, `nest-cli.json` (the plugin detects ESM) or Vitest configs. No migration: all collections are new.

## 11. Decisions

| Decision                    | Chosen                                                                                                                             | Rejected                                                                                   | Rationale and tradeoff                                                                                                                                                                                                                                                                                                                                                                                                              |
| --------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| History                     | Embedded append-only array; comments are events                                                                                    | `ticket_events` collection                                                                 | One atomic write for state and event, one read for the timeline; cross-ticket event queries and long threads cost more                                                                                                                                                                                                                                                                                                              |
| Transitions                 | Pure rules check + conditional `findOneAndUpdate`                                                                                  | Read-modify-`save()` with versions; transactions                                           | One write enforces rule and concurrency; transactions need a replica set; filters must mirror the rules (e2e covers it)                                                                                                                                                                                                                                                                                                             |
| Category lock               | Sticky `used` flag set before assignment                                                                                           | Query tickets and history on edit or delete                                                | Atomic on one document, covers previous categories and deleted tickets; can over-lock if the ticket write then fails                                                                                                                                                                                                                                                                                                                |
| Soft delete                 | `deletedAt`                                                                                                                        | `state: 'deleted'`                                                                         | Keeps the 3-state lifecycle; every filter must include `deletedAt: null`                                                                                                                                                                                                                                                                                                                                                            |
| Authentication              | Username and password login; one signed JWT with id and role, sent as `Authorization: Bearer`; global guard with `@Public` opt-out | `X-User-Id` header (simulated); httpOnly cookie session; cookie plus bearer, both accepted | The bearer token is what every client expects: Swagger's Authorize, curl and a future mobile app need no special handling, and the API reads one header with no session store, no CORS credentials and no second transport to keep in sync. Costs a token in `localStorage` (an XSS could read it, which an httpOnly cookie would have prevented), no server-side logout, and a role that stays valid until the token expires (8 h) |
| Password hashing            | Node `crypto.scrypt` with a random salt, compared with `timingSafeEqual`                                                           | bcrypt; argon2                                                                             | Memory-hard algorithm with no dependency and no native build (pnpm blocks build scripts and Alpine has no build tools); costs choosing the parameters by hand                                                                                                                                                                                                                                                                       |
| Signing secret              | `JWT_SECRET` from the environment, random per start when missing                                                                   | A default secret in the code or in `compose.yaml`                                          | No secret in the repo and no setup step; sessions end on every restart without `JWT_SECRET`                                                                                                                                                                                                                                                                                                                                         |
| Demo credentials            | One demo password for the seeded users, documented in the README; only hashes stored                                               | Per-user secrets in env files                                                              | They protect local demo data, not anything real, and the evaluator can log in with no setup                                                                                                                                                                                                                                                                                                                                         |
| User ids                    | Readable strings (`agent-1`)                                                                                                       | ObjectIds                                                                                  | Readable in tokens, history, logs and tests; id types differ across collections                                                                                                                                                                                                                                                                                                                                                     |
| Names                       | Resolved in the web by id                                                                                                          | Name snapshots in tickets and events                                                       | No denormalization while users are immutable and used categories are locked                                                                                                                                                                                                                                                                                                                                                         |
| API validation              | class-validator + class-transformer, global `ValidationPipe`                                                                       | Hand-written checks; zod + `StandardSchemaValidationPipe`                                  | Standard NestJS that the team knows; the Swagger plugin reads the limits; costs 2 dependencies                                                                                                                                                                                                                                                                                                                                      |
| Dashboard                   | Pure TypeScript over a projection                                                                                                  | Aggregation with `$median`                                                                 | Exact median and database-free unit tests (installed typings offer only `method: 'approximate'`); loads every non-deleted ticket per request                                                                                                                                                                                                                                                                                        |
| Action routes               | `POST /tickets/:id/take`, `/release`, `/resolve`                                                                                   | `PATCH` with `state`                                                                       | One route per transition, role and filter; clearer Swagger                                                                                                                                                                                                                                                                                                                                                                          |
| Web routing and data        | No router, data-fetching or UI library                                                                                             | React Router, TanStack Query, OpenAPI codegen                                              | Few views, no deep links, nginx needs no SPA fallback; manual refetch, no per-ticket URL                                                                                                                                                                                                                                                                                                                                            |
| Web forms                   | react-hook-form + zod through `zodResolver` (3 web dependencies)                                                                   | Plain controlled forms with hand-written checks                                            | Field errors before submit, submit state and one declarative schema per form instead of hand-written validation code; costs 3 dependencies, and validation is asynchronous, so tests must await it                                                                                                                                                                                                                                  |
| Validation library per side | zod in the web, class-validator in the API                                                                                         | zod in both; a shared schema package                                                       | The Swagger CLI plugin documents class-validator DTO classes with no extra decorators (AGENTS.md rule), and zod in the API would replace those classes. No shared package keeps api and web independent: separate lockfiles and Docker build contexts (`./api`, `./web`). Limits are mirrored by hand and can drift; the API stays the source of truth                                                                              |
| Web to API                  | CORS with an explicit origin                                                                                                       | Vite and nginx reverse proxy                                                               | Same URLs in dev and Docker, no extra config files                                                                                                                                                                                                                                                                                                                                                                                  |
| Category names              | Unique, case-insensitive (collation)                                                                                               | Case-sensitive                                                                             | "Hardware" and "hardware" are the same category                                                                                                                                                                                                                                                                                                                                                                                     |
| E2E data                    | One database per test file                                                                                                         | Shared database, serial files                                                              | Isolation by construction; a crashed run can leave a stray database                                                                                                                                                                                                                                                                                                                                                                 |

### What would change at 50,000 tickets/month and 5 support areas

- About 600k tickets a year still fits one replica set; query shapes change, not the stack.
- Lists get pagination, filters and search, with indexes such as `{ areaId: 1, state: 1, createdAt: 1 }`.
- The dashboard stops loading every ticket: store `firstTakenAt`, `resolvedAt` and `stateChangedAt` in the same writes, then compute windowed metrics with aggregation or keep precomputed daily metrics per area.
- Areas: `areaId` on categories and tickets, agents belong to areas, queues and take are scoped by area, and reassignment between areas becomes an action with its own event.
- Long comment threads move to a `ticket_events` collection, keeping recent events embedded.
- A replica set enables transactions and change streams (notifications).
- SSO (OIDC) replaces username and password, with `auth/` as the only swap point; role changes then need short-lived tokens with refresh, or revocation, instead of an 8-hour token.

## 12. Open Questions

None blocking. Status codes, input limits, list order and case-insensitive category names are set here; if the parallel specs differ, the specs win and this design is updated before tasks.
