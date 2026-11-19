import { describe, expect, it } from 'vitest';
import { initialState, opportunities } from '../data/sample.ts';
import type { Opportunity } from '../types.ts';
import { rankFeed, rankFeedDetailed } from './ranking.ts';
import { remindersFor, progressOf } from '../lib/applications.ts';
import { answerQuestion } from '../lib/ask.ts';
import { calendarItems, dayKey } from '../lib/calendar.ts';
import { countActive, emptyFilters, matches, type FilterContext } from '../lib/filters.ts';
import { evidenceFor, orderByEvidence } from '../lib/pathways.ts';
import { buildOpportunityRoadmap, planFor } from '../lib/roadmap.ts';
import { applicationInfo } from '../data/sample.ts';
import type { PathProfile, Roadmap } from '../types.ts';
import { clearDemoStorage, fromBackendProfile, loadState, reducer, saveState, startingState, storageKey, type AppState } from './store.ts';

// One clock for every call: the score includes recency, so two calls a millisecond apart would
// otherwise differ in the last digits and break exact comparisons.
const NOW = Date.now();
const scores = (state: AppState = initialState) =>
  new Map(rankFeedDetailed(opportunities, state, NOW).map((r) => [r.opportunity.id, r.score]));
const ids = (state: AppState = initialState) => rankFeed(opportunities, state).map((o) => o.id);

describe('rankFeed', () => {
  it('removes a dismissed card and scores the others of its type lower', () => {
    const state = reducer(initialState, { type: 'dismiss', id: 'opp-northwind-swe' });
    expect(ids(state)).not.toContain('opp-northwind-swe');
    expect(scores(state).get('opp-harbor-data')!).toBeLessThan(scores().get('opp-harbor-data')!);
    // A type the student did not touch is left alone.
    expect(scores(state).get('opp-systems-club')).toBe(scores().get('opp-systems-club'));
  });

  it('scores cards higher when the student saved one of the same type', () => {
    const state = reducer(initialState, { type: 'toggleSaved', id: 'opp-lumen-info' });
    expect(scores(state).get('opp-career-fair')!).toBeGreaterThan(scores().get('opp-career-fair')!);
    const fair = rankFeedDetailed(opportunities, state).find((r) => r.opportunity.id === 'opp-career-fair')!;
    expect(fair.signals).toContain('saved-like');
    expect(fair.source).toBe('in-network');
  });

  it('one dismissal outweighs one open of the same type', () => {
    let state = reducer(initialState, { type: 'opened', id: 'opp-first-gen-scholarship' });
    const afterOpen = scores(state);
    state = reducer(initialState, { type: 'dismiss', id: 'opp-northwind-swe' });
    const afterDismiss = scores(state);
    const gain = afterOpen.get('opp-first-gen-scholarship')! - scores().get('opp-first-gen-scholarship')!;
    const loss = scores().get('opp-harbor-data')! - afterDismiss.get('opp-harbor-data')!;
    expect(gain).toBeGreaterThan(0);
    expect(loss).toBeGreaterThan(gain);
  });

  it('leaves out opportunities whose deadline has passed', () => {
    const closed: Opportunity = { ...opportunities[0]!, id: 'closed', deadline: new Date(Date.now() - 86_400_000).toISOString() };
    expect(rankFeed([...opportunities, closed], initialState).map((o) => o.id)).not.toContain('closed');
  });

  it('puts the opportunity for the next roadmap step ahead of an equal one that is not on the roadmap', () => {
    const base = opportunities.find((o) => o.id === 'opp-harbor-data')!; // linked to the next step, step-sql
    const twin: Opportunity = { ...base, id: 'twin' };
    const order = rankFeed([twin, base], initialState).map((o) => o.id);
    expect(order).toEqual(['opp-harbor-data', 'twin']);
  });

  it('spreads types out instead of stacking one type at the top', () => {
    const top = opportunities[0]!;
    const clones: Opportunity[] = [1, 2, 3].map((n) => ({ ...top, id: `clone-${n}` }));
    const order = rankFeed([...clones, ...opportunities], initialState);
    const firstFour = order.slice(0, 4).map((o) => o.type);
    expect(new Set(firstFour).size).toBeGreaterThan(1);
  });
});

