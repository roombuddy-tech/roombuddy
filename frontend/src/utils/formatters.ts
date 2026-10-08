// ─── Dates ────────────────────────────────────────────────────────────────────
// Listing dates travel as local "YYYY-MM-DD" strings. Parse them by parts —
// new Date('YYYY-MM-DD') is read as UTC and can land on the previous day.

const MONTHS_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export function parseISODate(s: string | null | undefined): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s || '');
  return m ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])) : null;
}

// "14 Oct 2026"
export function formatDisplayDate(s: string | null | undefined): string {
  const d = parseISODate(s);
  return d ? `${d.getDate()} ${MONTHS_SHORT[d.getMonth()]} ${d.getFullYear()}` : '';
}

// "12 days", "about 2 months", "about 1 month, 10 days" — rough on purpose.
export function describeDuration(fromISO: string | null | undefined, untilISO: string | null | undefined): string | null {
  const from = parseISODate(fromISO);
  const until = parseISODate(untilISO);
  if (!from || !until || until <= from) return null;
  const days = Math.round((until.getTime() - from.getTime()) / 86400000);
  if (days < 30) return `${days} day${days === 1 ? '' : 's'}`;
  const months = Math.floor(days / 30);
  const rest = days % 30;
  return `about ${months} month${months === 1 ? '' : 's'}${rest >= 7 ? `, ${rest} days` : ''}`;
}
