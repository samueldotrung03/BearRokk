// The calendar page's own list: the store's dated items (src/lib/calendar.ts) plus what the
// student added by hand or accepted from the week plan. Also the rules the views share: filters,
// how loaded a day is, and which days have more than one commitment.
import type { CalendarItem, CalendarKind, Priority } from '../calendar.ts';
import { dayDate } from './days.ts';

/** google: an event from the student's own Google Calendar. */
export type CxKind = CalendarKind | 'personal' | 'google';

/** Something the student put on the calendar themselves, or a plan block they accepted. */
export interface PersonalItem {
  id: string;
  day: string;
  title: string;
  priority: Priority;
  note: string;
  done: boolean;
  /** Set when the item is an accepted work block from "Plan my week". */
  block: { targetId: string; hours: number; why: string } | null;
  /** Start and end time, "HH:MM", for an item at a set time. Without them it is for the whole day. */
  time?: string | null;
  endTime?: string | null;
  /** The event this item made on the student's Google Calendar, once it has been added there. */
  google?: { eventId: string; link: string | null } | null;
}

export interface CxItem extends Omit<CalendarItem, 'kind'> {
  kind: CxKind;
  /** Set for personal items, so the page can edit, tick or delete them. */
  personalId: string | null;
  note: string;
  /** Planned hours, for accepted work blocks. */
  hours: number | null;
  /** Where the item lives elsewhere, such as the event on Google Calendar. */
  link?: string | null;
}

export const cxKindLabel: Record<CxKind, string> = {
  deadline: 'Deadline',
  reminder: 'Reminder',
  starts: 'Starts',
  step: 'Roadmap step',
  personal: 'Your own',
  google: 'Google Calendar',
};

export const ALL_KINDS: CxKind[] = ['deadline', 'reminder', 'starts', 'step', 'personal', 'google'];

const clockOf = (hhmm: string) => new Date(`2000-01-01T${hhmm}:00`).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });

export function fromPersonal(p: PersonalItem): CxItem {
  const when = p.time ? `${clockOf(p.time)}${p.endTime ? ` – ${clockOf(p.endTime)}` : ''}. ` : '';
  return {
    id: `personal-${p.id}`,
    date: p.time ? new Date(`${p.day}T${p.time}:00`).toISOString() : dayDate(p.day).toISOString(),
    day: p.day,
    title: p.title,
    kind: 'personal',
    priority: p.priority,
    why: when + (p.block ? p.block.why : p.note.trim() ? `You added this yourself. ${p.note.trim()}` : 'You added this yourself.'),
    opportunityId: null,
    stepId: null,
    done: p.done,
    personalId: p.id,
    note: p.note,
    hours: p.block?.hours ?? null,
    link: p.google?.link ?? null,
  };
}

const rank = (item: CxItem) => (item.priority === 'must' ? 0 : 1);

/** One sorted list, in the same order calendarItems() uses: day, then must before should. */
export function mergeItems(items: CalendarItem[], personal: PersonalItem[]): CxItem[] {
  const base: CxItem[] = items.map((item) => ({ ...item, personalId: null, note: '', hours: null }));
  return [...base, ...personal.map(fromPersonal)].sort(
    (a, b) => a.day.localeCompare(b.day) || rank(a) - rank(b) || a.date.localeCompare(b.date),
  );
}

export interface CxFilters {
  kinds: CxKind[];
  priorities: Priority[];
}

export const allFilters: CxFilters = { kinds: [...ALL_KINDS], priorities: ['must', 'should'] };

export const matchesFilters = (item: CxItem, filters: CxFilters) =>
  filters.kinds.includes(item.kind) && filters.priorities.includes(item.priority);

export const filtersActive = (filters: CxFilters) =>
  filters.kinds.length < ALL_KINDS.length || filters.priorities.length < 2;

export function groupByDay<T extends { day: string }>(items: T[]): Map<string, T[]> {
  const map = new Map<string, T[]>();
  for (const item of items) map.set(item.day, [...(map.get(item.day) ?? []), item]);
  return map;
}

/**
 * How full a day is, from 0 (nothing) to 3 (heavy). A must counts double: it cannot slip. Work
 * blocks count by their hours. Reminders and finished items do not add load.
 */
export function dayLoad(items: CxItem[], plannedHours = 0): { score: number; level: 0 | 1 | 2 | 3 } {
  let score = plannedHours;
  for (const item of items) {
    if (item.done || item.kind === 'reminder') continue;
    score += item.hours ?? (item.priority === 'must' ? 2 : 1);
  }
  const level = score === 0 ? 0 : score <= 2 ? 1 : score <= 4 ? 2 : 3;
  return { score, level };
}

export interface Conflict {
  day: string;
  /** The open must items that compete for that day, one per commitment. */
  items: CxItem[];
}

/**
 * Days where two or more separate commitments land at once. A deadline and the roadmap step to
 * submit that same application are one commitment, not two, so they are counted once. Reminders
 * only point at a deadline, and accepted work blocks are time the student chose, so neither counts.
 */
export function findConflicts(items: CxItem[]): Conflict[] {
  const conflicts: Conflict[] = [];
  for (const [day, list] of groupByDay(items)) {
    const seen = new Map<string, CxItem>();
    for (const item of list) {
      if (item.done || item.priority !== 'must' || item.kind === 'reminder' || item.hours !== null) continue;
      const key = item.opportunityId ?? item.id;
      if (!seen.has(key)) seen.set(key, item);
    }
    if (seen.size >= 2) conflicts.push({ day, items: [...seen.values()] });
  }
  return conflicts.sort((a, b) => a.day.localeCompare(b.day));
}
