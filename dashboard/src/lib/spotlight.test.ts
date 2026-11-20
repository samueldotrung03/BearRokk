import { describe, expect, it } from 'vitest';
import { initialState } from '../data/sample.ts';
import { reducer } from '../state/store.ts';
import { opportunitiesForRoadmap } from './roadmapMatch.ts';
import { planFor } from './roadmap.ts';
import { opportunities } from '../data/sample.ts';
import { score, spotlight } from './spotlight.ts';

const NOW = Date.now();
const flat = (query: string, state = initialState) => spotlight(query, state, NOW).flatMap((group) => group.items);

describe('spotlight', () => {
  it('scores a start-of-word hit above a hit in the middle, and needs every term', () => {
    expect(score('Roadmap', 'road')).toBeGreaterThan(score('Your roadmap', 'road'));
    expect(score('Your roadmap', 'road')).toBeGreaterThan(score('Broad map', 'road'));
    expect(score('Software Engineering Intern', 'software zebra')).toBe(0);
  });

  it('shows suggestions before anything is typed', () => {
    const groups = spotlight('', initialState, NOW);
    expect(groups.map((group) => group.title)).toEqual(['Suggested', 'Top picks for you', 'Go to']);
  });

  it('puts the best match first as the top hit and does not list it twice', () => {
    const items = flat('northwind');
    expect(items[0]!.open).toBe('opp-northwind-swe');
    expect(items.filter((item) => item.id === items[0]!.id)).toHaveLength(1);
    expect(flat('calendar')[0]!.to).toBe('/calendar');
  });

  it('always ends with a way to ask, and never shows a dismissed card', () => {
    expect(flat('zzzz').at(-1)).toMatchObject({ kind: 'ask', ask: 'zzzz' });
    const dismissed = reducer(initialState, { type: 'dismiss', id: 'opp-northwind-swe' });
    expect(flat('northwind', dismissed).some((item) => item.open === 'opp-northwind-swe')).toBe(false);
  });
});

describe('opportunities matched to the roadmap', () => {
  const matches = (state = initialState) => opportunitiesForRoadmap(planFor(state), state, opportunities, 20);

  it('lists the cards the roadmap names first, then others, each once', () => {
    const list = matches();
    const firstSuggested = list.findIndex((match) => !match.linked);
    expect(list.slice(0, firstSuggested).every((match) => match.linked)).toBe(true);
    expect(list.slice(firstSuggested).every((match) => !match.linked)).toBe(true);
    expect(new Set(list.map((match) => match.opportunity.id)).size).toBe(list.length);
    expect(list.some((match) => !match.linked)).toBe(true);
  });

  it('drops a card once its step is done or the card is dismissed', () => {
    const done = reducer(initialState, { type: 'toggleStep', id: 'step-hack' });
    expect(matches(done).some((match) => match.linked && match.opportunity.id === 'opp-bay-hack')).toBe(false);
    const dismissed = reducer(initialState, { type: 'dismiss', id: 'opp-systems-club' });
    expect(matches(dismissed).some((match) => match.opportunity.id === 'opp-systems-club')).toBe(false);
  });
});
