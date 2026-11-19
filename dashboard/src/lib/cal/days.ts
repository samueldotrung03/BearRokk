// Day arithmetic on local YYYY-MM-DD keys, the same keys dayKey() in src/lib/calendar.ts makes.
// Working on keys instead of timestamps keeps a day a day across daylight-saving changes.
import { dayKey } from '../calendar.ts';

export const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const;

/** Noon on the key's day, so a time zone shift can never push it into the next or previous day. */
export function dayDate(day: string): Date {
  const [year, month, date] = day.split('-').map(Number);
  return new Date(year!, month! - 1, date!, 12);
}

export function addDays(day: string, by: number): string {
  const d = dayDate(day);
  return dayKey(new Date(d.getFullYear(), d.getMonth(), d.getDate() + by, 12));
}

/** Whole days from `from` to `to`; negative when `to` is earlier. */
export function daysBetween(from: string, to: string): number {
  return Math.round((dayDate(to).getTime() - dayDate(from).getTime()) / 86_400_000);
}

/** 0 is Sunday, as with Date.getDay(). */
export const weekdayOf = (day: string) => dayDate(day).getDay();

/** The Sunday on or before the day, matching the month grid's first column. */
export const startOfWeek = (day: string) => addDays(day, -weekdayOf(day));

export function dayRange(from: string, count: number): string[] {
  return Array.from({ length: count }, (_, index) => addDays(from, index));
}

/** "Today", "Tomorrow", or "Fri, Nov 27". */
export function dayLabel(day: string, today: string): string {
  const gap = daysBetween(today, day);
  if (gap === 0) return 'Today';
  if (gap === 1) return 'Tomorrow';
  if (gap === -1) return 'Yesterday';
  return dayDate(day).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
}

export const shortDay = (day: string) => dayDate(day).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
export const longDay = (day: string) => dayDate(day).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });

/** Hours shown the way people say them: 2h, 1.5h, 30 min. */
export function hoursLabel(hours: number): string {
  if (hours < 1) return `${Math.round(hours * 60)} min`;
  return `${Number.isInteger(hours) ? hours : hours.toFixed(1)}h`;
}

/** The day inside a sentence: "today", "tomorrow", or "on Fri, Nov 27" (without "on" when `on` is false). */
export function dayPhrase(day: string, today: string, on = true): string {
  const label = dayLabel(day, today);
  if (label === 'Today' || label === 'Tomorrow' || label === 'Yesterday') return label.toLowerCase();
  return on ? `on ${label}` : label;
}
