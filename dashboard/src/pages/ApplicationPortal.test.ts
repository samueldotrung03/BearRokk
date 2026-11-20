import { createElement, type ReactNode } from 'react';
import { renderToString } from 'react-dom/server';
import { MemoryRouter, Route, Routes } from 'react-router';
import { describe, expect, it } from 'vitest';
import type { Portal, PortalApplication, PortalTab } from '../lib/portal/types.ts';

Object.assign(globalThis, {
  localStorage: { getItem: () => null, setItem: () => {}, removeItem: () => {}, clear: () => {}, key: () => null, length: 0 },
});

/** Renders inside the app's providers at `url`, with `path` routed so useParams works. */
async function render(url: string, path: string, element: ReactNode): Promise<string> {
  const { StoreProvider } = await import('../state/StoreProvider.tsx');
  const { AuthProvider } = await import('../auth/AuthProvider.tsx');
  const { LiveProvider } = await import('../state/live.tsx');
  const routes = createElement(Routes, null, createElement(Route, { path, element }));
  return renderToString(
    createElement(MemoryRouter, { initialEntries: [url] }, createElement(AuthProvider, null, createElement(StoreProvider, null, createElement(LiveProvider, null, routes)))),
  );
}

const text = (html: string) => html.replace(/<!-- -->/g, '').replace(/&#x27;/g, "'").replace(/&quot;/g, '"').replace(/&amp;/g, '&');

const application: PortalApplication = {
  opportunityId: 'opp-robotics',
  title: 'Robotics Lab Internship',
  organizer: 'Cal Robotics',
  status: 'applying',
  deadline: new Date(Date.now() + 10 * 86_400_000).toISOString(),
  actionUrl: 'https://example.org/apply',
  custom: false,
  updatedAt: '2026-11-18T00:00:00.000Z',
  progress: { done: 1, total: 3 },
};

const base = { wordLimit: null, files: [], done: false, updatedAt: '2026-11-18T00:00:00.000Z' };
const tabs: PortalTab[] = [
  { ...base, id: 'q1', kind: 'question', title: 'Why robotics', prompt: 'Why do you want to join our lab?', wordLimit: 5, body: 'I love building small rovers a lot.', source: 'posting' },
  { ...base, id: 'u1', kind: 'upload', title: 'Resume', prompt: 'One page, PDF.', body: '', source: 'agents', files: [{ id: 'f1', name: 'resume.pdf', size: 2048, type: 'application/pdf', addedAt: 'x' }], done: true },
  { ...base, id: 'n1', kind: 'note', title: 'People to ask', prompt: '', body: 'Professor Lee', source: 'student' },
];

describe('application portal page', () => {
  it('opens on the route with the id and says it is loading, with no backend needed to render', async () => {
    const { ApplicationPortal } = await import('./ApplicationPortal.tsx');
    const html = text(await render('/applications/opp-robotics', '/applications/:id', createElement(ApplicationPortal)));
    expect(html).toContain('Opening your application…');
  });

  it('explains a missing or unreachable application and links back to the list', async () => {
    const { PortalMessage } = await import('../components/applications/portal/PortalMessage.tsx');
    const missing = text(await render('/x', '/x', createElement(PortalMessage, { state: 'missing' })));
    expect(missing).toContain('This application is not on your account');
    expect(missing).toContain('href="/applications"');
    const offline = text(await render('/x', '/x', createElement(PortalMessage, { state: 'offline', onRetry: () => {} })));
    expect(offline).toContain('cannot reach your applications');
    expect(offline).toContain('Try again');
    expect(offline).toContain('href="/applications"');
  });

  it('shows the header, every tab in the left bar, and the first part open for writing', async () => {
    const { PortalWorkspace } = await import('../components/applications/portal/PortalWorkspace.tsx');
    const portal: Portal = { tabs, drafted: { at: 'x', found: true, note: '' } };
    const html = text(await render('/applications/opp-robotics', '/applications/:id', createElement(PortalWorkspace, { id: 'opp-robotics', application, portal })));
    // Header
    expect(html).toContain('href="/applications"');
    expect(html).toContain('Applying');
    expect(html).toMatch(/10 days left|9 days left/);
    expect(html).toContain('1 of 3 parts done');
    expect(html).toContain('Saved');
    expect(html).toContain('Export (.docx)');
    expect(html).toContain('href="/applications/opp-robotics/view"');
    expect(html).toContain('Mark as done');
    expect(html).toContain('href="https://example.org/apply"');
    // Left bar, in order, with the question's word count against its limit
    const order = ['Why robotics', 'Resume', 'People to ask'].map((t) => html.indexOf(`pt-tab-title">${t}`));
    expect(order.every((i) => i > 0)).toBe(true);
    expect([...order].sort((a, b) => a - b)).toEqual(order);
    expect(html).toContain('7/5');
    expect(html).toContain('draggable="true"');
    expect(html).toContain('Alt+ArrowUp');
    expect(html).toContain('Add</button>');
    // The open question: prompt, writing area, and the over-limit warning
    expect(html).toContain('Why do you want to join our lab?');
    expect(html).toContain('<textarea');
    expect(html).toContain('I love building small rovers a lot.');
    expect(html).toContain('7 of 5 words');
    expect(html).toContain('2 over the limit');
  });

  it('shows the agents looking when a new application has no parts yet', async () => {
    const { PortalWorkspace } = await import('../components/applications/portal/PortalWorkspace.tsx');
    const html = text(await render('/applications/a', '/applications/:id', createElement(PortalWorkspace, { id: 'a', application, portal: { tabs: [], drafted: null } })));
    expect(html).toContain("Your agents are looking for this application's questions and uploads…");
  });

  it('invites the student to add their own questions when the agents found none', async () => {
    const { PortalWorkspace } = await import('../components/applications/portal/PortalWorkspace.tsx');
    const portal: Portal = { tabs: [], drafted: { at: 'x', found: false, note: 'The organizer asks you to sign in to see the form.' } };
    const html = text(await render('/applications/a', '/applications/:id', createElement(PortalWorkspace, { id: 'a', application, portal })));
    expect(html).toContain('The organizer asks you to sign in to see the form.');
    expect(html).toContain('Add the questions yourself');
    expect(html).toContain('Add a question');
    expect(html).toContain('Add an upload');
    expect(html).toContain('Add a note');
    expect(html).toContain('Find questions again');
  });

  it('shows an applied application as Applied with a way to reopen it', async () => {
    const { PortalWorkspace } = await import('../components/applications/portal/PortalWorkspace.tsx');
    const html = text(await render('/applications/a', '/applications/:id', createElement(PortalWorkspace, { id: 'a', application: { ...application, status: 'applied' }, portal: { tabs, drafted: null } })));
    expect(html).toContain('Applied');
    expect(html).toContain('Reopen');
    expect(html).not.toContain('Mark as done');
  });
});

describe('portal editors', () => {
  it('an upload part lists its files and says plainly that they stay on this computer', async () => {
    const { TabEditor } = await import('../components/applications/portal/TabEditor.tsx');
    const html = text(await render('/x', '/x', createElement(TabEditor, { tab: tabs[1]!, index: 1, total: 3, onChange: () => {}, onDelete: () => {} })));
    expect(html).toContain('One page, PDF.');
    expect(html).toContain('Drop files here');
    expect(html).toContain('type="file"');
    expect(html).toContain('resume.pdf');
    expect(html).toContain('2 KB');
    expect(html).toContain('Remove resume.pdf');
    expect(html).toContain('Download resume.pdf');
    expect(html).toContain('Files stay on this computer');
  });

  it('a note is a free document with an editable title', async () => {
    const { TabEditor } = await import('../components/applications/portal/TabEditor.tsx');
    const html = text(await render('/x', '/x', createElement(TabEditor, { tab: tabs[2]!, index: 2, total: 3, onChange: () => {}, onDelete: () => {} })));
    expect(html).toContain('value="People to ask"');
    expect(html).toContain('works as your own doc');
    expect(html).toContain('Professor Lee');
    expect(html).toContain('Delete People to ask');
  });

  it("a student's own question has an editable prompt and word limit", async () => {
    const { TabEditor } = await import('../components/applications/portal/TabEditor.tsx');
    const { newTab } = await import('../lib/portal/tabs.ts');
    const html = text(await render('/x', '/x', createElement(TabEditor, { tab: newTab('question', {}, 'q9'), index: 0, total: 1, onChange: () => {}, onDelete: () => {} })));
    expect(html).toContain('Prompt');
    expect(html).toContain('Word limit (optional)');
    expect(html).toContain('Added by you');
  });
});

describe('view all page', () => {
  it('opens on its route and says it is loading', async () => {
    const { ApplicationView } = await import('./ApplicationView.tsx');
    const html = text(await render('/applications/opp-robotics/view', '/applications/:id/view', createElement(ApplicationView)));
    expect(html).toContain('Opening your application…');
  });

  it('lays out every part in order for a reader, ready to print', async () => {
    const { ApplicationViewReady } = await import('./ApplicationView.tsx');
    const html = text(await render('/applications/opp-robotics/view', '/applications/:id/view', createElement(ApplicationViewReady, { id: 'opp-robotics', application, tabs })));
    expect(html).toContain('Print');
    expect(html).toContain('href="/applications/opp-robotics"');
    expect(html).toContain('Robotics Lab Internship');
    expect(html).toContain('Cal Robotics');
    expect(html).toContain('Deadline: ');
    expect(html).toContain('pt-print-root');
    const order = ['Why robotics', 'Why do you want to join our lab?', 'I love building small rovers a lot.', '7 of 5 words', 'Resume', 'resume.pdf', 'People to ask', 'Professor Lee'].map((t) => html.indexOf(t));
    expect(order.every((i) => i > 0)).toBe(true);
    expect([...order].sort((a, b) => a - b)).toEqual(order);
    expect(html).toContain('Part 1 of 3');
  });
});
