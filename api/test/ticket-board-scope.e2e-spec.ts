import { loginAs, type SessionClient } from './auth.js';
import { createTestApp, type TestApp } from './create-test-app.js';

const REQUESTER = 'lucia.fernandez';
const OTHER_REQUESTER = 'martin.gomez';
const AGENT = 'carla.ruiz';

interface TicketResponse {
  id: string;
  code: string;
  state: string;
  createdAt: string;
}

interface TicketPage {
  items: TicketResponse[];
  total: number;
  page: number;
  limit: number;
}

describe('ticket-board-scope (e2e)', () => {
  let testApp: TestApp;
  let requester: SessionClient;
  let other: SessionClient;
  let agent: SessionClient;
  let categoryId: string;

  beforeEach(async () => {
    testApp = await createTestApp();
    requester = await loginAs(testApp.app, REQUESTER);
    other = await loginAs(testApp.app, OTHER_REQUESTER);
    agent = await loginAs(testApp.app, AGENT);

    const { body } = await agent.get('/categories?limit=100').expect(200);
    categoryId = (body as { items: { id: string }[] }).items[0].id;
  });

  afterEach(async () => {
    await testApp.close();
  });

  async function board(client: SessionClient, query = ''): Promise<TicketPage> {
    const { body } = await client.get(`/tickets${query}`).expect(200);
    return body as TicketPage;
  }

  async function open(
    client: SessionClient,
    title: string,
  ): Promise<TicketResponse> {
    const { body } = await client
      .post('/tickets')
      .send({ title, description: 'Something is wrong with it.', categoryId })
      .expect(201);
    return body as TicketResponse;
  }

  /** Takes the ticket and resolves it, which is the only route to `resolved`. */
  async function resolve(id: string): Promise<void> {
    await agent.post(`/tickets/${id}/take`).expect(200);
    await agent.post(`/tickets/${id}/resolve`).expect(200);
  }

  function codes(page: TicketPage): string[] {
    return page.items.map((ticket) => ticket.code);
  }

  it('The board answers only the states it was asked for', async () => {
    const stays = await open(requester, 'Printer jammed');
    const done = await open(requester, 'VPN drops');
    await resolve(done.id);

    const active = await board(requester, '?state=open,in_progress');

    expect(codes(active)).toEqual([stays.code]);
    // The total counts the filter, not the collection, or the column would
    // offer a "show more" that brings nothing.
    expect(active.total).toBe(1);
  });

  it('Resolved tickets are found through the state filter', async () => {
    const done = await open(requester, 'VPN drops');
    await resolve(done.id);

    const resolved = await board(requester, '?state=resolved');

    expect(codes(resolved)).toEqual([done.code]);
  });

  it('The resolved column is ordered by when each ticket was resolved', async () => {
    // Opened first, finished last: by creation date this one sinks to the
    // bottom, which is exactly the lie the column must not tell.
    const oldest = await open(requester, 'Opened first');
    const newest = await open(requester, 'Opened second');
    await resolve(newest.id);
    await resolve(oldest.id);

    const resolved = await board(requester, '?state=resolved');

    expect(codes(resolved)).toEqual([oldest.code, newest.code]);
  });

  it('Each column pages on its own', async () => {
    const first = await open(requester, 'First');
    const second = await open(requester, 'Second');
    await resolve(first.id);
    await resolve(second.id);

    const page = await board(requester, '?state=resolved&limit=1');

    expect(page.items).toHaveLength(1);
    expect(page.total).toBe(2);
    expect(page.limit).toBe(1);
  });

  it('A state filter cannot reach another requester ticket', async () => {
    await open(other, 'Not yours');

    const everything = await board(
      requester,
      '?state=open,in_progress,resolved',
    );

    expect(everything.items).toHaveLength(0);
    expect(everything.total).toBe(0);
  });

  it('An unknown state is rejected', async () => {
    await requester.get('/tickets?state=archived').expect(400);
  });

  it('An empty state filter is the same as asking for nothing', async () => {
    const ticket = await open(requester, 'Printer jammed');

    const asked = await board(requester, '?state=');

    expect(codes(asked)).toEqual([ticket.code]);
  });
});
