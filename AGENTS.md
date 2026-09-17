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

| Task | Command |
| --- | --- |
| Install everything | `pnpm install` |
| Full stack | `docker compose up --build` |
| Dev servers (MongoDB + API + web) | `pnpm run dev` |
| Lint and unit tests (also runs on pre-commit) | `pnpm run check` |
| API e2e tests (needs MongoDB) | `pnpm -C api test:e2e` |

## Rules

- Build only what the task needs. Do not add dependencies, layers or features without a stated reason.
- Every behavior change ships with Vitest tests. Run lint and tests before committing.
- Commits follow Conventional Commits.
- Code, identifiers and comments are in English.
- Every API endpoint must show up correctly in Swagger. The Swagger CLI plugin infers DTOs; add decorators only for what it cannot infer.
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