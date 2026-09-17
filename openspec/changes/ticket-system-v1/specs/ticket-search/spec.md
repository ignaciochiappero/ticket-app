# Delta for Ticket Search

## ADDED Requirements

### Requirement: Active Tickets By Default

The board MUST hold every ticket the user is allowed to see, and MUST show only the active ones (`open` and `in_progress`) until the state filter asks for more. Resolved tickets MUST be reachable through that filter. The interface MUST show which states are selected, so a ticket missing from the board is explained rather than lost. Soft-deleted tickets MUST remain unreachable through any filter.

#### Scenario: The board shows active tickets and hides resolved ones

- GIVEN open, in-progress and resolved tickets
- WHEN a user opens the board without choosing any filter
- THEN the open and in-progress tickets are listed, the resolved ones are not, and the interface shows that the active states are the ones selected

#### Scenario: Resolved tickets are found through the state filter

- GIVEN a resolved ticket
- WHEN a user filters by the resolved state
- THEN that ticket is listed, together with the count of tickets matching that filter

#### Scenario: No filter brings back a soft-deleted ticket

- GIVEN a soft-deleted ticket
- WHEN a user asks for every state, including resolved
- THEN that ticket is not listed

### Requirement: Ticket Filters

Users MUST be able to narrow the board by state, category, assignee (an agent or unassigned), the name of the requester or the assignee, and free text matched against the ticket code and title. Filters MUST combine with each other, with sorting and with paging, and the count returned with a page MUST describe the same filter as that page. Filtering MUST happen in the API: the interface MUST NOT fetch the whole collection to narrow it, and MUST NOT query while the person is still typing.

#### Scenario: Filters combine to narrow the board

- GIVEN tickets across several states, categories and assignees
- WHEN a user filters by one state, one category and one assignee at the same time
- THEN only the tickets matching all three are listed, and the count describes that same combination

#### Scenario: A ticket is found by its code or its title

- GIVEN a ticket whose code is known and whose title contains a word
- WHEN a user searches by that code, and then by that word
- THEN the ticket is found both times, regardless of letter case

#### Scenario: A ticket is found by the name of the person involved

- GIVEN tickets created by different requesters and taken by different agents
- WHEN a user searches by a requester's surname, and then by an assignee's first name
- THEN only the tickets of those people are listed

#### Scenario: Unassigned tickets can be singled out

- GIVEN open tickets with no assignee and in-progress tickets with one
- WHEN an agent filters by unassigned
- THEN only the tickets nobody has taken are listed

#### Scenario: A requester's filters never reach another requester's tickets

- GIVEN tickets from several requesters
- WHEN a requester filters or searches with terms that match another requester's tickets
- THEN only their own tickets are listed

### Requirement: Ticket Sorting

Users MUST be able to sort the board by creation date, newest or oldest first, and the order MUST stay stable across pages. Oldest first, with the active states selected, MUST surface the tickets that have been waiting longest.

#### Scenario: The board is sorted by creation date in both directions

- GIVEN tickets created at different times
- WHEN a user sorts newest first, and then oldest first
- THEN the tickets come back in that order, and each ticket appears on exactly one page when walking every page

#### Scenario: The oldest active tickets are the ones that have waited longest

- GIVEN active and resolved tickets of different ages
- WHEN a user sorts oldest first with the active states selected
- THEN the first tickets listed are the oldest ones still unresolved

### Requirement: Date Range Filters

Users SHOULD be able to narrow the board to tickets created within a date range, and to tickets taken within a date range. Both MUST combine with the other filters.

#### Scenario: Tickets are narrowed to a creation date range

- GIVEN tickets created on different days
- WHEN a user asks for the tickets created between two dates
- THEN only the tickets created within that range are listed

#### Scenario: Tickets are narrowed to when they were taken

- GIVEN tickets taken on different days, and tickets never taken
- WHEN a user asks for the tickets taken between two dates
- THEN only the tickets whose history records a take within that range are listed

## MODIFIED Requirements

### Requirement: Ticket Lists

A requester MUST see only tickets they created. An agent MUST see every non-deleted ticket. Both MUST see one board, one page at a time, with each ticket's code, state, category, requester and assignee, sorted and filtered as asked.

#### Scenario: Requester's ticket list shows only tickets they created

- GIVEN tickets created by several requesters
- WHEN a requester opens their board
- THEN only their own tickets are listed

#### Scenario: Agent's board shows every ticket with its state and assignee

- GIVEN tickets in several states, some taken and some not
- WHEN an agent opens the board
- THEN every active ticket is listed with its code, state, requester and assignee
