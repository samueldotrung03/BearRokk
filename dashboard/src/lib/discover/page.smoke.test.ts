// Renders the page and the guide on the server, so a broken component shows up in `vitest` without
// a browser. Checks that each part is there, in the order the student reads it.
import { createElement } from 'react';
import { renderToString } from 'react-dom/server';
import { MemoryRouter } from 'react-router';
import { afterEach, describe, expect, it } from 'vitest';
import { AuthProvider } from '../../auth/AuthProvider.tsx';
import { CareerGuide } from '../../components/discover/CareerGuide.tsx';
import { quizQuestions } from '../../data/discover-extra.ts';
import { Discover } from '../../pages/Discover.tsx';
import { LiveProvider } from '../../state/live.tsx';
import { StoreProvider } from '../../state/StoreProvider.tsx';
import { providerLabel, slugFor, stepLine, type Guide, type SectionId } from './guide.ts';

// The page header reads the signed-in account and the live data, so both providers wrap it.
const render = () =>
  renderToString(
    createElement(
      MemoryRouter,
      null,
      createElement(AuthProvider, null, createElement(StoreProvider, null, createElement(LiveProvider, null, createElement(Discover)))),
    ),
  );

function stubStorage(entries: Record<string, unknown>) {
  const data = new Map(Object.entries(entries).map(([k, v]) => [k, JSON.stringify(v)]));
  (globalThis as { localStorage?: unknown }).localStorage = {
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => void data.set(key, value),
  };
}

afterEach(() => {
  delete (globalThis as { localStorage?: unknown }).localStorage;
});

const done = <T,>(data: T, sample = false) => ({ status: 'done' as const, data, sample, error: null });
const waiting = { status: 'waiting' as const, data: null, sample: false, error: null };

const guide = (over: Partial<Guide> = {}): Guide => ({
  slug: 'economist',
  query: 'economist',
  title: 'Economist',
  oneLine: 'Studies how people and markets use scarce resources.',
  field: 'economics',
  status: 'ready',
  provider: 'claude',
  startedAt: '2026-11-19T10:00:00Z',
  updatedAt: '2026-11-19T10:02:00Z',
  error: null,
  sections: {
    basics: done({ summary: 'Economists study data.', whatTheyDo: ['Build models'], whereTheyWork: ['Central banks'], skills: ['Statistics'], pay: null, outlook: null, sources: [{ title: 'BLS', url: 'https://www.bls.gov/' }] }),
    voices: done({ posts: [{ author: 'Maya R.', role: 'Analyst at a mid-size bank', handle: null, text: 'Most of my day is cleaning data.', takeaway: 'Learn to clean data.', url: null, date: null }] }, true),
    start: done({ steps: [{ title: 'Take intro economics', detail: 'Start with micro.', resource: null }], resources: [] }),
    interview: done({ formats: [{ name: 'Case interview', tests: 'How you reason', howToPractice: 'Practise cases aloud', url: null }], questions: [{ kind: 'Case interview', question: 'How would a sugar tax change demand?' }], sources: [] }),
  },
  ...over,
});

const renderGuide = (g: Guide, firstPart: SectionId = 'basics') => renderToString(createElement(CareerGuide, { guide: g, onSearchAgain: () => {}, onAddMore: () => {}, firstPart }));

describe('Discover page', () => {
  it('opens on the career search with quick picks and the path finder closed', () => {
    const html = render();
    for (const text of ['Career discovery', 'Which career do you want to learn about?', 'Learn', 'Not sure? Find my path', 'Type a career above, or pick one, to see its guide.']) {
      expect(html).toContain(text);
    }
    expect(html).toContain('aria-expanded="false"');
    expect(html).not.toContain('Start the quiz');
  });

  it("offers the student's best matches as quick picks, outside technology too", () => {
    const answers = Object.fromEntries(quizQuestions.map((q) => [q.id, [...q.options].sort((a, b) => (b.fit['path-health'] ?? 0) - (a.fit['path-health'] ?? 0))[0]!.id]));
    stubStorage({ 'bearrok.discover.answers': answers });
    const picks = render().split('dc-learn-picks')[1]!;
    expect(picks).toContain('Healthcare and pre-med');
  });
});

