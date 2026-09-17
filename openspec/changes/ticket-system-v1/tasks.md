# Tasks: Ticket System v1

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | ~4,500-6,000 (additions + deletions) |
| 400-line budget risk | High |
| Chained PRs recommended | Yes, by size alone |
| Suggested split | Single PR accepted under `size-exception`; the 6 work units below map to commits, not separate PRs |
| Delivery strategy | exception-ok |
| Chain strategy | size-exception |

Decision needed before apply: No
Chained PRs recommended: Yes
Chain strategy: size-exception
400-line budget risk: High

The user already accepted `size-exception` for this change: 4 API modules, 3 collections, 6 e2e suites, ~20 web files, 5 delivery docs, built and shipped in one day. No further decision needed before `sdd-apply`.

### Suggested Work Units

| Unit | Goal | Likely PR | Notes |
|------|------|-----------|-------|
| 1 | API foundation, users, categories | PR 1 (single) | Phases 1-2; base for everything else |
| 2 | Ticket lifecycle + history (API) | PR 1 (single) | Phases 3-4; depends on Unit 1 |
| 3 | Mandatory web (requester/agent views) | PR 1 (single) | Phase 5; cut-safe checkpoint - full product usable via UI |
| 4 | Comments (API + web) | PR 1 (single) | Phase 6; optional, droppable |
| 5 | Dashboard (API + web) | PR 1 (single) | Phase 7; optional, droppable |
| 6 | Verification + delivery docs | PR 1 (single) | Phases 8-9; gates the final commit |

**TDD convention**: every `RED→GREEN` task means write the failing test(s) named exactly as quoted, confirm they fail, implement the minimum to pass, then refactor before moving on (`strict_tdd: true`).

**Build order note**: mandatory web views (Phase 5) sit right after the mandatory API (Phases 1-4) and before optional API capabilities (Phases 6-7). A deadline cut after Phase 5 still leaves a fully usable, demoable product - only Comments and Dashboard are lost.

**Parallel vs sequential**: tasks within a phase are sequential (each e2e file and `TicketDetail.tsx` accumulate scenarios/actions across tasks). Across phases, 1.1 and 1.2 (dependency installs) are independent of each other. Phase 6 (Comments) and Phase 7 (Dashboard) are independent of each other - both only depend on Phase 5 - so a second implementer could take one while the first takes the other. Everything else is strictly sequential.

## Phase 1: Foundation

- [x] 1.1 Install API deps `class-validator`, `class-transformer` in `api/package.json` (required by the global `ValidationPipe`, design ADR "API validation"). If pnpm blocks a build script or skips a version published <1 day ago, resolve via `allowBuilds` for the `api` project in `pnpm-workspace.yaml`.
- [x] 1.2 Install web deps `react-hook-form`, `zod`, `@hookform/resolvers` in `web/package.json` (form state + schema validation, design ADR "Web forms"). Same pnpm freshness/`allowBuilds` check for `web`.
- [x] 1.3 Delete hello-world scaffold: `api/src/app.controller.ts`, `app.service.ts`, `app.controller.spec.ts`, `api/test/app.e2e-spec.ts`.
- [x] 1.4 Create `api/test/create-test-app.ts`: per-file `MONGODB_URI` (`tickets-e2e-<uuid>`), drop database on close.
- [x] 1.5 `api/src/app.module.ts`: `MongooseModule.forRootAsync`, global `ValidationPipe` via `APP_PIPE`. `api/src/main.ts`: CORS (`WEB_ORIGIN`), Swagger `X-User-Id` apiKey scheme.
- [x] 1.6 `users/`: `user.schema.ts`, `dto/user.dto.ts`, `users.seed.ts` (`bulkWrite` seed, 4 requesters + 4 agents, fixed ids, `$setOnInsert`), `users.service.ts` (queries), `users.controller.ts` (`GET /users`, `@Public`), `users.module.ts`.
- [x] 1.7 RED→GREEN `auth/acting-user.guard.spec.ts`: missing/unknown user → 401; wrong role → 403; `@Public` bypass. Implement `auth/acting-user.guard.ts`, `auth/acting-user.decorators.ts` (`@Public`/`@Roles`/`@CurrentUser`), `auth/auth.module.ts` (registers `APP_GUARD`).
- [x] 1.8 RED→GREEN `user-access.e2e-spec.ts`: "Seeded users are available without any login step"; seed idempotency (second app boot, same data unchanged). The two role scenarios need role-restricted endpoints, so they moved to 2.2 and 3.3. Superseded by login in 1.9-1.13: that first scenario becomes "Seeded users can log in with their demo credentials".

