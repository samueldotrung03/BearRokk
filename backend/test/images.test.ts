// The picture finder, on fake pages and pictures: no network.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { SimBrain } from '../src/agents/simBrain.ts';
import { AgentSystem } from '../src/agents/system.ts';
import { cleanSvg, ImageFinder, imageSize, picturesOn, safeUrl, type ImageSubject } from '../src/agents/images.ts';

const NOW = new Date('2026-11-19T12:00:00Z');

function png(width: number, height: number) {
  const b = Buffer.alloc(33);
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]).copy(b, 0);
  b.writeUInt32BE(13, 8);
  b.write('IHDR', 12);
  b.writeUInt32BE(width, 16);
  b.writeUInt32BE(height, 20);
  return b;
}
function jpeg(width: number, height: number) {
  // SOI, an APP0 segment, then a baseline frame header.
  return Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x04, 0x00, 0x00, 0xff, 0xc0, 0x00, 0x11, 0x08, height >> 8, height & 255, width >> 8, width & 255, 0x03, 0, 0, 0, 0, 0, 0, 0, 0, 0]);
}

/** A tiny web: addresses to pages and pictures. Anything else is a 404. */
function web(routes: Record<string, { type: string; body: string | Buffer }>) {
  const asked: string[] = [];
  const fetcher = (async (input: string | URL | Request) => {
    const url = String(input);
    asked.push(url);
    const hit = routes[url];
    if (!hit) return new Response('missing', { status: 404 });
    const res = new Response(typeof hit.body === "string" ? hit.body : new Uint8Array(hit.body), { status: 200, headers: { 'content-type': hit.type } });
    Object.defineProperty(res, 'url', { value: url });
    return res;
  }) as typeof fetch;
  return { fetcher, asked };
}

const posting = (over: Partial<ImageSubject> = {}): ImageSubject => ({
  id: 'opp-1',
  title: 'Bay Area Climate Hackathon',
  organizer: 'Greenlight Labs',
  type: 'hackathon',
  field: 'software',
  tags: [],
  sourceUrl: 'https://greenlight.example.org/hackathon',
  actionUrl: null,
  image: null,
  ...over,
});
const html = (head: string) => `<!doctype html><html><head>${head}</head><body></body></html>`;
const page = (head: string) => ({ type: 'text/html; charset=utf-8', body: html(head) });

test('pictures: sizes are read from the first bytes of PNG and JPEG files', () => {
  assert.deepEqual(imageSize(png(1200, 630)), { width: 1200, height: 630 });
  assert.deepEqual(imageSize(jpeg(1600, 900)), { width: 1600, height: 900 });
  assert.equal(imageSize(Buffer.from('not a picture')), null);
});

test('pictures: a page offers its preview pictures and its logo, with addresses made whole', () => {
  const found = picturesOn(
    html(`<meta property="og:image" content="/banner.jpg"><link rel="apple-touch-icon" href="/touch.png">
      <script type="application/ld+json">{"@type":"Event","image":["https://cdn.example.org/event.jpg"],"organizer":{"@type":"Organization","logo":"https://cdn.example.org/logo.png"}}</script>`),
    'https://greenlight.example.org/hackathon',
  );
  assert.deepEqual(found.event, ['https://greenlight.example.org/banner.jpg', 'https://cdn.example.org/event.jpg']);
  assert.deepEqual(found.logo, ['https://greenlight.example.org/touch.png', 'https://cdn.example.org/logo.png']);
});

test("pictures: the event's own picture comes first", async () => {
  const { fetcher } = web({
    'https://greenlight.example.org/hackathon': page('<meta property="og:image" content="https://greenlight.example.org/hackathon-2026.jpg"><link rel="icon" href="/logo.png">'),
    'https://greenlight.example.org/hackathon-2026.jpg': { type: 'image/jpeg', body: jpeg(1600, 900) },
    'https://greenlight.example.org/logo.png': { type: 'image/png', body: png(256, 256) },
  });
  const found = await new ImageFinder({ fetch: fetcher, stock: false }).find(posting());
  assert.deepEqual(found, { url: 'https://greenlight.example.org/hackathon-2026.jpg', kind: 'event', credit: null, creditUrl: null });
});

