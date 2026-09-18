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
  it('calls anything under a minute "just now"', () => {
    expect(timeAgo(ago(0), NOW)).toBe('just now');
    expect(timeAgo(ago(59_000), NOW)).toBe('just now');
  });

  it('counts minutes, hours and days, singular when there is one', () => {
    expect(timeAgo(ago(MINUTE), NOW)).toBe('1 minute ago');
    expect(timeAgo(ago(5 * MINUTE), NOW)).toBe('5 minutes ago');
    expect(timeAgo(ago(HOUR), NOW)).toBe('1 hour ago');
    expect(timeAgo(ago(3 * HOUR), NOW)).toBe('3 hours ago');
    expect(timeAgo(ago(DAY), NOW)).toBe('1 day ago');
    expect(timeAgo(ago(2 * DAY), NOW)).toBe('2 days ago');
  });

  it('keeps counting days rather than switching to a date', () => {
    // A ticket that has waited 45 days is the one the board exists to expose;
    // "Aug 3" would hide exactly how long that is.
    expect(timeAgo(ago(45 * DAY), NOW)).toBe('45 days ago');
  });

  it('rounds down, so a unit is only counted once it is complete', () => {
    expect(timeAgo(ago(HOUR + 59 * MINUTE), NOW)).toBe('1 hour ago');
    expect(timeAgo(ago(DAY - 1), NOW)).toBe('23 hours ago');
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
