import { describe, expect, it } from 'vitest';
import { initialState, opportunities } from '../../data/sample.ts';
import type { CxItem } from '../cal/items.ts';
import { goalNeeds, headline, pipeline, profileStrength, quickReminder, roadmapGlance, upcoming, weekStrip, whenText } from './dashboard.ts';

const item = (over: Partial<CxItem>): CxItem => ({
  id: over.id ?? `${over.day}-${over.title ?? 'x'}`,
  date: `${over.day}T17:00:00`,
  day: '2026-11-19',
  title: 'Something',
  kind: 'deadline',
  priority: 'should',
  why: '',
  opportunityId: null,
  stepId: null,
  done: false,
  personalId: null,
  note: '',
  hours: null,
  ...over,
});

const today = '2026-11-19';

describe('dashboard', () => {
  it('lays out seven days from today and counts what is open on each', () => {
    const week = weekStrip([item({ day: today, priority: 'must' }), item({ day: '2026-11-21', title: 'a' }), item({ day: '2026-11-21', title: 'b', done: true }), item({ day: '2026-11-30' })], today);
    expect(week).toHaveLength(7);
    expect(week[0]).toMatchObject({ isToday: true, weekday: 'Thu', date: 19, must: 1, should: 0 });
    expect(week[2]).toMatchObject({ weekday: 'Sat', should: 1, done: 1 });
    expect(week.at(-1)!.day).toBe('2026-11-25');
  });

  it('lists what is coming up: overdue first, then soonest, never finished items', () => {
    const list = upcoming([item({ day: '2026-11-22', title: 'later' }), item({ day: '2026-11-17', title: 'late' }), item({ day: today, title: 'done', done: true }), item({ day: '2027-03-01', title: 'far' })], today);
    expect(list.map((u) => u.item.title)).toEqual(['late', 'later']);
    expect(list[0]!.daysAway).toBe(-2);
    expect([whenText(-2), whenText(0), whenText(1), whenText(5)]).toEqual(['2 days late', 'Today', 'Tomorrow', 'In 5 days']);
  });

  it('puts a committed item ahead of an optional one on the same day', () => {
    const list = upcoming([item({ day: today, title: 'optional' }), item({ day: today, title: 'committed', priority: 'must' })], today);
    expect(list[0]!.item.title).toBe('committed');
  });

  it('counts the week, overdue items and applications for the headline', () => {
    const numbers = headline(initialState, [item({ day: today }), item({ day: '2026-11-25', title: 'edge' }), item({ day: '2026-11-26', title: 'next week' }), item({ day: '2026-11-10', title: 'late' })], today);
    expect(numbers).toMatchObject({ dueThisWeek: 2, dueToday: 1, overdue: 1 });
    const statuses = Object.values(initialState.applications).map((a) => a.status);
    expect(numbers.tracked).toBe(statuses.length);
    expect(numbers.inProgress + numbers.applied).toBe(statuses.length);
  });

  it('groups every tracked application by stage, in pipeline order', () => {
    const byId = new Map(opportunities.map((o) => [o.id, o]));
    const stages = pipeline(initialState, byId, Date.parse('2026-11-19T12:00:00'));
    expect(stages.map((s) => s.status)).toEqual(['interested', 'to_apply', 'applying', 'applied']);
    expect(stages.reduce((sum, s) => sum + s.count, 0)).toBe(Object.keys(initialState.applications).length);
    for (const stage of stages) for (const app of stage.items) expect(app.readiness).toBeGreaterThanOrEqual(0);
  });

  it('shows the next unfinished roadmap steps and drops one once it is ticked', () => {
    const before = roadmapGlance(initialState);
    expect(before.next.length).toBeGreaterThan(0);
    const first = before.next[0]!.id;
    const after = roadmapGlance({ ...initialState, doneSteps: [...initialState.doneSteps, first] });
    expect(after.next.map((s) => s.id)).not.toContain(first);
    expect(after.done).toBe(before.done + 1);
  });

  it('counts a goal requirement as met by a profile skill or a finished step, missing ones first', () => {
    const before = goalNeeds({ ...initialState, doneSteps: [], profile: { ...initialState.profile, skills: [] } });
    expect(before.met).toBe(0);
    const withStep = before.needs.length > 0 ? goalNeeds({ ...initialState, profile: { ...initialState.profile, skills: [] }, doneSteps: initialState.doneSteps }) : before;
    expect(withStep.total).toBe(before.total);
    const all = goalNeeds(initialState);
    const firstMet = all.needs.findIndex((n) => n.met);
    if (firstMet >= 0) expect(all.needs.slice(firstMet).every((n) => n.met)).toBe(true);
  });

  it('scores the profile by what is filled in', () => {
    const empty = profileStrength({ ...initialState, preferences: undefined, profile: { ...initialState.profile, major: '', about: '', skills: [], interests: [], careerInterests: [] } });
    expect(empty.percent).toBe(0);
    const some = profileStrength({ ...initialState, preferences: undefined, profile: { ...initialState.profile, major: 'Biology', about: '', skills: ['a', 'b', 'c'], interests: [], careerInterests: [] } });
    expect(some.checks.filter((c) => c.done).map((c) => c.id).sort()).toEqual(['major', 'skills']);
    expect(some.checks[0]!.done).toBe(false);
  });

  it('makes a dashboard reminder in the shape the calendar keeps', () => {
    expect(quickReminder('  Email my advisor ', '2026-11-20', 'own-1')).toEqual({ id: 'own-1', day: '2026-11-20', title: 'Email my advisor', priority: 'must', note: '', done: false, block: null });
  });
});
