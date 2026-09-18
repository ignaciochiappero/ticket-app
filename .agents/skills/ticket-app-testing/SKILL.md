---
name: ticket-app-testing
description: The testing standard for this repository — which level to write at, the TDD loop, how to drive the UI, and the traps that make a green run a lie. Use when writing or fixing any test, or when a suite behaves strangely.
metadata:
  author: ticket-app
  scope: api/, web/
---

How testing works here, and the specific ways it has gone wrong. The last
section is the one to read first if a run looks odd — a suite that reports
"passed" while doing nothing is worse than a red one.

## Which level

| Write a…                | When                                              | Where                    |
| ----------------------- | ------------------------------------------------- | ------------------------ |
| Pure unit test          | The logic takes no I/O and no clock               | `*.spec.ts` beside it    |
| Component test (jsdom)  | A screen or form, against a faked API             | `*.test.tsx` beside it   |
| E2E against MongoDB     | HTTP, authorization, concurrency, persistence     | `api/test/*.e2e-spec.ts` |

**Push logic into pure modules so it can be covered exhaustively.**
`ticket-rules.ts`, `ticket-query.ts` and `web/.../transitions.ts` take no
database and no clock, so every combination of role, ownership and state costs
a function call. Spend the expensive tests only where a real database is the
only thing that can answer.

**What only an e2e can prove:** that four agents taking one ticket produce one
winner and three 409s. A unit test cannot see a race.

## The loop

Strict TDD: write the failing test, **run it and watch it fail**, implement the
minimum, refactor. Seeing RED is not ceremony — a test that passes before the
code exists is testing nothing, and that has happened here.

Every spec scenario in `openspec/changes/<change>/` maps to a test whose name
matches the scenario title. Test names describe behaviour, in English, even
though the interface they drive is Spanish:

```ts
it('The resolved column is ordered by when each ticket was resolved', ...)
```

**When a test looks suspicious, mutate the code.** Remove the line it is
supposed to protect and confirm that exactly that test fails. This has been
done here for the history `$push` and for the resolved-column cap; both times
it proved the test earned its place.

## E2E

```ts
const testApp = await createTestApp();       // its own database, dropped on close
const agent = await loginAs(testApp.app, 'carla.ruiz');
```

Each file gets its own database, so files never share data. Needs MongoDB:

```bash
docker compose up -d mongo && pnpm -C api test:e2e
```

They are not in `pnpm run check` — the pre-commit hook must not need a
database.

## Driving the web app

**Use Testing Library's `waitFor`. Never `vi.waitFor`.**

```ts
import { waitFor } from '@testing-library/react'; // ✅ wraps polling in act()
import { vi } from 'vitest';                      // vi.waitFor knows nothing about React
```

This is not style. `vi.waitFor` produced **56** `act(...)` warnings across the
suite: the assertions passed, so nothing failed, but the output became
unreadable and real problems could hide in it.

**Drive a Radix dropdown with `user-event`, never `fireEvent`.** Radix waits
for a whole pointer sequence; a single synthetic event never opens it.

```ts
await userEvent.click(screen.getByLabelText('Categoría'));
await userEvent.click(await screen.findByRole('option', { name: 'Hardware' }));
```

jsdom implements none of `hasPointerCapture`, `setPointerCapture`,
`releasePointerCapture` or `scrollIntoView`, which Radix calls while opening.
They are stubbed in `web/src/test-setup.ts`; without it the dropdown throws
for a reason that has nothing to do with the component.

**Assert on the Spanish the interface shows**, and choose the option by the
name a person reads rather than by the id underneath it.

**Make the fake API behave like the real one.** The board's fake honours the
`limit` it was asked for — a mock that ignored it let "Ver más" look like it
worked while asking for nothing new.

**Drag and drop** is native HTML5, so a stubbed `dataTransfer` drives it:
`fireEvent.dragStart`, `dragOver`, `drop`. jsdom has no `DataTransfer`.

## When the suite lies

**Read the two numbers.** `Test Files 6 passed (8)` means six of eight ran and
two never started: workers died, and the files that never ran are reported as
though they were fine. That is a memory failure wearing a green hat.

The web suite therefore runs **one worker at a time** (`vite.config.ts`). It
costs about twelve extra seconds and buys a number that can be believed. If it
happens anyway, the machine is out of memory — check it before changing any
config, because a laptop at 99% of its Windows commit limit fails to start
processes at all, and that looks like a dozen unrelated bugs at once.

**A pipe hides an exit code.** `some-command | tail -5` reports `tail`'s
status, which is always 0. That turned a failed build into a "success" here.

**`--print-config` is not behaviour.** A linter config that looks right can
still not be running: prove a rule is live by writing a violation and watching
it get caught.

## Before you commit

```bash
pnpm run check        # format, lint, typecheck — runs on every commit
```

The full version, with tests, runs before a push. **Typecheck is not
decoration**: in one session it caught three files importing a deleted module,
an API that had changed shape (`poolOptions`), and a translated value that was
compared rather than rendered. Lint is type-aware on the API and has caught a
`.sort()` with no comparator and a spread of a class instance.
