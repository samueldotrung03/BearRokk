// The Feed tab's filters as plain data and pure functions, so the panel can show how many
// cards each choice would leave before the student picks it.
import { opportunityPaths } from '../data/opportunities-more.ts';
import { careerPaths } from '../data/sample.ts';
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
  /**
   * Fields of work, by career path group ('Technology', 'Finance and business').
   * Missing or empty means every field; optional so filters saved before it still read.
   */
  fields?: string[];
}

export const emptyFilters: Filters = { types: [], format: 'any', deadline: 'any', minFit: 0, only: [], fields: [] };

/** Every field a career path belongs to, in the order the career paths list them. */
export const fieldOptions: string[] = [
  ...new Set(careerPaths.map((path) => path.group).filter((group): group is NonNullable<typeof group> => !!group)),
];

/** The field of the career path the student is aiming at, if it has one. */
export function fieldOfGoal(goalId: string): string | null {
  return careerPaths.find((path) => path.id === goalId)?.group ?? null;
}

/**
 * The fields an opportunity leads into, read from the career paths it is recorded against.
 * An empty list means it is open to any field (a fair, most scholarships, anything unrecorded).
 */
export function fieldsOf(o: Opportunity): string[] {
  const groups = (opportunityPaths[o.id] ?? []).map((id) => careerPaths.find((path) => path.id === id)?.group);
  return [...new Set(groups.filter((group): group is NonNullable<typeof group> => !!group))];
}

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
  const wanted = filters.fields ?? [];
  if (wanted.length > 0) {
    const fields = fieldsOf(o);
    // Open to any field means it fits whichever field the student picked.
    if (fields.length > 0 && !fields.some((field) => wanted.includes(field))) return false;
  }
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
    filters.only.length +
    (filters.fields?.length ?? 0)
  );
}

/** Adds the value to the list, or takes it out if it is already there. */
export function toggled<T>(list: T[], value: T): T[] {
  return list.includes(value) ? list.filter((item) => item !== value) : [...list, value];
}
