// Renders the Today page to HTML for the sample student and for a brand-new one, so a broken
// section or a missing honesty line fails here rather than in the demo. No browser is needed.
import { createElement } from 'react';
import { renderToString } from 'react-dom/server';
import { MemoryRouter } from 'react-router';
import { beforeEach, describe, expect, it } from 'vitest';
import { initialState } from '../../data/sample.ts';

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
    for (const text of ['New for you', 'What your goal asks for', 'Profile strength', 'Add a reminder for today', 'Due this week', 'This week', 'Applications', 'Next steps', 'Your agents']) {
      expect(html).toContain(text);
    }
    expect(html).toContain('Grok will write it once the agents are connected');
  });

  it('still renders for a brand-new student with nothing tracked', async () => {
    const html = await render({ ...initialState, applications: {}, saved: [], liked: [], extraSteps: [], doneSteps: [] });
    expect(html).toContain('Nothing tracked yet');
    expect(html).toContain('None tracked yet');
    expect(html).not.toContain('Do today');
  });
});
