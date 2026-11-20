import { describe, expect, it } from 'vitest';
import { initialState, opportunities } from '../../data/sample.ts';
import { startingState } from '../../state/store.ts';
import { aiJourney, aiPlan, chosenFrom, requestKey, roadmapRequest, type AiAnswer } from './ai.ts';
import { careerJourney, jobJourney, planJourney } from './journey.ts';

const now = Date.parse('2026-11-19T12:00:00');
const job = opportunities.find((o) => o.id === 'opp-northwind-swe')!;

const answer = (writer: AiAnswer['writer'] = 'cli'): AiAnswer => ({
  writer,
  citations: ['https://example.com/how-i-got-in', 'not a link'],
  roadmap: {
    summary: 'You show Python; Go is still to come.',
    fit: { score: 50.4, met: ['Python'], missing: ['Go'] },
    phases: [
      {
        title: 'Close the gap',
        window: 'This month',
        steps: [
          { title: 'Learn Go basics', detail: 'Work through the tour.', kind: 'learn', source: 'gap', hours: 8, skills: ['Go'], strength: null, why: 'The posting names Go.', resources: [{ label: 'A Tour of Go', url: 'https://go.dev/tour' }, { label: 'Made up', url: 'go-course' }] },
          { title: 'Ship a small service', detail: 'Build and deploy one API.', kind: 'build', source: 'people', hours: 12, skills: [], strength: 'Most people did this', why: 'Common among people who got in.', resources: [] },
        ],
      },
      { title: 'Apply', window: 'Before the deadline', steps: [{ title: 'Submit the application', detail: 'Send it.', kind: 'apply', source: 'posting', hours: 0.5, skills: [], strength: null, why: 'The posting closes soon.', resources: [] }] },
    ],
    howPeopleGotIn: [{ outcome: 'Backend intern', timeline: ['Built an API', 'Applied early'] }],
  },
});

describe('the roadmap Grok writes', () => {
  it('asks with the signed-in student\'s own data and where the application stands', () => {
    const me = { ...startingState(initialState, true), profile: { ...initialState.profile, major: 'Nursing', skills: ['Spanish'] } };
    const request = roadmapRequest(me, 'Software Engineering Intern at Northwind Robotics', { opportunity: job, status: 'applied' }, []);
    expect(request.kind).toBe('job');
    expect(request.profile).toMatchObject({ major: 'Nursing', skills: ['Spanish'] });
    expect(request.posting).toMatchObject({ title: job.title, organizer: job.organizer, status: 'applied' });
    expect(request.posting!.prompts.length).toBeGreaterThan(0);
    expect(roadmapRequest(me, 'Software engineering', null, []).posting).toBeNull();
  });

  it('asks again when the profile or the status changes, and not when a step is ticked off', () => {
    const key = (state: typeof initialState, status: 'to_apply' | 'applied' = 'to_apply') => requestKey(roadmapRequest(state, 'x', { opportunity: job, status }, []));
    expect(key({ ...initialState, doneSteps: ['anything'] })).toBe(key(initialState));
    expect(key({ ...initialState, profile: { ...initialState.profile, skills: ['Rust'] } })).not.toBe(key(initialState));
    expect(key(initialState, 'applied')).not.toBe(key(initialState));
  });

  it('draws the written roadmap as a journey, keeping ticks and set-aside steps and dropping made-up links', () => {
    const state = { ...initialState, applications: {}, doneSteps: [] };
    const base = jobJourney(state, job, now);
    const journey = aiJourney(state, base, answer());
    expect(journey.steps.map((s) => s.title)).toEqual(['Learn Go basics', 'Ship a small service', 'Submit the application']);
    expect(journey.phases.map((p) => p.count)).toEqual([2, 1]);
    expect(journey.goal).toBe(base.goal);
    expect(journey.steps[0]!.resources).toEqual([{ label: 'A Tour of Go', url: 'https://go.dev/tour' }]);
    expect(journey.steps[0]!.opportunity?.id).toBe(job.id);
    expect(journey.analysis.fit).toEqual({ score: 50, met: ['Python'], missing: ['Go'] });
    expect(journey.analysis.sources).toEqual(['https://example.com/how-i-got-in']);
    expect(journey.analysis.stories[0]!.timeline).toEqual(['Built an API', 'Applied early']);
    expect(journey.analysis.basis).toContain('Written by Grok');

    const first = journey.steps[0]!.id;
    const ticked = aiJourney({ ...state, doneSteps: [first] }, base, answer());
    expect(ticked.steps[0]!.done).toBe(true);
    expect(ticked.nextIndex).toBe(1);
    const aside = aiJourney(state, base, answer(), [journey.steps[1]!.id, journey.steps[2]!.id]);
    // A recommendation can be set aside; what the posting asks for stays.
    expect(aside.steps.map((s) => s.title)).toEqual(['Learn Go basics', 'Submit the application']);
  });

  it('shows a posting\'s selection process only when the writer found one, and never on a career', () => {
    const state = { ...initialState };
    const o = opportunities[0]!;
    const found = answer();
    found.roadmap.process = [{ stage: 'Online assessment', detail: 'Two timed problems.' }, { stage: ' ', detail: 'blank stages are dropped' }];
    const job = aiJourney(state, jobJourney(state, o, now, []), found);
    expect(job.analysis.process).toEqual([{ stage: 'Online assessment', detail: 'Two timed problems.' }]);
    expect(aiJourney(state, jobJourney(state, o, now, []), answer()).analysis.process).toEqual([]);
    expect(aiJourney(state, careerJourney(state, now), found).analysis.process).toEqual([]);
  });

  it('fills a roadmap built from picks with the writer\'s actions and recommendations, and keeps every pick', () => {
    const state = { ...initialState, goalId: 'path-swe', doneSteps: [] };
    const board = careerJourney(state, now);
    const club = board.steps.find((s) => s.kind === 'join')!;
    const skill = board.steps.find((s) => s.kind === 'learn')!;
    const plan = planJourney(board, [club.id, skill.id]);
    expect(roadmapRequest(state, plan.goal, null, [], chosenFrom(plan)).chosen.map((c) => c.title).sort()).toEqual([club.title, skill.title].sort());
    const clubPhase = plan.phases.find((p) => plan.steps[p.from]!.id === club.id)!;
    const found = answer();
    found.roadmap.phases = [{ title: clubPhase.title, window: '', more: [{ title: 'Run for a club officer role', why: 'Shows leadership.' }, { title: club.title, why: 'already chosen, so dropped' }], steps: [{ ...found.roadmap.phases[0]!.steps[0]!, title: club.title.toUpperCase(), actions: ['Email the president', 'Go on Tuesday'] }] }];
    const written = aiPlan(plan, found);
    expect(written.steps.map((s) => s.id)).toEqual(plan.steps.map((s) => s.id));
    expect(written.steps.find((s) => s.id === club.id)!.actions).toEqual(['Email the president', 'Go on Tuesday']);
    // The pick the writer said nothing about keeps its own things to do.
    expect(written.steps.find((s) => s.id === skill.id)!.actions).toEqual(plan.steps.find((s) => s.id === skill.id)!.actions);
    expect(written.phases.find((p) => p.id === clubPhase.id)!.more).toEqual([{ id: null, title: 'Run for a club officer role', why: 'Shows leadership.' }]);
  });

  it('says Grok wrote the roadmap', () => {
    const state = { ...initialState, doneSteps: [] };
    const journey = aiJourney(state, careerJourney(state, now), answer('api'));
    expect(journey.analysis.basis).toContain('Written by Grok');
    expect(journey.mode).toBe('career');
  });
});
