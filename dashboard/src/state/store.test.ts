import { describe, expect, it } from 'vitest';
import { initialState, opportunities } from '../data/sample.ts';
import type { Opportunity } from '../types.ts';
import { rankFeed, rankFeedDetailed } from './ranking.ts';
import { reducer, type AppState } from './store.ts';

const scores = (state: AppState = initialState) =>
  new Map(rankFeedDetailed(opportunities, state).map((r) => [r.opportunity.id, r.score]));
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
