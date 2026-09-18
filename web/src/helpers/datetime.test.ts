import { describe, expect, it } from 'vitest';
import { formatDateTime, timeAgo } from './datetime';

const NOW = new Date('2026-09-17T15:00:00.000Z');

function ago(ms: number): string {
  return new Date(NOW.getTime() - ms).toISOString();
}

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

describe('timeAgo', () => {
  it('calls anything under a minute "recién"', () => {
    expect(timeAgo(ago(0), NOW)).toBe('recién');
    expect(timeAgo(ago(59_000), NOW)).toBe('recién');
  });

  it('counts minutes, hours and days, singular when there is one', () => {
    expect(timeAgo(ago(MINUTE), NOW)).toBe('hace 1 minuto');
    expect(timeAgo(ago(5 * MINUTE), NOW)).toBe('hace 5 minutos');
    expect(timeAgo(ago(HOUR), NOW)).toBe('hace 1 hora');
    expect(timeAgo(ago(3 * HOUR), NOW)).toBe('hace 3 horas');
    expect(timeAgo(ago(DAY), NOW)).toBe('hace 1 día');
    expect(timeAgo(ago(2 * DAY), NOW)).toBe('hace 2 días');
  });

  it('keeps counting days rather than switching to a date', () => {
    // A ticket that has waited 45 days is the one the board exists to expose;
    // "Aug 3" would hide exactly how long that is.
    expect(timeAgo(ago(45 * DAY), NOW)).toBe('hace 45 días');
  });

  it('rounds down, so a unit is only counted once it is complete', () => {
    expect(timeAgo(ago(HOUR + 59 * MINUTE), NOW)).toBe('hace 1 hora');
    expect(timeAgo(ago(DAY - 1), NOW)).toBe('hace 23 horas');
  });
});

describe('formatDateTime', () => {
  it('gives the timeline an exact, readable instant', () => {
    const text = formatDateTime('2026-09-17T14:31:05.000Z');

    // Rendered in the viewer's own time zone, so the hour is not asserted:
    // the shape is what matters, a date and a time somebody can read.
    expect(text).toMatch(/2026/);
    expect(text).toMatch(/\d{1,2}:\d{2}/);
  });
});
