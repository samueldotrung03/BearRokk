import { describe, expect, it } from 'vitest';
import { initialState, opportunities } from '../data/sample.ts';
import { reducer } from '../state/store.ts';
import { findOpportunity, respond, suggestionsFor } from './assistant.ts';

const NOW = Date.now();

describe('assistant', () => {
  it('finds the opportunity a message names and ignores filler words', () => {
    expect(findOpportunity('tell me about northwind', opportunities)?.id).toBe('opp-northwind-swe');
    expect(findOpportunity('show me an internship', opportunities)).toBeUndefined();
  });

  it('offers a status change as an action instead of making it', () => {
    const reply = respond('mark Harbor Analytics as applying', initialState, NOW);
    const action = reply.actions!.find((a) => a.dispatch)!;
    expect(action.dispatch).toEqual({ type: 'setApplication', id: 'opp-harbor-data', status: 'applying' });
    expect(reply.text).toContain('Reminders');
  });

  it('answers the week from the calendar, with what has to be done first', () => {
    const reply = respond('what should I do this week?', initialState, NOW);
    expect(reply.text).toMatch(/\d+ thing/);
    expect(reply.actions!.some((a) => a.to === '/calendar')).toBe(true);
  });

  it('reports roadmap progress that changes when a step is ticked', () => {
    const before = respond('am I on track with my roadmap?', initialState, NOW);
    const next = before.actions!.find((a) => a.dispatch)!;
    const after = respond('am I on track with my roadmap?', reducer(initialState, next.dispatch!), NOW);
    expect(after.text).not.toBe(before.text);
  });

  it('finds by type and never shows a dismissed card', () => {
    const reply = respond('find internships', initialState, NOW);
    expect(reply.actions!.every((a) => opportunities.find((o) => o.id === a.open)!.type === 'internship')).toBe(true);
    const dismissed = reducer(initialState, { type: 'dismiss', id: 'opp-northwind-swe' });
    expect(respond('find internships', dismissed, NOW).actions!.map((a) => a.open)).not.toContain('opp-northwind-swe');
  });

  it('falls back to help it can act on, and suggests by page', () => {
    expect(respond('asdf qwer', initialState, NOW).points!.length).toBeGreaterThan(2);
    expect(suggestionsFor('/roadmap')).not.toEqual(suggestionsFor('/'));
  });
});
