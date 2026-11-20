// Deadlines as the portal shows them. Kept apart from exportDocx.ts so the page can show a date
// without loading the Word library.
import { daysUntil } from '../time.ts';

/** A deadline as a reader expects it, e.g. "December 1, 2026". */
export function longDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
}

/** "12 days left", "1 day left", "Due today", "Closed 3 days ago". */
export function daysLeftLabel(deadline: string, now = Date.now()): string {
  const days = daysUntil(deadline, now);
  if (days < 0) return `Closed ${-days} ${days === -1 ? 'day' : 'days'} ago`;
  if (days === 0) return 'Due today';
  if (days === 1) return '1 day left';
  return `${days} days left`;
}
