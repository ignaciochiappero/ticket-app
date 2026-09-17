import request from 'supertest';
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

  it('Seeded users are available without any login step', async () => {
    const response = await request(testApp.app.getHttpServer())
      .get('/users')
      .expect(200);
    const users = response.body as UserResponse[];

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
    expect(users.filter((user) => user.role === 'requester')).toHaveLength(4);
    expect(users.filter((user) => user.role === 'agent')).toHaveLength(4);
  });

  it('Restarting the app keeps the seeded users unchanged', async () => {
    const before = await request(testApp.app.getHttpServer())
      .get('/users')
      .expect(200);

    const restarted = await createTestApp(testApp.databaseName);
    try {
      const after = await request(restarted.app.getHttpServer())
        .get('/users')
        .expect(200);
      expect(after.body).toEqual(before.body);
    } finally {
      await restarted.close({ dropDatabase: false });
    }
  });
});