describe('reducer', () => {
  it('dismissing a saved card unsaves it, and restore brings it back unsaved', () => {
    let state = reducer(initialState, { type: 'toggleSaved', id: 'opp-bay-hack' });
    state = reducer(state, { type: 'dismiss', id: 'opp-bay-hack' });
    expect(state.saved).toEqual([]);
    expect(state.dismissed).toEqual(['opp-bay-hack']);
    state = reducer(state, { type: 'restore', id: 'opp-bay-hack' });
    expect(state.dismissed).toEqual([]);
  });

  it('does not record the same opened or dismissed card twice', () => {
    let state = reducer(initialState, { type: 'opened', id: 'a' });
    state = reducer(state, { type: 'opened', id: 'a' });
    state = reducer(state, { type: 'dismiss', id: 'b' });
    state = reducer(state, { type: 'dismiss', id: 'b' });
    expect(state.opened).toEqual(['a']);
    expect(state.dismissed).toEqual(['b']);
  });

  it('clearing history keeps roadmap progress and profile', () => {
    let state = reducer(initialState, { type: 'toggleStep', id: 'step-sql' });
    state = reducer(state, { type: 'dismiss', id: 'opp-bay-hack' });
    state = reducer(state, { type: 'resetHistory' });
    expect(state.dismissed).toEqual([]);
    expect(state.doneSteps).toEqual(['step-ds', 'step-sql']);
    expect(state.profile).toEqual(initialState.profile);
  });
});

describe('likes, roadmap steps and applications', () => {
  it('scores cards higher when the student liked one of the same type', () => {
    const state = reducer(initialState, { type: 'toggleLiked', id: 'opp-lumen-info' });
    expect(scores(state).get('opp-career-fair')!).toBeGreaterThan(scores().get('opp-career-fair')!);
  });

  it('adds a feed card to the roadmap once and removes it with its done mark', () => {
    let state = reducer(initialState, { type: 'addStep', id: 'opp-ml-research' });
    state = reducer(state, { type: 'addStep', id: 'opp-ml-research' });
    expect(state.extraSteps).toEqual(['opp-ml-research']);
    state = reducer(state, { type: 'toggleStep', id: 'extra-opp-ml-research' });
    state = reducer(state, { type: 'removeStep', id: 'opp-ml-research' });
    expect(state.extraSteps).toEqual([]);
    expect(state.doneSteps).not.toContain('extra-opp-ml-research');
  });

  it('keeps drafts when the status changes and drops the record when tracking stops', () => {
    let state = reducer(initialState, { type: 'setApplication', id: 'opp-ml-research', status: 'interested' });
    state = reducer(state, { type: 'setDraft', id: 'opp-ml-research', index: 0, text: 'A draft' });
    state = reducer(state, { type: 'setApplication', id: 'opp-ml-research', status: 'applying' });
    expect(state.applications['opp-ml-research']).toMatchObject({ status: 'applying', drafts: { 0: 'A draft' } });
    state = reducer(state, { type: 'setApplication', id: 'opp-ml-research', status: null });
    expect(state.applications['opp-ml-research']).toBeUndefined();
  });

  it('ignores a draft for something that is not tracked', () => {
    const state = reducer(initialState, { type: 'setDraft', id: 'opp-bay-hack', index: 0, text: 'x' });
    expect(state).toBe(initialState);
  });

  it('sets reminders only while there is still something to send, and only with a deadline', () => {
    const now = Date.UTC(2026, 10, 1);
    const deadline = new Date(now + 5 * 86_400_000).toISOString();
    expect(remindersFor('interested', deadline, now)).toEqual([]);
    expect(remindersFor('applied', deadline, now)).toEqual([]);
    expect(remindersFor('to_apply', null, now)).toEqual([]);
    const reminders = remindersFor('applying', deadline, now);
    expect(reminders.map((r) => r.label)).toEqual(['7 days before', '2 days before', 'On the day']);
    // Five days out, the seven-day reminder has already passed.
    expect(reminders.map((r) => r.past)).toEqual([true, false, false]);
  });

  it('counts drafted prompts and gathered materials, ignoring blank drafts', () => {
    const info = { prompts: ['a', 'b'], materials: ['Resume', 'Transcript'], requiresLogin: false };
    const application = { status: 'applying' as const, drafts: { 0: 'text', 1: '   ' }, materialsDone: ['Resume', 'Old item'] };
    expect(progressOf(application, info)).toEqual({ done: 2, total: 4 });
  });
});

