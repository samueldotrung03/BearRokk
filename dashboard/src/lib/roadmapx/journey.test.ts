import { describe, expect, it } from 'vitest';
import { careerPaths, initialState, opportunities } from '../../data/sample.ts';
import { startingState } from '../../state/store.ts';
import { careerJourney, careerSearch, curveThrough, customCareer, destinations, jobChoices, jobJourney, layoutPath, planJourney, pathMatch, relatedPaths } from './journey.ts';

const now = Date.parse('2026-11-19T12:00:00');

describe('roadmap journey', () => {
  it('builds a career journey for every goal: ordered steps, phases that cover them, no gaps', () => {
    for (const path of careerPaths) {
      const journey = careerJourney({ ...initialState, goalId: path.id, doneSteps: [], applications: {} }, now);
      expect(journey.steps.length, path.id).toBeGreaterThan(3);
      expect(journey.steps.map((s) => s.index)).toEqual(journey.steps.map((_, i) => i));
      expect(journey.phases.reduce((sum, p) => sum + p.count, 0)).toBe(journey.steps.length);
      expect(journey.phases[0]!.from).toBe(0);
      expect(journey.nextIndex).toBe(0);
      expect(journey.percent).toBe(0);
      for (const step of journey.steps) expect(step.hours, step.id).toBeGreaterThan(0);
    }
  });

  it('follows the student: a finished step moves the next step on and counts toward the goal', () => {
    const before = careerJourney({ ...initialState, doneSteps: [] }, now);
    const first = before.steps[0]!;
    const after = careerJourney({ ...initialState, doneSteps: [first.id] }, now);
    expect(after.steps[0]!.done).toBe(true);
    expect(after.nextIndex).toBe(1);
    expect(after.doneCount).toBe(1);
    expect(after.hoursLeft).toBeCloseTo(before.hoursLeft - first.hours);
    const all = careerJourney({ ...initialState, doneSteps: before.steps.map((s) => s.id) }, now);
    expect(all.percent).toBe(100);
    expect(all.nextIndex).toBe(all.steps.length);
  });

  it('says what each step teaches and why, from data rather than invention', () => {
    const journey = careerJourney({ ...initialState, goalId: 'path-swe', doneSteps: [] }, now);
    expect(journey.skills.length).toBeGreaterThan(0);
    expect(journey.steps.some((s) => s.skills.length > 0)).toBe(true);
    expect(journey.steps.some((s) => s.resources.length > 0)).toBe(true);
    for (const step of journey.steps) expect(step.why.join(' ')).not.toMatch(/undefined|NaN/);
  });

  it('recommends rather than requires: every career step is from what people did and can be set aside', () => {
    const base = careerJourney({ ...initialState, goalId: 'path-swe', doneSteps: [] }, now);
    expect(base.steps.every((s) => s.source === 'people')).toBe(true);
    expect(base.steps.some((s) => s.strength !== null)).toBe(true);
    expect(base.analysis.stories.length).toBeGreaterThan(0);
    const dropped = base.steps[1]!;
    const without = careerJourney({ ...initialState, goalId: 'path-swe', doneSteps: [] }, now, [dropped.id]);
    expect(without.steps.map((s) => s.id)).not.toContain(dropped.id);
    expect(without.skipped).toEqual([{ id: dropped.id, title: dropped.title }]);
    expect(without.steps.map((s) => s.index)).toEqual(without.steps.map((_, i) => i));
  });

  it('writes a job roadmap from the posting checked against the profile', () => {
    const job = opportunities.find((o) => o.id === 'opp-northwind-swe')!;
    const none = jobJourney({ ...initialState, applications: {}, doneSteps: [], profile: { ...initialState.profile, skills: [] } }, job, now);
    const asked = none.analysis.fit!.missing;
    expect(asked.length).toBeGreaterThan(0);
    // Each skill the posting names and the profile lacks becomes a step that closes it.
    expect(none.steps.filter((s) => s.source === 'gap').map((s) => s.skills[0]!.label)).toEqual(asked);
    const all = jobJourney({ ...initialState, applications: {}, doneSteps: [], profile: { ...initialState.profile, skills: asked } }, job, now);
    expect(all.analysis.fit).toMatchObject({ score: 100, missing: [] });
    expect(all.steps.some((s) => s.source === 'gap')).toBe(false);
    expect(all.steps.at(-1)!.kind).toBe('apply');
    // What people who got similar roles did is added as recommendations, with the count behind it.
    const people = all.steps.filter((s) => s.source === 'people');
    expect(people.length).toBeGreaterThan(0);
    for (const s of people) expect(s.evidence!.count / s.evidence!.total).toBeGreaterThanOrEqual(0.5);
    // A posting's own steps cannot be set aside.
    const posting = all.steps.find((s) => s.source === 'posting')!;
    expect(jobJourney({ ...initialState, applications: {}, doneSteps: [] }, job, now, [posting.id]).steps.map((s) => s.id)).toContain(posting.id);
  });

  it('is written for whoever is signed in: a new account with a blank profile gets its own roadmap, not the sample student\'s', () => {
    const job = opportunities.find((o) => o.id === 'opp-northwind-swe')!;
    const fresh = startingState(initialState, true);
    const theirs = jobJourney(fresh, job, now);
    const sample = jobJourney({ ...initialState, applications: {}, doneSteps: [] }, job, now);
    expect(fresh.profile.skills).toEqual([]);
    expect(theirs.analysis.fit!.met).toEqual([]);
    expect(theirs.analysis.fit!.missing.length).toBeGreaterThan(sample.analysis.fit!.missing.length);
    expect(theirs.steps.filter((s) => s.source === 'gap').length).toBeGreaterThan(sample.steps.filter((s) => s.source === 'gap').length);
    // Nothing said about the sample student leaks into another person's roadmap.
    expect(theirs.summary).not.toBe(job.fitExplanation);
    expect(theirs.summary).toContain('None of it is on your profile yet');
    const career = careerJourney(fresh, now);
    expect(career.analysis.stages[0]!.result).toContain('0 skills');
    expect(JSON.stringify([theirs, career])).not.toMatch(/undefined|NaN|Maya/);
    expect(destinations(fresh, opportunities, new Map(opportunities.map((o) => [o.id, o]))).every((d) => d.status === null)).toBe(true);
  });

  it('turns into what to do while waiting once the application is sent', () => {
    const job = opportunities.find((o) => o.id === 'opp-northwind-swe')!;
    const sent = jobJourney({ ...initialState, doneSteps: [], applications: { [job.id]: { ...Object.values(initialState.applications)[0]!, status: 'applied' } } }, job, now);
    expect(sent.phases[0]!.title).toBe('After you apply');
    expect(sent.steps[0]!.source).toBe('after');
    expect(sent.steps.some((s) => s.kind === 'apply')).toBe(false);
  });

  it('gives a roadmap for every tracked posting without being asked, and suggests some when none is tracked', () => {
    const byId = new Map(opportunities.map((o) => [o.id, o]));
    const tracked = destinations(initialState, opportunities, byId);
    expect(tracked.length).toBeGreaterThan(0);
    expect(tracked.every((d) => d.status !== null && initialState.applications[d.opportunity.id])).toBe(true);
    // Every application is there, each with its own roadmap, the sent ones first.
    expect(tracked).toHaveLength(Object.keys(initialState.applications).filter((id) => byId.has(id)).length);
    expect(tracked[0]!.status).toBe('applied');
    const goals = tracked.map((d) => jobJourney(initialState, d.opportunity, now).goal);
    expect(new Set(goals).size).toBe(tracked.length);
    const fresh = destinations({ ...initialState, applications: {} }, opportunities, byId);
    expect(fresh).toHaveLength(3);
    expect(fresh.every((d) => d.status === null)).toBe(true);
  });

  it('offers postings worth a roadmap, the tracked ones first, never dismissed ones', () => {
    const tracked = Object.keys(initialState.applications);
    const choices = jobChoices(initialState, opportunities);
    expect(choices.length).toBeGreaterThan(0);
    expect(tracked).toContain(choices[0]!.id);
    expect(choices.every((o) => ['internship', 'research', 'scholarship'].includes(o.type))).toBe(true);
    const without = jobChoices({ ...initialState, dismissed: [choices[0]!.id] }, opportunities);
    expect(without.map((o) => o.id)).not.toContain(choices[0]!.id);
  });

  it('lays the road out from near to far with one extra point for the goal', () => {
    const { points, length } = layoutPath(5, 1000, 200);
    expect(points).toHaveLength(6);
    for (let i = 1; i < points.length; i += 1) expect(points[i]!.y).toBeLessThan(points[i - 1]!.y);
    expect(points[0]!.y).toBeLessThan(length);
    expect(curveThrough(points).startsWith(`M ${points[0]!.x} ${points[0]!.y}`)).toBe(true);
    expect(curveThrough(points).match(/C/g)).toHaveLength(5);
  });
});

