import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module.js';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.enableCors({
    origin: process.env.WEB_ORIGIN ?? 'http://localhost:5173',
  });

  const config = new DocumentBuilder()
    .setTitle('Ticket App API')
    .setDescription(
      'Support ticket system. To try it: list the users with GET /users, click Authorize and enter one of their ids (requester-1 to requester-4, or agent-1 to agent-4). Every request then runs as that user.',
    )
    .addApiKey(
      {
        type: 'apiKey',
        in: 'header',
        name: 'X-User-Id',
        description:
          'Id of the acting user: requester-1 to requester-4, or agent-1 to agent-4.',
      },
      'acting-user',
    )
    .build();
  SwaggerModule.setup('docs', app, () =>
    SwaggerModule.createDocument(app, config),
  );

  await app.listen(process.env.PORT ?? 3000);
}
await bootstrap();
