const UNITS = [
  ['day', 86_400_000],
  ['hour', 3_600_000],
  ['minute', 60_000],
] as const;

/**
 * "3 days ago", for the board and the timeline. Days are never rolled up into
 * a date: a ticket that has waited 45 days is exactly what the board exists to
 * expose, and "Aug 3" would hide how long that is. Rounds down, so a unit is
 * counted only once it is complete.
 */
export function timeAgo(iso: string, now: Date = new Date()): string {
  const elapsed = now.getTime() - Date.parse(iso);
  for (const [unit, ms] of UNITS) {
    const count = Math.floor(elapsed / ms);
    if (count >= 1) {
      return `${count} ${unit}${count === 1 ? '' : 's'} ago`;
    }
  }
  return 'just now';
}

const dateTime = new Intl.DateTimeFormat('en-GB', {
  dateStyle: 'medium',
  timeStyle: 'short',
});

/** The exact instant, in the viewer's time zone, for where "3 days ago" is not enough. */
export function formatDateTime(iso: string): string {
  return dateTime.format(new Date(iso));
}
