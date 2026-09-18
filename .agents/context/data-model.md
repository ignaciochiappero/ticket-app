# The data model

Four collections. `domain.md` says what these mean to people; `DECISIONS.md`
section 1 argues for the shape and section 6 says where it stops working.

## `tickets`

The aggregate. Everything about a ticket, including everything that ever
happened to it.

| Field         | Type                                  | Notes                                                               |
| ------------- | ------------------------------------- | ------------------------------------------------------------------- |
| `code`        | string, unique                        | `TCK-14`. From the `counters` sequence, never from a document count |
| `title`       | string                                | ≤ 120 characters                                                    |
| `description` | string                                | ≤ 5000 characters                                                   |
| `categoryId`  | ObjectId                              | Into `categories`. A real ObjectId, unlike the people ids           |
| `state`       | `open` \| `in_progress` \| `resolved` | Needs `type: String` on the decorator — see the trap below          |
| `requesterId` | string                                | A seeded user id such as `requester-2`                              |
| `assigneeId`  | string \| null                        | **Null exactly when the state is `open`**                           |
| `createdAt`   | Date                                  | Set by hand, not by timestamps — see below                          |
| `deletedAt`   | Date \| null                          | Non-null hides the ticket from every query                          |
| `resolvedAt`  | Date \| null                          | Non-null once resolved; the resolved column sorts by it             |
| `history`     | `HistoryEvent[]`                      | Append-only                                                         |

A `HistoryEvent` is `{ type, actorId, at }` plus, depending on the type,
`changes` (for an edit: `field`, `from`, `to`, all as strings) or `body` (for
a comment).

Indexes:

```
{ code: 1 }                  unique — the public handle
{ requesterId: 1, createdAt: 1 }  a requester's own list, either direction
{ state: 1, resolvedAt: -1 } the resolved column, asked for over and over
```

### Invariants

Break one of these and the product is wrong, not just untidy.

1. **`assigneeId` is null exactly when `state` is `open`.** Taking assigns,
   releasing clears. Resolving keeps the assignee, because the history has to
   say who did it.
2. **`history` only ever grows.** No route edits or removes an event.
3. **A state change and its event are one write.** Always `$set` and `$push`
   in the same `findOneAndUpdate`, never two calls.
4. **`createdAt` equals the `at` of the first history event**, and
   `resolvedAt` equals the `at` of the `resolved` event. Both are set by hand
   from one `new Date()` so the ticket and its timeline cannot disagree by a
   few milliseconds. This is why the schema does not use Mongoose timestamps.
5. **A requester's scope is part of the filter, not a check afterwards.**
   `scopeOf(user)` goes into every query and is applied **last**, so no query
   string can widen it.

## `categories`

| Field  | Type    | Notes                                                       |
| ------ | ------- | ----------------------------------------------------------- |
| `name` | string  | ≤ 50 characters, unique **case-insensitively**              |
| `used` | boolean | Set true the first time a ticket uses it, and never cleared |

The uniqueness index carries a collation (`{ locale: 'en', strength: 2 }`), so
"Hardware" and "hardware" are the same category. Any query that compares names
has to pass the same collation or it will disagree with the index.

`used` is one-way. It is set before the ticket is created, which means a
ticket that then fails to save leaves the category locked for nothing — known,
deliberate, and written up as debt in `DECISIONS.md` section 7. The other
order would be worse: a ticket pointing at a category somebody deleted
meanwhile.

## `users`

Seeded, never created through the API.

| Field          | Type                   | Notes                                      |
| -------------- | ---------------------- | ------------------------------------------ |
| `_id`          | string                 | `agent-1`, `requester-2` — fixed, readable |
| `username`     | string, unique         | `carla.ruiz`                               |
| `name`         | string                 | `Carla Ruiz` — what the interface shows    |
| `role`         | `requester` \| `agent` |                                            |
| `passwordHash` | string                 | scrypt, stored as `salt:key`               |

`autoIndex` is off on this schema: the seed writes usernames before the unique
index is built, and it then calls `createIndexes()` itself.

The seed upserts by `_id` with `$set`, so **every restart rewrites** name,
role and hash. That keeps the demo credentials working and means an edited
user is overwritten. Categories behave differently on purpose: they are
inserted only when the collection is empty, so a renamed or deleted starter
category never comes back.

## `counters`

| Field | Type   | Notes                                    |
| ----- | ------ | ---------------------------------------- |
| `_id` | string | The sequence name; `ticket` issues codes |
| `seq` | number | Starts at 0                              |

One atomic `findOneAndUpdate` with `$inc` and `upsert` hands out the next
number. Counting documents would repeat a code after a deletion, and two
callers arriving together would get the same one.

## Traps worth knowing before you edit a schema

**A string union needs `type: String` on the decorator.** The metadata a union
emits is `Object`, so Mongoose cannot work the type out and silently stores
something useless. This applies to `state`, the event `type`, and a change's
`field`.

**Ids of people are strings, ids of categories are ObjectIds.** Seeded users
have readable ids; categories are created at runtime. Mongoose casts a
category id string against the schema path, so one shape serves both a filter
and an update.

**Names are resolved once per page**, never one lookup per row. `personLookup`
on the tickets service exists for that.
