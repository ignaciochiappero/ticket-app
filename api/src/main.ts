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
      'Support ticket system. To try it: run POST /auth/login with one of the demo users listed in the README, copy the token from the response and paste it into Authorize. Every endpoint below then runs as that user, and GET /auth/me says who that is. Tokens last 8 hours; logging out is simply discarding one.',
    )
    .addBearerAuth({
      type: 'http',
      scheme: 'bearer',
      bearerFormat: 'JWT',
      description: 'Token returned by POST /auth/login.',
    })
    .build();
  SwaggerModule.setup('docs', app, () =>
    SwaggerModule.createDocument(app, config),
  );

  await app.listen(process.env.PORT ?? 3000);
}
await bootstrap();