test('pictures: a small square or logo-named preview is not taken as the event picture; the logo is used', async () => {
  const { fetcher } = web({
    'https://greenlight.example.org/hackathon': page('<meta property="og:image" content="https://greenlight.example.org/social_icon_200.png">'),
    'https://greenlight.example.org/social_icon_200.png': { type: 'image/png', body: png(200, 200) },
    'https://greenlight.example.org/': page('<link rel="apple-touch-icon" href="/apple-touch-icon.png">'),
    'https://greenlight.example.org/apple-touch-icon.png': { type: 'image/png', body: png(180, 180) },
  });
  const found = await new ImageFinder({ fetch: fetcher, stock: false }).find(posting());
  assert.equal(found?.kind, 'logo');
  assert.equal(found?.url, 'https://greenlight.example.org/apple-touch-icon.png');
});

test("pictures: a job board's own logo is never used as the organizer's", async () => {
  const { fetcher, asked } = web({
    'https://boards.greenhouse.io/greenlight/jobs/1': page(''),
    'https://boards.greenhouse.io/': page('<link rel="icon" href="/greenhouse-logo.png">'),
    'https://boards.greenhouse.io/greenhouse-logo.png': { type: 'image/png', body: png(256, 256) },
  });
  const found = await new ImageFinder({ fetch: fetcher, stock: false }).find(posting({ sourceUrl: 'https://boards.greenhouse.io/greenlight/jobs/1' }));
  assert.equal(found, null);
  assert.ok(!asked.includes('https://boards.greenhouse.io/'), "the board's home page is not read for a logo");
});

test('pictures: with nothing of its own, a free stock photo on the topic, with its credit', async () => {
  const stockUrl = 'https://live.staticflickr.com/1/hack_b.jpg';
  const { fetcher, asked } = web({
    [stockUrl]: { type: 'image/jpeg', body: jpeg(1024, 683) },
  });
  const openverse = (async (input: string | URL | Request, init?: RequestInit) => {
    const url = String(input);
    if (url.startsWith('https://api.openverse.org/')) {
      asked.push(url);
      return new Response(JSON.stringify({ results: [{ url: stockUrl, width: 1024, height: 683, creator: 'hackNY', license: 'by-sa', license_version: '2.0', foreign_landing_url: 'https://www.flickr.com/photos/hackny/1' }] }), { headers: { 'content-type': 'application/json' } });
    }
    return fetcher(input, init);
  }) as typeof fetch;
  const found = await new ImageFinder({ fetch: openverse }).find(posting({ sourceUrl: 'https://boards.greenhouse.io/x' }));
  assert.deepEqual(found, { url: stockUrl, kind: 'stock', credit: 'Photo by hackNY, CC BY-SA 2.0', creditUrl: 'https://www.flickr.com/photos/hackny/1' });
  assert.match(asked.find((u) => u.includes('openverse'))!, /q=hackathon%20programming/);
});

test('pictures: last of all an illustration the agents draw, kept only if it is plain drawing', async () => {
  const { fetcher } = web({});
  const finder = new ImageFinder({ fetch: fetcher, stock: false });
  const drawn = '<svg viewBox="0 0 800 500" xmlns="http://www.w3.org/2000/svg"><rect width="800" height="500" fill="#e8f0ff"/><circle cx="400" cy="250" r="90" fill="#4f6bff"/></svg>';
  const found = await finder.find(posting(), async () => drawn);
  assert.equal(found?.kind, 'generated');
  assert.equal(found?.credit, 'AI-generated illustration');
  assert.equal(Buffer.from(found!.url.split(',')[1]!, 'base64').toString(), drawn);

  for (const bad of [
    '<svg><script>alert(1)</script></svg>',
    '<svg onload="alert(1)"></svg>',
    '<svg><a href="https://evil.example"><rect/></a></svg>',
    '<svg><image href="https://tracker.example/x.png"/></svg>',
    '<svg><foreignObject><div/></foreignObject></svg>',
    'not an svg',
    `<svg>${'<rect/>'.repeat(3000)}</svg>`,
  ])
    assert.equal(cleanSvg(bad), null, bad.slice(0, 40));
  assert.equal(await finder.find(posting(), async () => '<svg onload="x()"></svg>'), null);
});