- [x] 1.9 Install `@nestjs/jwt`, `cookie-parser` and `@types/cookie-parser` in `api` (signed session tokens; reading the session cookie). Same pnpm freshness and `allowBuilds` check.
- [x] 1.10 RED→GREEN `auth/password.spec.ts`: hashing uses a random salt; the right password verifies; a wrong one does not. Implement `auth/password.ts` (`scrypt` + `timingSafeEqual`, no dependencies).
- [x] 1.11 RED→GREEN `user-access.e2e-spec.ts`: "Seeded users can log in with their demo credentials"; "Login with a wrong password is rejected" (same 401 for an unknown username). Add `username` and `passwordHash` to `user.schema.ts` and `users.seed.ts` (hash of the demo password), `UsersService.findByUsername`; implement `auth/dto/login.dto.ts`, `auth.service.ts` (login), `auth.controller.ts` (`POST /auth/login` sets the `session` cookie).
- [x] 1.12 RED→GREEN `auth/auth.guard.spec.ts`, replacing the `X-User-Id` guard: missing, invalid or expired token → 401; wrong role → 403; `@Public` bypass. Implement `auth.guard.ts` and `auth.decorators.ts` (renamed from `acting-user.*`), `JWT_SECRET` or a random secret at startup, and `main.ts` (`cookie-parser`, CORS credentials, Swagger cookie auth). Dropping the header also required the e2e helper `test/auth.ts` (`loginAs`) and migrating `ticket-categories.e2e-spec.ts` here, to keep the suite green in one step; `src/app.setup.ts` shares the cookie middleware with the test app.
- [x] 1.13 RED→GREEN `user-access.e2e-spec.ts`: "A request without a valid session is rejected"; "Logging out ends the session"; "The current user endpoint returns the logged-in user"; `GET /users` now needs a session. Implement `POST /auth/logout`, `GET /auth/me`. Login and logout share `SESSION_COOKIE_OPTIONS`, because a browser only drops a cookie when the attributes match. Superseded by 1.15: with no cookie there is no server-side session to end, so the logout endpoint and its scenario are gone.

- [x] 1.14 RED→GREEN `auth/auth.guard.spec.ts` and `user-access.e2e-spec.ts` ("The token from login is accepted on protected requests"): the guard reads `Authorization: Bearer` first and falls back to the cookie. Add `auth/dto/login-response.dto.ts` (`token` + `user`), return it from `POST /auth/login`, and declare `addBearerAuth()` in `main.ts` with `@ApiBearerAuth()` on guarded controllers, so Swagger's Authorize button works.
- [x] 1.15 Reduce authentication to one credential, the bearer token (user decision: keep it standard and simple). `LoginResponseDto` becomes `{ token }` only, so identity always comes from `GET /auth/me`. Remove the cookie path: `POST /auth/logout`, `SESSION_COOKIE*`, `src/app.setup.ts`, `cookie-parser` and `@types/cookie-parser`, CORS credentials, the cookie Swagger scheme and `@ApiCookieAuth()`. Update the guard and its tests to the header only, and `test/auth.ts` to a supertest agent with a default `Authorization` header (the ticket-categories tests keep their shape). Logout moves to the web batch as discarding the token.

