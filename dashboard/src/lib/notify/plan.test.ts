import { describe, expect, it } from 'vitest';
import { dayKey } from '../calendar.ts';
import { dueNotifications, MAX_AT_ONCE, nextUpcoming, shortReason, type NotifyItem } from './plan.ts';

// Thursday 09:00 local time.
const NOW = new Date(2026, 10, 19, 9, 0).getTime();
const at = (days: number, hour = 17) => {
  const d = new Date(2026, 10, 19 + days, hour, 0);
  return { date: d.toISOString(), day: dayKey(d) };
};

function item(id: string, days: number, over: Partial<NotifyItem> = {}): NotifyItem {
  return { id, ...at(days), title: `Item ${id}`, kind: 'deadline', priority: 'must', why: 'You marked this "Applying". More detail.', done: false, ...over };
}

const keys = (items: NotifyItem[], sent: string[] = []) => dueNotifications(items, NOW, sent).map((n) => n.key);

describe('dueNotifications', () => {
  it('announces a must-do deadline 3 days before, the day before and on the day', () => {
    expect(keys([item('a', 3)])).toEqual(['a@due-3d']);
    expect(keys([item('a', 1)])).toEqual(['a@due-1d']);
    expect(keys([item('a', 0)])).toEqual(['a@due-today']);
    expect(keys([item('a', 4)])).toEqual([]);
    expect(keys([item('a', -1)])).toEqual([]);
  });

  it('gives the three-day notice a day late when it was missed, but only once', () => {
    expect(keys([item('a', 2)])).toEqual(['a@due-3d']);
    expect(keys([item('a', 2)], ['a@due-3d'])).toEqual([]);
  });

  it('skips should-do deadlines, done items and deadlines already past their time today', () => {
    expect(keys([item('a', 1, { priority: 'should' })])).toEqual([]);
    expect(keys([item('a', 0, { done: true })])).toEqual([]);
    expect(keys([item('a', 0, at(0, 8))])).toEqual([]);
  });

  it('announces reminders, start days and roadmap steps only on their day', () => {
    const reminder = item('r', 0, { kind: 'reminder', why: '2 days before: the deadline is Nov 21.' });
    const starts = item('s', 0, { kind: 'starts', priority: 'should' });
    const step = item('p', 0, { kind: 'step', priority: 'should' });
    expect(keys([reminder, starts, step]).sort()).toEqual(['p@today', 'r@today', 's@today']);
    expect(keys([{ ...reminder, ...at(1) }, { ...starts, ...at(1) }, { ...step, ...at(-1) }])).toEqual([]);
  });

  it('never repeats a key that was already sent, and dedupes within one call', () => {
    expect(keys([item('a', 0), item('a', 0)])).toEqual(['a@due-today']);
    expect(keys([item('a', 0)], ['a@due-today'])).toEqual([]);
  });

  it('puts the most urgent first', () => {
    const list = [item('step', 0, { kind: 'step', priority: 'should' }), item('soon', 3), item('today', 0)];
    expect(keys(list)).toEqual(['today@due-today', 'soon@due-3d', 'step@today']);
  });

  it('caps the count and folds the rest into one "and N more" notification that covers them', () => {
    const list = [item('a', 0), item('b', 1), item('c', 3), item('d', 0, { kind: 'step' }), item('e', 0, { kind: 'starts' })];
    const out = dueNotifications(list, NOW, []);
    expect(out).toHaveLength(MAX_AT_ONCE);
    expect(out.slice(0, 2).map((n) => n.key)).toEqual(['a@due-today', 'b@due-1d']);
    expect(out[2]?.title).toBe('And 3 more coming up');
    expect(out[2]?.covers.sort()).toEqual(['c@due-3d', 'd@today', 'e@today']);
    // Once everything shown is recorded, nothing comes back.
    expect(dueNotifications(list, NOW, out.flatMap((n) => n.covers))).toEqual([]);
  });

  it('writes the title and body in plain words with the short reason', () => {
    const [n] = dueNotifications([item('a', 1, { title: 'Google STEP' })], NOW, []);
    expect(n?.title).toBe('Due tomorrow: Google STEP');
    expect(n?.body).toMatch(/^The application closes tomorrow, Nov 20\. You marked this "Applying"\.$/);
  });
});

describe('shortReason', () => {
  it('keeps the first sentence and drops one that is too long', () => {
    expect(shortReason('You saved this. It starts on this day.')).toBe('You saved this.');
    expect(shortReason('x'.repeat(200))).toBe('');
  });
});

describe('nextUpcoming', () => {
  it('picks the soonest unfinished item, must before should', () => {
    const list = [item('later', 5), item('done', 0, { done: true }), item('should', 1, { kind: 'step', priority: 'should' }), item('must', 1, { kind: 'reminder' })];
    expect(nextUpcoming(list, NOW)?.title).toBe('Test reminder: Item must');
    expect(nextUpcoming(list, NOW)?.body).toMatch(/^Reminder tomorrow\./);
  });

  it('returns null when nothing is coming up', () => {
    expect(nextUpcoming([item('old', -2)], NOW)).toBeNull();
  });
});
