// HTTP routes for career guides. Guides are shared by every student, so no sign-in is needed.
import type { Hono } from 'hono';
import { CareerError, type CareerGuides } from './guide.ts';

export function mountCareers(app: Hono, guides: CareerGuides) {
  app.get('/api/careers/guides', (c) => c.json({ guides: guides.list() }));

  app.get('/api/careers/guides/:slug', (c) => {
    const guide = guides.get(c.req.param('slug'));
    return guide ? c.json({ guide }) : c.json({ error: 'No guide for this career yet.' }, 404);
  });

  // "Add more": one section's researcher looks again and new items are merged into that section.
  app.post('/api/careers/guides/:slug/sections/:section/more', (c) => {
    try {
      return c.json({ guide: guides.more(c.req.param('slug'), c.req.param('section')) }, 202);
    } catch (e) {
      if (e instanceof CareerError) return c.json({ error: e.message }, e.status);
      throw e;
    }
  });

  app.post('/api/careers/guides', async (c) => {
    const body = await c.req.json().catch(() => ({}));
    try {
      const guide = guides.start(String(body.career ?? ''), body.refresh === true);
      return c.json({ guide }, 202);
    } catch (e) {
      if (e instanceof CareerError) return c.json({ error: e.message }, e.status);
      throw e;
    }
  });
}
