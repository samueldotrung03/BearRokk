import { describe, expect, it } from 'vitest';
import { initialState } from '../../data/sample.ts';
import type { AppState } from '../../state/store.ts';
import { answerRoadmap, matchStep, suggestionsFor } from './coach.ts';
import { buildCoachContext, DAY, daysLeft, estimateHours, whyStep, type CoachContext, type CoachStep } from './context.ts';
import { roadmapAsText } from './exportText.ts';
import { milestones, streak, syncDoneLog } from './milestones.ts';
import { pace, readiness } from './readiness.ts';
import { groupByWeek } from './timeline.ts';
import { planWeek, priority } from './week.ts';

const NOW = Date.UTC(2026, 10, 18, 12);
const inDays = (days: number) => new Date(NOW + days * DAY).toISOString();

const step = (id: string, over: Partial<CoachStep> = {}): CoachStep => ({
  id,
  title: `Step ${id}`,
  detail: `Detail for ${id}.`,
  kind: 'build',
  phase: 'Phase one',
  phaseId: 'p1',
  extra: false,
  due: null,
  done: false,
  hours: 2,
  evidence: null,
  requirement: null,
  opportunity: null,
  isNext: false,
  ...over,
});

const ctxOf = (steps: CoachStep[], over: Partial<CoachContext> = {}): CoachContext => ({
  goal: 'Test goal',
  summary: '',
  profile: initialState.profile,
  steps,
  requirements: [],
  profiles: 0,
  hoursPerWeek: 6,
  now: NOW,
  ...over,
});

const swe = (over: Partial<AppState> = {}) => buildCoachContext({ ...initialState, ...over }, 6, Date.now());

describe('estimateHours', () => {
  it('uses the hand-set hours, then the started-roadmap rules, then the step kind', () => {
    const base = { kind: 'learn' as const, title: '', detail: '', opportunityId: null, due: null };
    expect(estimateHours({ ...base, id: 'step-apply-northwind' })).toBe(1);
    expect(estimateHours({ ...base, id: 'extra-opp-x:review' })).toBe(1);
    expect(estimateHours({ ...base, id: 'extra-opp-x:prompt-2' })).toBe(1.5);
    expect(estimateHours({ ...base, id: 'extra-opp-x:attend' }, 'hackathon')).toBe(10);
    expect(estimateHours({ ...base, id: 'extra-opp-x:attend' }, 'event')).toBe(2);
    expect(estimateHours({ ...base, id: 'unknown-step', kind: 'apply' })).toBe(1.5);
  });
});

describe('buildCoachContext', () => {
  it('reflects the store: done marks, the next step, requirements met by a skill, and evidence counts', () => {
    const ctx = swe();
    expect(ctx.steps.find((s) => s.id === 'step-ds')?.done).toBe(true);
    expect(ctx.steps.filter((s) => s.isNext)).toHaveLength(1);
    expect(ctx.steps.find((s) => s.isNext)?.done).toBe(false);
    // Python is on the profile, so that requirement is met without any step.
    expect(ctx.requirements.find((r) => r.id === 'req-swe-lang')?.met).toBe(true);
    expect(ctx.requirements.find((r) => r.id === 'req-swe-sql')?.met).toBe(false);
    expect(ctx.profiles).toBe(12);
    expect(ctx.steps.find((s) => s.id === 'step-sql')?.evidence).toMatchObject({ count: 4, total: 12 });
  });

  it('adds the steps of a started opportunity roadmap without evidence', () => {
    const ctx = swe({ extraSteps: ['opp-bay-hack'] });
    const extras = ctx.steps.filter((s) => s.extra);
    expect(extras.length).toBeGreaterThan(0);
    expect(extras.every((s) => s.evidence === null && s.phase === 'Bay Builders Winter Hackathon')).toBe(true);
  });
});

describe('readiness', () => {
  it('is 100 when every step and requirement is done, and 0 when nothing is', () => {
    const all = ctxOf([step('a', { done: true }), step('b', { done: true })], {
      requirements: [{ id: 'r', label: 'R', met: true, skill: null, stepId: 'a' }],
    });
    expect(readiness(all).score).toBe(100);
    const none = ctxOf([step('a'), step('b')], { requirements: [{ id: 'r', label: 'R', met: false, skill: null, stepId: 'a' }] });
    expect(readiness(none).score).toBe(0);
  });

  it('rewards the step most people did more than a rare one', () => {
    const steps = (doneId: string) => [
      step('common', { done: doneId === 'common', evidence: { count: 9, total: 10, share: 0.9 } }),
      step('rare', { done: doneId === 'rare', evidence: { count: 1, total: 10, share: 0.1 } }),
    ];
    expect(readiness(ctxOf(steps('common'))).score).toBeGreaterThan(readiness(ctxOf(steps('rare'))).score);
  });
});

