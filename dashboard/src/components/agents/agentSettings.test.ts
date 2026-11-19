import { createElement } from 'react';
import { renderToString } from 'react-dom/server';
import { MemoryRouter } from 'react-router';
import { describe, expect, it } from 'vitest';

Object.assign(globalThis, {
  localStorage: { getItem: () => null, setItem: () => {}, removeItem: () => {}, clear: () => {}, key: () => null, length: 0 },
});

describe('agent settings', () => {
  it('opens from a button at the top of the Agents page, and the page no longer offers "Internships only"', async () => {
    const { Agents } = await import('../../pages/Agents.tsx');
    const { StoreProvider } = await import('../../state/StoreProvider.tsx');
    const { AuthProvider } = await import('../../auth/AuthProvider.tsx');
    const { LiveProvider } = await import('../../state/live.tsx');
    const html = renderToString(createElement(MemoryRouter, null, createElement(AuthProvider, null, createElement(StoreProvider, null, createElement(LiveProvider, null, createElement(Agents))))));
    expect(html).toContain('Agent settings');
    expect(html).not.toContain('Internships only');
  });
});
