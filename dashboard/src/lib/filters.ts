// The Feed tab's filters as plain data and pure functions, so the panel can show how many
// cards each choice would leave before the student picks it.
import type { Format, Opportunity, OpportunityType } from '../types.ts';

export type DeadlineFilter = 'any' | 'week' | 'two-weeks' | 'month' | 'none';
export type OnlyFilter = 'saved' | 'liked' | 'roadmap' | 'new';

export interface Filters {
  /** Empty means every type. */
  types: OpportunityType[];
  format: Format | 'any';
  deadline: DeadlineFilter;
  /** Lowest fit score to show, 0 to 100. */
  minFit: number;
  /** Every one that is switched on must hold. */
  only: OnlyFilter[];
}

export const emptyFilters: Filters = { types: [], format: 'any', deadline: 'any', minFit: 0, only: [] };

export const deadlineLabel: Record<DeadlineFilter, string> = {
  any: 'Any time',
  week: 'This week',
  'two-weeks': 'Within 2 weeks',
  month: 'Within a month',
  none: 'No deadline',
};

export const onlyLabel: Record<OnlyFilter, string> = {
  saved: 'Saved',
  liked: 'Liked',
  roadmap: 'On my roadmap',
  new: 'New today',
};

export const fitOptions = [0, 70, 80, 90];

/** What the filters need to know about the student. */
export interface FilterContext {
  saved: string[];
  liked: string[];
  /** Opportunities tied to a roadmap step that is not done yet. */
  roadmap: Set<string>;
  now: number;
}

const DAY = 86_400_000;
const deadlineDays: Partial<Record<DeadlineFilter, number>> = { week: 7, 'two-weeks': 14, month: 30 };

export function matches(o: Opportunity, filters: Filters, context: FilterContext): boolean {
  if (filters.types.length > 0 && !filters.types.includes(o.type)) return false;
  if (filters.format !== 'any' && o.format !== filters.format) return false;
  if (filters.deadline === 'none' && o.deadline !== null) return false;
  const days = deadlineDays[filters.deadline];
  if (days !== undefined && (o.deadline === null || new Date(o.deadline).getTime() - context.now > days * DAY)) return false;
  if (Math.round(o.baseScore * 100) < filters.minFit) return false;
  return filters.only.every((rule) => {
    if (rule === 'saved') return context.saved.includes(o.id);
    if (rule === 'liked') return context.liked.includes(o.id);
    if (rule === 'roadmap') return context.roadmap.has(o.id);
    return context.now - new Date(o.foundAt).getTime() < DAY;
  });
}

export function countActive(filters: Filters): number {
  return (
    filters.types.length +
    (filters.format !== 'any' ? 1 : 0) +
    (filters.deadline !== 'any' ? 1 : 0) +
    (filters.minFit > 0 ? 1 : 0) +
    filters.only.length
  );
}

/** Adds the value to the list, or takes it out if it is already there. */
export function toggled<T>(list: T[], value: T): T[] {
  return list.includes(value) ? list.filter((item) => item !== value) : [...list, value];
}
