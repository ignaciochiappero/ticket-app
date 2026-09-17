import type { INestApplication } from '@nestjs/common';
import {
  DocumentBuilder,
  SwaggerModule,
  type OpenAPIObject,
} from '@nestjs/swagger';

const DESCRIPTION =
  'Support ticket system. To try it: run POST /auth/login with one of the demo users listed in the README, copy the token from the response and paste it into Authorize. Every endpoint below then runs as that user, and GET /auth/me says who that is. Tokens last 8 hours; logging out is simply discarding one.';

// Built here rather than inside bootstrap() so a test can assert that the endpoints
// document themselves: a documentation rule with no test is a rule that rots.
export function buildOpenApiDocument(app: INestApplication): OpenAPIObject {
  const config = new DocumentBuilder()
    .setTitle('Ticket App API')
    .setDescription(DESCRIPTION)
    .addBearerAuth({
      type: 'http',
      scheme: 'bearer',
      bearerFormat: 'JWT',
      description: 'Token returned by POST /auth/login.',
    })
    .build();
  return SwaggerModule.createDocument(app, config);
}

export function setupSwagger(app: INestApplication): void {
  SwaggerModule.setup('docs', app, () => buildOpenApiDocument(app));
}
