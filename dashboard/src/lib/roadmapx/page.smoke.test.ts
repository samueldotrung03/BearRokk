// Renders the Roadmap page on the server for a goal outside technology, so a missing piece of
// data for the newer fields shows up in `vitest` without a browser.
import { createElement } from 'react';
import { renderToString } from 'react-dom/server';
import { MemoryRouter } from 'react-router';
import { afterEach, describe, expect, it } from 'vitest';
import { AuthProvider } from '../../auth/AuthProvider.tsx';
import { careerPaths } from '../../data/sample.ts';
import { RoadmapList as Roadmap } from '../../pages/RoadmapList.tsx';
import { LiveProvider } from '../../state/live.tsx';
import { StoreProvider } from '../../state/StoreProvider.tsx';

const render = () =>
  renderToString(
    createElement(
      MemoryRouter,
      null,
      createElement(AuthProvider, null, createElement(StoreProvider, null, createElement(LiveProvider, null, createElement(Roadmap)))),
    ),
  );

// The store saves under a versioned key that is not exported, so match it by its prefix.
function stubGoal(goalId: string) {
  const data = new Map<string, string>();
  (globalThis as { localStorage?: unknown }).localStorage = {
    getItem: (key: string) => data.get(key) ?? (key.startsWith('bearrok.dashboard') ? JSON.stringify({ goalId }) : null),
    setItem: (key: string, value: string) => void data.set(key, value),
  };
}

afterEach(() => {
  delete (globalThis as { localStorage?: unknown }).localStorage;
});

describe('Roadmap page', () => {
  it('opens the goal picker on the field of the current goal and lists only that field’s goals', () => {
    stubGoal('path-health');
    const html = render();
    expect(html).toContain('Clinical internship, summer 2027');
    expect(html).toMatch(/aria-pressed="true"[^>]*>Science, engineering and health/);
    expect(html).toContain('Healthcare and pre-med');
    expect(html).toContain('Mechanical and aerospace engineering');
    expect(html).not.toContain('>Software engineering<');
  });

  it('renders every goal without a missing value', () => {
    for (const path of careerPaths) {
      stubGoal(path.id);
      const html = render();
      expect(html, path.id).not.toMatch(/undefined|NaN/);
    }
  });
});

describe('Roadmap journey page', () => {
  it('renders the 3D journey for every goal without a missing value', async () => {
    const { Roadmap: Journey } = await import('../../pages/Roadmap.tsx');
    for (const path of careerPaths) {
      stubGoal(path.id);
      const html = renderToString(
        createElement(MemoryRouter, null, createElement(AuthProvider, null, createElement(StoreProvider, null, createElement(LiveProvider, null, createElement(Journey))))),
      );
      expect(html, path.id).not.toMatch(/undefined|NaN/);
      expect(html, path.id).toContain('rm3-opt');
      expect(html, path.id).toContain('How people got in');
      expect(html, path.id).toContain('Recommended');
      expect(html, path.id).toContain(path.title);
    }
  });
});
