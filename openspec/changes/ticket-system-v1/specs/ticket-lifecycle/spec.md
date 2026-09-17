# Delta for Ticket Lifecycle

## ADDED Requirements

### Requirement: Ticket Creation

Any requester MUST be able to create a ticket with a title, description, and an existing category.

#### Scenario: Requester creates a ticket in an existing category

- GIVEN an existing category
- WHEN a requester creates a ticket with it
- THEN the ticket is `open`, unassigned, with those fields

#### Scenario: Creating a ticket with a nonexistent category fails

- GIVEN a category id that does not exist
- WHEN a requester creates a ticket with it
- THEN the API rejects the request

### Requirement: Ticket Editing

The requester MUST be able to edit title, description, and category only while `open`.

#### Scenario: Requester edits title, description, and category of their own open ticket

- GIVEN an open ticket owned by the acting requester
- WHEN the requester edits its title, description, and category
- THEN the ticket reflects the new values

#### Scenario: Editing a ticket that is not open is rejected

- GIVEN an `in_progress` or `resolved` ticket
- WHEN its requester attempts to edit it
- THEN the API rejects the request

### Requirement: Ticket Soft Delete

The requester MUST be able to soft-delete their own ticket only while `open`. A soft-deleted ticket MUST be invisible and unreachable.

#### Scenario: Requester deletes their own open ticket

- GIVEN an open ticket owned by the acting requester
- WHEN the requester deletes it
- THEN it is soft-deleted and no longer listed

#### Scenario: Any action attempted on a soft-deleted ticket fails as not found

- GIVEN a soft-deleted ticket
- WHEN any user attempts any action on it
- THEN the API responds as if it does not exist

### Requirement: Take Ticket

Any agent MUST be able to take an `open`, unassigned ticket, becoming `in_progress`. Concurrent takes MUST resolve to exactly one winner.

#### Scenario: Agent takes an open ticket and becomes its assignee

- GIVEN an open, unassigned ticket
- WHEN an agent takes it
- THEN it becomes `in_progress`, assigned to that agent

#### Scenario: Second agent cannot take a ticket that is already in progress

- GIVEN an open, unassigned ticket
- WHEN two agents take it at the same time
- THEN exactly one succeeds and is assigned; the other's attempt fails

### Requirement: Release Ticket

The assigned agent MUST be able to release an `in_progress` ticket to `open`, unassigned; any agent MAY then take it again.

#### Scenario: Assigned agent releases an in-progress ticket back to the open queue

- GIVEN an in-progress ticket assigned to an agent
- WHEN that agent releases it
- THEN it becomes `open` and unassigned

#### Scenario: A released ticket can be edited or deleted by its requester again

- GIVEN a ticket that was taken, then released
- WHEN its requester edits or deletes it
- THEN the action succeeds, as for any other open ticket

### Requirement: Resolve Ticket

The assigned agent MUST be able to resolve an `in_progress` ticket to `resolved`, a final state with no further transitions.

#### Scenario: Assigned agent resolves an in-progress ticket

- GIVEN an in-progress ticket assigned to an agent
- WHEN that agent resolves it
- THEN it becomes `resolved`

#### Scenario: An agent who is not the assignee cannot resolve the ticket

- GIVEN an in-progress ticket assigned to agent A
- WHEN agent B attempts to resolve it
- THEN the API rejects the request; the ticket stays `in_progress`

#### Scenario: A resolved ticket cannot be taken, released, or resolved again

- GIVEN a resolved ticket
- WHEN any agent attempts to take, release, or resolve it
- THEN every attempt is rejected; the ticket stays `resolved`

### Requirement: Ticket Lists

A requester MUST see only tickets they created. An agent MUST see all non-deleted tickets, grouped by state (`open` first), with assignees.

#### Scenario: Requester's ticket list shows only tickets they created

- GIVEN tickets created by several requesters
- WHEN one requester lists their tickets
- THEN only tickets that requester created are shown

#### Scenario: Agent's ticket list shows all tickets grouped by state with each ticket's assignee

- GIVEN tickets in different states from different requesters
- WHEN an agent lists tickets
- THEN they are grouped by state, `open` first, with assignees shown
