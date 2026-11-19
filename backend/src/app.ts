// HTTP API the dashboard calls. See backend/README.md for the contract.
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { HttpError, mountAgents, type AgentsOptions } from './agents/api.ts';
import { config } from './config.ts';
import { mountDesktopAuth } from './desktopAuth.ts';
import { Engine, UserError, type Deps, type Mode } from './pipeline.ts';
import type { Store } from './store/index.ts';

export function createApp(store: Store, deps: Partial<Deps> = {}, agents?: AgentsOptions) {
  const engine = new Engine(store, deps);
  const app = new Hono();
  app.use('/api/*', cors());

  app.get('/api/health', (c) =>
    c.json({ ok: true, store: store.kind, live: (deps.liveAvailable ?? (() => config.xaiApiKey !== null))(), model: config.xaiModel }),
  );

  app.post('/api/searches', async (c) => {
    const body = await c.req.json().catch(() => ({}));
    const mode: Mode = ['prepared', 'live'].includes(body.mode) ? body.mode : 'auto';
    const search = await engine.start(String(body.request ?? ''), mode);
    return c.json({ search, opportunities: [] }, 201);
  });

  app.post('/api/searches/:id/follow-up', async (c) => {
    const body = await c.req.json().catch(() => ({}));
    const search = await engine.answer(c.req.param('id'), String(body.answer ?? ''));
    return c.json({ search, opportunities: [] });
  });

  app.get('/api/searches/:id', async (c) => {
    const search = await store.getSearch(c.req.param('id'));
    if (!search) throw new UserError('search not found', 404);
    const done = search.status === 'complete' || search.status === 'empty';
    return c.json({ search, opportunities: done ? await store.getOpportunities(search.id) : [] });
  });

  app.get('/api/searches', async (c) => c.json({ searches: await store.listSearches(20) }));

  // Each student's memory is kept in the same store, under their account.
  if (agents) mountAgents(app, { memory: store, ...agents });
  mountDesktopAuth(app);

  app.onError((err, c) => {
    if (err instanceof UserError) return c.json({ error: err.message }, err.status as 400);
    if (err instanceof HttpError) return c.json({ error: err.message }, err.status);
    console.error(err);
    return c.json({ error: 'internal error' }, 500);
  });

  return { app, engine };
}
