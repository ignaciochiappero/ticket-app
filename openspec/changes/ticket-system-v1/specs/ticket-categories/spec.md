# Delta for Ticket Categories

## ADDED Requirements

### Requirement: Starter Categories Seed
The system MUST seed exactly 4 starter categories (Access, Hardware, Software, Other) at startup. Starter categories remain editable and deletable like any other category until used by a ticket.

#### Scenario: Starter categories exist after startup and are editable
- GIVEN a freshly started system
- WHEN an agent lists categories
- THEN Access, Hardware, Software, and Other exist and can be edited or deleted

### Requirement: Category Management by Agents
Any agent MUST be able to create, list, edit, and delete categories. Requesters MUST NOT manage categories; they may only select an existing one when creating a ticket.

#### Scenario: Requester cannot create a category
- GIVEN an acting user with the requester role
- WHEN that user attempts to create a category
- THEN the API rejects the request and no category is created

### Requirement: Unique Category Names
Category names MUST be unique. Creating or renaming a category to a name that already exists MUST fail.

#### Scenario: Creating a category with a name that already exists fails
- GIVEN a category named "Hardware" already exists
- WHEN an agent creates a new category also named "Hardware"
- THEN the API rejects the request and no category is created

### Requirement: Used-Category Lock
A category that is, or ever was, assigned to a ticket MUST NOT be edited or deleted. This includes a category that is only a ticket's previous category after an edit, and categories assigned to soft-deleted tickets.

#### Scenario: A category currently assigned to a ticket cannot be edited or deleted
- GIVEN a category assigned to an open ticket
- WHEN an agent attempts to edit or delete that category
- THEN the API rejects the request and the category is unchanged

#### Scenario: A category previously assigned to an edited ticket remains locked
- GIVEN a ticket whose category was changed from category X to category Y
- WHEN an agent attempts to edit or delete category X
- THEN the API rejects the request, because X was once assigned to the ticket

#### Scenario: A category assigned to a soft-deleted ticket remains locked
- GIVEN a category assigned to a ticket that was later soft-deleted
- WHEN an agent attempts to edit or delete that category
- THEN the API rejects the request, because the category was assigned to the deleted ticket