## Phase 2: Ticket Categories (API, mandatory)

- [x] 2.1 `category.schema.ts` (unique index, `collation: { locale: 'en', strength: 2 }`), `dto/category.dto.ts`, `dto/save-category.dto.ts`, documented for Swagger (JSDoc descriptions and examples, `@ApiParam`, `@ApiTags`).
- [x] 2.2 RED→GREEN `ticket-categories.e2e-spec.ts` (seed + CRUD): "Starter categories exist after startup and are editable"; "Requester cannot create a category"; "Creating a category with a name that already exists fails"; seed idempotency; plus case-insensitive names, rename to an existing name, create, validation, not found, and the `used` lock tested by setting the flag directly. Also add "A requester attempting an agent-only action is rejected" to `user-access.e2e-spec.ts` (requester calls `POST /categories`). Implement `categories.seed.ts` (seed 4 starters when empty), `categories.service.ts` (create/list/edit/delete, conditional `used: false` filters; `markUsed()` moves to 3.3, where tickets call and test it), `categories.controller.ts`, `categories.module.ts`; register in `app.module.ts`.

## Phase 3: Ticket Lifecycle (API, mandatory)

- [ ] 3.1 `ticket.schema.ts` (embedded `history`), `dto/` with one file per DTO (`TicketDto`, `TicketSummaryDto`, `HistoryEventDto`, `CreateTicketDto`, `UpdateTicketDto`), documented for Swagger.
- [ ] 3.2 RED→GREEN `ticket-rules.spec.ts`: "A requester cannot modify a ticket created by another requester"; "Editing a ticket records the previous and new values of changed fields"; role/state/assignee/deleted checks per action. Implement `ticket-rules.ts`.
- [ ] 3.3 RED→GREEN `ticket-lifecycle.e2e-spec.ts` (create/edit/delete): "Requester creates a ticket in an existing category"; "Creating a ticket with a nonexistent category fails"; "Requester edits title, description, and category of their own open ticket"; "Editing a ticket that is not open is rejected"; "Requester deletes their own open ticket"; "Any action attempted on a soft-deleted ticket fails as not found". Also add "An agent attempting a requester-only action is rejected" to `user-access.e2e-spec.ts` (agent calls `POST /tickets`). Implement `CategoriesService.markUsed()`, then `tickets.service.ts`/`tickets.controller.ts` create/edit/delete (edit as compare-and-set, create calls `markUsed`), `tickets.module.ts` (imports `CategoriesModule`); register in `app.module.ts`.
- [ ] 3.4 RED→GREEN addition to `ticket-categories.e2e-spec.ts` (needs tickets from 3.3): "A category currently assigned to a ticket cannot be edited or deleted"; "A category previously assigned to an edited ticket remains locked"; "A category assigned to a soft-deleted ticket remains locked"; concurrent delete-category vs create-ticket race never both succeed (design section 9 "Category race"). Pure verification - no new production code.
- [ ] 3.5 RED→GREEN same e2e file (transitions): "Agent takes an open ticket and becomes its assignee"; "Second agent cannot take a ticket that is already in progress" (4 agents, `Promise.all`); "Assigned agent releases an in-progress ticket back to the open queue"; "A released ticket can be edited or deleted by its requester again"; "Assigned agent resolves an in-progress ticket"; "An agent who is not the assignee cannot resolve the ticket"; "A resolved ticket cannot be taken, released, or resolved again". Implement take/release/resolve as conditional `findOneAndUpdate` + re-read-and-classify on `null`.
- [ ] 3.6 RED→GREEN same e2e file (lists): "Requester's ticket list shows only tickets they created"; "Agent's ticket list shows all tickets grouped by state with each ticket's assignee". Implement `GET /tickets` (role-scoped) + `GET /tickets/:id`.

## Phase 4: Ticket History (API, mandatory)

