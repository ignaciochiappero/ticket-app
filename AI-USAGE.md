# AI Usage

## Tools

- **Claude Code** as an assistant throughout the project. I ran every command and wrote every file myself following its instructions, so I understood each step.
- **Skills from [skills.sh](https://skills.sh)** in `.agents/skills/`: `mongodb-schema-design`, `nestjs-patterns`, `vercel-react-best-practices` and `vitest`.

## How I structured the context

- **`AGENTS.md`:** stack and versions, commands, rules, skills, agent persona, strict git rules and workflow. `CLAUDE.md` only imports it, so Cursor and Claude Code read the same rules.
- **`openspec/`:** Spec-Driven Development artifacts for each change: proposal, specs, design, tasks and verification. Every spec scenario has at least one test with the same name.
- **Skills committed to the repo, not just `skills-lock.json`:** when restoring, the CLI downloads them again from the default branch of their source repo and does not verify the hash, so the lock does not guarantee the content I reviewed.
- **`.agents/context/`:** the onboarding path for whoever arrives next, agent or person — the domain, the data model with its invariants, and a glossary that maps the Spanish interface to the English code. Without that last one an agent either translates an identifier and breaks the code, or writes English into a screen and breaks the product.
- **Four skills of my own** beside the vendored ones, and they win when the two disagree: `ticket-app-new-feature` (the path from a spec to a merged pull request), plus one each for the API, the web app and testing. They are written from the mistakes this project actually made, not from general advice, which is why the testing one opens with the ways a test run reports passing while doing nothing.

How I worked with it, which mattered more than any of the above:

- **One feature per branch, reviewed before the next.** No sub-agents, no parallel work I could not read.
- **I ran every git command myself.** The agent shows the exact command and waits. It broke this rule once, with a `git mv`, and disclosed it.
- **Specs before code.** No implementation until the proposal, specs and design for that change were approved, and every spec scenario maps to a test with the same name.
- **It had to verify, not assert.** "It works" was not accepted without a command and its output, which is how the silent test-runner failure and my own wrong layout diagnosis were both caught.

## What I fully delegated

- Verifying every command and configuration in a scratch folder before handing it to me: scaffolds, Dockerfiles, hooks and skills.
- **Writing the code once a decision was made.** I decided the shape; the agent typed it. Every file in `api/src` and `web/src` was written by it and reviewed by me.
- **Mechanical work across many files.** Translating the whole interface to Spanish and updating the roughly eighty test assertions that depended on the old copy; swapping the query DTOs when a route's contract changed; repointing every importer when a module moved.
- **Empirical verification.** Rather than accepting "this works", I had it prove each claim: four concurrent agents taking one ticket over six runs, a category-delete race over five, mutation-testing the history suite by removing the `$push`, reading the built OpenAPI document instead of assuming the Swagger plugin ran, dragging a real card in a real browser, and measuring a misaligned row with `getBoundingClientRect()` after two wrong diagnoses from reading class names.
- **Writing its own onboarding.** `.agents/context/` and the four `ticket-app-*` skills, so the next agent starts with this context instead of rediscovering it.

## Where I intervened and why

- **Stack:** the AI recommended a single Next.js app. With the context from the interview I chose NestJS + React with Vite + MongoDB, because it is the team's stack and makes the handoff easier.
- **Package manager:** I chose pnpm over npm for security. It does not run dependency install scripts without approval and does not install versions published less than a day ago.
- **Skills:** the AI had dropped the NestJS and React skills. I asked to include them, and we picked alternatives that fit the stack.
- **Agentic setup:** the AI suggested postponing part of it because of the deadline. I decided to set it up from the start.

Then, once code was being written, the interventions changed character. The planning ones were about what to build; these were about the agent being wrong, or too slow, or too cautious:

- **Product calls it argued with.** I swapped the metrics dashboard for search and filters, because with thousands of tickets the pain is finding one, not counting them. It pushed back twice, quoting the exercise's own context paragraph. I kept the swap and had it write down what the swap costs.
- **Decisions it took without asking.** It discarded React Router and a component library on its own and recorded that as a design decision. I reversed both: filters and ticket codes belong in the URL, and a component library keeps the interface consistent. This is the intervention I would most want to avoid repeating — it is cheap to fix a wrong answer and expensive to fix a decision you never knew was taken.
- **Where it was too cautious.** With the deadline close I ordered both optional features built with no new tests. It raised the tradeoff once, which was right, and then did it — and verified the result by hand instead, which was the correct compromise. I would rather it argue once than either refuse or comply silently.
- **Where I caught it lying to itself.** Its own pre-commit gate never typechecked, so nothing caught a broken import. I told it things were escaping; turning the typecheck on immediately found three files importing a module it had deleted. Twice more that day the typecheck caught an API it had assumed (`poolOptions`, removed in Vitest 4) and a translated value that was compared rather than rendered.
- **Where its diagnosis was wrong and mine was too.** A row of filters looked misaligned. It blamed control heights twice, from reading class names. Measured in the browser, the heights were identical the whole time: Radix renders a hidden select beside its trigger, so a `space-y` rule spaced that too. The lesson I made it write into a skill: measure, do not read.
- **Reliability of its own tooling.** A test run reported `6 passed (8)` — two files never started because the machine was out of memory — and it initially treated that as a pass. It now reads both numbers, and the trap is documented.

## AI output I rejected

- **Skills reviewed and dropped:** `nestjs-best-practices` (Jest, TypeORM and Prisma examples; pushes migrations, JWT and microservices), `nestjs-expert` (JWT, TypeORM, Prisma, Swagger and GraphQL) and `react-vite-best-practices` (pushes lazy loading, React Router, Zustand and TanStack).
- **Incomplete `.gitignore`:** it did not include `*.tsbuildinfo`. The file got committed and I removed it with `git rm --cached`.

From the implementation phase:

- **An httpOnly cookie for the session token**, twice. It left the token out of the login response, which makes Swagger's Authorize button useless, then offered to accept both a cookie and a bearer header. I cut it to one standard mechanism: login returns only the token, every client sends it as a bearer header, and the user's data comes from `GET /auth/me`. No session state, no logout endpoint.
- **A metrics dashboard** as an optional feature. Replaced with search and filters.
- **A table for the ticket board.** I asked for a Jira-style board, one column per state with cards, which reads as a queue rather than a report.
- **A default board that hides resolved tickets.** It proposed this while the board has a Resolved column — the column would have been permanently empty and resolving a ticket would have made it vanish from the board that just moved it there. Replaced with the last ten completed and a "Ver más", which is what Jira does.
- **A lint config that silently disabled thirty-two React rules**, including `rules-of-hooks` at error level, in order to hide two cosmetic warnings from vendored shadcn files. Rejected; the warnings were suppressed with two scoped inline comments instead.
- **`process.loadEnvFile()` presented as safe without evidence.** I made it prove that the file does not override variables already in the environment before I accepted it, because if it did, a forgotten `.env` could redirect a deployed API.
- **Its own attribution line in a pull request description.** I do not ship AI attribution on my deliverables, and it had read the rule as applying only to commits.
- **Overwriting two committed files** it had not read first: `web/.oxlintrc.json` and the `pre-push` hook, the second of which blocks direct pushes to `main`. Both restored from git. The cause was a diagnostic command of its own whose fallback made a missing tool look like a missing file.

## Log

- Scope review before the proposal: the AI suggested fixed categories and leaving ticket edit and delete out. I defined categories managed by agents (editable and deletable only if no ticket ever used them), a tracked "release to queue" action, editing and deleting tickets, time in the current state on the dashboard, and 4 requesters plus 4 agents as seed users.
- Design review: the AI planned plain React forms with no extra libraries; I chose react-hook-form with zod for form handling and validation in the web app.
- Delivery plan: the AI planned one PR implemented by sub-agents in six batches; I stopped it before any code was written and chose one branch and PR per batch, implemented one at a time under my review.
- Code structure: the AI put the startup seed inside `UsersService` and the acting-user guard in `users/`. I asked for a clearer criterion: seeds in a `*.seed.ts` file per feature and the guard in its own `auth/` folder.
- Authentication: the AI planned simulated auth, an `X-User-Id` header with a user switcher, and kept real login out of scope. I brought login into scope: username and password, a JWT carrying the user's role, `GET /auth/me` for the web app, and only password hashes stored.
- Token transport: the AI first kept the token out of the login response, in an httpOnly cookie, which left Swagger's Authorize button useless, and then proposed accepting both a cookie and a bearer token. I cut it to one standard mechanism: the login returns only the token, every client sends it as a bearer header, and the user's data comes from `GET /auth/me`.
- Optional features: the AI picked comments and a metrics dashboard. I swapped the dashboard for search and filters: with thousands of tickets the pain is finding one, and in every platform I have worked on nobody asked for metrics before filters. The AI pushed back with the exercise's own context paragraph, which names the three unknowns a dashboard answers; we kept the swap and wrote down what it costs us, the aggregate duration.
- Web stack: the AI decided on its own, without asking me, that the web app would have no router and no UI library, and recorded it as a design decision. I reversed both: React Router, because filters and ticket codes belong in the URL, and a component library, because it keeps the interface consistent.
- Board layout: the AI built the ticket board as a table. I asked for a board laid out like Jira, one column per state with cards, which reads as a queue rather than a report and makes the grouping by state the AI had dropped fit naturally with sorting.
- Board interaction and icons: I asked for drag and drop between columns as in Jira, a refresh button, and Lucide icons declared once in a single object rather than imported screen by screen. The AI implemented the drag against the state machine, so a column that would refuse the move never accepts the drop.
- API documentation: the AI relied on Swagger's type inference and kept all of a feature's DTOs in one file. I asked for docs a tester can use (descriptions, examples and path parameters) and a `dto/` folder with one file per DTO, treating every feature as one that will grow.
- Quality gate: the AI left `pnpm run check` at format, lint and tests, so no command ever typechecked the code and nothing caught a broken import until a test happened to fail. I asked for global build and lint commands after spotting warnings the AI had passed over, and then rejected its first answer, which ran the whole suite on every commit: the hook is now split, `check:quick` (format, lint, types) before a commit and the full `check` before a push. The AI also blamed vitest for failures that turned out to be the machine sitting at 99% of its Windows commit limit.
