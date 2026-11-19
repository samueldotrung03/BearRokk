import { describe, expect, it } from 'vitest';
import { opportunities } from '../../data/sample.ts';
import { googleCalendarUrl } from '../applications.ts';
import { buildBrief } from './brief.ts';
import { addDays, dayLabel } from './days.ts';
import { icsCalendar, googleUrlFor } from './export.ts';
import { allFilters, dayLoad, findConflicts, fromPersonal, matchesFilters, type CxItem } from './items.ts';
import { planWeek } from './planner.ts';

const TODAY = '2026-11-18';
const item = (over: Partial<CxItem>): CxItem => ({
  id: over.id ?? 'x',
  date: `${over.day ?? TODAY}T12:00:00.000Z`,
  day: TODAY,
  title: 'Item',
  kind: 'deadline',
  priority: 'must',
  why: 'Because.',
  opportunityId: null,
  stepId: null,
  done: false,
  personalId: null,
  note: '',
  hours: null,
  ...over,
});

describe('findConflicts', () => {
  it('flags a day with two separate commitments', () => {
    const conflicts = findConflicts([item({ id: 'a', opportunityId: 'o1' }), item({ id: 'b', kind: 'starts', opportunityId: 'o2' })]);
    expect(conflicts).toHaveLength(1);
    expect(conflicts[0]!.items.map((i) => i.id)).toEqual(['a', 'b']);
  });

  it('treats a deadline and the step to submit that same application as one commitment', () => {
    const list = [item({ id: 'deadline', opportunityId: 'o1' }), item({ id: 'step', kind: 'step', stepId: 's', opportunityId: 'o1' })];
    expect(findConflicts(list)).toEqual([]);
  });

  it('ignores reminders, should items, finished items and accepted work blocks', () => {
    const list = [
      item({ id: 'a', opportunityId: 'o1' }),
      item({ id: 'r', kind: 'reminder', opportunityId: 'o2' }),
      item({ id: 's', priority: 'should', opportunityId: 'o3' }),
      item({ id: 'd', done: true, opportunityId: 'o4' }),
      item({ id: 'blk', kind: 'personal', hours: 2 }),
    ];
    expect(findConflicts(list)).toEqual([]);
  });

  it('counts a personal must task against a deadline', () => {
    const own = fromPersonal({ id: 'p1', day: TODAY, title: 'Midterm', priority: 'must', note: '', done: false, block: null });
    expect(findConflicts([item({ id: 'a', opportunityId: 'o1' }), own])).toHaveLength(1);
  });
});

describe('dayLoad and filters', () => {
  it('weighs musts double and ignores reminders and done items', () => {
    expect(dayLoad([]).level).toBe(0);
    expect(dayLoad([item({ priority: 'should' })]).score).toBe(1);
    expect(dayLoad([item({}), item({ kind: 'reminder' }), item({ done: true })]).score).toBe(2);
    expect(dayLoad([item({}), item({}), item({ priority: 'should' })]).level).toBe(3);
    expect(dayLoad([item({ priority: 'should' })], 3).level).toBe(2);
  });

  it('hides items whose kind or priority is turned off', () => {
    const own = item({ kind: 'personal' });
    expect(matchesFilters(own, allFilters)).toBe(true);
    expect(matchesFilters(own, { ...allFilters, kinds: ['deadline'] })).toBe(false);
    expect(matchesFilters(item({ priority: 'should' }), { ...allFilters, priorities: ['must'] })).toBe(false);
  });
});

