import { describe, expect, it } from 'vitest';
import { initialState, opportunities } from '../../data/sample.ts';
import type { AppState } from '../../state/store.ts';
import type { Opportunity } from '../../types.ts';
import { currentRoadmap } from '../roadmap.ts';
import {
  briefSentence,
  buildToday,
  calendarDaysUntil,
  candidateActions,
  closingThisWeek,
  dueText,
  newForYou,
  rankTodayActions,
  type TodayAction,
} from './today.ts';

const DAY = 86_400_000;
const NOW = Date.now();
// Noon a given number of days from now, so the calendar-day count is the same in every time zone.
const inDays = (days: number) => {
  const d = new Date(NOW + days * DAY);
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 12).toISOString();
};

function action(overrides: Partial<TodayAction> & { id: string }): TodayAction {
  return {
    title: overrides.id,
    subject: null,
    reason: 'Because.',
    source: 'step',
    priority: 'should',
    due: null,
    daysLeft: null,
    opportunityId: null,
    cta: { kind: 'tick', stepId: overrides.id, label: 'Mark done' },
    ...overrides,
  };
}

function posting(id: string, title: string, deadline: string | null): Opportunity {
  return { ...opportunities[0]!, id, title, organizer: 'Test Org', deadline, startTime: null };
}

/** A student who has done nothing yet. */
const fresh: AppState = { ...initialState, applications: {}, saved: [], liked: [], dismissed: [], opened: [], extraSteps: [], doneSteps: [] };
const allPlannedSteps = currentRoadmap(fresh.goalId).phases.flatMap((phase) => phase.steps.map((step) => step.id));

describe('ranking the day', () => {
  it('puts what the student committed to before what would help, even when the help is sooner', () => {
    const ranked = rankTodayActions([
      action({ id: 'should-today', daysLeft: 0 }),
      action({ id: 'must-later', priority: 'must', daysLeft: 6 }),
    ]);
    expect(ranked.map((a) => a.id)).toEqual(['must-later', 'should-today']);
  });

  it('puts overdue items first within the same priority, and undated ones last', () => {
    const ranked = rankTodayActions([
      action({ id: 'undated' }),
      action({ id: 'tomorrow', daysLeft: 1 }),
      action({ id: 'overdue', daysLeft: -2 }),
    ]);
    expect(ranked.map((a) => a.id)).toEqual(['overdue', 'tomorrow', 'undated']);
  });

  it('keeps one action per opportunity and at most three', () => {
    const ranked = rankTodayActions([
      action({ id: 'a1', opportunityId: 'x', daysLeft: 1 }),
      action({ id: 'a2', opportunityId: 'x', daysLeft: 0 }),
      action({ id: 'b', daysLeft: 2 }),
      action({ id: 'c', daysLeft: 3 }),
      action({ id: 'd', daysLeft: 4 }),
    ]);
    expect(ranked.map((a) => a.id)).toEqual(['a2', 'b', 'c']);
  });

  it('ranks a tracked application above the roadmap steps', () => {
    const o = posting('test-swe', 'Test Engineering Intern', inDays(5));
    const state: AppState = { ...fresh, applications: { [o.id]: { status: 'applying', drafts: {}, materialsDone: [] } } };
    const [first] = rankTodayActions(candidateActions(state, [o], NOW));
    expect(first).toMatchObject({ source: 'application', priority: 'must', opportunityId: o.id, daysLeft: 5 });
  });
});

describe('no invented dates', () => {
  it('shows a tracked posting with no deadline as having none, and the brief names no date', () => {
    const o = posting('test-open', 'Open Role', null);
    const state: AppState = { ...fresh, applications: { [o.id]: { status: 'to_apply', drafts: {}, materialsDone: [] } }, doneSteps: allPlannedSteps };
    const today = buildToday(state, [o], NOW);
    const app = today.actions.find((a) => a.opportunityId === o.id)!;
    expect(app).toMatchObject({ due: null, daysLeft: null, title: 'Confirm the deadline' });
    expect(dueText(app)).toBe('No deadline listed');
    expect(today.closing).toEqual([]);
    expect(today.brief).toBe('The most useful thing today: Confirm the deadline for Open Role.');
    expect(today.brief).not.toMatch(/due|closing|days/);
  });

  it('says a step has no date rather than giving it one', () => {
    expect(dueText({ source: 'step', daysLeft: null })).toBe('No date set');
    expect(dueText({ source: 'step', daysLeft: -1 })).toBe('1 day overdue');
  });

  it('counts calendar days, not hours', () => {
    const tonight = new Date(new Date(NOW).setHours(23, 59, 0, 0)).toISOString();
    expect(calendarDaysUntil(tonight, NOW)).toBe(0);
    expect(calendarDaysUntil(inDays(3), NOW)).toBe(3);
  });
});