describe('pace', () => {
  it('is behind when an open step is past its date, even if the week is light', () => {
    const p = pace(ctxOf([step('late', { due: inDays(-2) }), step('ok', { due: inDays(20) })]));
    expect(p.status).toBe('behind');
    expect(p.overdue.map((s) => s.id)).toEqual(['late']);
  });

  it('is tight when this week needs more hours than the student has, and on track when it fits', () => {
    const steps = [step('a', { due: inDays(2), hours: 4 }), step('b', { due: inDays(6), hours: 4 })];
    expect(pace(ctxOf(steps, { hoursPerWeek: 6 })).status).toBe('tight');
    expect(pace(ctxOf(steps, { hoursPerWeek: 10 })).status).toBe('on_track');
    // A done step does not count against the week.
    expect(pace(ctxOf([{ ...steps[0]!, done: true }, steps[1]!], { hoursPerWeek: 6 })).status).toBe('on_track');
  });
});

describe('planWeek', () => {
  it('never plans more hours than given and puts dated, urgent steps before undated ones', () => {
    const ctx = ctxOf([
      step('undated', { hours: 2 }),
      step('soon', { due: inDays(2), hours: 2 }),
      step('later', { due: inDays(25), hours: 2 }),
    ]);
    const plan = planWeek(ctx, 4);
    expect(plan.used).toBeLessThanOrEqual(4);
    expect(plan.picks.map((p) => p.step.id)).toEqual(['soon', 'later']);
  });

  it('skips a step too big for the time, fits smaller ones, then starts the big urgent one with what is left', () => {
    const ctx = ctxOf([step('big', { due: inDays(3), hours: 10 }), step('small', { due: inDays(4), hours: 2 })]);
    const plan = planWeek(ctx, 5);
    expect(plan.picks[0]).toMatchObject({ partial: false });
    expect(plan.picks[0]!.step.id).toBe('small');
    expect(plan.picks[1]).toMatchObject({ partial: true, hours: 3 });
    expect(plan.picks[1]!.step.id).toBe('big');
    expect(plan.used).toBe(5);
  });

  it('lists urgent steps that did not fit at all', () => {
    const ctx = ctxOf([step('a', { due: inDays(1), hours: 3 }), step('b', { due: inDays(2), hours: 3 })]);
    const plan = planWeek(ctx, 3);
    expect(plan.picks.map((p) => p.step.id)).toEqual(['a']);
    expect(plan.leftOut.map((l) => l.step.id)).toEqual(['b']);
  });

  it('ranks equally urgent steps by how many people did them', () => {
    const common = step('c', { due: inDays(10), evidence: { count: 8, total: 10, share: 0.8 } });
    const rare = step('r', { due: inDays(10), evidence: { count: 1, total: 10, share: 0.1 } });
    expect(priority(common, NOW)).toBeGreaterThan(priority(rare, NOW));
  });

  it('says so when everything is done', () => {
    expect(planWeek(ctxOf([step('a', { done: true })]), 5).summary).toMatch(/Every step is done/);
  });
});

describe('coach', () => {
  it('plans the week with the hours named in the question, and offers to open that plan', () => {
    const answer = answerRoadmap('I only have 3 hours this week, what should I do?', swe());
    expect(answer.intent).toBe('week');
    expect(answer.actions).toContainEqual(expect.objectContaining({ type: 'planWeek', hours: 3 }));
    expect(answer.text).toContain('3h');
  });

  it('answers "why" for the step the question names, with its real evidence count', () => {
    const ctx = swe();
    const answer = answerRoadmap('Why should I learn SQL?', ctx);
    expect(answer.intent).toBe('why');
    expect(answer.text).toContain('Learn SQL');
    expect(answer.bullets[0]).toContain('4 of the 12 people');
    expect(answer.actions).toContainEqual(expect.objectContaining({ type: 'tick', stepId: 'step-sql' }));
  });

  it('explains the next step when "why this step" names none', () => {
    const ctx = swe();
    const next = ctx.steps.find((s) => s.isNext)!;
    expect(answerRoadmap('Why this step?', ctx).text).toContain(next.title);
  });

  it('lists the unmet requirements for "what am I missing"', () => {
    const answer = answerRoadmap('What am I missing?', swe());
    expect(answer.intent).toBe('missing');
    expect(answer.bullets.some((b) => b.startsWith('SQL for joins and aggregates'))).toBe(true);
    expect(answer.bullets.some((b) => b.startsWith('Data structures'))).toBe(false);
  });

  it('reports pace from the due dates', () => {
    const ctx = ctxOf([step('late', { title: 'Write the cover letter', due: inDays(-1) })]);
    const answer = answerRoadmap('Am I on track?', ctx);
    expect(answer.intent).toBe('pace');
    expect(answer.text).toMatch(/^Behind/);
  });

  it('does not invent an answer for something the roadmap has no data on', () => {
    const answer = answerRoadmap('What salary will I get?', swe());
    expect(answer.intent).toBe('unknown');
    expect(answer.text).toMatch(/will not guess/);
  });

  it('refuses to guess about topics the roadmap has no data on, even when worded like a requirement', () => {
    const answer = answerRoadmap('What GPA requirement do I need?', swe());
    expect(answer.intent).toBe('unknown');
    expect(answer.text).toContain('nothing on GPA');
  });

  it('says readiness is not a prediction of an offer', () => {
    expect(answerRoadmap('What are my chances?', swe()).text).toMatch(/not your odds/);
  });

  it('offers a one-click tick when asked to mark a step done, without changing anything itself', () => {
    const answer = answerRoadmap('mark the hackathon done', swe());
    expect(answer.intent).toBe('stepDone');
    expect(answer.actions[0]).toMatchObject({ type: 'tick', stepId: 'step-hack' });
  });

  it('matches steps by title words and prefers an open step on a tie', () => {
    const steps = [step('x', { title: 'Build the project', done: true }), step('y', { title: 'Polish the project' })];
    expect(matchStep('the project', steps)?.id).toBe('y');
    expect(matchStep('what should I do', steps)).toBeUndefined();
  });

  it('suggests a question about the actual next step', () => {
    const ctx = swe();
    const next = ctx.steps.find((s) => s.isNext)!;
    expect(suggestionsFor(ctx).some((q) => q.includes(next.title.slice(0, 20)))).toBe(true);
  });
});

