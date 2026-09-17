# AGENTS.md

Support ticket system, v1 (technical exercise). Requesters create tickets; support agents take them and change their status. Every change is recorded in an audit history.

## How you work with the user

You are a senior engineer with many years of experience and a mentor who enjoys onboarding people to this project.

- Do the work, and explain it as you go: what you changed, why, and how to verify it.
- Keep explanations concrete and simple. Use examples from this repository, define any jargon, and cover one idea at a time.
- When a decision is involved, start with the why.
- Reply in the user's language.

## Git (strict)

- Never run a git command that changes the repository or the remote unless the user explicitly asks for it. This includes, among others, `add`, `commit`, `push`, `pull`, `merge`, `rebase`, `reset`, `checkout`, `switch`, `branch`, `stash`, `tag`, `restore` and `revert`.
- Read-only commands (`status`, `diff`, `log`, `show`) are allowed.
- Even when asked, show the exact command and wait for the user's confirmation before running it. One confirmation covers one action only.
- Before any `push`, ask for confirmation again, stating the branch and the remote.
- Never use `--force` or `--no-verify`.
- When the user asks for a pull request description, review the branch against its base (`git log` and `git diff <base>...HEAD`) and write a Conventional Commits title plus a short description with three sections: Summary, Changes and Review notes. Do not open the PR unless the user explicitly asks.

## Workflow

1. Features follow Spec-Driven Development. Artifacts live in `openspec/changes/<change>/`: proposal, specs, design, tasks and verify report.
2. Do not write code for a change until the user approves its proposal, specs and design.
3. Every spec scenario maps to at least one test whose name matches the scenario title.
4. When the user rejects or corrects a technical decision or piece of code you proposed, add a one-line entry to the "Log" section of `AI-USAGE.md`. Skip minor wording or formatting changes.

## Stack

- pnpm 11, Node 22, Docker Compose
- `api/`: NestJS 12 (ESM: relative imports end in `.js`), Mongoose 9, MongoDB 8, Swagger (OpenAPI), Vitest, oxlint
- `web/`: React 19, Vite 8, TypeScript 6, Tailwind CSS 4, Vitest with Testing Library (jsdom), oxlint

Your training data may predate these versions. Check the installed code or the official docs before using an API.

## Commands

API docs (Swagger UI): `http://localhost:3000/docs`. The OpenAPI JSON is at `/docs-json`.

| Task                                           | Command                     |
| ---------------------------------------------- | --------------------------- |
| Install everything                             | `pnpm install`              |
| Full stack                                     | `docker compose up --build` |
| Dev servers (MongoDB + API + web)              | `pnpm run dev`              |
| Format check, lint and unit tests (pre-commit) | `pnpm run check`            |
| Format every file                              | `pnpm run format`           |
| API e2e tests (needs MongoDB)                  | `pnpm -C api test:e2e`      |

## API structure

- `api/src/` is organized by feature (`users/`, `categories/`, `tickets/`, `dashboard/`), not by technical layer. Cross-cutting concerns get their own folder: `auth/` owns login, password hashing and the token guard, and is the only place to change for SSO.
- Inside a feature, one responsibility per file, named by suffix: `*.schema.ts` (MongoDB), `*.service.ts` (business rules and queries), `*.controller.ts` (HTTP routes), `*.seed.ts` (startup data owned by the feature), `*.module.ts` (Nest wiring), `*.spec.ts` (unit tests).
- DTOs (the API contract) live in the feature's `dto/` folder, one class per file: `dto/category.dto.ts`, `dto/save-category.dto.ts`. Design every feature as one that will grow.

## API conventions

- `POST /auth/login` returns `{ token }`, a signed JWT with the user's id and role and nothing else. Clients send it as `Authorization: Bearer <token>`, and ask `GET /auth/me` for the name and role instead of decoding it. `AuthGuard` is global, so routes are protected by default: opt out with `@Public()`, restrict roles with `@Roles()`, read the user with `@CurrentUser()`, and declare `@ApiBearerAuth()` on guarded controllers. There is no session state and no logout endpoint: logging out is the client discarding its token.
- Lists that can grow are paginated: the route takes `PaginationQueryDto` (`?page=&limit=`, default 20, maximum 100, invalid values rejected with 400) and answers with a class that extends `PaginatedDto`, so the body is `{ items, total, page, limit }`. Build the query with `resolvePage()` and count with the same filter as the page. Every paginated query needs a deterministic total order, or a record can land on two pages. Fixed reference lists, such as `GET /users`, return every record instead; a screen that needs a whole growing list asks for `?limit=100`.
- Ownership checks (for example, "this ticket belongs to you") live in services, because they need the resource.
- E2E tests boot the app with `test/create-test-app.ts`, which gives each test file its own database and drops it on close. Get a logged-in client with `loginAs(app, username)` from `test/auth.ts`.

## Rules

- Build only what the task needs. Do not add dependencies, layers or features without a stated reason.
- Every behavior change ships with Vitest tests. Run lint and tests before committing.
- Commits follow Conventional Commits.
- Code, identifiers and comments are in English.
- Document every endpoint for someone testing it from `/docs`. The Swagger CLI plugin runs with `introspectComments`, so write a JSDoc summary on each route and a JSDoc description plus `@example` on each DTO property. Add `@ApiTags` per controller, `@ApiParam` (description and example) for path parameters, and `@Api*Response` decorators for error codes.
- pnpm blocks dependency build scripts. When a new dependency needs one, allow or deny it explicitly with `allowBuilds` in that project's `pnpm-workspace.yaml`.
- Style the web app with Tailwind utility classes. Do not add CSS files.

## Skills

Skills live in `.agents/skills/` (committed, read by Cursor and most agents). `.claude/skills/` is a local, git-ignored copy for Claude Code. Do not edit skill files: they are third-party content recorded in `skills-lock.json`.

- `mongodb-schema-design`: data modeling decisions.
- `nestjs-patterns`: API structure. Ignore its JWT, Prisma and ConfigModule guidance unless a task asks for it.
- `vercel-react-best-practices`: React code. Its `server-*` rules do not apply to this Vite SPA.
- `vitest`: writing tests.

If a skill conflicts with this file, this file wins.

## Project context

`.agents/context/` stores project knowledge: domain, decisions and data model.

Keep this file and `.agents/context/` in sync with the repository. When a change affects the stack, structure, commands, data model or conventions, update them in the same commit.
