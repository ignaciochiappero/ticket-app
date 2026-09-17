import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { DEMO_PASSWORD } from '../src/users/users.seed.js';

export type SessionClient = ReturnType<typeof request.agent>;

// Logs in and returns a client that sends that user's bearer token on every request,
// so tests read like the real flow: log in once, then call the endpoints.
export async function loginAs(
  app: INestApplication,
  username: string,
): Promise<SessionClient> {
  const server = app.getHttpServer();
  const response = await request(server)
    .post('/auth/login')
    .send({ username, password: DEMO_PASSWORD })
    .expect(200);
  const { token } = response.body as { token: string };

  return request.agent(server).set('Authorization', `Bearer ${token}`);
}
