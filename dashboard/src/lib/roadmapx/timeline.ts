// Lays the steps out by week from today, for the timeline view. Weeks are counted from now
// rather than from Monday, so "this week" always means the next seven days.
import { DAY, daysLeft, type CoachStep } from './context.ts';

export interface WeekBucket {
  key: string;
  /** -1 for overdue, 0 for the next seven days, and so on. Null for steps with no date. */
  index: number | null;
  label: string;
  /** First day the bucket covers, for the date under the label. */
  start: number | null;
  steps: CoachStep[];
  hours: number;
}

const short = (time: number) => new Date(time).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

export function weekLabel(index: number, now: number): string {
  if (index < 0) return 'Overdue';
  if (index === 0) return 'This week';
  if (index === 1) return 'Next week';
  return `Week of ${short(now + index * 7 * DAY)}`;
}

/** Buckets in time order, only weeks that have steps, with undated steps last. */
export function groupByWeek(steps: CoachStep[], now: number): WeekBucket[] {
  const byIndex = new Map<number, CoachStep[]>();
  const undated: CoachStep[] = [];
  for (const step of steps) {
    if (!step.due) {
      undated.push(step);
      continue;
    }
    const days = daysLeft(step.due, now);
    const index = days < 0 ? -1 : Math.floor(days / 7);
    byIndex.set(index, [...(byIndex.get(index) ?? []), step]);
  }
  const buckets: WeekBucket[] = [...byIndex.entries()]
    .sort(([a], [b]) => a - b)
    .map(([index, items]) => ({
      key: `w${index}`,
      index,
      label: weekLabel(index, now),
      start: index < 0 ? null : now + index * 7 * DAY,
      steps: items.sort((a, b) => new Date(a.due!).getTime() - new Date(b.due!).getTime()),
      hours: items.filter((s) => !s.done).reduce((sum, s) => sum + s.hours, 0),
    }));
  if (undated.length > 0) {
    buckets.push({
      key: 'none',
      index: null,
      label: 'No date yet',
      start: null,
      steps: undated,
      hours: undated.filter((s) => !s.done).reduce((sum, s) => sum + s.hours, 0),
    });
  }
  return buckets;
}
