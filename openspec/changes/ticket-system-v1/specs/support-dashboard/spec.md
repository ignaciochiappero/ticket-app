# Delta for Support Dashboard

## ADDED Requirements

### Requirement: Dashboard Access

The dashboard MUST be visible to agents only.

#### Scenario: Requester cannot access the dashboard

- GIVEN an acting user with the requester role
- WHEN that user requests the dashboard
- THEN the API rejects the request

### Requirement: Per-State Ticket Counts

The dashboard MUST show a ticket count per state. Since `open` tickets are always unassigned, both are reported as a single "Open (unassigned)" figure. Soft-deleted tickets MUST be excluded from every dashboard figure.

#### Scenario: Dashboard shows ticket counts per state including a single Open (unassigned) figure

- GIVEN tickets in the `open`, `in_progress`, and `resolved` states
- WHEN an agent views the dashboard
- THEN it shows one "Open (unassigned)" count, one `in_progress` count, and one `resolved` count

#### Scenario: Soft-deleted tickets are excluded from dashboard counts

- GIVEN a soft-deleted ticket
- WHEN an agent views the dashboard
- THEN that ticket is not included in any figure

### Requirement: Median Time Metrics

The dashboard MUST show the median time from creation to first take, and the median time from creation to resolution. Each median MUST be computed only over tickets that reached that milestone (finished intervals); tickets that have not yet reached it MUST be excluded from that median.

#### Scenario: Median time to take is computed only from tickets that have been taken

- GIVEN some tickets that have been taken and some that are still untaken
- WHEN an agent views the dashboard
- THEN the median time to take uses only the taken tickets' creation-to-take intervals

#### Scenario: Median time to resolve is computed only from resolved tickets

- GIVEN some resolved tickets and some tickets that are still open or in progress
- WHEN an agent views the dashboard
- THEN the median time to resolve uses only the resolved tickets' creation-to-resolution intervals

### Requirement: Time in Current State

For each ticket that is `open` or `in_progress`, the dashboard MUST show the elapsed time since it entered that state.

#### Scenario: Dashboard shows elapsed time in current state for open and in-progress tickets

- GIVEN one ticket that is `open` and one that is `in_progress`
- WHEN an agent views the dashboard
- THEN each ticket shows the time elapsed since it entered its current state