describe('answerQuestion', () => {
  const northwind = opportunities.find((o) => o.id === 'opp-northwind-swe')!;
  const context = { info: undefined, step: undefined, profile: initialState.profile };

  it('gives the deadline when there is one and says so when there is not', () => {
    expect(answerQuestion(northwind, 'When is it due?', context)).toContain('The deadline is');
    const open = { ...northwind, deadline: null, startTime: null };
    expect(answerQuestion(open, 'when is the deadline', context)).toContain('does not give a deadline');
  });

  it('does not invent pay, materials or questions the posting does not state', () => {
    expect(answerQuestion(northwind, 'Is it paid?', context)).toContain('does not state pay');
    expect(answerQuestion(northwind, 'What do I need to apply?', context)).toContain('does not list');
    const locked = { ...context, info: { prompts: [], materials: ['Resume'], requiresLogin: true } };
    expect(answerQuestion(northwind, 'What are the essay questions?', locked)).toContain('behind a sign-in');
  });

  it('lists the materials when the agents read them', () => {
    const known = { ...context, info: { prompts: ['Why us?'], materials: ['Resume (PDF)', 'Transcript'], requiresLogin: false } };
    expect(answerQuestion(northwind, 'what do i need', known)).toBe('You need resume (pdf) and transcript. It also has one written question.');
  });
});

describe('roadmap evidence from profiles', () => {
  const step = (id: string) => ({ id, kind: 'learn' as const, title: id, detail: '', opportunityId: null, due: null });
  const roadmap: Roadmap = {
    goalId: 'g',
    goal: '',
    summary: '',
    requirements: [],
    phases: [
      { id: 'p1', title: '', window: '', steps: [step('a'), step('b')] },
      { id: 'p2', title: '', window: '', steps: [step('c')] },
    ],
  };
  const profile = (id: string, did: string[], goalId = 'g'): PathProfile => ({ id, goalId, outcome: '', year: 'Junior', timeline: [], did });
  const profiles = [profile('1', ['b', 'c']), profile('2', ['b']), profile('3', ['a', 'b']), profile('4', ['a', 'b', 'c'], 'other')];

  it('counts only profiles for this goal and sorts steps into common and rare', () => {
    const evidence = evidenceFor(roadmap, profiles);
    expect(evidence.total).toBe(3);
    expect(evidence.byStep.get('b')).toMatchObject({ count: 3, share: 1 });
    expect(evidence.common.map((item) => item.step.id)).toEqual(['b']);
    expect(evidence.rare.map((item) => item.step.id)).toEqual(['a', 'c']);
  });

  it('puts the more common step first inside a phase and leaves the phases in order', () => {
    const ordered = orderByEvidence(roadmap, evidenceFor(roadmap, profiles));
    expect(ordered.phases.map((phase) => phase.steps.map((s) => s.id))).toEqual([['b', 'a'], ['c']]);
  });

  it('leaves the plan as written when there are no profiles for the goal', () => {
    const evidence = evidenceFor(roadmap, []);
    expect(evidence.total).toBe(0);
    expect(orderByEvidence(roadmap, evidence)).toBe(roadmap);
  });
});

describe('a roadmap started for one opportunity', () => {
  const swe = opportunities.find((o) => o.id === 'opp-northwind-swe')!;
  const info = applicationInfo[swe.id];

  it('is built from the posting: its materials, its questions, and a submit step on time', () => {
    const steps = buildOpportunityRoadmap(swe, info, [], new Date(swe.deadline!).getTime() - 30 * 86_400_000);
    const titles = steps.map((step) => step.title);
    info!.materials.forEach((material) => expect(titles).toContain(`Get ready: ${material}`));
    expect(titles.filter((title) => title.startsWith('Draft your answer'))).toHaveLength(info!.prompts.length);
    expect(titles).toContain('Get comfortable with Python');
    expect(titles.at(-1)).toBe('Submit the application');
    expect(new Date(steps.at(-1)!.due!).getTime()).toBeLessThan(new Date(swe.deadline!).getTime());
    expect(new Set(steps.map((step) => step.id)).size).toBe(steps.length);
  });

  it('skips a skill the student has and never sets a date in the past', () => {
    const now = new Date(swe.deadline!).getTime() - 2 * 86_400_000;
    const steps = buildOpportunityRoadmap(swe, info, ['Python'], now);
    expect(steps.map((step) => step.title)).not.toContain('Get comfortable with Python');
    steps.forEach((step) => expect(new Date(step.due!).getTime()).toBeGreaterThanOrEqual(now));
  });

  it('adds nothing to the plan until started, and removing it clears its done marks', () => {
    const before = planFor(initialState).steps.length;
    let state = reducer(initialState, { type: 'addStep', id: swe.id });
    const mine = planFor(state).extras;
    expect(mine.length).toBeGreaterThan(0);
    expect(planFor(state).steps.length).toBe(before + mine.length);
    state = reducer(state, { type: 'toggleStep', id: mine[0]!.id });
    state = reducer(state, { type: 'removeStep', id: swe.id });
    expect(state.doneSteps).not.toContain(mine[0]!.id);
    expect(planFor(state).steps.length).toBe(before);
  });
});

