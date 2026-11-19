// Renders the whole page on the server, so a broken component shows up in `vitest` without a
// browser. Only checks that each part is there and that saved answers lead to a result.
import { createElement } from 'react';
import { renderToString } from 'react-dom/server';
import { MemoryRouter } from 'react-router';
import { afterEach, describe, expect, it } from 'vitest';
import { quizQuestions } from '../../data/discover-extra.ts';
import { Discover } from '../../pages/Discover.tsx';
import { AuthProvider } from '../../auth/AuthProvider.tsx';
import { LiveProvider } from '../../state/live.tsx';
import { StoreProvider } from '../../state/StoreProvider.tsx';

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

describe('Discover page', () => {
  it('renders the quiz, the ranked matches, the detail, the chat and the compare table', () => {
    const html = render();
    for (const text of ['Find my path', 'Start the quiz', 'Not sure where your major could take you?', 'Your matches', 'Show all fields', 'Skills it expects', 'How people got in', 'Ask about this career', 'Side by side', 'Grok will answer once the agents are connected']) {
      expect(html).toContain(text);
    }
  });

  it('shows the best fit, not the intro, when every answer is already saved', () => {
    // Every answer picks the product-management option, so that path should come out on top.
    const answers = Object.fromEntries(quizQuestions.map((q) => [q.id, [...q.options].sort((a, b) => (b.fit['path-pm'] ?? 0) - (a.fit['path-pm'] ?? 0))[0]!.id]));
    stubStorage({ 'bearrok.discover.answers': answers });
    const html = render();
    expect(html).toContain('Your best fit');
    expect(html).not.toContain('Start the quiz');
    // The header's goal pill names the current goal, so look only after the result heading.
    const result = html.slice(html.indexOf('Your best fit'));
    expect(result.indexOf('Product management')).toBeLessThan(result.indexOf('Software engineering'));
  });

  it('lists only the top matches until the student asks for every field', () => {
    const html = render();
    const list = html.slice(html.indexOf('Your matches'), html.indexOf('Show all fields'));
    // The goal stays pinned when it ranks below the top five, so allow one extra row.
    const rows = list.match(/class="dc-match /g) ?? [];
    expect(rows.length).toBeGreaterThanOrEqual(5);
    expect(rows.length).toBeLessThanOrEqual(6);
  });

  it('can put a path outside technology first', () => {
    const answers = Object.fromEntries(quizQuestions.map((q) => [q.id, [...q.options].sort((a, b) => (b.fit['path-health'] ?? 0) - (a.fit['path-health'] ?? 0))[0]!.id]));
    stubStorage({ 'bearrok.discover.answers': answers });
    const result = render().split('Your best fit')[1]!;
    expect(result.indexOf('Healthcare and pre-med')).toBeGreaterThan(-1);
    expect(result.indexOf('Healthcare and pre-med')).toBeLessThan(result.indexOf('%'));
  });
});
