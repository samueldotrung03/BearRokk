// Renders the Today page to HTML for the sample student and for a brand-new one, so a broken
// section or a missing honesty line fails here rather than in the demo. No browser is needed.
import { createElement } from 'react';
import { renderToString } from 'react-dom/server';
import { MemoryRouter } from 'react-router';
import { beforeEach, describe, expect, it } from 'vitest';
import { initialState } from '../../data/sample.ts';
import { currentRoadmap } from '../roadmap.ts';

const store = new Map<string, string>();
const memoryStorage = {
  getItem: (key: string) => store.get(key) ?? null,
  setItem: (key: string, value: string) => void store.set(key, value),
  removeItem: (key: string) => void store.delete(key),
  clear: () => store.clear(),
  key: () => null,
  length: 0,
};
Object.assign(globalThis, { localStorage: memoryStorage });

async function render(saved?: unknown) {
  store.clear();
  if (saved) store.set('bearrok.dashboard.v3', JSON.stringify(saved));
  const { Today } = await import('../../pages/Today.tsx');
  const { StoreProvider } = await import('../../state/StoreProvider.tsx');
  const { AuthProvider } = await import('../../auth/AuthProvider.tsx');
  const { LiveProvider } = await import('../../state/live.tsx');
  // The page header reads the signed-in account and the live data, so both providers wrap it.
  const page = createElement(AuthProvider, null, createElement(StoreProvider, null, createElement(LiveProvider, null, createElement(Today))));
  return renderToString(createElement(MemoryRouter, null, page));
}

describe('Today page', () => {
  beforeEach(() => store.clear());

  it('renders every section for the sample student', async () => {
    const html = await render();
    for (const text of ['Today&#x27;s brief', 'Do today', 'Closing this week', 'New for you', 'Your progress', 'Ask BearRok']) {
      expect(html).toContain(text);
    }
    expect(html).toContain('td-action'); // the sample student has things to do
    expect(html).toContain('Grok will write it once the agents are connected');
  });

  it('shows the start screen for a brand-new student with nothing due', async () => {
    const steps = currentRoadmap(initialState.goalId).phases.flatMap((phase) => phase.steps.map((step) => step.id));
    const html = await render({ ...initialState, applications: {}, saved: [], liked: [], extraSteps: [], doneSteps: steps });
    expect(html).toContain('Nothing to do today');
    expect(html).toContain('Open your feed');
    expect(html).toContain('href="/discover"');
    // With no agent results there is no feed to point at; the sample set is not shown in its place.
    expect(html).toContain('Nothing is due yet. Save a few things from your feed and they will show up here.');
  });
});
