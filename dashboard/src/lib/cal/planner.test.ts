import { describe, expect, it } from 'vitest';
import { initialState } from '../../data/sample.ts';
import { calendarItems } from '../calendar.ts';
import { effortContext } from './assistant.ts';
import { addDays, dayRange, weekdayOf } from './days.ts';
import { mergeItems, type CxItem } from './items.ts';
import { MAX_BLOCK, estimateEffort, planWeek, targetsFrom, type PlanInput, type PlanTarget } from './planner.ts';

const TODAY = '2026-11-18'; // a Wednesday
const target = (id: string, due: string, hours: number, priority: 'must' | 'should' = 'must'): PlanTarget => ({
  id,
  title: id,
  due,
  priority,
  hours,
  basis: '',
  reason: '',
});
const input = (targets: PlanTarget[], hours = 2, extra: Partial<PlanInput> = {}): PlanInput => ({
  today: TODAY,
  days: 7,
  hoursByWeekday: Array(7).fill(hours),
  targets,
  accepted: [],
  ...extra,
});
const hoursFor = (plan: ReturnType<typeof planWeek>, id: string) =>
  plan.blocks.filter((b) => b.targetId === id).reduce((sum, b) => sum + b.hours, 0);

describe('planWeek', () => {
  it('never places a block after its due date, even when that leaves work unplaced', () => {
    const targets = [target('a', addDays(TODAY, 1), 6), target('b', addDays(TODAY, 3), 5, 'should'), target('c', TODAY, 3)];
    const plan = planWeek(input(targets, 3));
    for (const block of plan.blocks) {
      expect(block.day <= targets.find((t) => t.id === block.targetId)!.due).toBe(true);
      expect(block.day >= TODAY).toBe(true);
    }
    // 'c' is due today and 'a' tomorrow: 9h of must work, 6h of room on those two days.
    expect(plan.shortfalls.map((s) => s.targetId)).toContain('a');
  });

  it('keeps every day within the hours the student gave, counting accepted blocks', () => {
    const hoursByWeekday = [0, 1, 1.5, 2, 2, 4, 0];
    const accepted = [{ targetId: 'x', day: addDays(TODAY, 1), hours: 1, done: false }];
    const targets = [target('a', addDays(TODAY, 6), 8), target('b', addDays(TODAY, 5), 6, 'should'), target('x', addDays(TODAY, 4), 2)];
    const plan = planWeek(input(targets, 0, { hoursByWeekday, accepted }));
    for (const day of dayRange(TODAY, 7)) {
      const suggested = plan.blocks.filter((b) => b.day === day).reduce((sum, b) => sum + b.hours, 0);
      const already = accepted.filter((b) => b.day === day).reduce((sum, b) => sum + b.hours, 0);
      expect(suggested + already).toBeLessThanOrEqual(hoursByWeekday[weekdayOf(day)]!);
    }
  });

  it('plans must items before should items when hours are short', () => {
    const plan = planWeek(input([target('should-first-due', addDays(TODAY, 2), 4, 'should'), target('must', addDays(TODAY, 2), 4)], 1));
    // Only 2h exist before the due day plus 1h on it; the must takes them all.
    expect(hoursFor(plan, 'must')).toBe(3);
    expect(hoursFor(plan, 'should-first-due')).toBe(0);
    expect(plan.overloaded).toBe(true);
    expect(plan.warnings.some((w) => w.includes('must') || w.startsWith('Have to do'))).toBe(true);
  });

  it('flags an overloaded week and says by how much', () => {
    const plan = planWeek(input([target('a', addDays(TODAY, 6), 10, 'should'), target('b', addDays(TODAY, 6), 10, 'should')], 2));
    expect(plan.available).toBe(14);
    expect(plan.needed).toBe(20);
    expect(plan.overloaded).toBe(true);
    expect(plan.warnings[0]).toContain('20h');
    expect(plan.warnings[0]).toContain('14h');
  });

  it('is not overloaded when everything fits', () => {
    const plan = planWeek(input([target('a', addDays(TODAY, 4), 3)], 2));
    expect(plan.overloaded).toBe(false);
    expect(plan.shortfalls).toEqual([]);
    expect(hoursFor(plan, 'a')).toBe(3);
  });

  it('splits long work into sittings of at most two hours and leaves the due day free when it can', () => {
    const plan = planWeek(input([target('a', addDays(TODAY, 4), 5)], 4));
    const blocks = plan.blocks.filter((b) => b.targetId === 'a');
    expect(blocks.every((b) => b.hours <= MAX_BLOCK)).toBe(true);
    expect(blocks.some((b) => b.day === addDays(TODAY, 4))).toBe(false);
    expect(blocks[0]!.why).toContain('1 of 3');
  });

  it('does not plan overdue work and warns about it instead', () => {
    const plan = planWeek(input([target('late', addDays(TODAY, -2), 2)]));
    expect(plan.blocks).toEqual([]);
    expect(plan.overdue.map((t) => t.id)).toEqual(['late']);
    expect(plan.warnings.join(' ')).toContain('"late" was due');
  });

  it('counts accepted hours toward the target, but not an accepted block from a past day left unticked', () => {
    const t = target('a', addDays(TODAY, 5), 4);
    const accepted = planWeek(input([t], 2, { accepted: [{ targetId: 'a', day: TODAY, hours: 2, done: false }] }));
    expect(hoursFor(accepted, 'a')).toBe(2);
    const missed = planWeek(input([t], 2, { accepted: [{ targetId: 'a', day: addDays(TODAY, -1), hours: 2, done: false }] }));
    expect(hoursFor(missed, 'a')).toBe(4);
  });

  it('gives a should item due after this week only its share of the week', () => {
    const plan = planWeek(input([target('later', addDays(TODAY, 13), 4, 'should')], 3));
    expect(hoursFor(plan, 'later')).toBe(2); // 7 of its 14 days fall in this week
    expect(plan.blocks[0]!.why).toContain('due after this week');
  });

  it('leaves work due past the two-week horizon for later', () => {
    const plan = planWeek(input([target('far', addDays(TODAY, 30), 3)]));
    expect(plan.blocks).toEqual([]);
    expect(plan.later.map((t) => t.id)).toEqual(['far']);
  });
});

describe('targets from the sample calendar', () => {
  const items = mergeItems(calendarItems(initialState, new Date(`${TODAY}T09:00:00`).getTime()), []);
  const ctx = effortContext(initialState);

  it('plans the Northwind application once, not once for the deadline and again for its apply step', () => {
    const targets = targetsFrom(items, ctx);
    const northwind = targets.filter((t) => t.id.includes('northwind'));
    expect(northwind.map((t) => t.id)).toEqual(['deadline-opp-northwind-swe']);
  });

  it('sizes an application by the parts still open', () => {
    const deadline = items.find((i) => i.id === 'deadline-opp-northwind-swe') as CxItem;
    // 2 prompts and 3 materials, the resume is ticked: 4 of 5 parts open.
    expect(estimateEffort(deadline, ctx)).toMatchObject({ hours: 3.5 });
  });

  it('only places blocks for real calendar items, on or before their own day', () => {
    const plan = planWeek({ today: TODAY, days: 7, hoursByWeekday: [2, 2, 2, 2, 2, 2, 3], targets: targetsFrom(items, ctx), accepted: [] });
    expect(plan.blocks.length).toBeGreaterThan(0);
    for (const block of plan.blocks) {
      const item = items.find((i) => i.id === block.targetId);
      expect(item).toBeDefined();
      expect(block.day <= item!.day).toBe(true);
    }
  });
});