- [ ] 4.1 RED→GREEN `ticket-history.e2e-spec.ts`: "Every lifecycle action records exactly one history event"; "A ticket's timeline lists its events in the order they occurred"; "Requester cannot view the history of a ticket created by another requester"; "Agent can view the history of any ticket". History is already embedded by Phase 3; close any visibility/ordering gap found.

## Phase 5: Mandatory Web - cut-safe checkpoint

- [ ] 5.1 RED→GREEN `api.test.ts`, `format.test.ts`: requests send the stored bearer token, `ApiError` mapping (401 clears the token), `formatDuration`. Implement `web/src/api.ts`, `types.ts`, `format.ts`.
- [ ] 5.2 RED→GREEN `auth/LoginForm.test.tsx` (empty fields block submit; wrong credentials show the API message; a valid login reports the user) and `App.test.tsx`: "Logging in shows the views for the user's role". Implement `auth/validation.ts`, `auth/LoginForm.tsx` and the `App.tsx` shell (token in `localStorage`, `GET /auth/me`, login form or role layout keyed by user id, logout that discards the token).
- [ ] 5.3 `tickets/validation.ts`: zod schemas mirroring API DTO limits (exercised by 5.4).
- [ ] 5.4 RED→GREEN `TicketForm.test.tsx`: empty/too-long blocks submit with a field message; valid input calls `onSubmit`; rejected `onSubmit` shows the API message (`root.server`). Implement `TicketForm.tsx` (react-hook-form + `zodResolver`, create and edit).
- [ ] 5.5 RED→GREEN `Timeline.test.tsx`: events render in order; edits show from→to with resolved category names. Implement `Timeline.tsx`.
- [ ] 5.6 RED→GREEN `RequesterTickets.test.tsx` + `TicketDetail.test.tsx`: owner sees edit/delete only while `open`. Implement `RequesterTickets.tsx` + `TicketDetail.tsx` (owner actions).
- [ ] 5.7 RED→GREEN `AgentTickets.test.tsx` + same `TicketDetail.test.tsx`: grouped by state with assignee; take/release/resolve shown by state and assignee. Implement `AgentTickets.tsx` + agent actions in `TicketDetail.tsx`.
- [ ] 5.8 RED→GREEN `CategoriesAdmin.test.tsx`: rename/delete disabled when `used`. Implement `categories/validation.ts`, `CategoryForm.tsx`, `CategoriesAdmin.tsx`.
- [ ] 5.9 Checkpoint: the mandatory product is usable end to end via the UI. Safe point to cut Phases 6-7 if the deadline forces it.

## Phase 6: Ticket Comments (optional)

- [ ] 6.1 RED→GREEN `ticket-comments.e2e-spec.ts`: "Requester adds a comment to their own ticket"; "Agent adds a comment to a ticket"; "Adding a comment to a resolved ticket fails"; "A comment cannot be edited or deleted after creation" (no PATCH/DELETE route exists - Nest 404s by default); "A comment made by an agent is visible to the ticket's requester". Implement `dto/create-comment.dto.ts`, `POST /tickets/:id/comments` (`$push commented`, state check).
- [ ] 6.2 RED→GREEN `CommentForm.test.tsx`: empty/too-long blocks submit; valid input calls `onSubmit`. Implement `CommentForm.tsx` (react-hook-form + zod), wire into `TicketDetail.tsx`.

## Phase 7: Support Dashboard (optional)