describe('exploring careers', () => {
  it('lays a career out as directions with no order, the most common option first in each', () => {
    const journey = careerJourney({ ...initialState, goalId: 'path-swe', doneSteps: [] }, now);
    expect(journey.open).toBe(true);
    expect(journey.phases.every((p) => p.window === '')).toBe(true);
    expect(journey.phases.length).toBeGreaterThan(1);
    for (const phase of journey.phases) {
      const shares = journey.steps.slice(phase.from, phase.from + phase.count).map((s) => (s.evidence ? s.evidence.count / s.evidence.total : 0));
      expect(shares).toEqual([...shares].sort((a, b) => b - a));
    }
    expect(jobJourney(initialState, opportunities.find((o) => o.id === 'opp-northwind-swe')!, now).open).toBe(false);
  });

  it('opens any career without changing the goal, and finds careers by name, skill or interest', () => {
    const other = careerPaths.find((p) => p.id !== initialState.goalId)!;
    const looked = careerJourney(initialState, now, [], other.id);
    expect(looked.goal).not.toBe(careerJourney(initialState, now).goal);
    expect(careerSearch(initialState, other.title.slice(0, 5))[0]!.title).toBe(other.title);
    const bySkill = careerSearch(initialState, 'python');
    expect(bySkill.length).toBeGreaterThan(0);
    expect(bySkill.some((hit) => hit.reason.toLowerCase().includes('python'))).toBe(true);
    expect(careerSearch(initialState, 'zzzz')).toEqual([]);
    // Before typing, the student's own goal leads the suggestions.
    expect(careerSearch(initialState, '')[0]).toMatchObject({ id: initialState.goalId, reason: 'Your goal' });
  });

  it('suggests neighbouring paths with how each connects and how much of it the profile shows', () => {
    const related = relatedPaths(initialState, 'path-swe');
    expect(related.length).toBeGreaterThan(1);
    expect(related.map((r) => r.id)).not.toContain('path-swe');
    for (const r of related) {
      expect(r.why.length).toBeGreaterThan(10);
      expect(r.match === null || (r.match >= 0 && r.match <= 100)).toBe(true);
    }
    const none = pathMatch({ ...initialState, doneSteps: [], preferences: undefined, profile: { ...initialState.profile, skills: [] } }, 'path-swe');
    expect(none).toBe(0);
  });

  it('gives a typed career an empty map for the writer to fill', () => {
    const custom = customCareer('Marine biology');
    expect(custom).toMatchObject({ goal: 'Marine biology', open: true, steps: [], nextIndex: 0 });
  });

  it('holds everything the app knows toward a career, not a shortlist', () => {
    const state = { ...initialState, goalId: 'path-swe', doneSteps: [] };
    const journey = careerJourney(state, now);
    expect(journey.steps.length).toBeGreaterThan(20);
    const titles = journey.steps.map((s) => s.title);
    expect(new Set(journey.steps.map((s) => s.id)).size).toBe(journey.steps.length);
    expect(journey.phases.map((p) => p.title)).toContain('What people actually did');
    // Every line on the people's own timelines is there once: as an option, or named inside the option that says the same thing.
    const said = journey.steps.map((s) => `${s.title} ${s.detail}`).join(' | ');
    for (const line of new Set(journey.analysis.stories.flatMap((story) => story.timeline))) expect(said, line).toContain(line);
    expect(titles.filter((t) => /^Applied in /.test(t)).length).toBeLessThanOrEqual(1);
    // They are not all one kind of thing.
    expect(new Set(journey.steps.filter((s) => s.id.includes(':did-')).map((s) => s.kind)).size).toBeGreaterThan(1);
    const did = journey.steps.find((s) => s.id.includes(':did-'))!;
    expect(did.evidence!.total).toBe(journey.analysis.stories.length);
    // Postings in the feed for this career are options too, and open the posting.
    expect(journey.steps.some((s) => s.id.includes(':opp-') && s.opportunity)).toBe(true);
    expect(careerJourney({ ...state, dismissed: opportunities.map((o) => o.id) }, now).steps.some((s) => s.id.includes(':opp-'))).toBe(false);
    expect(careerSearch(initialState, '').length).toBe(careerPaths.length);
  });

  it('builds a roadmap from the picks: things to do for each, and more to add at the end of each category', () => {
    const board = careerJourney({ ...initialState, goalId: 'path-swe', doneSteps: [] }, now);
    const club = board.steps.find((s) => s.kind === 'join')!;
    const skill = board.steps.find((s) => s.kind === 'learn')!;
    const plan = planJourney(board, [club.id, skill.id]);
    expect(plan.plan).toBe(true);
    expect(plan.open).toBe(false);
    expect(plan.steps.map((s) => s.id).sort()).toEqual([club.id, skill.id].sort());
    for (const step of plan.steps) expect(step.actions!.length).toBeGreaterThanOrEqual(3);
    // Each category the student chose from ends with further options from that same category, none already picked.
    for (const phase of plan.phases) {
      const inBoard = board.phases.find((p) => p.id === phase.id)!;
      const ids = board.steps.slice(inBoard.from, inBoard.from + inBoard.count).map((s) => s.id);
      expect(phase.more!.length).toBeGreaterThan(0);
      for (const more of phase.more!) {
        // A recommendation is another option from the board, or general advice with no id when the board has none left.
        if (more.id) expect(ids).toContain(more.id);
        expect([club.id, skill.id]).not.toContain(more.id);
      }
    }
    // Categories with no pick are offered, not forced onto the roadmap.
    expect(plan.left!.length).toBe(board.phases.length - plan.phases.length);
    expect(plan.steps.map((s) => s.index)).toEqual(plan.steps.map((_, i) => i));
  });

  it('shows that people got in with different mixes, including without a club', () => {
    const journey = careerJourney({ ...initialState, goalId: 'path-swe', doneSteps: [] }, now);
    const ids = new Set(journey.steps.map((s) => s.id));
    const mixes = journey.analysis.stories.map((story) => story.did!);
    for (const mix of mixes) {
      expect(mix.length).toBeGreaterThan(0);
      for (const id of mix) expect(ids.has(id)).toBe(true);
    }
    expect(new Set(mixes.map((mix) => [...mix].sort().join())).size).toBeGreaterThan(1);
    // No single option is on everyone's path, so none of them can be called required.
    const clubs = journey.steps.filter((s) => s.kind === 'join').map((s) => s.id);
    expect(mixes.some((mix) => !mix.some((id) => clubs.includes(id)))).toBe(true);
  });
});

describe('saved sample data', () => {
  it('brings newly added sample applications into a saved guest once, and leaves the student\'s own alone', async () => {
    const { loadState } = await import('../../state/store.ts');
    const saved = { applications: { 'opp-northwind-swe': { status: 'applied', drafts: {}, materialsDone: [] } } };
    const { vi } = await import('vitest');
    vi.stubGlobal('localStorage', { getItem: () => JSON.stringify(saved) });
    const first = loadState(initialState);
    expect(Object.keys(first.applications).length).toBe(Object.keys(initialState.applications).length);
    expect(first.applications['opp-northwind-swe']!.status).toBe('applied');
    // Once seeded, an application the student removes stays removed.
    vi.stubGlobal('localStorage', { getItem: () => JSON.stringify({ ...saved, seed: initialState.seed }) });
    expect(Object.keys(loadState(initialState).applications)).toEqual(['opp-northwind-swe']);
    vi.unstubAllGlobals();
  });
});
