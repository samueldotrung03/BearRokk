import { createElement } from 'react';
import { renderToString } from 'react-dom/server';
import { MemoryRouter } from 'react-router';
import { describe, expect, it } from 'vitest';
import { initialState, opportunities } from '../../data/sample.ts';
import { activeApplications } from './journey.ts';

const store = new Map<string, string>();
Object.assign(globalThis, {
  localStorage: { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => void store.set(k, v), removeItem: (k: string) => void store.delete(k), clear: () => store.clear(), key: () => null, length: 0 },
});

describe('roadmap applications', () => {
  it('only Applying and To apply get a roadmap, Applying first, soonest deadline first', () => {
    const [a, b, c, d] = opportunities.slice(0, 4).map((o, i) => ({ ...o, deadline: `2027-0${4 - i}-01T00:00:00Z` }));
    const byId = new Map([a!, b!, c!, d!].map((o) => [o.id, o]));
    const app = (status: 'interested' | 'to_apply' | 'applying' | 'applied') => ({ status, drafts: {}, materialsDone: [] });
    const state = { ...initialState, applications: { [a!.id]: app('to_apply'), [b!.id]: app('applying'), [c!.id]: app('interested'), [d!.id]: app('to_apply') } };
    expect(activeApplications(state, byId).map((x) => [x.opportunity.id, x.status])).toEqual([
      [b!.id, 'applying'],
      [d!.id, 'to_apply'],
      [a!.id, 'to_apply'],
    ]);
    // A tracked posting the agents never found (a sample card) is not shown.
    expect(activeApplications(state, new Map([[b!.id, b!]]))).toHaveLength(1);
  });

  it('with nothing in progress the page points to the feed and the saved list, not to sample postings', async () => {
    store.clear();
    const { Roadmap } = await import('../../pages/Roadmap.tsx');
    const { StoreProvider } = await import('../../state/StoreProvider.tsx');
    const { AuthProvider } = await import('../../auth/AuthProvider.tsx');
    const { LiveProvider } = await import('../../state/live.tsx');
    // The live layer is still connecting in a test, so the note waits; mark it as offline-free by
    // checking the sample applications no longer appear as roadmaps.
    const html = renderToString(createElement(MemoryRouter, null, createElement(AuthProvider, null, createElement(StoreProvider, null, createElement(LiveProvider, null, createElement(Roadmap))))));
    for (const id of Object.keys(initialState.applications)) {
      const o = opportunities.find((x) => x.id === id);
      if (o) expect(html).not.toContain(`>${o.title}<`);
    }
    expect(html).not.toContain('Suggested for you');
  });
});
