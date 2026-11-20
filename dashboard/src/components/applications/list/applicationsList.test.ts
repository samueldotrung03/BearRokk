import { createElement } from 'react';
import { renderToString } from 'react-dom/server';
import { MemoryRouter } from 'react-router';
import { describe, expect, it } from 'vitest';

Object.assign(globalThis, {
  localStorage: { getItem: () => null, setItem: () => {}, removeItem: () => {}, clear: () => {}, key: () => null, length: 0 },
});

describe('Applications page', () => {
  it('with nothing tracked, explains the link to Saved and offers New application, with no sample data', async () => {
    const { Applications } = await import('../../../pages/Applications.tsx');
    const { StoreProvider } = await import('../../../state/StoreProvider.tsx');
    const { AuthProvider } = await import('../../../auth/AuthProvider.tsx');
    const { LiveProvider } = await import('../../../state/live.tsx');
    const html = renderToString(
      createElement(MemoryRouter, null, createElement(AuthProvider, null, createElement(StoreProvider, null, createElement(LiveProvider, null, createElement(Applications))))),
    );
    expect(html).toContain('New application');
    expect(html).toContain('Postings you set to To apply or Applying on the Saved page appear here');
    expect(html).toContain('href="/saved"');
    // The old page's sample-driven parts are gone.
    expect(html).not.toContain('Export all deadlines');
    expect(html).not.toContain('Go to the feed');
  });
});

describe('application row', () => {
  it('links into the portal and shows status, days left, progress and the custom label', async () => {
    const { ApplicationListRow } = await import('./ApplicationListRow.tsx');
    const now = Date.parse('2026-11-19T12:00:00Z');
    const html = renderToString(
      createElement(
        MemoryRouter,
        null,
        createElement(ApplicationListRow, {
          now,
          application: {
            opportunityId: 'custom-abc 1',
            title: 'Summer research',
            organizer: 'Physics lab',
            status: 'applying',
            deadline: new Date(now + 4 * 86_400_000).toISOString(),
            actionUrl: null,
            custom: true,
            updatedAt: '',
            progress: { done: 3, total: 7 },
            kind: 'custom',
          },
        }),
      ),
    );
    expect(html).toContain('href="/applications/custom-abc%201"');
    expect(html).toContain('Summer research');
    expect(html).toContain('Applying');
    expect(html).toContain('4 days left');
    expect(html).toContain('3 of 7 parts done');
    expect(html).toContain('Made by you');
  });

  it('a posting row keeps its picture and shows the deadline, who can apply and what it asks for instead of the description', async () => {
    const { ApplicationListRow } = await import('./ApplicationListRow.tsx');
    const { StoreProvider } = await import('../../../state/StoreProvider.tsx');
    const { AuthProvider } = await import('../../../auth/AuthProvider.tsx');
    const { opportunities } = await import('../../../data/sample.ts');
    const now = Date.parse('2026-11-19T12:00:00Z');
    const posting = { ...opportunities[0]!, id: 'p1', image: 'https://example.org/event.jpg', eligibility: 'Undergraduates in any major', fitExplanation: 'DESCRIPTION TEXT' };
    const html = renderToString(
      createElement(
        MemoryRouter,
        null,
        createElement(AuthProvider, null, createElement(
          StoreProvider,
          null,
          createElement(ApplicationListRow, {
            now,
            posting,
            tracked: { opportunityId: 'p1', status: 'to_apply', deadline: null, actionUrl: null, prompts: ['Why us?', 'A project'], materials: ['Resume'], reminders: [], needsDeadline: false, calendar: { state: 'none', eventId: null, htmlLink: null, addUrl: null, error: null } },
            application: { opportunityId: 'p1', title: posting.title, organizer: posting.organizer, status: 'to_apply', deadline: new Date(now + 10 * 86_400_000).toISOString(), actionUrl: null, custom: false, updatedAt: '', progress: { done: 0, total: 3 }, kind: posting.type },
          }),
        )),
      ),
    );
    expect(html).toContain('feed-row');
    expect(html).toContain('https://example.org/event.jpg');
    expect(html).toContain('Who can apply');
    expect(html).toContain('Undergraduates in any major');
    expect(html).toContain('2 questions, resume');
    expect(html).toContain('10 days left');
    expect(html).not.toContain('DESCRIPTION TEXT');
  });
});