test('pictures: addresses on this computer or its network are never fetched', () => {
  for (const bad of ['http://localhost:8787/api', 'http://127.0.0.1/x.png', 'http://10.0.0.5/x', 'http://192.168.1.1/', 'http://169.254.169.254/latest/meta-data', 'http://[::1]/', 'file:///etc/passwd', 'http://intranet/'])
    assert.equal(safeUrl(bad), null, bad);
  assert.equal(safeUrl('https://example.org/a.png')?.href, 'https://example.org/a.png');
});

test('pictures: every kept posting is looked at once, stored ones without a picture are filled in, and a re-found one keeps its picture', async () => {
  const looked: string[] = [];
  const finder = {
    find: async (o: ImageSubject) => {
      looked.push(o.title);
      return { url: `https://pictures.example.org/${encodeURIComponent(o.title)}.jpg`, kind: 'event' as const, credit: null, creditUrl: null };
    },
  } as unknown as ImageFinder;
  const s = new AgentSystem(new SimBrain({ speed: 0, now: () => NOW }), { now: () => NOW, feedTarget: 0, images: finder });
  await s.trigger('first');
  const feed = s.student().feed.map((f) => f.opportunity);
  assert.ok(feed.length > 0);
  assert.ok(feed.every((o) => o.imageKind === 'event' && o.image!.startsWith('https://pictures.example.org/')));
  assert.equal(looked.length, feed.length, 'one look per posting');
  assert.ok(s.currentRun()!.jobs.some((j) => j.kind === 'image'));

  // A memory from before pictures were looked for: they are filled in on the next run.
  const memory = JSON.parse(JSON.stringify(s.memorySnapshot()));
  for (const o of memory.learned.opportunities) {
    delete o.imageKind;
    o.image = null;
  }
  looked.length = 0;
  const next = new AgentSystem(new SimBrain({ speed: 0, now: () => NOW }), { now: () => NOW, feedTarget: 0, images: finder });
  next.restore(memory);
  // Filled in straight away, with no search.
  await next.fillPictures();
  assert.equal(next.student().runCount, s.student().runCount, 'no search was run');
  const stored = memory.learned.opportunities.map((o: { title: string }) => o.title);
  assert.ok(stored.every((t: string) => looked.includes(t)), 'every stored posting was looked at');
  assert.ok(next.student().feed.every((f) => f.opportunity.image));
  // Looked at once: neither another pass nor a search looks again.
  looked.length = 0;
  await next.fillPictures();
  await next.trigger('manual');
  assert.ok(stored.every((t: string) => !looked.includes(t)));
});

test('pictures: a student whose stored cards have no pictures gets them when their memory loads', async () => {
  const { createApp } = await import('../src/app.ts');
  const { LocalStore } = await import('../src/store/local.ts');
  const looked: string[] = [];
  const finder = {
    find: async (o: ImageSubject) => {
      looked.push(o.title);
      return { url: 'https://pictures.example.org/x.jpg', kind: 'logo' as const, credit: null, creditUrl: null };
    },
  } as unknown as ImageFinder;
  // A memory saved before pictures existed.
  const old = new AgentSystem(new SimBrain({ speed: 0, now: () => NOW }), { now: () => NOW, feedTarget: 0 });
  await old.trigger('first');
  const store = new LocalStore(null);
  await store.saveStudent('u1', old.memorySnapshot());
  const s = new AgentSystem(new SimBrain({ speed: 0, now: () => NOW }), { now: () => NOW, feedTarget: 0, images: finder });
  const { app } = createApp(store, {}, {
    demo: new AgentSystem(new SimBrain({ speed: 0, now: () => NOW }), { now: () => NOW, feedTarget: 0 }),
    webConfig: { apiKey: 'k', projectId: 'p', authDomain: 'x' },
    verify: async () => ({ uid: 'u1', name: 'Ana', email: null, picture: null, provider: 'google', emailVerified: true }),
    forUser: () => s,
    saveDelayMs: 5,
  });
  const before = await app.request('/api/students/me/state', { headers: { authorization: 'Bearer t' } });
  assert.equal(before.status, 200);
  await new Promise((r) => setTimeout(r, 60));
  const feed = s.student().feed;
  assert.ok(feed.length > 0 && feed.every((f) => f.opportunity.imageKind === 'logo'));
  assert.equal(s.student().runCount, 1, 'no search was needed');
  assert.ok((await store.loadStudent('u1'))!.learned.opportunities.every((o) => o.image === 'https://pictures.example.org/x.jpg'), 'and the pictures were saved');
});
