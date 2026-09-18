# Project context

Everything an agent — or a person on their first morning — needs before
touching this repository. Read in this order; each file says what it is for so
you can stop when you have enough.

| Read                                       | To understand                                                     |
| ------------------------------------------ | ----------------------------------------------------------------- |
| [`domain.md`](domain.md)                   | The product: who uses it, what a ticket is, what may happen to it |
| [`data-model.md`](data-model.md)           | What is stored, where, and the invariants that must never break   |
| [`glossary.md`](glossary.md)               | The Spanish the interface speaks and the English the code speaks  |
| [`../../DECISIONS.md`](../../DECISIONS.md) | Why it is shaped this way, what it costs, how to add a feature    |
| [`../../AGENTS.md`](../../AGENTS.md)       | The rules: git, workflow, conventions, commands                   |

## Building something new

Start with the `ticket-app-new-feature` skill in [`../skills/`](../skills/): it is
the ordered path from a spec to a merged pull request. The `ticket-app-api`,
`ticket-app-web` and `ticket-app-testing` skills say how to write each part
well once you know where you are.

## The one-paragraph version

A support ticket system. People who need help (**requesters**) open tickets
against a **category**; support staff (**agents**) take them, work them and
resolve them. Every change is recorded in an append-only history, which is the
feature the whole design bends around. The API is NestJS and MongoDB, the web
app is React; the API speaks English, the interface speaks Spanish.

## Where things live

```
api/src/<feature>/     one folder per feature, not per layer
api/src/auth/          login, hashing, the global guard — the only place SSO would touch
web/src/features/      the same idea on the web: a folder per feature
web/src/components/    only what more than one feature uses
openspec/changes/      what each feature was planned to do, before it was written
.agents/skills/        standards: four vendored, four ours
```

## The five things that surprise people

1. **The history lives inside the ticket document.** A state change and the
   event that records it are one write, so they cannot disagree. See
   `data-model.md`.
2. **Rules are enforced twice on purpose.** A pure function decides _which
   error_ to report; a conditional write decides _what actually happens_. The
   second one is what makes concurrent takes safe.
3. **The board asks once per column.** One paginated list cannot serve three
   columns without starving one of them.
4. **Filters live in the URL**, so a filtered board is a link, and the API does
   the filtering — the web never narrows a list it already holds.
5. **The interface is Spanish, the code is English.** Identifiers, comments,
   commits and the API are English. Only what a person reads is translated.
   `glossary.md` maps the two so nobody invents a third vocabulary.

## Before you commit

```bash
pnpm run check
```

It runs before every commit anyway (format, lint, typecheck), and the full
version including tests runs before a push. If a test run prints
`Test Files 6 passed (8)`, the two numbers disagree and the run is lying —
workers died before starting. That is a memory failure, not a pass.
