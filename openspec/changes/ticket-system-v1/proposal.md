# Proposal: Ticket System v1

## Intent

- **Problem**: a ~800-person organization handles support requests through email and spreadsheets. Nobody knows how many requests are open, how long they take, or who has them.
- **Outcome**: requesters file tickets and follow their status; agents work one queue with clear ownership; each ticket shows who did what and when; agents see volume and timing from real data.
- **Constraint**: v1 must ship in one day, so scope is deliberately minimal.

## Scope

### In Scope

- **Mandatory**: requesters create tickets (title, description, category); agents see the queue, take tickets, and change their status; every change is traceable; requester and agent profiles have different views.
- **Optional features (at most 2 allowed)**:
  - **Comments**: without them, agent-requester conversations fall back to email, the channel this system replaces.
  - **Metrics dashboard**: answers "how many are open" and "how long they take", computed from the audit history.
- **Supporting**: login with seeded users (JWT bearer token), categories back office, edit and soft delete while `open`, release to queue.

### Out of Scope

| Item                                                         | Why not now                                                                                                                  |
| ------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------- |
| SLA by priority                                              | A time target needs a measured baseline; the dashboard provides it for a later phase                                         |
| Notifications                                                | Need an email provider or real-time infrastructure and complicate the local run; requesters already see status in their view |
| Attachments                                                  | Among the costliest (storage, size limits, per-file access control); links in the description cover the need                 |
| Reassignment                                                 | One support team: take plus release covers it; relevant once there are several support areas                                 |
| Search and filters                                           | The queue is enough at this organization's volume                                                                            |
| Automatic categorization                                     | Agents curate categories and requesters pick one; AI does not address the main pain                                          |
| Reopen                                                       | A recurring problem becomes a new ticket, so each ticket has one resolution and one unambiguous time to resolve              |
| User management (sign-up, password change, account recovery) | Not part of the stated problem; seeded users with demo credentials cover v1                                                  |

## Product Rules

### Access

- 4 requesters and 4 agents are preloaded with a username and a demo password; each user has exactly one role. Users log in and log out; there is no sign-up or password change.
- Logging in returns a signed token with the user's id and role, which the client sends on every request. The web app asks the API who is logged in to adapt its views; it never reads the token itself. Logging out is discarding the token, since the API keeps no session.
- The API enforces role and ownership on every action; hiding a control in the UI is never the only check.
- Requesters see only their own tickets; agents see all tickets.
- A soft-deleted ticket disappears from every view and metric; any action on it fails as if it did not exist.

### Ticket lifecycle

`open` →take→ `in_progress` →resolve→ `resolved` (final) · `in_progress` →release→ `open`

| Action                            | Who                              | Only when             | Result                                                                                          |
| --------------------------------- | -------------------------------- | --------------------- | ----------------------------------------------------------------------------------------------- |
| Create                            | Any requester                    | The category exists   | `open`, unassigned                                                                              |
| Edit title, description, category | Ticket's requester               | `open`                | Fields updated                                                                                  |
| Delete                            | Ticket's requester               | `open`                | Soft deleted: hidden everywhere, kept in the database                                           |
| Take                              | Any agent                        | `open` and unassigned | `in_progress`, assigned to that agent; if agents take it at the same time, exactly one succeeds |
| Release to queue                  | Assigned agent                   | `in_progress`         | `open`, unassigned; any agent can take it again (not reassignment)                              |
| Resolve                           | Assigned agent                   | `in_progress`         | `resolved`                                                                                      |
| Comment                           | Ticket's requester, or any agent | Not `resolved`        | Shown in the ticket timeline                                                                    |

- Every action above records a history event with who, what, and when; edits record previous and new values.
- Agents see the history of any ticket; requesters only of their own.

### Categories

- Agents create, list, edit, and delete categories; requesters pick an existing one.
- A category that was ever assigned to a ticket (current or previous category, deleted tickets included) cannot be edited or deleted.
- Starter categories (Access, Hardware, Software, Other) are seeded and stay editable until used; category names are unique.

### Dashboard (agents only)

- Ticket count per state. `open` tickets are always unassigned, so a single "Open (unassigned)" figure covers both.
- Median time to take and median time to resolve, so an outlier ticket does not distort them.
- For each `open` or `in_progress` ticket: time since it entered its current state.

## Capabilities

### New Capabilities

Each capability covers its API rules and its UI.

