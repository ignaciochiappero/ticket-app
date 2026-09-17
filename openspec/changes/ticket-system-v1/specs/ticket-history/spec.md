# Delta for Ticket History

## ADDED Requirements

### Requirement: Audit Event Recording

Every lifecycle action (create, edit, soft delete, take, release, resolve) and every comment MUST record a history event with who performed it, what it was, and when. The event MUST identify the person by name, not only by id. An edit's event MUST record the previous and new values of each changed field.

#### Scenario: Every lifecycle action records exactly one history event

- GIVEN a ticket
- WHEN any lifecycle action is performed on it
- THEN exactly one history event is recorded with the actor, the action, and the time

#### Scenario: Editing a ticket records the previous and new values of changed fields

- GIVEN an open ticket
- WHEN its requester edits its title and category
- THEN the recorded event includes the previous and new value of both fields

### Requirement: Ticket Timeline

A ticket's history events MUST be presented as a timeline, in the order they occurred.

#### Scenario: A ticket's timeline lists its events in the order they occurred

- GIVEN a ticket with several recorded events
- WHEN its timeline is viewed
- THEN the events appear in the order they occurred

### Requirement: History Visibility

Any agent MUST be able to view the history of any ticket. A requester MUST be able to view the history only of tickets they created.

#### Scenario: Requester cannot view the history of a ticket created by another requester

- GIVEN a ticket created by requester A
- WHEN requester B requests its history
- THEN the API rejects the request

#### Scenario: Agent can view the history of any ticket

- GIVEN a ticket created by any requester
- WHEN an agent requests its history
- THEN the full history is returned
