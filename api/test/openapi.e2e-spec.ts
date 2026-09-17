import type { OpenAPIObject } from '@nestjs/swagger';
import request from 'supertest';
import { buildOpenApiDocument } from '../src/openapi.js';
import { createTestApp, type TestApp } from './create-test-app.js';

const METHODS = ['get', 'post', 'patch', 'put', 'delete'] as const;

// The only operation a client can call without a token.
const PUBLIC_OPERATIONS = ['post /auth/login'];

// This suite only asserts what the decorators declare. Descriptions, examples and DTO
// schemas come from the Swagger CLI plugin in nest-cli.json, which runs in the Nest
// compiler and not under Vitest, so they are checked against a built app instead.
describe('openapi (e2e)', () => {
  let testApp: TestApp;
  let document: OpenAPIObject;

  beforeAll(async () => {
    testApp = await createTestApp();
    document = buildOpenApiDocument(testApp.app);
  });

  afterAll(async () => {
    await testApp.close();
  });

  it('requires the bearer token on every operation except login', () => {
    const unprotected: string[] = [];

    for (const [path, item] of Object.entries(document.paths)) {
      for (const method of METHODS) {
        const operation = item[method];
        if (!operation) {
          continue;
        }
        const id = `${method} ${path}`;
        const schemes = (operation.security ?? []).flatMap((requirement) =>
          Object.keys(requirement),
        );
        if (!schemes.includes('bearer') && !PUBLIC_OPERATIONS.includes(id)) {
          unprotected.push(id);
        }
      }
    }

    expect(unprotected).toEqual([]);
  });

  it('points a browser at the documentation from the API root', async () => {
    // No token: whoever opens the API for the first time does not have one yet.
    const response = await request(testApp.app.getHttpServer())
      .get('/')
      .expect(200);

    expect(response.headers['content-type']).toMatch(/text\/html/);
    expect(response.text).toContain('href="/docs"');
  });

  it('declares the endpoints the web app needs', () => {
    const operations = Object.entries(document.paths).flatMap(([path, item]) =>
      METHODS.filter((method) => item[method]).map(
        (method) => `${method} ${path}`,
      ),
    );

    expect(operations.sort()).toEqual([
      'delete /categories/{id}',
      'delete /tickets/{id}',
      'get /auth/me',
      'get /categories',
      'get /tickets',
      'get /tickets/{id}',
      'get /users',
      'patch /categories/{id}',
      'patch /tickets/{id}',
      'post /auth/login',
      'post /categories',
      'post /tickets',
      'post /tickets/{id}/release',
      'post /tickets/{id}/resolve',
      'post /tickets/{id}/take',
    ]);
  });
});