describe('the feed reacts to what the student does', () => {
  const rank = (state: AppState) => rankFeed(opportunities, state, NOW).map((o) => o.id);
  const place = (state: AppState, id: string) => rank(state).indexOf(id);

  it('moves a type down after a dislike and up after a save', () => {
    const disliked = reducer(initialState, { type: 'dismiss', id: 'opp-lumen-info' });
    expect(rank(disliked)).not.toContain('opp-lumen-info');
    expect(scores(disliked).get('opp-career-fair')!).toBeLessThan(scores().get('opp-career-fair')!);
    const saved = reducer(initialState, { type: 'toggleSaved', id: 'opp-lumen-info' });
    expect(scores(saved).get('opp-career-fair')!).toBeGreaterThan(scores().get('opp-career-fair')!);
  });

  it('carries a like over to sibling types, at less than full strength', () => {
    const liked = reducer(initialState, { type: 'toggleLiked', id: 'opp-northwind-swe' });
    const gain = (id: string) => scores(liked).get(id)! / scores().get(id)!;
    expect(gain('opp-ml-research')).toBeGreaterThan(1); // research is in the same family
    expect(gain('opp-harbor-data')).toBeGreaterThan(gain('opp-ml-research')); // the same type gains more
  });

  it('changes the order of the feed, not just the scores', () => {
    let state = initialState;
    for (const id of ['opp-lumen-info', 'opp-career-fair']) state = reducer(state, { type: 'toggleLiked', id });
    expect(rank(state)).not.toEqual(rank(initialState));
    // The first event in the feed comes sooner once events are liked.
    const firstEvent = (st: AppState) => rankFeed(opportunities, st, NOW).findIndex((o) => o.type === 'event');
    expect(firstEvent(state)).toBeLessThan(firstEvent(initialState));
  });
});

describe('feed filters', () => {
  const DAY = 86_400_000;
  const base = opportunities.find((o) => o.id === 'opp-northwind-swe')!;
  const make = (change: Partial<Opportunity>): Opportunity => ({ ...base, ...change });
  const context: FilterContext = { saved: ['a'], liked: [], roadmap: new Set(['b']), now: NOW };
  const inDays = (days: number) => new Date(NOW + days * DAY).toISOString();

  it('lets everything through when nothing is switched on', () => {
    expect(opportunities.every((o) => matches(o, emptyFilters, context))).toBe(true);
    expect(countActive(emptyFilters)).toBe(0);
  });

  it('filters by deadline window and by having no deadline', () => {
    const soon = make({ deadline: inDays(5) });
    const later = make({ deadline: inDays(20) });
    const open = make({ deadline: null });
    expect([soon, later, open].map((o) => matches(o, { ...emptyFilters, deadline: 'week' }, context))).toEqual([true, false, false]);
    expect([soon, later, open].map((o) => matches(o, { ...emptyFilters, deadline: 'month' }, context))).toEqual([true, true, false]);
    expect([soon, later, open].map((o) => matches(o, { ...emptyFilters, deadline: 'none' }, context))).toEqual([false, false, true]);
  });

  it('requires every "only show" rule at once and applies the fit floor', () => {
    const saved = make({ id: 'a', baseScore: 0.85, foundAt: inDays(-3) });
    const onRoadmap = make({ id: 'b', baseScore: 0.6, foundAt: inDays(-0.5) });
    expect(matches(saved, { ...emptyFilters, only: ['saved'] }, context)).toBe(true);
    expect(matches(saved, { ...emptyFilters, only: ['saved', 'new'] }, context)).toBe(false);
    expect(matches(onRoadmap, { ...emptyFilters, only: ['roadmap', 'new'] }, context)).toBe(true);
    expect(matches(onRoadmap, { ...emptyFilters, minFit: 70 }, context)).toBe(false);
    expect(matches(saved, { ...emptyFilters, minFit: 80, types: [base.type], format: base.format! }, context)).toBe(true);
    expect(countActive({ types: [base.type], format: base.format!, deadline: 'week', minFit: 80, only: ['saved', 'new'] })).toBe(6);
  });
});

