import request from 'supertest';
import { DEMO_PASSWORD } from '../src/users/users.seed.js';
import { loginAs } from './auth.js';
import { createTestApp, type TestApp } from './create-test-app.js';

interface UserResponse {
  id: string;
  name: string;
  role: string;
}

describe('user-access (e2e)', () => {
  let testApp: TestApp;

  beforeAll(async () => {
    testApp = await createTestApp();
  });

  afterAll(async () => {
    await testApp.close();
  });

  it('Seeded users can log in with their demo credentials', async () => {
    const response = await request(testApp.app.getHttpServer())
      .post('/auth/login')
      .send({ username: 'carla.ruiz', password: DEMO_PASSWORD })
      .expect(200);

    // Only the token: the user's data comes from GET /auth/me.
    expect(response.body).toEqual({
      token: expect.stringMatching(/^[\w-]+\.[\w-]+\.[\w-]+$/),
    });
  });

  it('The token from login is accepted on protected requests', async () => {
    const server = testApp.app.getHttpServer();
    const login = await request(server)
      .post('/auth/login')
      .send({ username: 'carla.ruiz', password: DEMO_PASSWORD })
      .expect(200);
    const { token } = login.body as { token: string };

    const response = await request(server)
      .get('/auth/me')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(response.body).toEqual({
      id: 'agent-1',
      name: 'Carla Ruiz',
      role: 'agent',
    });
  });

  it('Login with a wrong password is rejected', async () => {
    const server = testApp.app.getHttpServer();

    const wrongPassword = await request(server)
      .post('/auth/login')
      .send({ username: 'carla.ruiz', password: 'not-the-password' })
      .expect(401);
    const unknownUsername = await request(server)
      .post('/auth/login')
      .send({ username: 'nobody', password: DEMO_PASSWORD })
      .expect(401);

    expect(wrongPassword.body).toEqual(unknownUsername.body);
    expect(wrongPassword.body).not.toHaveProperty('token');
  });

  it('A request without a valid token is rejected', async () => {
    const server = testApp.app.getHttpServer();

    await request(server).get('/users').expect(401);
    await request(server)
      .get('/users')
      .set('Authorization', 'Bearer tampered.token.value')
      .expect(401);
  });

  it('The current user endpoint returns the logged-in user', async () => {
    const agent = await loginAs(testApp.app, 'carla.ruiz');

    const response = await agent.get('/auth/me').expect(200);

    expect(response.body).toEqual({
      id: 'agent-1',
      name: 'Carla Ruiz',
      role: 'agent',
    });
  });

  it('A requester attempting an agent-only action is rejected', async () => {
    const requester = await loginAs(testApp.app, 'lucia.fernandez');

    await requester.post('/categories').send({ name: 'Printers' }).expect(403);

    const response = await requester.get('/categories').expect(200);
    const names = (response.body as { name: string }[]).map((c) => c.name);
    expect(names).not.toContain('Printers');
  });

  it('Restarting the app keeps the seeded users unchanged', async () => {
    const agent = await loginAs(testApp.app, 'carla.ruiz');

    const before = await agent.get('/users').expect(200);
    const users = before.body as UserResponse[];
    expect(users.map((user) => user.id)).toEqual([
      'requester-1',
      'requester-2',
      'requester-3',
      'requester-4',
      'agent-1',
      'agent-2',
      'agent-3',
      'agent-4',
    ]);

    const restarted = await createTestApp(testApp.databaseName);
    try {
      const restartedAgent = await loginAs(restarted.app, 'carla.ruiz');
      const after = await restartedAgent.get('/users').expect(200);
      expect(after.body).toEqual(before.body);
    } finally {
      await restarted.close({ dropDatabase: false });
    }
  });
});
