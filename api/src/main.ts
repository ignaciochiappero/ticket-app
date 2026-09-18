import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module.js';
import { setupSwagger } from './openapi.js';

// Node reads no `.env` by itself and this API has no config library, so one
// line makes `api/.env` work for a local run. It never overwrites a variable
// the environment already holds, so Docker and CI still win and a forgotten
// `.env` cannot quietly redirect a deployed API at somebody's laptop.
//
// This runs before `bootstrap`, which is early enough for all four: the
// database uri and the session secret are read inside factories that Nest
// calls while it builds the app, not while this file is imported.
try {
  process.loadEnvFile();
} catch {
  // No file, which is the normal case. Every variable has a default.
}

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.enableCors({
    origin: process.env.WEB_ORIGIN ?? 'http://localhost:5173',
  });
  setupSwagger(app);

  await app.listen(process.env.PORT ?? 3000);
}
await bootstrap();
