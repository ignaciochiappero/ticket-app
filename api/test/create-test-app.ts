import { randomUUID } from 'node:crypto';
import type { INestApplication } from '@nestjs/common';
import { getConnectionToken } from '@nestjs/mongoose';
import { Test } from '@nestjs/testing';
import type { Connection } from 'mongoose';
import { AppModule } from '../src/app.module.js';

export interface TestApp {
  app: INestApplication;
  databaseName: string;
  close: (options?: { dropDatabase?: boolean }) => Promise<void>;
}

// Boots the real AppModule against its own database, so e2e files never share data.
export async function createTestApp(
  databaseName = `tickets-e2e-${randomUUID()}`,
): Promise<TestApp> {
  process.env.MONGODB_URI = `mongodb://localhost:27017/${databaseName}`;

  const moduleRef = await Test.createTestingModule({
    imports: [AppModule],
  }).compile();
  const app = moduleRef.createNestApplication();
  await app.init();

  return {
    app,
    databaseName,
    close: async ({ dropDatabase = true } = {}) => {
      if (dropDatabase) {
        await app.get<Connection>(getConnectionToken()).dropDatabase();
      }
      await app.close();
    },
  };
}
