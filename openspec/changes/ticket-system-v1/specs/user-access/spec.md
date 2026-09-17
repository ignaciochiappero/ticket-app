# Delta for User Access

## ADDED Requirements

### Requirement: Seeded Users

The system MUST seed exactly 4 requester users and 4 agent users at startup, each with exactly one role, a unique username and a demo password. Passwords MUST be stored only as salted hashes.

#### Scenario: Seeded users can log in with their demo credentials

- GIVEN a freshly started system
- WHEN a seeded user logs in with their username and the demo password
- THEN the login succeeds and the API returns a token for that user

### Requirement: Login

Users MUST log in with username and password. A successful login MUST return a token, and nothing else, that proves the user's identity and role on later requests. Protected endpoints MUST accept that token as their only credential. The API MUST keep no session state of its own, so logging out is the client discarding its token.

#### Scenario: Login with a wrong password is rejected

- GIVEN a seeded user
- WHEN someone logs in with that username and a wrong password
- THEN the API rejects the login with the same response it gives for an unknown username, and returns no token

#### Scenario: The token from login is accepted on protected requests

- GIVEN a user who logged in and received a token
- WHEN a protected action is called with that token in the Authorization header
- THEN the API accepts the request as that user, with their role

#### Scenario: A request without a valid token is rejected

- GIVEN no token, or a token that was tampered with or has expired
- WHEN a protected action is called
- THEN the API rejects the request as unauthenticated

### Requirement: Current User

The API MUST tell the web app who the token belongs to (id, name and role), so the web app can adapt its views without reading the token itself.

#### Scenario: The current user endpoint returns the logged-in user

- GIVEN a logged-in agent
- WHEN the web app asks the API for the current user
- THEN the API returns that agent's id, name and role

#### Scenario: Logging in shows the views for the user's role

- GIVEN the login screen
- WHEN a requester logs in, and later an agent logs in
- THEN each one sees the actions and data of their own role and ownership

#### Scenario: Logging out returns to the login screen

- GIVEN a logged-in user
- WHEN the user logs out
- THEN the web app discards the token and shows the login screen again

### Requirement: Role Enforcement

The API MUST reject any action performed by a user whose role does not match the role required for that action, regardless of what the UI allows.

#### Scenario: A requester attempting an agent-only action is rejected

- GIVEN a logged-in user with the requester role
- WHEN that user calls an agent-only action, such as creating a category
- THEN the API rejects the request and no change is made

#### Scenario: An agent attempting a requester-only action is rejected

- GIVEN a logged-in user with the agent role
- WHEN that user calls a requester-only action, such as creating a ticket
- THEN the API rejects the request and no change is made

### Requirement: Ownership Enforcement

The API MUST reject any action on a ticket performed by a requester who did not create that ticket.

#### Scenario: A requester cannot modify a ticket created by another requester

- GIVEN a ticket created by requester A
- WHEN requester B attempts to edit or delete that ticket
- THEN the API rejects the request and no change is made
