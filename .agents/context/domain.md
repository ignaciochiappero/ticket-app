# The domain

What the product is, in the language of the people who use it. No code here;
`data-model.md` says how this is stored and `DECISIONS.md` says why.

## Who is involved

**Requesters** need something fixed. They open tickets, describe the problem,
and follow it. A requester sees **only their own tickets** — this is not a
preference, it is enforced in the API, and it is the rule most likely to be
broken by a careless change. Four are seeded.

**Agents** work the queue. An agent sees **every** ticket, takes one to become
responsible for it, and resolves it. Agents also manage categories. Four are
seeded.

Nobody is an administrator. There is no role that can rewrite history, and
that is deliberate: see "The history is the product" below.

## A ticket

A request for help, identified by a code people quote out loud — `TCK-14`. The
codes are a gapless sequence starting at 1, which is why they come from an
atomic counter rather than from a document count.

A ticket has a title, a description, exactly one category, the requester who
opened it, the agent who currently has it (or nobody), when it was opened, and
its history.

## What may happen to it

```
                    take                resolve
   ┌──────┐  ─────────────────▶  ┌─────────────┐  ─────────▶  ┌──────────┐
   │ open │                      │ in_progress │              │ resolved │
   └──────┘  ◀─────────────────  └─────────────┘              └──────────┘
                   release
```

**Open** — in the queue, assigned to nobody. The queue owes an answer. Its
requester may still edit or delete it.

**In progress** — one named agent has it and owes the answer. The requester can
no longer change it: somebody is working from what it said when they started.

**Resolved** — nobody owes anything. **Final.** A resolved ticket cannot be
taken, released, resolved again, edited, deleted or commented on.

There is no reopening. If a problem comes back it is a new ticket, because a
state that can be undone stops meaning anything, and a terminal column that
is not terminal stops being useful on a board.

Who may do what:

| Action           | Who                      | Only while         |
| ---------------- | ------------------------ | ------------------ |
| Open a ticket    | its requester            | —                  |
| Edit, delete     | its requester            | it is open         |
| Take             | any agent                | it is open         |
| Release, resolve | the agent who took it    | it is in progress  |
| Comment          | its requester, any agent | it is not resolved |
| Read             | its requester, any agent | it is not deleted  |

**Release is not reassignment.** It returns the ticket to the queue,
unassigned, for anybody to take next. Handing a ticket to a named colleague is
not a feature here.

**Deleting hides, never erases.** A deleted ticket disappears from every view
and keeps its history in the database. You cannot audit what you threw away.

## Categories

What kind of problem a ticket is: four are seeded (Hardware, Software, Access,
Other) and agents may add more.

A category becomes **locked** the moment any ticket has ever used it — it can
no longer be renamed or deleted, and this holds even if that ticket was later
edited to a different category or deleted entirely. The reason is the history:
if "Hardware" could be renamed to "Networking", every past audit entry would
silently start claiming something that was never true. The lock protects the
record, not the category.

A locked category can still be **chosen** for a new ticket. Locked means
unchangeable, not retired.

## The history is the product

Every event is appended to the ticket, in order, with who did it and when:
opened, edited (with the old and new value of each field), taken, released,
resolved, deleted, commented.

Nothing edits or removes an event. There is no route to do it, and that
absence is the feature — a trail that can be rewritten is not a record. When
you are tempted to add a "fix the history" endpoint, that is the thing this
system exists to refuse.

## The board

Agents and requesters see the same board: three columns, one per state, cards
inside. The column is the grouping and the order inside it is the sort, so the
two never fight. Dragging a card between columns performs that state change,
and a column only accepts a drop when the move is legal.

The two live columns hold all their work. **Resolved only grows**, so it shows
the last ten completed with a "Ver más" that asks for more — the same thing
Jira does with a large column, and the reason the board asks the API once per
column instead of paginating across the three.

Filters narrow the board by search term, by who opened a ticket, by which
agent has it (including nobody), and by age. They live in the URL, so a
filtered board is a link an agent can send.
