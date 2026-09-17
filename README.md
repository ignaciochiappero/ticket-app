# Ticket App

Internal support ticket system, v1. Requesters open tickets; support agents work the queue, take them and change their status. Every change is recorded in an append-only history, so you can always tell what happened and when.

Built as a technical exercise. Two documents explain the thinking behind it:

- [`AI-USAGE.md`](AI-USAGE.md) — how the AI was used, what was delegated, and every decision I corrected.
- [`openspec/changes/`](openspec/changes) — the artifacts each feature was built from: proposal, specs, design and tasks.

## Stack

| Part    | Stack                                                                    |
| ------- | ------------------------------------------------------------------------ |
| API     | NestJS 12 (ESM), Mongoose 9, MongoDB 8, Swagger, Vitest                  |
| Web     | React 19, Vite 8, TypeScript 6, Tailwind CSS 4, Vitest + Testing Library |
| Tooling | pnpm 11, Node 22, Docker Compose, oxlint, Prettier, Husky                |

## Run it with Docker

Everything, database included, with one command:

```bash
docker compose up --build
```

| Service               | URL                        |
| --------------------- | -------------------------- |
| Web app               | http://localhost:5173      |
| API                   | http://localhost:3000      |
| API docs (Swagger UI) | http://localhost:3000/docs |

To stop it: `docker compose down`. The MongoDB data lives in a volume and survives restarts; `docker compose down -v` removes it and gives you a clean database.

## Run it for development

You need Node 22, pnpm 11 and Docker (only for MongoDB).

```bash
pnpm install
```

```bash
pnpm run dev
```

That starts MongoDB in the background and then the API (port 3000, watch mode) and the web app (port 5173, Vite) in parallel. Stop it with `Ctrl+C`.

If port 3000 is already taken by a container from a previous `docker compose up`, run `docker compose down` first.

## Log in

The database is seeded on every startup with 8 users, all sharing the same demo password:

```
ticket-demo
```

| Username           | Name             | Role      |
| ------------------ | ---------------- | --------- |
| `lucia.fernandez`  | Lucía Fernández  | requester |
| `martin.gomez`     | Martín Gómez     | requester |
| `sofia.diaz`       | Sofía Díaz       | requester |
| `tomas.perez`      | Tomás Pérez      | requester |
| `carla.ruiz`       | Carla Ruiz       | agent     |
| `diego.lopez`      | Diego López      | agent     |
| `valentina.torres` | Valentina Torres | agent     |
| `julian.romero`    | Julián Romero    | agent     |

These credentials exist so the project runs with no setup. They protect nothing real and are not used anywhere else.

Requesters and agents see different things: a requester works with their own tickets, an agent works the whole queue and manages the categories.

The seed also creates four starter categories — Access, Hardware, Other, Software — which agents can rename or delete while no ticket has used them.

## Try the API

Open http://localhost:3000/docs and:

1. Run `POST /auth/login` with one of the users above, for example `{ "username": "carla.ruiz", "password": "ticket-demo" }`.
2. Copy the `token` from the response.
3. Click **Authorize**, paste the token, and every endpoint below runs as that user.

`GET /auth/me` tells you who the token belongs to. Tokens last 8 hours, and logging out is simply discarding one: the API keeps no session state.

The same thing from the terminal:

```bash
curl -s -X POST http://localhost:3000/auth/login -H "Content-Type: application/json" -d "{\"username\":\"carla.ruiz\",\"password\":\"ticket-demo\"}"
```

```bash
curl -s http://localhost:3000/auth/me -H "Authorization: Bearer <token>"
```

## Tests

```bash
pnpm run check
```

Lint plus unit tests for both projects. This also runs automatically before every commit.

```bash
pnpm -C api test:e2e
```

End-to-end API tests against a real MongoDB (`docker compose up -d mongo` first, or leave `pnpm run dev` running). Each test file gets its own database and drops it when it finishes, so they never share data.

## Layout

```
api/           NestJS API
  src/         one folder per feature (users, categories, ...), plus auth/ for login and the token guard
  test/        end-to-end tests, one file per capability
web/           React single-page app
openspec/      what each feature was planned to do, before it was written
AGENTS.md      the rules the AI follows in this repository
```

## Environment variables

Everything has a working default, so the commands above need no configuration.

| Variable      | Default                             | Used by    |
| ------------- | ----------------------------------- | ---------- |
| `MONGODB_URI` | `mongodb://localhost:27017/tickets` | API        |
| `PORT`        | `3000`                              | API        |
| `WEB_ORIGIN`  | `http://localhost:5173`             | API (CORS) |
| `JWT_SECRET`  | a random secret per start           | API        |

Without `JWT_SECRET` the API logs a warning and signs tokens with a random secret, which means a restart invalidates them. Set it to keep sessions across restarts.

## Status

The work is split into batches, tracked in [`openspec/changes/ticket-system-v1/tasks.md`](openspec/changes/ticket-system-v1/tasks.md).

- **Done**: project setup, API foundation, seeded users, login and role enforcement, ticket categories.
- **In progress**: ticket lifecycle and history, the web views, comments and the metrics dashboard.
