// Ordering, searching and moving applications between the four status columns.
import { STATUSES } from '../applications.ts';
import type { ApplicationStatus, Opportunity } from '../../types.ts';

/** The status one column to the left (-1) or right (1), or null at either end of the board. */
export function neighborStatus(status: ApplicationStatus, direction: -1 | 1): ApplicationStatus | null {
  return STATUSES[STATUSES.indexOf(status) + direction] ?? null;
}

export type SortKey = 'deadline' | 'readiness' | 'fit';

export const sortLabel: Record<SortKey, string> = {
  deadline: 'Deadline, soonest first',
  readiness: 'Least ready first',
  fit: 'Best fit first',
};

export interface Sortable {
  opportunity: Opportunity;
  score: number;
}

export function sortItems<T extends Sortable>(items: T[], key: SortKey): T[] {
  const deadline = (o: Opportunity) => (o.deadline ? new Date(o.deadline).getTime() : Infinity);
  const byDeadline = (a: T, b: T) => deadline(a.opportunity) - deadline(b.opportunity);
  return [...items].sort((a, b) => {
    if (key === 'readiness') return a.score - b.score || byDeadline(a, b);
    if (key === 'fit') return b.opportunity.baseScore - a.opportunity.baseScore || byDeadline(a, b);
    return byDeadline(a, b) || b.opportunity.baseScore - a.opportunity.baseScore;
  });
}

/** Search across what a student would remember about a posting: name, organizer, tags, type. */
export function matchesQuery(o: Opportunity, query: string): boolean {
  const words = query.toLowerCase().trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return true;
  const haystack = [o.title, o.organizer, o.type, o.location ?? '', ...o.tags].join(' ').toLowerCase();
  return words.every((word) => haystack.includes(word));
}

/** How many applications sit at each status, for the funnel at the top of the page. */
export function funnelCounts(statuses: ApplicationStatus[]): Record<ApplicationStatus, number> {
  const counts = Object.fromEntries(STATUSES.map((s) => [s, 0])) as Record<ApplicationStatus, number>;
  for (const status of statuses) counts[status] += 1;
  return counts;
}
