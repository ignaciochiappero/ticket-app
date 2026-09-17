import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError, apiFetch, readToken, writeToken } from './client';

function respondWith(body: unknown, status = 200): Response {
  return new Response(status === 204 ? null : JSON.stringify(body), {
    status,
    headers: status === 204 ? {} : { 'Content-Type': 'application/json' },
  });
}

describe('apiFetch', () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    localStorage.clear();
    fetchMock.mockReset();
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  function headersOf(call = 0): Headers {
    return new Headers(
      (fetchMock.mock.calls[call][1] as RequestInit).headers as HeadersInit,
    );
  }

  it('sends the stored token as a bearer header', async () => {
    writeToken('a-token');
    fetchMock.mockResolvedValue(respondWith({ id: 'agent-1' }));

    await apiFetch('/auth/me');

    expect(headersOf().get('Authorization')).toBe('Bearer a-token');
  });

  it('sends no authorization header when nobody is logged in', async () => {
    fetchMock.mockResolvedValue(respondWith([]));

    await apiFetch('/categories');

    expect(headersOf().has('Authorization')).toBe(false);
  });

  it('returns the parsed body on success', async () => {
    fetchMock.mockResolvedValue(respondWith({ total: 4, items: [] }));

    await expect(apiFetch('/categories')).resolves.toEqual({
      total: 4,
      items: [],
    });
  });

  it('returns nothing for a response with no content', async () => {
    fetchMock.mockResolvedValue(respondWith(null, 204));

    await expect(apiFetch('/categories/1', { method: 'DELETE' })).resolves.toBe(
      undefined,
    );
  });

  it('throws an ApiError carrying the status and the message from the API', async () => {
    fetchMock.mockResolvedValue(
      respondWith({ message: 'Category not found' }, 404),
    );

    await expect(apiFetch('/categories/1')).rejects.toMatchObject({
      status: 404,
      message: 'Category not found',
    });
    await expect(apiFetch('/categories/1')).rejects.toBeInstanceOf(ApiError);
  });

  it('joins the list of messages a validation error returns', async () => {
    fetchMock.mockResolvedValue(
      respondWith(
        { message: ['name must be shorter', 'name should not be empty'] },
        400,
      ),
    );

    await expect(apiFetch('/categories')).rejects.toMatchObject({
      message: 'name must be shorter, name should not be empty',
    });
  });

  it('clears the stored token when the API rejects it', async () => {
    writeToken('an-expired-token');
    fetchMock.mockResolvedValue(respondWith({ message: 'Log in' }, 401));

    await expect(apiFetch('/auth/me')).rejects.toBeInstanceOf(ApiError);

    // Keeping a token the API refuses would leave the app stuck on a loading state.
    expect(readToken()).toBe(null);
  });

  it('explains a network failure instead of leaking the fetch error', async () => {
    fetchMock.mockRejectedValue(new TypeError('Failed to fetch'));

    await expect(apiFetch('/categories')).rejects.toMatchObject({ status: 0 });
  });
});
