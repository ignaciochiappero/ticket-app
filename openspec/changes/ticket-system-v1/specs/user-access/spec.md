# Delta for User Access

## ADDED Requirements

### Requirement: Seeded Users
The system MUST seed exactly 4 requester users and 4 agent users at startup, each with exactly one role, with no login step required to use them.

#### Scenario: Seeded users are available without any login step
- GIVEN a freshly started system
- WHEN the app loads
- THEN 4 requester users and 4 agent users are available to pick as the acting user, with no credentials required

### Requirement: Acting User Switching
The web app MUST provide a switcher to pick the acting user from the seeded users. Every API request MUST identify the acting user so the API can authorize it.

#### Scenario: Switching the acting user changes which actions and data the app shows
- GIVEN the app is showing one seeded user as the acting user
- WHEN the user switches to a different seeded user
- THEN the app's available actions and visible data reflect the newly acting user's role and ownership

### Requirement: Role Enforcement
The API MUST reject any action performed by a user whose role does not match the role required for that action, regardless of what the UI allows.

#### Scenario: A requester attempting an agent-only action is rejected
- GIVEN an acting user with the requester role
- WHEN that user calls an agent-only action, such as taking a ticket
- THEN the API rejects the request and no change is made

#### Scenario: An agent attempting a requester-only action is rejected
- GIVEN an acting user with the agent role
- WHEN that user calls a requester-only action, such as creating a ticket
- THEN the API rejects the request and no change is made

### Requirement: Ownership Enforcement
The API MUST reject any action on a ticket performed by a requester who did not create that ticket.

#### Scenario: A requester cannot modify a ticket created by another requester
- GIVEN a ticket created by requester A
- WHEN requester B attempts to edit or delete that ticket
- THEN the API rejects the request and no change is made
