# Delta for Ticket Comments

## ADDED Requirements

### Requirement: Adding Comments
The ticket's requester or any agent MUST be able to add a comment to a ticket that is not `resolved`. Every comment MUST appear in the ticket's timeline.

#### Scenario: Requester adds a comment to their own ticket
- GIVEN an open ticket owned by the acting requester
- WHEN the requester adds a comment
- THEN the comment is saved and appears in the ticket's timeline

#### Scenario: Agent adds a comment to a ticket
- GIVEN a ticket that is `open` or `in_progress`
- WHEN an agent adds a comment
- THEN the comment is saved and appears in the ticket's timeline

#### Scenario: Adding a comment to a resolved ticket fails
- GIVEN a resolved ticket
- WHEN a user attempts to add a comment to it
- THEN the API rejects the request

### Requirement: Comment Immutability
A comment MUST NOT be editable or deletable once created.

#### Scenario: A comment cannot be edited or deleted after creation
- GIVEN a ticket with an existing comment
- WHEN any user attempts to edit or delete that comment
- THEN the API rejects the request

### Requirement: Comment Visibility
Every comment MUST be visible to the ticket's requester and to agents. There are no agent-only or internal comments.

#### Scenario: A comment made by an agent is visible to the ticket's requester
- GIVEN a ticket with a comment added by an agent
- WHEN the ticket's requester views the timeline
- THEN that comment is included