describe('Career guide', () => {
  it('lists the four parts as tabs in the order a student needs them, and shows only the first', () => {
    const html = renderGuide(guide());
    const tabs = html.slice(html.indexOf('role="tablist"'), html.indexOf('role="tabpanel"'));
    const order = ['The basics', 'What people in the job say', 'How to start', 'What the interviews ask'].map((t) => tabs.indexOf(t));
    expect(order.every((i) => i > -1)).toBe(true);
    expect([...order].sort((a, b) => a - b)).toEqual(order);
    expect(html.match(/role="tabpanel"/g)).toHaveLength(1);
    expect(html).toContain('aria-selected="true"');
    expect(html).toContain('Economists study data.');
    expect(html).not.toContain('Most of my day is cleaning data.');
    expect(html).not.toContain('How would a sugar tax change demand?');
    expect(html).toContain('Next: What people in the job say');
  });

  it('marks each tab with its own part icon, faint until the part is researched', () => {
    const tabs = (g: Guide) => { const html = renderGuide(g); return html.slice(html.indexOf('role="tablist"'), html.indexOf('role="tabpanel"')); };
    const ready = tabs(guide());
    expect(ready.match(/viewBox="0 0 256 256"/g)).toHaveLength(4);
    expect(ready.match(/dc-step-mark is-done/g)).toHaveLength(4);
    const researching = tabs(guide({ status: 'researching', sections: { ...guide().sections, voices: waiting, interview: { ...waiting, status: 'working' } } }));
    expect(researching.match(/dc-step-mark is-done/g)).toHaveLength(2);
    expect(researching).toContain('dc-step-mark is-working');
  });

  it('offers Add more on a part and says what the last one found', () => {
    const g = guide();
    g.sections.basics = { ...g.sections.basics, added: { count: 3, at: new Date().toISOString() } };
    const html = renderGuide(g);
    expect(html).toContain('Add more');
    expect(html).toMatch(/items · added 3 new just now/);
    const working = renderGuide(guide({ sections: { ...guide().sections, basics: { ...guide().sections.basics, status: 'working' } } }));
    expect(working).toContain('Finding more');
    expect(stepLine(guide({ sections: { ...guide().sections, interview: { ...guide().sections.interview, status: 'working' } } }))).toBe('Finding more interview questions');
  });

  it('shows interview questions under their format with what a strong answer shows', () => {
    const g = guide();
    g.sections.interview = done({ formats: [{ name: 'Case interview', tests: 'Structured reasoning', howToPractice: 'Practise aloud', url: null }], questions: [{ kind: 'Case interview', question: 'How would a sugar tax change demand?', tip: 'Clear structure before numbers' }], sources: [] });
    const html = renderToString(createElement(CareerGuide, { guide: g, onSearchAgain: () => {}, onAddMore: () => {} }));
    expect(html).not.toContain('sugar tax');
    const first = renderGuide(g, 'interview');
    expect(first).toContain('How would a sugar tax change demand?');
    expect(first).toContain('A strong answer: clear structure before numbers');
  });

  it('labels sample stories as samples and credits them to Grok on X without a link', () => {
    const html = renderGuide(guide(), 'voices');
    expect(html).toContain('Sample stories with made-up people');
    expect(html).toContain('Grok · X');
    expect(html).toContain('>Sample<');
    expect(html).not.toContain('Open on X');
  });

  it('shows a real post with its link and no sample label', () => {
    const g = guide();
    g.sections.voices = done({ posts: [{ author: 'Real Person', role: 'Economist', handle: '@real', text: 'Real post', takeaway: 'Learn R', url: 'https://x.com/real/1', date: '2026-11-01' }] });
    const html = renderGuide(g, 'voices');
    expect(html).toContain('Open on X');
    expect(html).toContain('https://x.com/real/1');
    expect(html).not.toContain('>Sample<');
  });

  it('says what the agents are doing while they research, and holds a place for each part', () => {
    const g = guide({ status: 'researching', sections: { ...guide().sections, voices: waiting, interview: { ...waiting, status: 'working' } } });
    expect(stepLine(g)).toBe('Collecting interview questions · 2 of 4 ready');
    const html = renderGuide(g);
    expect(html).toContain('Collecting interview questions · 2 of 4 ready');
    expect(renderGuide({ ...g, sections: { ...g.sections, basics: waiting } })).toContain('Waiting to start');
    expect(renderGuide({ ...g, sections: { ...g.sections, basics: { ...waiting, status: 'working' } } })).toContain('Researching');
    expect(stepLine(guide({ status: 'planning' }))).toBe('Working out what economist involves');
    expect(stepLine(guide())).toBeNull();
  });

  it('never presents Claude as Grok, and says when a figure is missing', () => {
    expect(providerLabel('claude')).toBe('Claude (test mode)');
    const html = renderGuide(guide());
    expect(html).toContain('by Claude (test mode)');
    expect(html).toContain('No pay figure found');
  });

  it('makes the same slug as the backend', () => {
    expect(slugFor('  Data Science / AI  ')).toBe('data-science-ai');
  });
});
