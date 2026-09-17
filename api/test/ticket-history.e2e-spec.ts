import { getModelToken } from '@nestjs/mongoose';
import type { Model } from 'mongoose';
import { Ticket } from '../src/tickets/ticket.schema.js';
import { loginAs, type SessionClient } from './auth.js';
import { createTestApp, type TestApp } from './create-test-app.js';

const REQUESTER = 'lucia.fernandez';
const OTHER_REQUESTER = 'martin.gomez';
const AGENT = 'carla.ruiz';

interface Event {
  type: string;
  actor: { id: string; name: string };
  at: string;
  changes?: { field: string; from: string; to: string }[];
}

interface TicketResponse {
  id: string;
  code: string;
  history: Event[];
}

describe('ticket-history (e2e)', () => {
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
    const categories = (body as { items: { id: string }[] }).items;
    categoryId = categories[0].id;
    otherCategoryId = categories[1].id;
  });

  afterEach(async () => {
    await testApp.close();
  });

  async function openTicket(): Promise<TicketResponse> {
    const { body } = await requester
      .post('/tickets')
      .send({
        title: 'Printer jammed',
        description: 'On floor 3',
        categoryId,
      })
      .expect(201);
    return body as TicketResponse;
  }

  async function historyOf(
    client: SessionClient,
    id: string,
  ): Promise<Event[]> {
    const { body } = await client.get(`/tickets/${id}`).expect(200);
    return (body as TicketResponse).history;
  }

  it('Every lifecycle action records exactly one history event', async () => {
    const ticket = await openTicket();

    await requester
      .patch(`/tickets/${ticket.id}`)
      .send({ categoryId: otherCategoryId })
      .expect(200);
    await agent.post(`/tickets/${ticket.id}/take`).expect(200);
    await agent.post(`/tickets/${ticket.id}/release`).expect(200);
    await agent.post(`/tickets/${ticket.id}/take`).expect(200);
    await agent.post(`/tickets/${ticket.id}/resolve`).expect(200);

    const history = await historyOf(agent, ticket.id);

    // One event per action, in the order they happened, and taking twice
    // leaves two `taken` events rather than one overwritten.
    expect(history.map((event) => event.type)).toEqual([
      'created',
      'edited',
      'taken',
      'released',
      'taken',
      'resolved',
    ]);
    expect(history.map((event) => event.actor.id)).toEqual([
      'requester-1',
      'requester-1',
      'agent-1',
      'agent-1',
      'agent-1',
      'agent-1',
    ]);
    // Names, not bare ids: the timeline is read by people.
    expect(history[0].actor.name).toBe('Lucía Fernández');
    expect(history[2].actor.name).toBe('Carla Ruiz');
    // Only the edit carries the before and after values.
    expect(history.filter((event) => event.changes)).toHaveLength(1);
    expect(history[1].changes).toEqual([
      { field: 'categoryId', from: categoryId, to: otherCategoryId },
    ]);
  });

  it('A rejected action records nothing', async () => {
    const ticket = await openTicket();
    await agent.post(`/tickets/${ticket.id}/take`).expect(200);

    // Each of these is refused for a different reason.
    await requester
      .patch(`/tickets/${ticket.id}`)
      .send({ title: 'Too late' })
      .expect(409);
    const otherAgent = await loginAs(testApp.app, 'diego.lopez');
    await otherAgent.post(`/tickets/${ticket.id}/resolve`).expect(403);
    const stranger = await loginAs(testApp.app, OTHER_REQUESTER);
    await stranger.get(`/tickets/${ticket.id}`).expect(403);

    // The history records what happened, not what was attempted.
    expect((await historyOf(agent, ticket.id)).map((e) => e.type)).toEqual([
      'created',
      'taken',
    ]);
  });

  it("A ticket's timeline lists its events in the order they occurred", async () => {
    const ticket = await openTicket();
    await agent.post(`/tickets/${ticket.id}/take`).expect(200);
    await agent.post(`/tickets/${ticket.id}/resolve`).expect(200);

    const history = await historyOf(agent, ticket.id);
    const times = history.map((event) => Date.parse(event.at));

    // Oldest first, and never going backwards. Two actions inside the same
    // millisecond are allowed to tie; the array order is what tells them apart.
    expect(times).toEqual([...times].sort((a, b) => a - b));
    expect(history[0].type).toBe('created');
    expect(history.at(-1)?.type).toBe('resolved');
  });

  it('Requester cannot view the history of a ticket created by another requester', async () => {
    const ticket = await openTicket();
    const stranger = await loginAs(testApp.app, OTHER_REQUESTER);

    await stranger.get(`/tickets/${ticket.id}`).expect(403);
  });

  it('Agent can view the history of any ticket', async () => {
    const ticket = await openTicket();

    // Not their ticket, never assigned to them, and still fully readable:
    // an agent works the whole queue.
    const history = await historyOf(
      await loginAs(testApp.app, 'julian.romero'),
      ticket.id,
    );

    expect(history.map((event) => event.type)).toEqual(['created']);
    expect(history[0].actor).toEqual({
      id: 'requester-1',
      name: 'Lucía Fernández',
    });
  });

  it('A deleted ticket keeps its history in the database', async () => {
    const ticket = await openTicket();
    await requester.delete(`/tickets/${ticket.id}`).expect(204);

    // The API hides it from everyone, so the record is read straight from the
    // collection: a soft delete is an audit decision, not a cleanup.
    const stored = await testApp.app
      .get<Model<Ticket>>(getModelToken(Ticket.name))
      .findById(ticket.id)
      .lean();

    expect(stored?.deletedAt).toBeInstanceOf(Date);
    expect(stored?.history.map((event) => event.type)).toEqual([
      'created',
      'deleted',
    ]);
  });
});
