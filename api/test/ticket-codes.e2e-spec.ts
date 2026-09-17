import { CountersService } from '../src/counters/counters.service.js';
import { createTestApp, type TestApp } from './create-test-app.js';

describe('ticket-codes (e2e)', () => {
  let testApp: TestApp;
  let counters: CountersService;

  beforeEach(async () => {
    testApp = await createTestApp();
    counters = testApp.app.get(CountersService);
  });

  afterEach(async () => {
    await testApp.close();
  });

  it('hands out the sequence from one', async () => {
    expect(await counters.next('ticket')).toBe(1);
    expect(await counters.next('ticket')).toBe(2);
  });

  it('never gives the same number to two callers at once', async () => {
    // The guarantee the ticket code rests on. A read-then-write would hand the
    // same number to both callers here; $inc cannot.
    const numbers = await Promise.all(
      Array.from({ length: 8 }, () => counters.next('ticket')),
    );

    expect(new Set(numbers).size).toBe(8);
    expect([...numbers].sort((a, b) => a - b)).toEqual([
      1, 2, 3, 4, 5, 6, 7, 8,
    ]);
  });

  it('keeps one sequence per name', async () => {
    await counters.next('ticket');
    await counters.next('ticket');

    expect(await counters.next('something-else')).toBe(1);
    expect(await counters.next('ticket')).toBe(3);
  });
});
