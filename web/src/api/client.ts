const BASE_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:3000';
const TOKEN_KEY = 'ticket-app.token';

/** A failed request. `status` is 0 when the API could not be reached at all. */
export class ApiError extends Error {
  // Declared and assigned rather than a parameter property, which
  // `erasableSyntaxOnly` rules out.
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

export function readToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function writeToken(token: string | null): void {
  if (token === null) {
    localStorage.removeItem(TOKEN_KEY);
    return;
  }
  localStorage.setItem(TOKEN_KEY, token);
}

// The only place in the app that calls fetch. Everything else asks a feature's
// api module, which asks this.
export async function apiFetch<T>(
  path: string,
  init: RequestInit = {},
): Promise<T> {
  const token = readToken();
  const headers = new Headers(init.headers);
  headers.set('Content-Type', 'application/json');
  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  let response: Response;
  try {
    response = await fetch(`${BASE_URL}${path}`, { ...init, headers });
  } catch {
    // A DNS failure, a refused connection or a CORS rejection all land here,
    // and none of them have a status. Say so instead of repeating the browser.
    throw new ApiError(0, 'The API is not responding. Is it running?');
  }

  if (!response.ok) {
    // A token the API refuses is worse than no token: the app would keep
    // sending it and never show the login screen.
    if (response.status === 401) {
      writeToken(null);
    }
    throw new ApiError(response.status, await readMessage(response));
  }

  return response.status === 204
    ? (undefined as T)
    : ((await response.json()) as T);
}

// Nest answers with a single message, or with one per failed validation rule.
async function readMessage(response: Response): Promise<string> {
  try {
    const body = (await response.json()) as { message?: string | string[] };
    const message = body.message;
    if (Array.isArray(message)) {
      return message.join(', ');
    }
    return message ?? response.statusText;
  } catch {
    return response.statusText;
  }
}