describe('calendar', () => {
  const find = (state: AppState, id: string) => calendarItems(state, NOW).find((item) => item.id === id);

  it('marks a deadline the student committed to as a must, with reminders before it', () => {
    // The sample state tracks the Northwind internship as "To apply".
    const deadline = find(initialState, 'deadline-opp-northwind-swe')!;
    expect(deadline.priority).toBe('must');
    expect(deadline.why).toContain('To apply');
    const reminders = calendarItems(initialState, NOW).filter((item) => item.kind === 'reminder');
    expect(reminders.map((item) => item.id)).toEqual(['reminder-opp-northwind-swe-7 days before', 'reminder-opp-northwind-swe-2 days before']);
    expect(reminders.every((item) => item.day < deadline.day)).toBe(true);
  });

  it('shows a saved card as a should, and nothing for a card the student never touched', () => {
    expect(find(initialState, 'deadline-opp-harbor-data')).toBeUndefined();
    const saved = reducer(initialState, { type: 'toggleSaved', id: 'opp-harbor-data' });
    expect(find(saved, 'deadline-opp-harbor-data')!.priority).toBe('should');
    const tracked = reducer(saved, { type: 'setApplication', id: 'opp-harbor-data', status: 'applying' });
    expect(find(tracked, 'deadline-opp-harbor-data')!.priority).toBe('must');
  });

  it('puts roadmap steps on their due day with a reason, and carries the done mark', () => {
    const step = calendarItems(initialState, NOW).find((item) => item.kind === 'step' && !item.done)!;
    expect(step.why.length).toBeGreaterThan(20);
    expect(step.day).toBe(dayKey(step.date));
    const done = reducer(initialState, { type: 'toggleStep', id: step.stepId! });
    expect(find(done, step.id)!.done).toBe(true);
  });

  it('is sorted by day with the musts first inside a day', () => {
    const state = reducer(initialState, { type: 'addStep', id: 'opp-northwind-swe' });
    const items = calendarItems(state, NOW);
    for (let i = 1; i < items.length; i++) {
      const [a, b] = [items[i - 1]!, items[i]!];
      expect(a.day <= b.day).toBe(true);
      if (a.day === b.day) expect(a.priority === 'should' && b.priority === 'must').toBe(false);
    }
  });
});

describe('a student starts from their own profile', () => {
  const fresh = startingState(initialState, true);

  it('keeps the sample student for a guest and starts a signed-in student with nothing done', () => {
    expect(startingState(initialState, false)).toBe(initialState);
    expect(fresh.doneSteps).toEqual([]);
    expect(fresh.applications).toEqual({});
    expect(fresh.profile.name).toBe('');
    expect(fresh.preferences).toBeUndefined();
  });

  it('follows a suggested goal until the student picks one by hand', () => {
    let state = reducer(fresh, { type: 'suggestGoal', id: 'path-health' });
    expect(state.goalId).toBe('path-health');
    expect(reducer(state, { type: 'suggestGoal', id: null }).goalId).toBe('path-health');
    state = reducer(state, { type: 'setGoal', id: 'path-media' });
    expect(state.goalChosen).toBe(true);
    expect(reducer(state, { type: 'suggestGoal', id: 'path-finance' }).goalId).toBe('path-media');
  });

  it('fills a blank profile once and never overwrites a name already there', () => {
    const state = reducer(fresh, { type: 'adoptProfile', profile: { name: 'Ana', major: 'Nursing' }, goalId: 'path-health' });
    expect(state.profile).toMatchObject({ name: 'Ana', major: 'Nursing' });
    expect(state.goalId).toBe('path-health');
    expect(reducer(state, { type: 'adoptProfile', profile: { name: 'Someone else' } }).profile.name).toBe('Ana');
    expect(reducer(fresh, { type: 'adoptProfile', profile: { major: 'Nursing' } })).toBe(fresh);
  });

  it("reads the student's profile from the backend but not the backend's demo student", () => {
    const seed = { name: 'Maya', school: 'UC Berkeley', major: 'Computer Science', year: 'Freshman', careerInterests: [], preferences: null };
    expect(fromBackendProfile(seed)).toBeNull();
    expect(fromBackendProfile(null)).toBeNull();
    const own = fromBackendProfile({ name: 'Ana', school: 'SRJC', major: 'Nursing', year: 'Junior', careerInterests: ['Healthcare'], preferences: { fields: ['Public health'], topField: null } });
    expect(own?.profile).toMatchObject({ name: 'Ana', school: 'SRJC', major: 'Nursing', year: 'Junior', careerInterests: ['Healthcare'] });
    expect(own?.preferences?.fields).toEqual(['Public health']);
    expect(own?.preferences?.notes).toEqual([]);
  });
});