- `user-access`: seeded users with demo credentials, login, current user, role and ownership checks.
- `ticket-categories`: agent back office and the used-category lock.
- `ticket-lifecycle`: create, edit, soft delete, take, release, resolve; requester's ticket list and agent ticket list (all tickets grouped by state, with assignee).
- `ticket-history`: audit events, the ticket timeline, and who can see it.
- `ticket-comments` (optional feature): comment rules; comments appear in the timeline.
- `support-dashboard` (optional feature): agent metrics.

### Modified Capabilities

None; `openspec/specs/` has no specs yet.

## Approach

- **Authentication**: `POST /auth/login` checks the password hash and returns a signed JWT (user id and role). Clients send it as `Authorization: Bearer <token>`; a global guard verifies it on every request and enforces roles, while ownership checks stay in services. `GET /auth/me` tells the web app who is logged in.
- **Seed**: users are created automatically, so `docker compose up --build` is the only setup step.
- **Design input** (decided in `sdd-design`): history embedded in each ticket, with comments as history events; users referenced by id; categories in their own collection; take, release, and resolve as conditional atomic updates, so one write enforces both the state rule and concurrency.

## Affected Areas

| Area                                         | Impact             | Description                                                                            |
| -------------------------------------------- | ------------------ | -------------------------------------------------------------------------------------- |
| `api/src/`                                   | New                | Feature modules, authentication, seed                                                  |
| `api/src/app.module.ts`                      | Modified           | Registers the feature modules                                                          |
| `api/test/`                                  | New                | e2e tests: concurrent take, authorization, category lock                               |
| `web/src/`                                   | New/Modified       | Login, requester and agent views, back office, dashboard (`App.tsx` becomes the shell) |
| `compose.yaml`                               | Modified if needed | Web-to-API wiring or seed                                                              |
| `README.md`, `.agents/context/`, `AGENTS.md` | New/Modified       | Run steps and seeded users; domain, decisions, data model (AGENTS.md sync rule)        |

## Risks

| Risk                                                                                                           | Likelihood | Mitigation                                                                                                                                                      |
| -------------------------------------------------------------------------------------------------------------- | ---------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Single-day delivery                                                                                            | High       | Closed scope; build mandatory capabilities first and optional ones last, so a cut drops only optional work                                                      |
| Races on one ticket or category: two takes, edit vs take, comment vs resolve, category delete vs ticket create | Med        | Each action is one conditional write; e2e test with parallel takes                                                                                              |
| History out of sync with ticket state                                                                          | Med        | The event is saved in the same write as the change; tests expect one event per action                                                                           |
| Authorization enforced only in the UI                                                                          | Med        | Tests call the API with the wrong role and the wrong owner                                                                                                      |
| Credentials or signing secrets committed to the repo                                                           | Med        | Only password hashes are stored; demo passwords are documented as demo-only; the JWT secret comes from `JWT_SECRET` or is generated at startup, never committed |
| Works in dev, fails under Docker (API URL, CORS, seed)                                                         | Med        | Run `docker compose up --build` end to end before delivery                                                                                                      |

## Rollback Plan

New code on its own branch, delivered in one PR; no existing behavior or data changes. Roll back by not merging or by reverting the merge commit. `docker compose down -v` removes the local database, including seeded users.

## Dependencies

- Every new dependency needs a stated reason in design.

## Success Criteria

- [ ] Every product rule above is enforced by the API and covered by a spec scenario with a same-named test.
- [ ] When two agents take the same ticket at the same time, exactly one succeeds.
- [ ] Each ticket's timeline lists, in order, who did what and when, for every lifecycle action and comment.
- [ ] Using only the app, an agent can tell how many tickets are open, how long they take, and who has them.
- [ ] `docker compose up --build` starts the full stack with seeded users and no manual steps.

## Decisions from the question round (confirmed by the user)

1. **Agent ticket list**: agents see all tickets grouped by state (`open` first), with the assignee of each; no search or filters.
2. **Times**: time to take runs from creation to the first take; time to resolve from creation to resolution. Medians use finished intervals only; unfinished tickets appear in the time-in-state list.
3. **Released tickets**: a released ticket is `open` again, so its requester may edit or delete it, even if it has comments.
4. **Starter categories**: Access, Hardware, Software and Other are seeded and editable until used; category names are unique.
5. **Dashboard counts**: a single "Open (unassigned)" figure, since both counts are always equal.

**Also confirmed**: comments cannot be edited or deleted; every comment is visible to the ticket's requester (no internal notes); agents do not create tickets; resolving needs no resolution note; reopen stays out of scope for the reason above.

**Changed after the question round**: the user brought real login into scope (username and password, JWT bearer token) instead of the simulated user switcher. User management stays out.
