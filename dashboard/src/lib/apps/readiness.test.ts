import { describe, expect, it } from 'vitest';
import { applicationInfo, initialState, opportunities } from '../../data/sample.ts';
import type { Application, ApplicationStatus, Opportunity } from '../../types.ts';
import { funnelCounts, matchesQuery, neighborStatus, sortItems } from './board.ts';
import { allDeadlinesIcs, exportable } from './export.ts';
import { followUpSteps, interviewQuestions } from './followup.ts';
import { draftState, rankActions, readinessOf } from './readiness.ts';

const NOW = Date.parse('2026-11-18T12:00:00Z');
const DAY = 86_400_000;
const base = opportunities.find((o) => o.id === 'opp-northwind-swe') as Opportunity;
const info = applicationInfo['opp-northwind-swe'];
const withDeadline = (days: number | null): Opportunity => ({
  ...base,
  deadline: days === null ? null : new Date(NOW + days * DAY).toISOString(),
});
const app = (status: ApplicationStatus, extra: Partial<Application> = {}): Application => ({ status, drafts: {}, materialsDone: [], ...extra });
const words = (n: number) => Array.from({ length: n }, () => 'word').join(' ');

describe('readiness', () => {
  it('treats a draft as ready only inside the stated limit and with no blanks left', () => {
    const prompt = 'Why? (150 words)';
    expect(draftState(prompt, '')).toBe('empty');
    expect(draftState(prompt, words(40))).toBe('started');
    expect(draftState(prompt, words(120))).toBe('ready');
    expect(draftState(prompt, words(160))).toBe('started');
    expect(draftState(prompt, `${words(120)} [your project]`)).toBe('started');
  });

  it('never assumes a deadline: with none on the posting, the next step is to confirm it', () => {
    const r = readinessOf(withDeadline(null), app('to_apply'), info, NOW);
    expect(r.daysLeft).toBeNull();
    expect(r.next.kind).toBe('confirm_deadline');
  });

  it('walks the next action from drafting to gathering to submitting', () => {
    const o = withDeadline(9);
    expect(readinessOf(o, app('to_apply'), info, NOW).next).toMatchObject({ kind: 'draft', promptIndex: 0 });
    const drafted = { 0: words(150), 1: words(120) };
    expect(readinessOf(o, app('applying', { drafts: drafted }), info, NOW).next).toMatchObject({ kind: 'gather', material: 'Resume (PDF)' });
    const all = app('applying', { drafts: drafted, materialsDone: info!.materials });
    const done = readinessOf(o, all, info, NOW);
    expect(done.next.kind).toBe('submit');
    expect(done.score).toBe(100);
  });

  it('offers a one-click move for an application that is only Interested', () => {
    expect(readinessOf(withDeadline(9), app('interested'), info, NOW).next).toMatchObject({ kind: 'decide', moveTo: 'to_apply' });
  });

  it('scores more finished work higher, and less time left lower', () => {
    const half = app('applying', { drafts: { 0: words(150) }, materialsDone: ['Resume (PDF)'] });
    expect(readinessOf(withDeadline(9), half, info, NOW).score).toBeGreaterThan(readinessOf(withDeadline(9), app('applying'), info, NOW).score);
    expect(readinessOf(withDeadline(30), half, info, NOW).score).toBeGreaterThan(readinessOf(withDeadline(1), half, info, NOW).score);
  });

  it('ranks the close deadline with work left above a far one, and applied last', () => {
    const items = [
      { id: 'far', readiness: readinessOf(withDeadline(30), app('to_apply'), info, NOW) },
      { id: 'sent', readiness: readinessOf(withDeadline(2), app('applied'), info, NOW) },
      { id: 'soon', readiness: readinessOf(withDeadline(2), app('applying'), info, NOW) },
    ];
    expect(rankActions(items).map((a) => a.id)).toEqual(['soon', 'far', 'sent']);
  });

  it('marks a passed deadline closed instead of suggesting work', () => {
    expect(readinessOf(withDeadline(-3), app('applying'), info, NOW).next.kind).toBe('closed');
  });
});

describe('board', () => {
  it('moves one column at a time and stops at the ends', () => {
    expect(neighborStatus('interested', 1)).toBe('to_apply');
    expect(neighborStatus('applied', -1)).toBe('applying');
    expect(neighborStatus('interested', -1)).toBeNull();
    expect(neighborStatus('applied', 1)).toBeNull();
  });

  it('sorts by deadline with no-deadline postings last', () => {
    const items = [withDeadline(null), withDeadline(20), withDeadline(3)].map((o, i) => ({ opportunity: { ...o, id: `o${i}` }, score: 0 }));
    expect(sortItems(items, 'deadline').map((i) => i.opportunity.id)).toEqual(['o2', 'o1', 'o0']);
  });

  it('searches across organizer and tags with every word required', () => {
    expect(matchesQuery(base, 'northwind python')).toBe(true);
    expect(matchesQuery(base, 'northwind sql')).toBe(false);
  });

  it('counts each status for the funnel', () => {
    expect(funnelCounts(['applied', 'to_apply', 'applied'])).toEqual({ interested: 0, to_apply: 1, applying: 0, applied: 2 });
  });
});

describe('deadline export', () => {
  const items = [
    { opportunity: { ...withDeadline(9), id: 'a' }, status: 'to_apply' as const },
    { opportunity: { ...withDeadline(12), id: 'b' }, status: 'interested' as const },
    { opportunity: { ...withDeadline(4), id: 'c' }, status: 'applied' as const },
    { opportunity: { ...withDeadline(null), id: 'd' }, status: 'applying' as const },
  ];

  it('includes unsent applications with a deadline and leaves out applied and undated ones', () => {
    expect(exportable(items).map((i) => i.opportunity.id)).toEqual(['a', 'b']);
    const ics = allDeadlinesIcs(items)!;
    expect(ics.match(/BEGIN:VEVENT/g)).toHaveLength(2);
    expect(ics).toContain('UID:a@bearrok');
    expect(ics).not.toContain('UID:c@bearrok');
  });

  it('adds the three reminders only while the student still has to apply', () => {
    const ics = allDeadlinesIcs(items)!;
    const [eventA, eventB] = ics.split('BEGIN:VEVENT').slice(1) as [string, string];
    expect(eventA.match(/BEGIN:VALARM/g)).toHaveLength(3);
    expect(eventB).not.toContain('VALARM');
  });

  it('returns nothing when no tracked posting has a deadline', () => {
    expect(allDeadlinesIcs([items[3]!])).toBeNull();
  });
});

describe('after applying', () => {
  it('builds interview questions from the posting and says where each came from', () => {
    const questions = interviewQuestions(base, info, initialState.profile);
    expect(questions[0]!.question).toContain('Northwind Robotics');
    expect(questions.some((q) => q.question.includes('Python') && q.from.includes('your profile'))).toBe(true);
    expect(questions.some((q) => q.question.includes('robotics software'))).toBe(true);
    expect(questions.every((q) => q.from.length > 0)).toBe(true);
  });

  it('gives events a checklist instead of interview questions', () => {
    const hack = opportunities.find((o) => o.id === 'opp-bay-hack')!;
    expect(interviewQuestions(hack, applicationInfo[hack.id], initialState.profile)).toEqual([]);
    expect(followUpSteps(hack, applicationInfo[hack.id]).map((s) => s.id)).toContain('start');
  });
});
