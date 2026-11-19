// The wide row the feed list is made of, rendered to HTML: the picture is shown whole (never
// cropped) with a blurred fill behind it, and the title, organizer and reason sit beside it.
import { createElement } from 'react';
import { renderToString } from 'react-dom/server';
import { MemoryRouter } from 'react-router';
import { describe, expect, it } from 'vitest';
import { opportunities } from '../data/sample.ts';

Object.assign(globalThis, {
  localStorage: { getItem: () => null, setItem: () => {}, removeItem: () => {}, clear: () => {}, key: () => null, length: 0 },
});

async function row(over: Record<string, unknown> = {}) {
  const { OpportunityRow } = await import('./OpportunityCard.tsx');
  const { StoreProvider } = await import('../state/StoreProvider.tsx');
  const { AuthProvider } = await import('../auth/AuthProvider.tsx');
  const { LiveProvider } = await import('../state/live.tsx');
  const o = { ...opportunities[0]!, title: 'TreeHacks 2027', organizer: 'TreeHacks', image: 'https://treehacks.com/assets/og-image.jpg', imageKind: 'event', ...over };
  return renderToString(createElement(MemoryRouter, null, createElement(AuthProvider, null, createElement(StoreProvider, null, createElement(LiveProvider, null, createElement(OpportunityRow, { opportunity: o as never, onDismiss: () => {} }))))));
}

describe('feed row', () => {
  it('shows the whole picture beside the title, organizer and reason', async () => {
    const html = await row();
    expect(html).toContain('feed-row-media');
    expect(html).toContain('TreeHacks 2027');
    expect(html).toContain('cover-whole size-full object-contain');
    expect(html).toContain('cover-fill');
    expect(html).not.toMatch(/class="[^"]*object-cover[^"]*" src="https:\/\/treehacks\.com\/assets\/og-image\.jpg" loading/);
    for (const text of ['Save', 'Like', 'Dislike']) expect(html).toContain(text);
  });

  it('gives a logo room on a light panel, and credits a stock photo', async () => {
    expect(await row({ imageKind: 'logo' })).toContain('TreeHacks logo');
    const stock = await row({ imageKind: 'stock', imageCredit: 'Photo by hackNY, CC BY-SA 2.0', imageCreditUrl: 'https://www.flickr.com/photos/hackny/1' });
    expect(stock).toContain('Photo by hackNY, CC BY-SA 2.0');
  });
});
