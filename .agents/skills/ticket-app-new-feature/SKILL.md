---
name: ticket-app-new-feature
description: The end-to-end path for building a new feature in this app — from the spec artifacts through the API, the screens, the tests and the commits, with the decision points called out. Use when starting any new feature or slice, before writing code.
metadata:
  author: ticket-app
  scope: whole repository
---

The route from "we want X" to a merged pull request. The other skills say how
to write each part well; this one says **in what order**, and where the
decisions are that cost the most if taken late.

Read [`.agents/context/README.md`](../../context/README.md) first if you are
new to the repository. It takes five minutes and prevents most of what follows.

## 0. Before anything: is this the smallest thing that works?

Two questions that have each saved a day here:

**What would somebody actually do with it?** The metrics dashboard was
specified, half-designed and then dropped for search and filters, because with
thousands of tickets the daily pain is finding one, not counting them.

**What does it break that already works?** Filtering by person could have let
a requester see somebody else's queue. That is a one-line ordering detail in
the query builder — and a security hole if nobody thought about it first.

Then say out loud what you are **not** building, and write it down. A
deliverable that names its own gaps reads far better than one where the
reviewer finds them.

## 1. Write the spec before the code

Artifacts live in `openspec/changes/<change>/`: proposal, specs, design,
tasks. Do not write code for a change until those are approved.

Each scenario in the spec gets a name that will become a test name:

```
"The board answers only the states it was asked for"
"A search term is matched literally, not as a pattern"
"A requester cannot filter their way into someone else's tickets"
```

Scenario names are behaviour, not implementation. If you cannot name it
without mentioning a function, the spec is not finished.

**Slice it so every slice is shippable.** Tasks here are numbered `7.0a`,
`7.0b` and so on precisely because a slice was pulled forward mid-change when
it turned out to be load-bearing rather than optional. A slice that leaves the
app working is a slice you can stop at when the deadline arrives.

## 2. Build the API first

The web cannot be built against an endpoint that does not exist, and the API
is where the rules live. Follow the `ticket-app-api` skill. The order inside
this step matters:

1. **The pure rules**, in `<feature>-rules.ts` or `<feature>-query.ts`, with
   unit tests. No database, so every combination is cheap. Watch them fail
   first.
2. **The schema**, if the feature stores something new. Check the invariants in
   `data-model.md` still hold, and add the index the new query needs.
3. **The DTO**, documented for `/docs` with an `@example` per property.
4. **The service**, where a state change and its history event are one write.
5. **The controller**, one thin route.
6. **The e2e**, one scenario per spec scenario, against a real MongoDB.

Stop and check: does any new query touch tickets? Then the caller's scope goes
in **last**, so a query string can narrow what somebody sees and never widen
it. There is a test that fixes this; add yours beside it.

## 3. Then the screens

Follow the `ticket-app-web` skill. Read `glossary.md` before writing a string.

1. **The client function** in the feature's `api.ts`, one per endpoint.
2. **Pure rules**, if the interface decides what to offer —
   `transitions.ts` is the pattern. Tested without rendering.
3. **The component**, with its test.
4. **The route**, in `routes.tsx`.

Stop and check: does this add a filter or a view option? Then it lives in the
**URL**, not in `useState`, and the API does the filtering.

## 4. Run the gate, and read it properly

```bash
pnpm run check                                   # before every commit
docker compose up -d mongo && pnpm -C api test:e2e   # when you touched the API
```

`Test Files 6 passed (8)` is a failing run wearing a green hat: two files never
started. The `ticket-app-testing` skill has the rest of the ways a suite lies.

**Verify the claim you are about to make.** If you are about to write "this
works", run the thing. The habits that paid off here: mutate the code and
confirm the right test fails; read the built OpenAPI document rather than
assuming the Swagger plugin ran; measure a layout in the browser rather than
reading class names.

## 5. Commit and open the pull request

One feature per branch, merged in order. Conventional Commits, and each commit
should stand on its own: if it deletes a module, it also updates every importer.

The commit body says **why**, not what — the diff already says what:

> `GET /tickets` answered every state on one page of twenty while the header
> printed the real total, so a board with more tickets than that showed twenty
> and said nothing about the rest.

For the pull request, review the branch against its base and write a
Conventional Commits title plus **Summary**, **Changes** and **Review notes**.
Put the known limits in Review notes. A reviewer who is told about a gap trusts
the rest; one who finds it themselves does not.

## 6. Leave the repository knowing what you did

- `DECISIONS.md` if the feature changed the shape of anything, or added debt.
- `.agents/context/` if the domain, the data model or the vocabulary moved.
- `AGENTS.md` and `README.md` if commands or conventions changed.
- `AI-USAGE.md` with one line per corrected decision, if an AI proposed
  something that had to be reversed.

Do it in the **same commit** as the change. Documentation written later is
documentation written wrong.

## A worked example: ticket comments

What it actually looked like, start to finish:

1. **Scope.** A comment is not a new object — it is one more thing that
   happened to the ticket. That single decision meant no new collection, no new
   permissions model, and no way to edit history.
2. **Rules.** None to write: `ticket-rules.ts` already listed `comment` among
   its actions and already refused it on a resolved ticket, for both roles.
   Reading first saved writing.
3. **API.** `CreateCommentDto` trimming before its length check;
   `POST /tickets/:id/comments` pushing a `commented` event, with the state
   repeated in the write filter so a ticket resolved a millisecond earlier
   cannot collect a comment anyway.
4. **Web.** `CommentForm` at the end of the timeline rather than in a section
   of its own, hidden once the ticket is resolved because the API would refuse
   it.
5. **Verification.** Eleven checks against the composed stack: the requester,
   an agent, a stranger getting 403, an empty and an oversized body getting
   400, a resolved ticket getting 409, the absent delete route getting 404, and
   the whole trail surviving as `created,commented,commented,taken,resolved`.
6. **Honesty.** It shipped without automated tests, under deadline, and the
   pull request said so and named it as the first debt to pay. That is the
   right way to ship a compromise — not to hide it.
