import { Controller, Get } from '@nestjs/common';
import { ApiExcludeEndpoint } from '@nestjs/swagger';
import { Public } from './auth/auth.decorators.js';

const LANDING_PAGE = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>Ticket App API</title>
    <style>
      /* Both schemes on purpose: a page that sets a text colour and no background
         is unreadable in a browser that defaults to dark. */
      :root { color-scheme: light dark; }
      body { font-family: system-ui, sans-serif; margin: 4rem auto; max-width: 32rem; padding: 0 1rem; line-height: 1.6; background: #ffffff; color: #1f2937; }
      a { color: #1d4ed8; }
      code { background: #f3f4f6; padding: 0.1rem 0.3rem; border-radius: 0.2rem; }
      @media (prefers-color-scheme: dark) {
        body { background: #111827; color: #e5e7eb; }
        a { color: #93c5fd; }
        code { background: #1f2937; }
      }
    </style>
  </head>
  <body>
    <h1>Ticket App API</h1>
    <p><a href="/docs">Open the API documentation</a></p>
    <p>
      To try an endpoint, run <code>POST /auth/login</code> with one of the demo
      users from the README, copy the token and paste it into Authorize.
    </p>
  </body>
</html>
`;

// The API root would otherwise answer 404, which is the first thing anyone opening
// the project sees. This points them at the documentation instead.
@Controller()
export class DocsController {
  /** The landing page, excluded from the OpenAPI document: it is HTML, not part of the API. */
  @Public()
  @Get()
  @ApiExcludeEndpoint()
  landingPage(): string {
    return LANDING_PAGE;
  }
}