- [ ] 7.1 RED→GREEN `dashboard.service.spec.ts`: "Dashboard shows ticket counts per state including a single Open (unassigned) figure"; "Median time to take is computed only from tickets that have been taken"; "Median time to resolve is computed only from resolved tickets"; "Dashboard shows elapsed time in current state for open and in-progress tickets" (odd/even/empty medians; time-in-state reset only by `created`/`taken`/`released`, not edits/comments). Implement `computeDashboard()`, `dto/dashboard.dto.ts`.
- [ ] 7.2 RED→GREEN `support-dashboard.e2e-spec.ts`: "Requester cannot access the dashboard"; "Soft-deleted tickets are excluded from dashboard counts". Implement `dashboard.controller.ts` (`GET /dashboard`, agent-only), `dashboard.module.ts` (`forFeature` reuse of the `Ticket` model); register in `app.module.ts`.
- [ ] 7.3 RED→GREEN `Dashboard.test.tsx`: counts/medians render, "—" when `null`. Implement `dashboard/Dashboard.tsx`.

## Phase 8: Verification

- [ ] 8.1 Run `pnpm run check` (lint + unit, api + web); fix any failure.
- [ ] 8.2 `docker compose up -d mongo`, run `pnpm -C api test:e2e`; all 6 capability files pass, including concurrent-take and the category race.
- [ ] 8.3 `docker compose up --build` end to end: seeded users/categories visible, full ticket flow works through the UI with no manual steps.
- [ ] 8.4 Check `http://localhost:3000/docs`: only product endpoints listed, logging in from `/docs` authenticates the later calls, schemas match design section 5.

## Phase 9: Delivery Documentation

- [x] 9.1 `README.md`: Docker and dev run steps, 4 requester + 4 agent seeded users with their usernames and the demo password, 4 starter categories, Swagger at `/docs`. Written early, on the user's call; the Status section and the environment table need a final pass once the web app lands (8.x).
- [ ] 9.2 `DECISIONS.md`: data model and why (design sections 2, 11); ticket state machine and why those states (design section 3, proposal lifecycle table); optional features discarded and the selection criteria (proposal Out of Scope table); what breaks or gets redesigned at 50,000 tickets/month and 5 support areas (design section 11 subsection); conscious technical debt (category over-locking on failed writes, no transactions, manual zod/class-validator limit mirroring, no pagination or extra indexes, demo credentials in the seed, a role that stays valid until the token expires with no refresh or revocation, no server-side logout, and the token in `localStorage`).
- [ ] 9.3 `DECISIONS.md` Quality Strategy section: what's tested and how (design section 9 table), what's not (browser/visual e2e, load beyond the 4-agent race), and prioritization rationale (concurrency and authorization first, per proposal Risks table).
- [ ] 9.4 Throughout apply: append a one-line `## Log` entry to `AI-USAGE.md` for each rejected/corrected decision (skip minor wording, per AGENTS.md rule). At delivery, finish `## What I fully delegated` / `## Where I intervened and why` / `## AI output I rejected` for the implementation phase - do not rewrite existing planning-phase content.
- [ ] 9.5 Update `AGENTS.md` (module structure, e2e per-test-database note, pointer to `DECISIONS.md`); create `.agents/context/domain.md` and `.agents/context/data-model.md`.

## Suggested Batches and Commits

Decided by the user: one branch and one PR per batch, created from `main` and merged in order. Batches are implemented one at a time, with a review before the next one starts; the user runs every git command.

| Batch | Phases | Branch | Suggested commit |
|-------|--------|--------|-------------------|
| 1. API foundation, authentication and categories | 1-2 | `feat/api-foundation-categories` | already committed: dependencies, foundation, categories; then `feat(api): add login with bearer tokens` |
| 2. Ticket lifecycle and history | 3-4 | `feat/api-ticket-lifecycle` | `feat(api): add ticket lifecycle with embedded audit history` |
| 3. Mandatory web | 5 | `feat/web-ticket-views` | `feat(web): add switcher, requester/agent ticket views, and category admin` |
| 4. Comments (optional) | 6 | `feat/ticket-comments` | `feat: add ticket comments end to end` |
| 5. Dashboard (optional) | 7 | `feat/support-dashboard` | `feat: add support dashboard metrics end to end` |
| 6. Delivery and docs | 8-9 | `docs/delivery` | `docs: add README, DECISIONS, and finish AI usage log` |