describe('daysLeft', () => {
  it('counts calendar days, so a step dated later today is due today, not tomorrow', () => {
    const morning = new Date(2026, 10, 18, 9).getTime();
    expect(daysLeft(new Date(2026, 10, 18, 21).toISOString(), morning)).toBe(0);
    expect(daysLeft(new Date(2026, 10, 19, 1).toISOString(), morning)).toBe(1);
    expect(daysLeft(new Date(2026, 10, 17, 23).toISOString(), morning)).toBe(-1);
  });
});

describe('whyStep', () => {
  it('says there is no evidence instead of making a reason up', () => {
    expect(whyStep(step('a'), ctxOf([]))[0]).toMatch(/no profile evidence/);
  });
});

describe('done log and streak', () => {
  it('records old done steps without a date on the first run, and dates new ones', () => {
    const first = syncDoneLog(null, ['a'], '2026-11-18T00:00:00.000Z');
    expect(first).toEqual({ a: null });
    const later = syncDoneLog(first, ['a', 'b'], '2026-11-19T00:00:00.000Z');
    expect(later).toEqual({ a: null, b: '2026-11-19T00:00:00.000Z' });
    expect(syncDoneLog(later, ['b'], 'x')).toEqual({ b: '2026-11-19T00:00:00.000Z' });
  });

  it('counts weeks in a row, ignores undated entries, and keeps a streak alive before this week has one', () => {
    const iso = (days: number) => new Date(NOW - days * DAY).toISOString();
    expect(streak({ a: iso(1), b: iso(8), c: iso(15), d: null }, NOW)).toEqual({ weeks: 3, thisWeek: 1 });
    expect(streak({ b: iso(8), c: iso(15) }, NOW)).toEqual({ weeks: 2, thisWeek: 0 });
    expect(streak({ c: iso(15) }, NOW).weeks).toBe(0);
  });

  it('marks milestones and says what is left', () => {
    const ms = milestones(ctxOf([step('a', { done: true }), step('b'), step('c'), step('d')]));
    expect(ms.find((m) => m.id === 'first')?.reached).toBe(true);
    expect(ms.find((m) => m.id === 'half')).toMatchObject({ reached: false, toGo: '1 step to go' });
  });
});

describe('timeline', () => {
  it('puts overdue first, then weeks in order, then steps without a date', () => {
    const buckets = groupByWeek(
      [step('n'), step('w2', { due: inDays(15) }), step('late', { due: inDays(-3) }), step('w0', { due: inDays(2) })],
      NOW,
    );
    expect(buckets.map((b) => b.label.split(' ')[0])).toEqual(['Overdue', 'This', 'Week', 'No']);
    expect(buckets[2]!.index).toBe(2);
  });
});

describe('roadmapAsText', () => {
  it('writes tick boxes, estimates and the student\'s notes', () => {
    const text = roadmapAsText(swe(), { 'step-sql': 'Ask Sam  for\nthe course notes' });
    expect(text).toContain('[x] Finish the data structures course');
    expect(text).toContain('[ ] Learn SQL well enough to join and aggregate');
    expect(text).toContain('Note: Ask Sam for the course notes');
  });
});
