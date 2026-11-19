import { describe, expect, it } from 'vitest';
import { magnification } from '../components/Dock.tsx';
import { initialState, opportunities } from '../data/sample.ts';
import { rankFeed, reducer } from './store.ts';

const ids = (state = initialState) => rankFeed(opportunities, state).map((o) => o.id);

describe('rankFeed', () => {
  it('orders by the agent score when there is no history', () => {
    const scores = rankFeed(opportunities, initialState).map((o) => o.baseScore);
    expect(scores).toEqual([...scores].sort((a, b) => b - a));
  });

  it('removes a dismissed card and lowers the others of its type', () => {
    const before = ids();
    const state = reducer(initialState, { type: 'dismiss', id: 'opp-northwind-swe' });
    const after = ids(state);
    expect(after).not.toContain('opp-northwind-swe');
    // The other internship sat above the career fair; one dismissal drops it below.
    expect(before.indexOf('opp-harbor-data')).toBeLessThan(before.indexOf('opp-career-fair'));
    expect(after.indexOf('opp-harbor-data')).toBeGreaterThan(after.indexOf('opp-career-fair'));
  });

  it('lifts cards of a type the student saved', () => {
    const state = reducer(initialState, { type: 'toggleSaved', id: 'opp-lumen-info' });
    const after = ids(state);
    expect(after.indexOf('opp-career-fair')).toBeLessThan(ids().indexOf('opp-career-fair'));
    expect(after).toContain('opp-lumen-info');
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

describe('dock magnification', () => {
  it('is largest under the pointer and back to resting size at the edge of its reach', () => {
    expect(magnification(0)).toBeCloseTo(1.5);
    expect(magnification(60)).toBeGreaterThan(magnification(100));
    expect(magnification(130)).toBe(1);
    expect(magnification(500)).toBe(1);
  });
});
