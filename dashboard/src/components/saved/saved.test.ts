// The Saved page and the expanded details of a saved row, rendered to HTML.
import { createElement } from 'react';
import { renderToString } from 'react-dom/server';
import { MemoryRouter } from 'react-router';
import { describe, expect, it } from 'vitest';
import { opportunities } from '../../data/sample.ts';

const store = new Map<string, string>();
Object.assign(globalThis, {
  localStorage: { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => void store.set(k, v), removeItem: (k: string) => void store.delete(k), clear: () => store.clear(), key: () => null, length: 0 },
});

async function wrap(child: ReturnType<typeof createElement>) {
  const { StoreProvider } = await import('../../state/StoreProvider.tsx');
  const { AuthProvider } = await import('../../auth/AuthProvider.tsx');
  const { LiveProvider } = await import('../../state/live.tsx');
  // React marks the joins between pieces of text; they are taken out so sentences read whole.
  return renderToString(createElement(MemoryRouter, null, createElement(AuthProvider, null, createElement(StoreProvider, null, createElement(LiveProvider, null, child))))).replace(/<!-- -->/g, '');
}

const inDays = (n: number) => new Date(Date.now() + n * 86_400_000).toISOString();

describe('saved details', () => {
  it('shows the deadline with where it was read, and says plainly what the posting did not state', async () => {
    const { SavedDetails } = await import('./SavedDetails.tsx');
    // A posting the sample student is not tracking.
    const o = {
      ...opportunities[0]!,
      id: 'opp-test-listing',
      deadline: inDays(5),
      deadlineSource: 'listing' as const,
      deadlineEvidence: { quote: 'Applications close January 29', url: 'https://career.example.edu/goldwater' },
      eligibility: null,
      actionUrl: 'https://apply.example.org/form',
    };
    const html = await wrap(createElement(SavedDetails, { opportunity: o, application: undefined }));
    expect(html).toContain('5 days left');
    expect(html).toContain('career.example.edu');
    expect(html).toContain('Applications close January 29');
    expect(html).toContain('The posting does not say');
    expect(html).toContain('Set it to To apply or Applying and the deadline goes on your Google Calendar');
    expect(html).toContain('href="https://apply.example.org/form"');
    expect(html).toContain('Official page');
  });

  it('offers to add a deadline when none is known, and shows the calendar link once applying', async () => {
    const { SavedDetails } = await import('./SavedDetails.tsx');
    const o = { ...opportunities[0]!, id: 'opp-test-undated', deadline: null };
    const noDeadline = await wrap(createElement(SavedDetails, { opportunity: o, application: undefined }));
    expect(noDeadline).toContain('Not stated on the posting');
    expect(noDeadline).toContain('Add deadline');

    store.set('bearrok.dashboard.v3', JSON.stringify({ applications: { [o.id]: { status: 'applying', drafts: {}, materialsDone: [] } } }));
    const application = {
      opportunityId: o.id,
      status: 'applying' as const,
      deadline: inDays(9),
      actionUrl: null,
      prompts: ['Why us?'],
      materials: ['Résumé'],
      reminders: [{ at: inDays(2), label: 'Due in one week' }],
      needsDeadline: false,
      calendar: { state: 'link' as const, eventId: null, htmlLink: null, addUrl: 'https://calendar.google.com/calendar/render?action=TEMPLATE', error: null },
    };
    const applying = await wrap(createElement(SavedDetails, { opportunity: { ...o, deadline: application.deadline }, application }));
    // No link to add it by hand: BearRok adds it once Google Calendar is connected.
    expect(applying).not.toContain('Add to Google Calendar');
    expect(applying).toContain('connect Google Calendar and BearRok adds it');
    expect(applying).toContain('Reminders:');
    expect(applying).toContain('Needs: Résumé');
    expect(applying).toContain('1 question on the form');
    store.clear();
  });
});

describe('saved page', () => {
  it('has the Saved and Sheet view tabs', async () => {
    const { Saved } = await import('../../pages/Saved.tsx');
    const html = await wrap(createElement(Saved));
    expect(html).toContain('role="tablist"');
    expect(html).toContain('>Saved<');
    expect(html).toContain('Sheet view');
  });
});