describe('buildBrief', () => {
  const items = [
    item({ id: 'today-step', kind: 'step', priority: 'should', title: 'Read the posting' }),
    item({ id: 'dl', day: addDays(TODAY, 3), title: 'Northwind internship', opportunityId: 'o1', why: 'You marked this "To apply". More.' }),
    item({ id: 'ev', day: addDays(TODAY, 3), kind: 'starts', title: 'Robotics night', opportunityId: 'o2' }),
  ];
  const brief = buildBrief({ today: TODAY, name: 'Maya', items, conflicts: findConflicts(items), plan: null });
  const text = [brief.headline, ...brief.lines.map((l) => l.text)].join(' ');

  it('names only items that are on the calendar', () => {
    const quoted = [...text.matchAll(/"([^"]+)"/g)].map((m) => m[1]);
    const known = new Set([...items.map((i) => i.title), 'To apply']);
    expect(quoted.length).toBeGreaterThan(0);
    for (const title of quoted) expect(known.has(title!)).toBe(true);
  });

  it('leads with the next must when nothing is due today, and warns about the clash', () => {
    expect(brief.headline).toContain('Nothing is due today');
    expect(brief.headline).toContain('Northwind internship');
    const warn = brief.lines.find((l) => l.tone === 'warn');
    expect(warn?.day).toBe(addDays(TODAY, 3));
    expect(warn?.text).toContain(dayLabel(addDays(TODAY, 3), TODAY));
  });

  it('passes on an overloaded plan', () => {
    const plan = planWeek({
      today: TODAY,
      days: 7,
      hoursByWeekday: Array(7).fill(0.5),
      targets: [{ id: 'dl', title: 'Northwind internship', due: addDays(TODAY, 3), priority: 'must', hours: 4, basis: '', reason: '' }],
      accepted: [],
    });
    const withPlan = buildBrief({ today: TODAY, name: 'Maya', items, conflicts: [], plan });
    expect(withPlan.lines.some((l) => l.text.includes('Plan my week shows what does not fit'))).toBe(true);
  });
});

describe('export', () => {
  const list = [
    item({ id: 'a', title: 'Hackathon, team signup; bring laptop', why: 'A very long reason '.repeat(10) }),
    item({ id: 'b', day: '2026-12-31', kind: 'personal' }),
  ];
  const ics = icsCalendar(list, new Date('2026-11-18T10:00:00Z'));

  it('writes one all-day event per item, ending the next day, across a year end', () => {
    expect(ics.match(/BEGIN:VEVENT/g)).toHaveLength(2);
    expect(ics).toContain('DTSTART;VALUE=DATE:20261231');
    expect(ics).toContain('DTEND;VALUE=DATE:20270101');
  });

  it('escapes commas and semicolons and keeps lines within 75 octets', () => {
    expect(ics).toContain('Hackathon\\, team signup\\; bring laptop');
    for (const line of ics.split('\r\n')) expect(new TextEncoder().encode(line).length).toBeLessThanOrEqual(75);
  });

  it('uses the shared Google Calendar link for application deadlines', () => {
    const o = opportunities.find((x) => x.deadline)!;
    expect(googleUrlFor(item({ kind: 'deadline', opportunityId: o.id }), o)).toBe(googleCalendarUrl(o));
    expect(googleUrlFor(item({ kind: 'step', day: '2026-11-20' }))).toContain('dates=20261120%2F20261121');
  });
});

describe('conflictAdvice', () => {
  it('points at the plan when it already starts one of the clashing items earlier', async () => {
    const { conflictAdvice } = await import('./brief.ts');
    const day = addDays(TODAY, 3);
    const list = [item({ id: 'a', day, title: 'A', opportunityId: 'o1' }), item({ id: 'b', day, title: 'B', kind: 'starts', opportunityId: 'o2' })];
    const [conflict] = findConflicts(list);
    const plan = planWeek({
      today: TODAY,
      days: 7,
      hoursByWeekday: Array(7).fill(2),
      targets: [{ id: 'a', title: 'A', due: day, priority: 'must', hours: 2, basis: '', reason: '' }],
      accepted: [],
    });
    expect(conflictAdvice(conflict!, plan, TODAY)).toContain('Your plan already starts "A" today');
    expect(conflictAdvice(conflict!, null, TODAY)).toContain('a day or two earlier');
  });
});
