// Renders the Calendar page to HTML in each view with the plan open, so a broken view or a
// missing honesty line fails here rather than in the demo. No browser is needed.
import { createElement } from 'react';
import { renderToString } from 'react-dom/server';
import { MemoryRouter } from 'react-router';
import { beforeEach, describe, expect, it } from 'vitest';

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

async function render(view: string, extra: Record<string, unknown> = {}) {
  store.clear();
  store.set('bearrok.calendar.view', JSON.stringify(view));
  store.set('bearrok.calendar.planOpen', 'true');
  for (const [key, value] of Object.entries(extra)) store.set(key, JSON.stringify(value));
  const { Calendar } = await import('../../pages/Calendar.tsx');
  const { StoreProvider } = await import('../../state/StoreProvider.tsx');
  const { AuthProvider } = await import('../../auth/AuthProvider.tsx');
  const { LiveProvider } = await import('../../state/live.tsx');
  // The page header reads the signed-in account and the live data, so both providers wrap it.
  const page = createElement(AuthProvider, null, createElement(StoreProvider, null, createElement(LiveProvider, null, createElement(Calendar))));
  return renderToString(createElement(MemoryRouter, null, page));
}

describe('Calendar page', () => {
  beforeEach(() => store.clear());

  it.each(['month', 'week', 'agenda'])('renders the %s view with the brief, the plan and the honesty line', async (view) => {
    const html = await render(view);
    expect(html).toContain('Today&#x27;s brief');
    expect(html).toContain('Plan my week');
    expect(html).toContain('Grok will plan once the agents are connected');
    expect(html).toContain('cx-block'); // the sample week has work to place
  });

  it('survives malformed saved state', async () => {
    const html = await render('nonsense', { 'bearrok.calendar.hours': [1, 2], 'bearrok.calendar.filters': { kinds: 3 }, 'bearrok.calendar.personal': 'x' });
    expect(html).toContain('role="grid"');
  });

  it('shows an accepted block on the calendar and in the plan', async () => {
    const today = new Date();
    const day = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    const html = await render('month', {
      'bearrok.calendar.personal': [
        { id: 'p1', day, title: 'Work on: Test block', priority: 'must', note: '', done: false, block: { targetId: 'deadline-opp-northwind-swe', hours: 2, why: 'Because.' } },
      ],
    });
    expect(html).toContain('cx-block-accepted');
    expect(html).toContain('Work on: Test block');
  });
});
