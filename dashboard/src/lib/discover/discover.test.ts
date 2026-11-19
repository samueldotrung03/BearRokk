import { describe, expect, it } from 'vitest';
import { pathExtras, quizQuestions } from '../../data/discover-extra.ts';
import { careerPaths, initialState, opportunities, pathProfiles, roadmaps } from '../../data/sample.ts';
import type { Profile } from '../../types.ts';
import { answerCareerQuestion, suggestedCareerQuestions, type AskCareerContext } from './ask.ts';
import { pathInsight } from './insight.ts';
import { answeredCount, rankPaths, type History, type QuizAnswers } from './match.ts';

const profile: Profile = initialState.profile;
const noHistory: History = { saved: [], liked: [], dismissed: [] };

function rank(answers: QuizAnswers = {}, history: History = noHistory, who: Profile = profile, doneSteps: string[] = []) {
  return rankPaths({ paths: careerPaths, extras: pathExtras, roadmaps, opportunities, questions: quizQuestions, answers, profile: who, history, doneSteps });
}

/** Picks, for every question, the option that fits the given path best. */
function answersFor(pathId: string): QuizAnswers {
  return Object.fromEntries(
    quizQuestions.map((q) => [q.id, [...q.options].sort((a, b) => (b.fit[pathId] ?? 0) - (a.fit[pathId] ?? 0))[0]!.id]),
  );
}

function context(pathId: string, overrides: Partial<AskCareerContext> = {}): AskCareerContext {
  const path = careerPaths.find((p) => p.id === pathId)!;
  const ranked = rank(answersFor(pathId));
  return {
    insight: pathInsight({ path, extras: pathExtras, roadmaps, profiles: pathProfiles, opportunities, profile, doneSteps: [], saved: [], liked: [], dismissed: [] }),
    match: ranked.find((m) => m.pathId === pathId),
    ranked,
    titles: Object.fromEntries(careerPaths.map((p) => [p.id, p.title])),
    paces: Object.fromEntries(pathExtras.map((e) => [e.pathId, e.paceShort])),
    profile,
    goalId: 'path-swe',
    quizTaken: true,
    ...overrides,
  };
}

describe('rankPaths', () => {
  it('puts the path the quiz answers point to first, for every path', () => {
    for (const path of careerPaths) {
      expect(rank(answersFor(path.id))[0]!.pathId).toBe(path.id);
    }
  });

  it('says the quiz and feed are unknown before the student has used them, and still ranks', () => {
    const ranked = rank();
    expect(ranked).toHaveLength(careerPaths.length);
    for (const match of ranked) {
      expect(match.signals.map((s) => s.source)).not.toContain('quiz');
      expect(match.signals.map((s) => s.source)).not.toContain('feed');
      expect(match.unknowns.join(' ')).toMatch(/quiz/);
      expect(match.unknowns.join(' ')).toMatch(/saved or liked/);
    }
  });

  it('keeps signal weights summing to one when some signals are missing', () => {
    for (const match of rank({ enjoy: 'build' })) {
      expect(match.signals.reduce((sum, s) => sum + s.weight, 0)).toBeCloseTo(1, 6);
      expect(match.percent).toBeGreaterThanOrEqual(0);
      expect(match.percent).toBeLessThanOrEqual(100);
    }
  });

  it('raises a path when the student saves cards that lead to it, and lowers it on dismissals', () => {
    const base = rank({}, { saved: ['opp-other'], liked: [], dismissed: [] }).find((m) => m.pathId === 'path-ml')!;
    const saved = rank({}, { saved: ['opp-ml-research'], liked: [], dismissed: [] }).find((m) => m.pathId === 'path-ml')!;
    const dismissed = rank({}, { saved: [], liked: [], dismissed: ['opp-ml-research'] }).find((m) => m.pathId === 'path-ml')!;
    expect(saved.percent).toBeGreaterThan(base.percent);
    expect(dismissed.percent).toBeLessThan(base.percent);
    expect(saved.reasons.some((r) => r.source === 'feed' && r.text.includes('Efficient ML Systems'))).toBe(true);
  });

  it('counts a finished roadmap step as having the skill it teaches', () => {
    const before = rank().find((m) => m.pathId === 'path-data')!;
    const after = rank({}, noHistory, profile, ['step-data-sql', 'step-data-pipeline']).find((m) => m.pathId === 'path-data')!;
    expect(after.signals.find((s) => s.source === 'skills')!.score).toBeGreaterThan(before.signals.find((s) => s.source === 'skills')!.score);
  });

  it('explains a match in words from the answers the student gave', () => {
    const top = rank(answersFor('path-pm'))[0]!;
    expect(top.summary).toMatch(/^It fits because you said you/);
    expect(top.reasons[0]!.tone).toBe('plus');
  });

  it('ignores answers to questions or options that no longer exist', () => {
    expect(answeredCount(quizQuestions, { enjoy: 'build', gone: 'x', style: 'nope' })).toBe(1);
    expect(rank({ gone: 'x' })[0]!.signals.some((s) => s.source === 'quiz')).toBe(false);
  });
});