describe('saved state on this device', () => {
  function fakeStorage(entries: Record<string, string>) {
    const data = new Map(Object.entries(entries));
    return {
      data,
      get length() {
        return data.size;
      },
      key: (i: number) => [...data.keys()][i] ?? null,
      getItem: (k: string) => data.get(k) ?? null,
      setItem: (k: string, v: string) => void data.set(k, v),
      removeItem: (k: string) => void data.delete(k),
    };
  }

  it('keeps each account apart from the guest and from other accounts', () => {
    const storage = fakeStorage({});
    (globalThis as { localStorage?: unknown }).localStorage = storage;
    try {
      saveState({ ...initialState, goalId: 'path-media' }, 'uid-a');
      expect(storage.data.has(storageKey('uid-a'))).toBe(true);
      expect(loadState(initialState).goalId).toBe(initialState.goalId);
      expect(loadState(initialState, 'uid-a').goalId).toBe('path-media');
      expect(loadState(startingState(initialState, true), 'uid-b').doneSteps).toEqual([]);
    } finally {
      delete (globalThis as { localStorage?: unknown }).localStorage;
    }
  });

  it('loads state saved before goalChosen existed', () => {
    expect('goalChosen' in initialState).toBe(false);
    (globalThis as { localStorage?: unknown }).localStorage = fakeStorage({ [storageKey(null)]: JSON.stringify(initialState) });
    try {
      const state = loadState(initialState);
      expect(state.goalChosen).toBeFalsy();
      expect(reducer(state, { type: 'suggestGoal', id: 'path-health' }).goalId).toBe('path-health');
    } finally {
      delete (globalThis as { localStorage?: unknown }).localStorage;
    }
  });

  it('a clean demo clears the app keys but keeps sign-up records and other sites', () => {
    const storage = fakeStorage({
      'bearrok.dashboard.v3': '{}',
      'bearrok.dashboard.v3.uid-a': '{}',
      'bearrok.settings': '{}',
      'bearrok.roadmap.notes': '{}',
      'bearrok.onboarded.uid-a': '1',
      'firebase:authUser:key:[DEFAULT]': '{}',
    });
    const removed = clearDemoStorage(storage);
    expect(removed.sort()).toEqual(['bearrok.dashboard.v3', 'bearrok.dashboard.v3.uid-a', 'bearrok.roadmap.notes', 'bearrok.settings']);
    expect([...storage.data.keys()].sort()).toEqual(['bearrok.onboarded.uid-a', 'firebase:authUser:key:[DEFAULT]']);
  });
});

describe('saves from the account', () => {
  it("takes the account's saves and likes for the postings it knows, and leaves the rest alone", async () => {
    const { reducer } = await import('./store.ts');
    const local = { ...initialState, saved: ['a', 'b', 'sample-1'], liked: ['b'] };
    // The account knows a, b and c: on another device the student unsaved b and saved c.
    const next = reducer(local, { type: 'syncReactions', known: ['a', 'b', 'c'], saved: ['a', 'c'], liked: ['c'] });
    expect(next.saved).toEqual(['sample-1', 'a', 'c']);
    expect(next.liked).toEqual(['c']);
    // Always a new list, so the change is noticed even when nothing differs.
    const same = reducer(next, { type: 'syncReactions', known: ['a', 'c'], saved: ['a', 'c'], liked: ['c'] });
    expect(same.saved).not.toBe(next.saved);
    expect(same.saved).toEqual(next.saved);
  });
});
