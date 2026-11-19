import { describe, expect, it } from 'vitest';
import { candidates as catalog } from '../../data/agents-extra.ts';
import { initialState, opportunities } from '../../data/sample.ts';
import { buildBrief, memoryFrom, WORKER_JOB_CAP } from './brief.ts';
import { funnel, idleRun, judge, runReducer, totals, type RunInput, type RunState } from './engine.ts';

const input = (instructions: string[] = [], dismissed: string[] = []): RunInput => ({
  profile: initialState.profile,
  memory: memoryFrom(initialState, opportunities),
  instructions,
  dismissed,
  trigger: 'Started by hand.',
});

/** Starts a run and records the state after every tick. */
function play(runInput: RunInput, from: RunState = idleRun(runInput)): RunState[] {
  let state = runReducer(from, { type: 'start', input: runInput });
  const states = [state];
  while (state.status === 'running') {
    state = runReducer(state, { type: 'tick' });
    states.push(state);
  }
  return states;
}

const scenarios = [[], ['more research roles, fewer finance'], ['only remote'], ['internships only'], ['no events and clubs'], ['only in person, more hackathons']];

describe('run engine', () => {
  it('replays exactly the same run from the same start', () => {
    const a = play(input(['more research']));
    const b = play(input(['more research']));
    expect(b).toEqual(a);
  });

  it('ends with every agent done and the run marked done', () => {
    const last = play(input()).at(-1)!;
    expect(last.status).toBe('done');
    expect(Object.values(last.agents).every((agent) => agent.status === 'done')).toBe(true);
  });

  it('has validators judge only what an extractor found earlier', () => {
    for (const instructions of scenarios) {
      const states = play(input(instructions));
      for (let i = 1; i < states.length; i++) {
        for (const c of states[i]!.candidates.filter((c) => c.judged)) {
          const before = states[i - 1]!.candidates.find((p) => p.id === c.id);
          // It was found in an earlier beat, by the extractor in the validator's own lane.
          expect(before, `${c.id} judged in the beat it was found`).toBeDefined();
          expect(c.foundBy.split('-')[1]).toBe(c.judgedBy!.split('-')[1]);
        }
      }
    }
  });

  it('never lets a funnel stage hold more than the stage above, at any moment', () => {
    for (const instructions of scenarios) {
      for (const state of play(input(instructions, ['opp-bay-hack']))) {
        const { counts } = funnel(state.candidates);
        for (let k = 1; k < counts.length; k++) expect(counts[k]!).toBeLessThanOrEqual(counts[k - 1]!);
      }
    }
  });

  it('accounts for every candidate: shown, or dropped with a reason', () => {
    const { candidates } = play(input(['fewer finance'])).at(-1)!;
    const { counts, reasons } = funnel(candidates);
    const dropped = reasons.reduce((sum, r) => sum + r.items.length, 0);
    expect(counts[4]! + dropped).toBe(counts[0]);
  });

  it('removes the repost and keeps the original', () => {
    const { candidates } = play(input()).at(-1)!;
    expect(candidates.find((c) => c.id === 'c-swe')?.stage).toBe(4);
    expect(candidates.find((c) => c.id === 'c-swe-repost')?.reason).toBe('duplicate');
  });

  it('applies the student\'s instruction in validation', () => {
    const remote = play(input(['only remote'])).at(-1)!.candidates;
    for (const c of remote.filter((c) => c.stage === 4)) expect(catalog.find((x) => x.id === c.id)?.format).toBe('remote');
    const noFinance = play(input(['More research roles, fewer finance'])).at(-1)!.candidates;
    expect(noFinance.filter((c) => c.stage === 4 && catalog.find((x) => x.id === c.id)?.tags.includes('finance'))).toEqual([]);
    expect(noFinance.some((c) => c.reason === 'excluded')).toBe(true);
  });

  it('keeps a card the student disliked out of the feed', () => {
    const { candidates } = play(input([], ['opp-bay-hack'])).at(-1)!;
    expect(candidates.find((c) => c.opportunityId === 'opp-bay-hack')?.reason).toBe('disliked');
  });

  it('stays inside the demo cap of worker jobs', () => {
    for (const instructions of scenarios) expect(totals(play(input(instructions)).at(-1)!).workerJobs).toBeLessThanOrEqual(WORKER_JOB_CAP);
  });

  it('does nothing on tick while paused, and resumes where it stopped', () => {
    let state = runReducer(idleRun(input()), { type: 'start', input: input() });
    state = runReducer(runReducer(state, { type: 'tick' }), { type: 'pause' });
    expect(runReducer(state, { type: 'tick' })).toBe(state);
    expect(runReducer(runReducer(state, { type: 'resume' }), { type: 'tick' }).cursor).toBe(state.cursor + 1);
  });

  it('finishes to the same end state as ticking through', () => {
    const ticked = play(input(['only remote'])).at(-1)!;
    const started = runReducer(idleRun(input(['only remote'])), { type: 'start', input: input(['only remote']) });
    const finished = runReducer(started, { type: 'finish' });
    expect(finished.candidates).toEqual(ticked.candidates);
    expect(finished.agents).toEqual(ticked.agents);
  });
});

describe('judge', () => {
  const brief = buildBrief(initialState.profile, memoryFrom(initialState, opportunities), []);
  const find = (id: string) => catalog.find((c) => c.id === id)!;

  it('checks reposts before anything else', () => {
    expect(judge(find('c-swe-repost'), brief, new Set(['c-swe'])).reason).toBe('duplicate');
    expect(judge(find('c-swe'), brief, new Set()).reason).toBeNull();
  });

  it('gives a reason for each failed check', () => {
    expect(judge(find('c-fall'), brief, new Set()).reason).toBe('closed');
    expect(judge(find('c-sys-lab'), brief, new Set()).reason).toBe('unverified');
    expect(judge(find('c-bank'), brief, new Set()).reason).toBe('wrong_level');
    expect(judge(find('c-security'), brief, new Set()).reason).toBe('too_far');
  });
});