describe('pathInsight', () => {
  const insight = (pathId: string, doneSteps: string[] = [], dismissed: string[] = []) =>
    pathInsight({
      path: careerPaths.find((p) => p.id === pathId)!,
      extras: pathExtras,
      roadmaps,
      profiles: pathProfiles,
      opportunities,
      profile,
      doneSteps,
      saved: [],
      liked: [],
      dismissed,
    });

  it('splits expected skills into have, planned on the roadmap, and missing', () => {
    const ml = insight('path-ml');
    expect(ml.skills.find((s) => s.skill.label === 'Python')!.state).toBe('have');
    expect(ml.skills.find((s) => s.skill.label === 'A deep learning library')!.state).toBe('planned');
    expect(ml.skillsHave).toBe(ml.skills.filter((s) => s.state === 'have').length);
  });

  it('counts the sample people for the path and their class years', () => {
    const swe = insight('path-swe');
    const expected = pathProfiles.filter((p) => p.goalId === 'path-swe').length;
    expect(swe.people.total).toBe(expected);
    expect(swe.people.byYear.reduce((sum, y) => sum + y.count, 0)).toBe(expected);
    expect(swe.people.timelines.length).toBeLessThanOrEqual(3);
  });

  it('lists feed cards that lead to the path and drops the ones the student dismissed', () => {
    expect(insight('path-data').opportunities.map((o) => o.opportunity.id)).toContain('opp-harbor-data');
    expect(insight('path-data', [], ['opp-harbor-data']).opportunities.map((o) => o.opportunity.id)).not.toContain('opp-harbor-data');
  });

  it('points to the first unfinished roadmap step', () => {
    const swe = insight('path-swe', ['step-ds']);
    expect(swe.plan.done).toBe(1);
    expect(swe.plan.next?.id).not.toBe('step-ds');
  });
});

describe('answerCareerQuestion', () => {
  it('refuses to make up pay and says so', () => {
    const answer = answerCareerQuestion('What does it pay?', context('path-swe'));
    expect(answer.known).toBe(false);
    expect(answer.text).toMatch(/not in the data/);
    expect(answer.text).not.toMatch(/\$\d/);
  });

  it('does not treat "learn" as a question about earnings', () => {
    expect(answerCareerQuestion('What should I learn first?', context('path-swe')).text).not.toMatch(/Pay/);
  });

  it('names the missing skills and offers to set the goal when it is not the goal yet', () => {
    const answer = answerCareerQuestion('What am I missing?', context('path-ml'));
    expect(answer.text).toMatch(/linear algebra and probability/);
    expect(answer.actions[0]).toEqual({ kind: 'setGoal', pathId: 'path-ml', label: 'Make this my goal' });
  });

  it('offers the roadmap instead of the goal button for the current goal', () => {
    const answer = answerCareerQuestion('What should I do first?', context('path-swe'));
    expect(answer.actions[0]!.kind).toBe('openRoadmap');
    expect(answer.text).toMatch(/phases/);
  });

  it('answers how people got in from the sample counts, including the student’s year', () => {
    const answer = answerCareerQuestion('How did people get in?', context('path-swe'));
    const total = pathProfiles.filter((p) => p.goalId === 'path-swe').length;
    expect(answer.text).toContain(`Of ${total} people`);
    expect(answer.text).toMatch(/sophomore/);
  });

  it('compares with a path named in the question and offers the compare table', () => {
    const answer = answerCareerQuestion('How does it compare to data engineering?', context('path-swe'));
    expect(answer.actions[0]).toMatchObject({ kind: 'compare', pathIds: ['path-swe', 'path-data'] });
  });

  it('suggests asking about the goal only for paths that are not the goal', () => {
    expect(suggestedCareerQuestions(context('path-swe'))).not.toContain('Should I make this my goal?');
    expect(suggestedCareerQuestions(context('path-pm'))).toContain('Should I make this my goal?');
  });

  it('every suggested question gets a real answer, not the fallback', () => {
    for (const path of careerPaths) {
      const ctx = context(path.id);
      for (const question of suggestedCareerQuestions(ctx)) {
        expect(answerCareerQuestion(question, ctx).basis, `${path.id}: ${question}`).not.toBe('What this page knows');
      }
    }
  });
});
