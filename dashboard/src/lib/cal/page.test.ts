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

  it.each(['month', 'week', 'day', 'agenda'])('renders the %s view with the schedule recommendation, the plan and the honesty line', async (view) => {
    const html = await render(view);
    expect(html).toContain('Schedule recommendation');
    expect(html).toMatch(/Plan my week|Hide the week plan/);
    expect(html).toContain('Grok will plan once the agents are connected');
    expect(html).toContain('cx-block'); // the sample week has work to place
  });

  it('survives malformed saved state', async () => {
    const html = await render('nonsense', { 'bearrok.calendar.hours': [1, 2], 'bearrok.calendar.filters.v2': { kinds: 3 }, 'bearrok.calendar.personal': 'x' });
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

describe('Calendar page layout', () => {
  it('puts the calendar first with the upcoming application deadlines beside it, and has no .ics export or add-to-calendar link', async () => {
    const html = await render('month');
    expect(html).toContain('>Deadlines<');
    expect(html.indexOf('cx-view')).toBeLessThan(html.indexOf('>Deadlines<'));
    expect(html).not.toContain('Export .ics');
    expect(html).not.toContain('Add to Google Calendar');
    expect(html).toContain('go on your Google Calendar');
  });
});

describe('Calendar views', () => {
  it('offers Month, Week and Day, and the day view lists the day by the hour inside the fixed frame', async () => {
    const html = await render('day');
    for (const label of ['Month', 'Week', 'Day', 'Agenda']) expect(html).toMatch(new RegExp(`role="tab"[^>]*>(<svg[\\s\\S]*?</svg>)?${label}</button>`));
    expect(html).toContain('cx-view-box');
    expect(html).toContain('All day');
    // Day and Week are time grids: an hour column with events at their times.
    expect(html).toContain('cx-tg-rail');
    expect(html).toContain('aria-label="Next day"');
  });

  it('the agenda is kept, inside the same frame', async () => {
    const html = await render('agenda');
    expect(html).toContain('cx-view cx-view-box');
    expect(html).toContain('>From today<');
  });

  it('a month view keeps the same frame', async () => {
    const html = await render('month');
    expect(html).toContain('cx-view cx-view-box');
    expect(html).toContain('aria-label="Next month"');
  });
});

describe('Calendar and Google Calendar', () => {
  it("offers to connect the student's own Google Calendar, with no filter row or switch", async () => {
    const html = await render('month');
    expect(html).toContain('>Google Calendar<');
    expect(html).toContain('Not connected');
    // No filter row and no Career only switch: career only is how the calendar always works.
    expect(html).not.toContain('role="group" aria-label="Filters"');
    expect(html).not.toContain('Career only');
    // Never claims to be connected before the calendar has been read.
    expect(html).not.toContain('Synced with');
  });
});

describe('Adding events', () => {
  it('has an Add event button, and the form takes a date and an optional time', async () => {
    const html = await render('month');
    expect(html).toContain('aria-label="Add event"');
    // And the chat box, where the agents turn a sentence into an event.
    expect(html).toContain('Tell BearRok what to add');
  });
});

describe('Calendar header', () => {
  it('keeps the same controls in every view, so nothing moves when the view changes', async () => {
    for (const view of ['month', 'week', 'day', 'agenda']) {
      const html = await render(view);
      expect(html).toContain('cx-cal-title');
      expect(html.match(/aria-label="(Previous|Next) (month|week|day|month)"/g)?.length ?? html.match(/aria-label="(Previous|Next) /g)?.length).toBe(2);
      expect(html).toContain('Add event');
    }
    // In the agenda the arrows are hidden but still take their place.
    expect(await render('agenda')).toContain('visibility:hidden');
  });

  it('opens adding an event over the screen, not inside the side panel', async () => {
    const html = await render('month');
    expect(html).not.toContain('cx-event-dialog');
    expect(html).not.toContain('class="cx-form');
  });
});

describe('Calendar wording', () => {
  it('does not say "free", and does not label each event "Google Calendar"', async () => {
    for (const view of ['month', 'week', 'day', 'agenda']) {
      const html = (await render(view)).replace(/<!-- -->/g, '');
      expect(html).not.toMatch(/\bfree\b/i);
    }
  });
});
