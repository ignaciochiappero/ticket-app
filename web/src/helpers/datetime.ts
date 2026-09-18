// Spanish plurals are not a matter of adding an "s", so each unit carries both
// forms rather than being patched at the call site.
const UNITS = [
  ['día', 'días', 86_400_000],
  ['hora', 'horas', 3_600_000],
  ['minuto', 'minutos', 60_000],
] as const;

/**
 * "hace 3 días", for the board and the timeline. Days are never rolled up into
 * a date: a ticket that has waited 45 days is exactly what the board exists to
 * expose, and "3 ago" would hide how long that is. Rounds down, so a unit is
 * counted only once it is complete.
 */
export function timeAgo(iso: string, now: Date = new Date()): string {
  const elapsed = now.getTime() - Date.parse(iso);
  for (const [one, many, ms] of UNITS) {
    const count = Math.floor(elapsed / ms);
    if (count >= 1) {
      return `hace ${count} ${count === 1 ? one : many}`;
    }
  }
  return 'recién';
}

const dateTime = new Intl.DateTimeFormat('es-AR', {
  dateStyle: 'medium',
  timeStyle: 'short',
});

/** The exact instant, in the viewer's time zone, for where "hace 3 días" is not enough. */
export function formatDateTime(iso: string): string {
  return dateTime.format(new Date(iso));
}