describe('sheet view', () => {
  it('is always a spreadsheet: every column is set and blank rows wait to be filled, even with nothing loaded', async () => {
    const { SheetView, SHEET_COLUMNS } = await import('./SheetView.tsx');
    const html = await wrap(createElement(SheetView, { refreshKey: 'x' }));
    for (const column of SHEET_COLUMNS) expect(html).toContain(`<th scope="col" data-column="${column}">${column}</th>`);
    expect(html.match(/class="saved-sheet-blank"/g)?.length).toBe(14);
    expect(html).toContain('Loading your saved list');
    // Signed out there is no account to make a Google Sheet for, so only the description offers it.
    expect(html).toContain('Create a Google Sheet to have a copy in your own Drive');
  });

  it('has the same columns as the sheet the backend writes', async () => {
    const { SHEET_COLUMNS } = await import('./SheetView.tsx');
    const { readFileSync } = await import('node:fs');
    const source = readFileSync(new URL('../../../../backend/src/sheets.ts', import.meta.url), 'utf8');
    const block = /TRACKER_HEADER = \[([\s\S]*?)\];/.exec(source)![1]!;
    expect([...block.matchAll(/'([^']+)'/g)].map((m) => m[1])).toEqual(SHEET_COLUMNS);
  });
});

describe('empty kinds', () => {
  it('lists every kind on the Saved page, with 0 for the ones nothing is saved in', async () => {
    const { Saved } = await import('../../pages/Saved.tsx');
    const { typeMeta } = await import('../meta.ts');
    const html = await wrap(createElement(Saved));
    for (const meta of Object.values(typeMeta)) expect(html).toContain(`>${meta.plural}</span><span class="feed-cat-count">0</span>`);
    expect(html).toContain('>All</span><span class="feed-cat-count">0</span>');
  });

  it('an empty kind says so and offers to search for more of it', async () => {
    const { EmptyKind } = await import('../../pages/Feed.tsx');
    const html = await wrap(createElement(EmptyKind, { type: 'research', searching: false, onSearch: () => {} }));
    expect(html).toContain('No research yet');
    expect(html).toContain('Search for more research');
  });
});

describe('status and sheet updates', () => {
  it('saving a card makes it Interested, and the status menu has no "not tracking"', async () => {
    const { reducer } = await import('../../state/store.ts');
    const { initialState } = await import('../../data/sample.ts');
    const fresh = { ...initialState, saved: [], applications: {} };
    const saved = reducer(fresh, { type: 'toggleSaved', id: 'x' });
    expect(saved.applications.x?.status).toBe('interested');
    expect(reducer(saved, { type: 'toggleSaved', id: 'x' }).applications.x).toBeUndefined();

    const { StatusSelect } = await import('../StatusSelect.tsx');
    const html = await wrap(createElement(StatusSelect, { id: 'not-saved' }));
    expect(html).not.toMatch(/not tracking/i);
    expect(html).toContain('<option value="interested" selected="">Interested</option>');
  });

  it('the sheet has no update button: a created Google Sheet updates on its own', async () => {
    const { SheetView } = await import('./SheetView.tsx');
    const html = await wrap(createElement(SheetView, { refreshKey: 'x' }));
    expect(html).not.toMatch(/update now/i);
  });
});

describe('feed on launch', () => {
  it('says it is loading, not that there is nothing, before the student’s data has arrived', async () => {
    const { Feed } = await import('../../pages/Feed.tsx');
    const html = await wrap(createElement(Feed));
    expect(html).toContain('Loading your feed');
    expect(html).not.toContain('Nothing here yet');
    expect(html).not.toContain('You are all caught up');
  });

  it('does not let the browser hold the end card in view as cards arrive above it', async () => {
    const { readFileSync } = await import('node:fs');
    const css = readFileSync(new URL('../../index.css', import.meta.url), 'utf8');
    expect(css).toMatch(/\.reel-scroller \{[^}]*overflow-anchor: none/);
  });
});
