import { getModelToken } from '@nestjs/mongoose';
import type { Model } from 'mongoose';
import { Ticket } from '../src/tickets/ticket.schema.js';
import { loginAs, type SessionClient } from './auth.js';
import { createTestApp, type TestApp } from './create-test-app.js';

const REQUESTER = 'lucia.fernandez';
const OTHER_REQUESTER = 'martin.gomez';
const AGENT = 'carla.ruiz';
const OTHER_AGENT = 'diego.lopez';
const AGENTS = [
  'carla.ruiz',
  'diego.lopez',
  'valentina.torres',
  'julian.romero',
];
const MISSING_ID = '64b7f0c2a1b2c3d4e5f60718';

interface TicketResponse {
  id: string;
  code: string;
  title: string;
  description: string;
  categoryId: string;
  state: string;
  requester: { id: string; name: string };
  assignee: { id: string; name: string } | null;
  createdAt: string;
  history: {
    type: string;
    actor: { id: string; name: string };
    at: string;
    changes?: { field: string; from: string; to: string }[];
  }[];
}

describe('ticket-lifecycle (e2e)', () => {
  let testApp: TestApp;
  let requester: SessionClient;
  let agent: SessionClient;
  let categoryId: string;
  let otherCategoryId: string;

  beforeEach(async () => {
    testApp = await createTestApp();
    requester = await loginAs(testApp.app, REQUESTER);
    agent = await loginAs(testApp.app, AGENT);

    const { body } = await agent.get('/categories?limit=100').expect(200);
    const categories = (body as { items: { id: string; name: string }[] })
      .items;
    categoryId = categories[0].id;
    otherCategoryId = categories[1].id;
  });

  afterEach(async () => {
    await testApp.close();
  });

  function ticketModel(): Model<Ticket> {
    return testApp.app.get<Model<Ticket>>(getModelToken(Ticket.name));
  }

  interface TicketPage {
    items: TicketResponse[];
    total: number;
    page: number;
    limit: number;
  }

  async function board(client: SessionClient, query = ''): Promise<TicketPage> {
    const { body } = await client.get(`/tickets${query}`).expect(200);
    return body as TicketPage;
  }

  async function createTicket(
    overrides: Record<string, unknown> = {},
  ): Promise<TicketResponse> {
    const { body } = await requester
      .post('/tickets')
      .send({
        title: 'Printer on floor 3 is jammed',
        description: 'It jams on every double-sided job.',
        categoryId,
        ...overrides,
      })
      .expect(201);
    return body as TicketResponse;
  }

  it('Requester creates a ticket in an existing category', async () => {
    const ticket = await createTicket();

    expect(ticket).toMatchObject({
      code: 'TCK-1',
      title: 'Printer on floor 3 is jammed',
      categoryId,
      state: 'open',
      requester: { id: 'requester-1', name: 'Lucía Fernández' },
      assignee: null,
    });
    // One event, naming the person rather than an id, at the same instant the
    // ticket was created.
    expect(ticket.history).toHaveLength(1);
    expect(ticket.history[0]).toMatchObject({
      type: 'created',
      actor: { id: 'requester-1', name: 'Lucía Fernández' },
      at: ticket.createdAt,
    });

    // The codes are a sequence, not a random string.
    expect((await createTicket()).code).toBe('TCK-2');
  });

  it('Creating a ticket with a nonexistent category fails', async () => {
    await requester
      .post('/tickets')
      .send({
        title: 'Printer jammed',
        description: 'Again',
        categoryId: MISSING_ID,
      })
      .expect(400);

    // Nothing was created, so the next real ticket still gets the first code.
    expect((await createTicket()).code).toBe('TCK-1');
  });

  it('Requester edits title, description, and category of their own open ticket', async () => {
    const created = await createTicket();

    const { body } = await requester
      .patch(`/tickets/${created.id}`)
      .send({
        title: 'Printer on floor 4 is jammed',
        description: 'Moved: it is the floor 4 printer.',
        categoryId: otherCategoryId,
      })
      .expect(200);
    const edited = body as TicketResponse;

    expect(edited).toMatchObject({
      code: created.code,
      title: 'Printer on floor 4 is jammed',
      categoryId: otherCategoryId,
    });
    expect(edited.history.map((event) => event.type)).toEqual([
      'created',
      'edited',
    ]);
    expect(edited.history[1].changes).toEqual([
      {
        field: 'title',
        from: 'Printer on floor 3 is jammed',
        to: 'Printer on floor 4 is jammed',
      },
      {
        field: 'description',
        from: 'It jams on every double-sided job.',
        to: 'Moved: it is the floor 4 printer.',
      },
      { field: 'categoryId', from: categoryId, to: otherCategoryId },
    ]);
  });

  it('An edit that changes nothing records nothing', async () => {
    const created = await createTicket();

    const { body } = await requester
      .patch(`/tickets/${created.id}`)
      .send({ title: created.title })
      .expect(200);

    // No event: the history says what happened, and nothing happened.
    expect((body as TicketResponse).history).toHaveLength(1);
  });

  it('Editing a ticket that is not open is rejected', async () => {
    const created = await createTicket();
    // Set directly: taking a ticket is the next task's endpoint, and this
    // scenario is about the edit refusing, not about how the state got there.
    await ticketModel().updateOne(
      { _id: created.id },
      { $set: { state: 'in_progress', assigneeId: 'agent-1' } },
    );

    await requester
      .patch(`/tickets/${created.id}`)
      .send({ title: 'Too late' })
      .expect(409);
    await requester.delete(`/tickets/${created.id}`).expect(409);
  });

  it('A requester cannot see or change a ticket created by another requester', async () => {
    const created = await createTicket();
    const stranger = await loginAs(testApp.app, OTHER_REQUESTER);

    await stranger.get(`/tickets/${created.id}`).expect(403);
    await stranger
      .patch(`/tickets/${created.id}`)
      .send({ title: 'Not mine' })
      .expect(403);
    await stranger.delete(`/tickets/${created.id}`).expect(403);
  });

  it('Requester deletes their own open ticket', async () => {
    const created = await createTicket();

    await requester.delete(`/tickets/${created.id}`).expect(204);

    await requester.get(`/tickets/${created.id}`).expect(404);
  });

  it('Any action attempted on a soft-deleted ticket fails as not found', async () => {
    const created = await createTicket();
    await requester.delete(`/tickets/${created.id}`).expect(204);

    await requester.get(`/tickets/${created.id}`).expect(404);
    await requester
      .patch(`/tickets/${created.id}`)
      .send({ title: 'Still here?' })
      .expect(404);
    await requester.delete(`/tickets/${created.id}`).expect(404);
    // An agent has no more luck: deleted is deleted for everyone.
    await agent.get(`/tickets/${created.id}`).expect(404);
  });

  it('Agent takes an open ticket and becomes its assignee', async () => {
    const created = await createTicket();

    const { body } = await agent
      .post(`/tickets/${created.id}/take`)
      .expect(200);
    const taken = body as TicketResponse;

    expect(taken).toMatchObject({
      state: 'in_progress',
      assignee: { id: 'agent-1', name: 'Carla Ruiz' },
    });
    expect(taken.history.map((event) => event.type)).toEqual([
      'created',
      'taken',
    ]);
    expect(taken.history[1].actor).toEqual({
      id: 'agent-1',
      name: 'Carla Ruiz',
    });
  });

  it('Second agent cannot take a ticket that is already in progress', async () => {
    const created = await createTicket();
    const agents = await Promise.all(
      AGENTS.map((username) => loginAs(testApp.app, username)),
    );

    // All four reach for the same ticket at once. The conditional write is the
    // only thing standing between them: the pure rule cannot see this race.
    const results = await Promise.allSettled(
      agents.map((client) => client.post(`/tickets/${created.id}/take`)),
    );
    const statuses = results
      .map((result) =>
        result.status === 'fulfilled' ? result.value.status : 409,
      )
      // Numeric: the default sort compares as text, so 1000 would land first.
      .sort((a, b) => a - b);

    expect(statuses).toEqual([200, 409, 409, 409]);

    // And the history records it once: one winner, one event.
    const { body } = await agent.get(`/tickets/${created.id}`).expect(200);
    const ticket = body as TicketResponse;
    expect(
      ticket.history.filter((event) => event.type === 'taken'),
    ).toHaveLength(1);
    expect(ticket.assignee).not.toBeNull();
    expect(ticket.state).toBe('in_progress');
  });

  it('Assigned agent releases an in-progress ticket back to the open queue', async () => {
    const created = await createTicket();
    await agent.post(`/tickets/${created.id}/take`).expect(200);

    const { body } = await agent
      .post(`/tickets/${created.id}/release`)
      .expect(200);
    const released = body as TicketResponse;

    expect(released).toMatchObject({ state: 'open', assignee: null });
    expect(released.history.map((event) => event.type)).toEqual([
      'created',
      'taken',
      'released',
    ]);

    // Back in the queue for anybody, which is not a reassignment.
    const other = await loginAs(testApp.app, OTHER_AGENT);
    await other.post(`/tickets/${created.id}/take`).expect(200);
  });

  it('A released ticket can be edited or deleted by its requester again', async () => {
    const created = await createTicket();
    await agent.post(`/tickets/${created.id}/take`).expect(200);
    await requester
      .patch(`/tickets/${created.id}`)
      .send({ title: 'Not while it is taken' })
      .expect(409);

    await agent.post(`/tickets/${created.id}/release`).expect(200);

    await requester
      .patch(`/tickets/${created.id}`)
      .send({ title: 'Open again, so mine again' })
      .expect(200);
    await requester.delete(`/tickets/${created.id}`).expect(204);
  });

  it('Assigned agent resolves an in-progress ticket', async () => {
    const created = await createTicket();
    await agent.post(`/tickets/${created.id}/take`).expect(200);

    const { body } = await agent
      .post(`/tickets/${created.id}/resolve`)
      .expect(200);
    const resolved = body as TicketResponse;

    expect(resolved).toMatchObject({
      state: 'resolved',
      // The assignee stays: the history has to say who resolved it.
      assignee: { id: 'agent-1', name: 'Carla Ruiz' },
    });
    expect(resolved.history.map((event) => event.type)).toEqual([
      'created',
      'taken',
      'resolved',
    ]);
  });

  it('An agent who is not the assignee cannot resolve the ticket', async () => {
    const created = await createTicket();
    await agent.post(`/tickets/${created.id}/take`).expect(200);
    const other = await loginAs(testApp.app, OTHER_AGENT);

    await other.post(`/tickets/${created.id}/resolve`).expect(403);
    await other.post(`/tickets/${created.id}/release`).expect(403);
    // A requester has no business here either.
    await requester.post(`/tickets/${created.id}/resolve`).expect(403);
  });

  it('A resolved ticket cannot be taken, released, or resolved again', async () => {
    const created = await createTicket();
    await agent.post(`/tickets/${created.id}/take`).expect(200);
    await agent.post(`/tickets/${created.id}/resolve`).expect(200);

    for (const action of ['take', 'release', 'resolve']) {
      await agent.post(`/tickets/${created.id}/${action}`).expect(409);
    }
    // And its requester cannot edit or delete it either.
    await requester
      .patch(`/tickets/${created.id}`)
      .send({ title: 'Reopening by the back door' })
      .expect(409);
    await requester.delete(`/tickets/${created.id}`).expect(409);
  });

  it('An agent can read any ticket', async () => {
    const created = await createTicket();

    const { body } = await agent.get(`/tickets/${created.id}`).expect(200);

    expect((body as TicketResponse).code).toBe(created.code);
  });

  it("Requester's ticket list shows only tickets they created", async () => {
    await createTicket({ title: 'Mine, first' });
    await createTicket({ title: 'Mine, second' });
    const stranger = await loginAs(testApp.app, OTHER_REQUESTER);
    await stranger
      .post('/tickets')
      .send({ title: 'Theirs', description: 'Not mine', categoryId })
      .expect(201);

    const mine = await board(requester);
    expect(mine.total).toBe(2);
    expect(mine.items.map((ticket) => ticket.title)).toEqual([
      'Mine, second',
      'Mine, first',
    ]);

    const theirs = await board(stranger);
    expect(theirs.total).toBe(1);
    expect(theirs.items[0].title).toBe('Theirs');
  });

  it("Agent's board shows every ticket with its state and assignee", async () => {
    const first = await createTicket({ title: 'Untouched' });
    const taken = await createTicket({ title: 'Taken by Carla' });
    await agent.post(`/tickets/${taken.id}/take`).expect(200);

    const all = await board(agent);

    expect(all.total).toBe(2);
    expect(all.items.map((ticket) => ticket.title)).toEqual([
      'Taken by Carla',
      'Untouched',
    ]);
    expect(all.items[0]).toMatchObject({
      code: taken.code,
      state: 'in_progress',
      requester: { id: 'requester-1', name: 'Lucía Fernández' },
      assignee: { id: 'agent-1', name: 'Carla Ruiz' },
    });
    expect(all.items[1]).toMatchObject({
      code: first.code,
      state: 'open',
      assignee: null,
    });
  });

  it('The board leaves the heavy fields to the detail view', async () => {
    await createTicket();

    const { items } = await board(agent);

    // A row does not need a 5000-character description or the whole history.
    expect(items[0]).not.toHaveProperty('description');
    expect(items[0]).not.toHaveProperty('history');
  });

  it('The board is paginated, newest first, and hides deleted tickets', async () => {
    const oldest = await createTicket({ title: 'First' });
    await createTicket({ title: 'Second' });
    const newest = await createTicket({ title: 'Third' });

    const firstPage = await board(requester, '?limit=2');
    expect(firstPage).toMatchObject({ total: 3, page: 1, limit: 2 });
    expect(firstPage.items.map((ticket) => ticket.title)).toEqual([
      'Third',
      'Second',
    ]);

    const secondPage = await board(requester, '?limit=2&page=2');
    expect(secondPage.items.map((ticket) => ticket.title)).toEqual(['First']);

    await requester.delete(`/tickets/${oldest.id}`).expect(204);
    const afterDelete = await board(requester);
    expect(afterDelete.total).toBe(2);
    expect(afterDelete.items.map((ticket) => ticket.code)).toEqual([
      newest.code,
      (await board(requester)).items[1].code,
    ]);
  });

  it('Rejects a ticket that is missing fields, too long, or aimed at a malformed id', async () => {
    await requester
      .post('/tickets')
      .send({ title: 'Only a title' })
      .expect(400);
    await requester
      .post('/tickets')
      .send({ title: 'x'.repeat(121), description: 'ok', categoryId })
      .expect(400);
    await requester.get('/tickets/not-an-id').expect(400);
  });
});
