import type { CategoryId, Format, Opportunity } from '../data/opportunities.ts';

export const categoryOrder: { id: CategoryId; label: string; singular: string }[] = [
  { id: 'internship', label: 'Internships', singular: 'Internship' },
  { id: 'event', label: 'Events', singular: 'Event' },
  { id: 'club', label: 'Clubs', singular: 'Club' },
  { id: 'competition', label: 'Competitions', singular: 'Competition' },
  { id: 'research', label: 'Research', singular: 'Research' },
  { id: 'scholarship', label: 'Scholarships', singular: 'Scholarship' },
];

export type SortId = 'best' | 'deadline' | 'start' | 'title';

export const sortLabel: Record<SortId, string> = {
  best: 'Best match',
  deadline: 'Deadline soonest',
  start: 'Event date soonest',
  title: 'Title',
};

export type TimingFilter = 'any' | 'has_deadline' | 'deadline_unknown' | 'has_start';

export interface FeedFilters {
  format: Format | 'any';
  timing: TimingFilter;
  savedOnly: boolean;
}

export const emptyFilters: FeedFilters = { format: 'any', timing: 'any', savedOnly: false };

export function categoryMeta(id: CategoryId) {
  return categoryOrder.find((item) => item.id === id) ?? categoryOrder[0];
}

export function matchLabel(score: number) {
  if (score >= 0.9) return 'Strong match';
  if (score >= 0.75) return 'Good match';
  return 'Worth exploring';
}

export function freshness(iso: string, now = Date.now()) {
  const hours = Math.max(1, Math.round((now - new Date(iso).getTime()) / 3_600_000));
  if (hours < 24) return `Checked ${hours}h ago`;
  const days = Math.round(hours / 24);
  return `Checked ${days}d ago`;
}

export function shortDate(iso: string) {
  return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' }).format(new Date(iso));
}

export function formatLabel(format: Format) {
  if (format === 'online') return 'Online';
  if (format === 'in_person') return 'In person';
  return 'Hybrid';
}

/** One line for a card. Event starts and deadlines stay in separate clauses. */
export function dateLine(opportunity: Opportunity) {
  const parts: { text: string; unknown: boolean }[] = [];
  if (opportunity.start) {
    const noun = opportunity.startKind === 'meeting' ? 'Meets' : opportunity.startKind === 'program' ? 'Starts' : 'Starts';
    parts.push({ text: `${noun} ${shortDate(opportunity.start)}`, unknown: false });
  } else if (opportunity.startKind === 'event') {
    parts.push({ text: 'Event date unknown', unknown: true });
  }
  if (opportunity.term && !opportunity.start) parts.push({ text: opportunity.term, unknown: false });
  if (opportunity.deadline) {
    const verb = opportunity.deadlineKind === 'registration' ? 'Register by' : 'Apply by';
    parts.push({ text: `${verb} ${shortDate(opportunity.deadline)}`, unknown: false });
  } else if (opportunity.deadlineKind === 'registration') {
    parts.push({ text: 'Registration deadline unknown', unknown: true });
  } else if (opportunity.deadlineKind === 'application') {
    parts.push({ text: 'Application deadline unknown', unknown: true });
  }
  return parts;
}

export function matchesQuery(opportunity: Opportunity, query: string) {
  const words = query.toLowerCase().split(/\s+/).filter(Boolean);
  if (words.length === 0) return true;
  const text = [
    opportunity.title,
    opportunity.organizer,
    opportunity.location,
    formatLabel(opportunity.format),
    categoryMeta(opportunity.category).label,
    categoryMeta(opportunity.category).singular,
    ...opportunity.tags,
  ]
    .join(' ')
    .toLowerCase();
  return words.every((word) => text.includes(word));
}

export function matchesFilters(opportunity: Opportunity, filters: FeedFilters, saved: ReadonlySet<string>) {
  if (filters.format !== 'any' && opportunity.format !== filters.format) return false;
  if (filters.savedOnly && !saved.has(opportunity.id)) return false;
  if (filters.timing === 'has_deadline' && !opportunity.deadline) return false;
  if (filters.timing === 'deadline_unknown' && !(opportunity.deadlineKind && !opportunity.deadline)) return false;
  if (filters.timing === 'has_start' && !opportunity.start) return false;
  return true;
}

export function activeFilterCount(filters: FeedFilters) {
  let count = 0;
  if (filters.format !== 'any') count += 1;
  if (filters.timing !== 'any') count += 1;
  if (filters.savedOnly) count += 1;
  return count;
}

export function sortOpportunities(items: Opportunity[], sort: SortId) {
  const copy = [...items];
  if (sort === 'title') {
    copy.sort((a, b) => a.title.localeCompare(b.title));
  } else if (sort === 'deadline') {
    copy.sort((a, b) => {
      const left = a.deadline ? new Date(a.deadline).getTime() : Number.POSITIVE_INFINITY;
      const right = b.deadline ? new Date(b.deadline).getTime() : Number.POSITIVE_INFINITY;
      return left - right || b.matchScore - a.matchScore;
    });
  } else if (sort === 'start') {
    copy.sort((a, b) => {
      const left = a.start ? new Date(a.start).getTime() : Number.POSITIVE_INFINITY;
      const right = b.start ? new Date(b.start).getTime() : Number.POSITIVE_INFINITY;
      return left - right || b.matchScore - a.matchScore;
    });
  } else {
    copy.sort((a, b) => b.matchScore - a.matchScore);
  }
  return copy;
}
