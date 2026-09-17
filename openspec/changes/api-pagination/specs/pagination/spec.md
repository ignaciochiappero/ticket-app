# Delta for Pagination

## ADDED Requirements

### Requirement: Bounded Lists

Every endpoint that returns a collection that can grow MUST return one page at a time. A response MUST carry the page's items, the total number of matching records, the page number and the page size. Lists that cannot grow, such as the seeded users, MAY return every record.

#### Scenario: A list returns the first page by default

- GIVEN a collection with several records
- WHEN a client asks for the list with no parameters
- THEN the API returns the first page with the default page size, and reports the total

#### Scenario: A client can ask for a specific page and size

- GIVEN a collection with several records
- WHEN a client asks for the second page with a page size of two
- THEN the API returns only those two records, and the reported total does not change

#### Scenario: A page past the end is empty

- GIVEN a collection with several records
- WHEN a client asks for a page beyond the last one
- THEN the API returns no items and still reports the real total

#### Scenario: An invalid page or size is rejected

- GIVEN any paginated list
- WHEN a client asks for a page below one, a size below one, a size above the maximum, or a value that is not a whole number
- THEN the API rejects the request as invalid instead of guessing what was meant

### Requirement: Stable Page Order

Every paginated query MUST read its records in a deterministic total order, so that no record is repeated or skipped across pages.

#### Scenario: Paging through a list yields every record exactly once

- GIVEN a collection read one page at a time
- WHEN a client walks every page
- THEN each record appears exactly once, and together the pages hold the whole collection

## MODIFIED Requirements

### Requirement: Category Management by Agents

Any agent MUST be able to create, list, edit, and delete categories, and the list MUST come back one page at a time. Requesters MUST NOT manage categories; they may only select an existing one when creating a ticket.

#### Scenario: Requester cannot create a category

- GIVEN a logged-in user with the requester role
- WHEN that user attempts to create a category
- THEN the API rejects the request and no category is created
