// Decides which calendar items deserve a system notification right now. Pure, so it can be tested
// and called as often as the app likes: each (item, moment) pair has a stable key, and a key that
// was already sent is never announced again.
import type { CalendarItem } from '../calendar.ts';
import { dayKey, kindLabel } from '../calendar.ts';
import { shortDate } from '../time.ts';

export type NotifyItem = Pick<CalendarItem, 'id' | 'date' | 'day' | 'title' | 'kind' | 'priority' | 'why' | 'done'>;

export interface PlannedNotification {
  /** Stable id for this announcement; also used as the notification tag. */
  key: string;
  title: string;
  body: string;
  /** Every sent-key this announcement accounts for; record all of them once it is shown. */
  covers: string[];
}

/** No more than this many notifications at once, so a busy day does not flood the screen. */
export const MAX_AT_ONCE = 3;
/** Longest reason that still fits in a notification next to the main line. */
const MAX_REASON = 110;
const DAY = 86_400_000;

/** Whole calendar days from `today` to `day`, both YYYY-MM-DD in local time. */
function daysBetween(today: string, day: string): number {
  const at = (key: string) => {
    const [y = 0, m = 1, d = 1] = key.split('-').map(Number);
    return new Date(y, m - 1, d).getTime();
  };
  return Math.round((at(day) - at(today)) / DAY);
}

/** The first sentence of the item's reason, when it is short enough to read in a notification. */
export function shortReason(why: string): string {
  const first = why.trim().split(/(?<=[.!?])\s+/)[0] ?? '';
  return first.length > 0 && first.length <= MAX_REASON ? first : '';
}

const join = (...parts: string[]) => parts.filter(Boolean).join(' ');

interface Candidate {
  key: string;
  title: string;
  body: string;
  /** Lower is more urgent. */
  urgency: number;
  date: string;
  /** Short form used in the combined "and N more" notification. */
  line: string;
}

function candidateFor(item: NotifyItem, today: string, now: number): Candidate | null {
  if (item.done) return null;
  const days = daysBetween(today, item.day);
  const reason = shortReason(item.why);

  if (item.kind === 'deadline') {
    // Only deadlines the student committed to; a deadline already past its time is closed.
    if (item.priority !== 'must' || days < 0 || days > 3) return null;
    if (new Date(item.date).getTime() < now) return null;
    if (days === 0) {
      return { key: `${item.id}@due-today`, title: `Due today: ${item.title}`, body: join('The application closes today.', reason), urgency: 0, date: item.date, line: `${item.title} (due today)` };
    }
    if (days === 1) {
      return { key: `${item.id}@due-1d`, title: `Due tomorrow: ${item.title}`, body: join(`The application closes tomorrow, ${shortDate(item.date)}.`, reason), urgency: 1, date: item.date, line: `${item.title} (due tomorrow)` };
    }
    // The three-day notice; if the app was closed that day, it is given the day after instead.
    return {
      key: `${item.id}@due-3d`,
      title: `Due in ${days} days: ${item.title}`,
      body: join(`The application closes on ${shortDate(item.date)}.`, reason),
      urgency: 4,
      date: item.date,
      line: `${item.title} (due ${shortDate(item.date)})`,
    };
  }

  if (days !== 0) return null;

  if (item.kind === 'reminder') {
    return { key: `${item.id}@today`, title: `Reminder: ${item.title}`, body: reason || 'You set a reminder for today.', urgency: 2, date: item.date, line: `${item.title} (reminder)` };
  }
  if (item.kind === 'starts') {
    const must = item.priority === 'must';
    return { key: `${item.id}@today`, title: `Starts today: ${item.title}`, body: join('It starts today.', reason), urgency: must ? 3 : 6, date: item.date, line: `${item.title} (starts today)` };
  }
  // Roadmap step due today.
  const must = item.priority === 'must';
  return { key: `${item.id}@today`, title: `Roadmap step for today: ${item.title}`, body: reason || 'This step is due today.', urgency: must ? 5 : 7, date: item.date, line: item.title };
}

/** What to announce at `now`: most urgent first, never more than MAX_AT_ONCE notifications. */
export function dueNotifications(items: NotifyItem[], now: number, alreadySent: string[]): PlannedNotification[] {
  const today = dayKey(now);
  const sent = new Set(alreadySent);
  const seen = new Set<string>();
  const due: Candidate[] = [];
  for (const item of items) {
    const candidate = candidateFor(item, today, now);
    if (!candidate || sent.has(candidate.key) || seen.has(candidate.key)) continue;
    seen.add(candidate.key);
    due.push(candidate);
  }
  due.sort((a, b) => a.urgency - b.urgency || a.date.localeCompare(b.date) || a.key.localeCompare(b.key));

  const single = (c: Candidate): PlannedNotification => ({ key: c.key, title: c.title, body: c.body, covers: [c.key] });
  if (due.length <= MAX_AT_ONCE) return due.map(single);

  const shown = due.slice(0, MAX_AT_ONCE - 1);
  const rest = due.slice(MAX_AT_ONCE - 1);
  const list = rest.map((c) => c.line).join('; ');
  return [
    ...shown.map(single),
    {
      key: `more:${rest.map((c) => c.key).join('|')}`,
      title: `And ${rest.length} more coming up`,
      body: list.length <= 160 ? `${list}. Open your calendar to see them.` : 'Open your calendar to see them all.',
      covers: rest.map((c) => c.key),
    },
  ];
}

/** The next unfinished item, for the "Send a test reminder" button. Null when nothing is coming up. */
export function nextUpcoming(items: NotifyItem[], now: number): PlannedNotification | null {
  const today = dayKey(now);
  const next = items
    .filter((item) => !item.done && item.day >= today && !(item.kind === 'deadline' && new Date(item.date).getTime() < now))
    .sort((a, b) => a.day.localeCompare(b.day) || (a.priority === b.priority ? 0 : a.priority === 'must' ? -1 : 1) || a.date.localeCompare(b.date))[0];
  if (!next) return null;
  const days = daysBetween(today, next.day);
  const when = days === 0 ? 'today' : days === 1 ? 'tomorrow' : `on ${shortDate(next.date)}`;
  return {
    key: `test:${next.id}`,
    title: `Test reminder: ${next.title}`,
    body: join(`${kindLabel[next.kind]} ${when}.`, shortReason(next.why)),
    covers: [],
  };
}

/** Shown by the test button when the calendar is empty, so the student can still see one arrive. */
export const TEST_ONLY: PlannedNotification = {
  key: 'test:empty',
  title: 'BearRok test reminder',
  body: 'Notifications are working. Nothing is on your calendar yet, so this one is only a test.',
  covers: [],
};
