import { getModelToken } from '@nestjs/mongoose';
import type { Model } from 'mongoose';
import { Category } from '../src/categories/category.schema.js';
import { loginAs, type SessionClient } from './auth.js';
import { createTestApp, type TestApp } from './create-test-app.js';

interface CategoryResponse {
  id: string;
  name: string;
  used: boolean;
}

interface CategoryPage {
  items: CategoryResponse[];
  total: number;
  page: number;
  limit: number;
}

const STARTERS = ['Access', 'Hardware', 'Other', 'Software'];

const AGENT = 'carla.ruiz';
const REQUESTER = 'lucia.fernandez';
const MISSING_ID = '64b7f0c2a1b2c3d4e5f60718';

describe('ticket-categories (e2e)', () => {
  let testApp: TestApp;
  let api: SessionClient;

  beforeEach(async () => {
    testApp = await createTestApp();
    api = await loginAs(testApp.app, AGENT);
  });

  afterEach(async () => {
    await testApp.close();
  });

  async function listPage(query = ''): Promise<CategoryPage> {
    const response = await api.get(`/categories${query}`).expect(200);
    return response.body as CategoryPage;
  }

  async function listCategories(): Promise<CategoryResponse[]> {
    return (await listPage()).items;
  }

  function names(page: CategoryPage): string[] {
    return page.items.map((category) => category.name);
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

    await api
      .patch(`/categories/${await categoryId('Other')}`)
      .send({ name: 'General' })
      .expect(200);
    await api.delete(`/categories/${await categoryId('Access')}`).expect(204);

    expect((await listCategories()).map((c) => c.name)).toEqual([
      'General',
      'Hardware',
      'Software',
    ]);
  });

  it('A list returns the first page by default', async () => {
    const page = await listPage();

    expect(page).toMatchObject({ total: 4, page: 1, limit: 20 });
    expect(names(page)).toEqual(STARTERS);
  });

  it('A client can ask for a specific page and size', async () => {
    const page = await listPage('?page=2&limit=2');

    // The total counts every match, not the two returned, so the client can size the pager.
    expect(page).toMatchObject({ total: 4, page: 2, limit: 2 });
    expect(names(page)).toEqual(['Other', 'Software']);
  });

  it('A page past the end is empty', async () => {
    const page = await listPage('?page=99');

    expect(page.items).toEqual([]);
    expect(page.total).toBe(4);
  });

  it('An invalid page or size is rejected', async () => {
    await api.get('/categories?page=0').expect(400);
    await api.get('/categories?limit=0').expect(400);
    await api.get('/categories?limit=101').expect(400);
    await api.get('/categories?page=abc').expect(400);
    await api.get('/categories?page=1.5').expect(400);
  });

  it('Paging through a list yields every record exactly once', async () => {
    const first = await listPage('?page=1&limit=3');
    const second = await listPage('?page=2&limit=3');

    const walked = [...names(first), ...names(second)];
    expect(walked).toEqual(STARTERS);
    expect(new Set(walked).size).toBe(STARTERS.length);
  });

  it('Requester cannot create a category', async () => {
    const requester = await loginAs(testApp.app, REQUESTER);

    await requester.post('/categories').send({ name: 'Printers' }).expect(403);

    expect((await listCategories()).map((c) => c.name)).not.toContain(
      'Printers',
    );
  });

  it('Creating a category with a name that already exists fails', async () => {
    await api.post('/categories').send({ name: 'Hardware' }).expect(409);

    expect(await listCategories()).toHaveLength(4);
  });

  it('Category names are unique regardless of letter case', async () => {
    await api.post('/categories').send({ name: 'hARDWARE' }).expect(409);

    expect(await listCategories()).toHaveLength(4);
  });

  it('Renaming a category to a name that already exists fails', async () => {
    await api
      .patch(`/categories/${await categoryId('Other')}`)
      .send({ name: 'Software' })
      .expect(409);

    expect((await listCategories()).map((c) => c.name)).toContain('Other');
  });

  it('Agent creates a category that starts unused', async () => {
    const response = await api
      .post('/categories')
      .send({ name: '  Printers  ' })
      .expect(201);

    expect(response.body).toEqual({
      id: expect.any(String),
      name: 'Printers',
      used: false,
    });
  });

  it('Rejects a category name that is empty or longer than 50 characters', async () => {
    await api.post('/categories').send({ name: '   ' }).expect(400);
    await api
      .post('/categories')
      .send({ name: 'x'.repeat(51) })
      .expect(400);
  });

  it('Editing or deleting a category that does not exist fails as not found', async () => {
    await api
      .patch(`/categories/${MISSING_ID}`)
      .send({ name: 'Anything' })
      .expect(404);
    await api.delete(`/categories/${MISSING_ID}`).expect(404);
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

    await api
      .patch(`/categories/${hardwareId}`)
      .send({ name: 'Devices' })
      .expect(409);
    await api.delete(`/categories/${hardwareId}`).expect(409);

    expect(await listCategories()).toContainEqual({
      id: hardwareId,
      name: 'Hardware',
      used: true,
    });
  });

  it('Restarting the app does not bring back renamed or deleted starter categories', async () => {
    await api
      .patch(`/categories/${await categoryId('Other')}`)
      .send({ name: 'General' })
      .expect(200);
    await api.delete(`/categories/${await categoryId('Access')}`).expect(204);

    const restarted = await createTestApp(testApp.databaseName);
    try {
      // A restart signs sessions with a new secret, so this app needs its own login.
      const restartedApi = await loginAs(restarted.app, AGENT);
      const response = await restartedApi.get('/categories').expect(200);
      expect(names(response.body as CategoryPage)).toEqual([
        'General',
        'Hardware',
        'Software',
      ]);
    } finally {
      await restarted.close({ dropDatabase: false });
    }
  });
});
