# AI Usage

## Tools

- **Claude Code** as an assistant throughout the project. I ran every command and wrote every file myself following its instructions, so I understood each step.
- **Skills from [skills.sh](https://skills.sh)** in `.agents/skills/`: `mongodb-schema-design`, `nestjs-patterns`, `vercel-react-best-practices` and `vitest`.

## How I structured the context

- **`AGENTS.md`:** stack and versions, commands, rules, skills, agent persona, strict git rules and workflow. `CLAUDE.md` only imports it, so Cursor and Claude Code read the same rules.
- **`openspec/`:** Spec-Driven Development artifacts for each change: proposal, specs, design, tasks and verification. Every spec scenario has at least one test with the same name.
- **Skills committed to the repo, not just `skills-lock.json`:** when restoring, the CLI downloads them again from the default branch of their source repo and does not verify the hash, so the lock does not guarantee the content I reviewed.

## What I fully delegated

- Verifying every command and configuration in a scratch folder before handing it to me: scaffolds, Dockerfiles, hooks and skills.

## Where I intervened and why

- **Stack:** the AI recommended a single Next.js app. With the context from the interview I chose NestJS + React with Vite + MongoDB, because it is the team's stack and makes the handoff easier.
- **Package manager:** I chose pnpm over npm for security. It does not run dependency install scripts without approval and does not install versions published less than a day ago.
- **Skills:** the AI had dropped the NestJS and React skills. I asked to include them, and we picked alternatives that fit the stack.
- **Agentic setup:** the AI suggested postponing part of it because of the deadline. I decided to set it up from the start.

## AI output I rejected

- **Skills reviewed and dropped:** `nestjs-best-practices` (Jest, TypeORM and Prisma examples; pushes migrations, JWT and microservices), `nestjs-expert` (JWT, TypeORM, Prisma, Swagger and GraphQL) and `react-vite-best-practices` (pushes lazy loading, React Router, Zustand and TanStack).
- **Incomplete `.gitignore`:** it did not include `*.tsbuildinfo`. The file got committed and I removed it with `git rm --cached`.

## Log

- Scope review before the proposal: the AI suggested fixed categories and leaving ticket edit and delete out. I defined categories managed by agents (editable and deletable only if no ticket ever used them), a tracked "release to queue" action, editing and deleting tickets, time in the current state on the dashboard, and 4 requesters plus 4 agents as seed users.
- Design review: the AI planned plain React forms with no extra libraries; I chose react-hook-form with zod for form handling and validation in the web app.
- Delivery plan: the AI planned one PR implemented by sub-agents in six batches; I stopped it before any code was written and chose one branch and PR per batch, implemented one at a time under my review.
- Code structure: the AI put the startup seed inside `UsersService` and the acting-user guard in `users/`. I asked for a clearer criterion: seeds in a `*.seed.ts` file per feature and the guard in its own `auth/` folder.