describe('the brief', () => {
  it('leads with something overdue', () => {
    const actions = [action({ id: 'Finish the resume', daysLeft: -1 }), action({ id: 'other', daysLeft: 2 })];
    expect(briefSentence({ actions, closing: [], fresh: false })).toBe('One thing is overdue: Finish the resume. Start there.');
  });

  it('names the one thing of the student\'s that closes this week, with days left', () => {
    const o = posting('test-close', 'Northwind Intern', inDays(3));
    const state: AppState = { ...fresh, saved: [o.id], doneSteps: allPlannedSteps };
    const today = buildToday(state, [o], NOW);
    expect(today.closing).toMatchObject([{ daysLeft: 3, mine: true, label: 'Saved' }]);
    expect(today.brief).toBe('One thing closes this week: Northwind Intern, in 3 days.');
  });

  it('counts several closing things and names the soonest', () => {
    const a = posting('test-a', 'Alpha', inDays(6));
    const b = posting('test-b', 'Beta', inDays(1));
    const state: AppState = { ...fresh, applications: { [a.id]: { status: 'applying', drafts: {}, materialsDone: [] } }, liked: [b.id] };
    const closing = closingThisWeek(state, [a, b], NOW);
    expect(closing.map((c) => c.opportunity.id)).toEqual(['test-b', 'test-a']);
    expect(briefSentence({ actions: [], closing, fresh: false })).toBe('Two things close this week. The first is Beta, closing tomorrow.');
  });

  it('points to the feed when nothing of the student\'s own closes', () => {
    const o = posting('test-feed', 'Gamma', inDays(4));
    const closing = closingThisWeek(fresh, [o], NOW);
    expect(closing).toMatchObject([{ mine: false, label: 'In your feed' }]);
    expect(briefSentence({ actions: [], closing, fresh: true })).toBe('Nothing of yours is due. In your feed, Gamma closes in 4 days.');
  });

  it('leaves out applied and dismissed postings and anything past or more than a week away', () => {
    const list = [
      posting('test-applied', 'Applied', inDays(2)),
      posting('test-dismissed', 'Dismissed', inDays(2)),
      posting('test-past', 'Past', inDays(-1)),
      posting('test-far', 'Far', inDays(8)),
    ];
    const state: AppState = {
      ...fresh,
      applications: { 'test-applied': { status: 'applied', drafts: {}, materialsDone: [] } },
      dismissed: ['test-dismissed'],
      saved: ['test-past', 'test-far'],
    };
    expect(closingThisWeek(state, list, NOW)).toEqual([]);
  });
});

describe('a brand-new student', () => {
  it('gets an empty day that points to the feed, with nothing made up', () => {
    const today = buildToday({ ...fresh, doneSteps: allPlannedSteps }, [], NOW);
    expect(today.fresh).toBe(true);
    expect(today.actions).toEqual([]);
    expect(today.closing).toEqual([]);
    expect(today.brief).toBe('Nothing is due yet. Save a few things from your feed and they will show up here.');
    expect(today.questions).toContain('Which career path fits me?');
  });

  it('only sees roadmap steps, never an application they did not start', () => {
    const today = buildToday(fresh, opportunities, NOW);
    expect(today.actions.length).toBeGreaterThan(0);
    expect(today.actions.every((a) => a.source === 'step')).toBe(true);
    expect(today.progress).toMatchObject({ tracked: 0, saved: 0, applications: [] });
  });
});

describe('new for you', () => {
  it('skips cards the student opened, saved, dismissed or is tracking', () => {
    const [a, b, c, d] = opportunities.map((o) => o.id);
    const state: AppState = { ...fresh, opened: [a!], saved: [b!], dismissed: [c!], applications: { [d!]: { status: 'interested', drafts: {}, materialsDone: [] } } };
    const items = newForYou(state, opportunities, NOW);
    expect(items).toHaveLength(3);
    for (const item of items) expect([a, b, c, d]).not.toContain(item.opportunity.id);
    expect(items.every((item) => item.signal.length > 0)).toBe(true);
  });
});
