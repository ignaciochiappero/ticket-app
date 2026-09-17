import { getModelToken } from '@nestjs/mongoose';
import type { Model } from 'mongoose';
import request from 'supertest';
import { Category } from '../src/categories/category.schema.js';
import { createTestApp, type TestApp } from './create-test-app.js';

interface CategoryResponse {
  id: string;
  name: string;
  used: boolean;
}

const AGENT = 'agent-1';
const REQUESTER = 'requester-1';
const MISSING_ID = '64b7f0c2a1b2c3d4e5f60718';

describe('ticket-categories (e2e)', () => {
  let testApp: TestApp;

  beforeEach(async () => {
    testApp = await createTestApp();
  });

  afterEach(async () => {
    await testApp.close();
  });

  const api = () => request(testApp.app.getHttpServer());

  async function listCategories(): Promise<CategoryResponse[]> {
    const response = await api()
      .get('/categories')
      .set('X-User-Id', AGENT)
      .expect(200);
    return response.body as CategoryResponse[];
  }

  async function categoryId(name: string): Promise<string> {
    const category = (await listCategories()).find((c) => c.name === name);
    if (!category) {
      throw new Error(`Category "${name}" not found`);
    }
    return category.id;
  }

  it('Starter categories exist after startup and are editable', async () => {
    const categories = await listCategories();
    expect(categories.map((c) => c.name)).toEqual([
      'Access',
      'Hardware',
      'Other',
      'Software',
    ]);
    expect(categories.every((c) => !c.used)).toBe(true);

    await api()
      .patch(`/categories/${await categoryId('Other')}`)
      .set('X-User-Id', AGENT)
      .send({ name: 'General' })
      .expect(200);
    await api()
      .delete(`/categories/${await categoryId('Access')}`)
      .set('X-User-Id', AGENT)
      .expect(204);

    expect((await listCategories()).map((c) => c.name)).toEqual([
      'General',
      'Hardware',
      'Software',
    ]);
  });

  it('Requester cannot create a category', async () => {
    await api()
      .post('/categories')
      .set('X-User-Id', REQUESTER)
      .send({ name: 'Printers' })
      .expect(403);

    expect((await listCategories()).map((c) => c.name)).not.toContain(
      'Printers',
    );
  });

  it('Creating a category with a name that already exists fails', async () => {
    await api()
      .post('/categories')
      .set('X-User-Id', AGENT)
      .send({ name: 'Hardware' })
      .expect(409);

    expect(await listCategories()).toHaveLength(4);
  });

  it('Category names are unique regardless of letter case', async () => {
    await api()
      .post('/categories')
      .set('X-User-Id', AGENT)
      .send({ name: 'hARDWARE' })
      .expect(409);

    expect(await listCategories()).toHaveLength(4);
  });

  it('Renaming a category to a name that already exists fails', async () => {
    await api()
      .patch(`/categories/${await categoryId('Other')}`)
      .set('X-User-Id', AGENT)
      .send({ name: 'Software' })
      .expect(409);

    expect((await listCategories()).map((c) => c.name)).toContain('Other');
  });

  it('Agent creates a category that starts unused', async () => {
    const response = await api()
      .post('/categories')
      .set('X-User-Id', AGENT)
      .send({ name: '  Printers  ' })
      .expect(201);

    expect(response.body).toEqual({
      id: expect.any(String),
      name: 'Printers',
      used: false,
    });
  });

  it('Rejects a category name that is empty or longer than 50 characters', async () => {
    await api()
      .post('/categories')
      .set('X-User-Id', AGENT)
      .send({ name: '   ' })
      .expect(400);
    await api()
      .post('/categories')
      .set('X-User-Id', AGENT)
      .send({ name: 'x'.repeat(51) })
      .expect(400);
  });

  it('Editing or deleting a category that does not exist fails as not found', async () => {
    await api()
      .patch(`/categories/${MISSING_ID}`)
      .set('X-User-Id', AGENT)
      .send({ name: 'Anything' })
      .expect(404);
    await api()
      .delete(`/categories/${MISSING_ID}`)
      .set('X-User-Id', AGENT)
      .expect(404);
  });

  it('A category marked as used cannot be renamed or deleted', async () => {
    const hardwareId = await categoryId('Hardware');
    const categoryModel = testApp.app.get<Model<Category>>(
      getModelToken(Category.name),
    );
    await categoryModel.updateOne(
      { _id: hardwareId },
      { $set: { used: true } },
    );

    await api()
      .patch(`/categories/${hardwareId}`)
      .set('X-User-Id', AGENT)
      .send({ name: 'Devices' })
      .expect(409);
    await api()
      .delete(`/categories/${hardwareId}`)
      .set('X-User-Id', AGENT)
      .expect(409);

    expect(await listCategories()).toContainEqual({
      id: hardwareId,
      name: 'Hardware',
      used: true,
    });
  });

  it('Restarting the app does not bring back renamed or deleted starter categories', async () => {
    await api()
      .patch(`/categories/${await categoryId('Other')}`)
      .set('X-User-Id', AGENT)
      .send({ name: 'General' })
      .expect(200);
    await api()
      .delete(`/categories/${await categoryId('Access')}`)
      .set('X-User-Id', AGENT)
      .expect(204);

    const restarted = await createTestApp(testApp.databaseName);
    try {
      const response = await request(restarted.app.getHttpServer())
        .get('/categories')
        .set('X-User-Id', AGENT)
        .expect(200);
      expect((response.body as CategoryResponse[]).map((c) => c.name)).toEqual([
        'General',
        'Hardware',
        'Software',
      ]);
    } finally {
      await restarted.close({ dropDatabase: false });
    }
  });
});
