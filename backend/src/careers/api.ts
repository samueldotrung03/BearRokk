// HTTP routes for career guides. Every request goes to the agent system's master, which routes it
// to the career discovery skill. Guides are shared by every student, so no sign-in is needed; `by`
// names who asks, so each student sees only their own "Add more" history.
import type { Hono } from 'hono';
import { z } from 'zod';
import { AgentMaster, type StudentContext } from '../agents/skills/index.ts';
import { CareerError, type CareerGuides, type Guide } from './guide.ts';
import type { GuideAsk } from './schemas.ts';

const words = z.array(z.string().max(200)).max(20).catch([]);
const StudentBody = z
  .object({
    year: z.string().max(40).nullable().catch(null),
    major: z.string().max(120).nullable().catch(null),
    school: z.string().max(120).nullable().catch(null),
    location: z.string().max(120).nullable().catch(null),
    interests: words,
    careerInterests: words,
    skills: words,
    notes: words,
  })
  .nullable()
  .catch(null);

const who = (v: unknown) => (typeof v === 'string' && /^[\w.-]{1,128}$/.test(v) ? v : 'guest');

/** Sets up the master with the career discovery skill and mounts the guide routes. */
export function mountCareers(app: Hono, guides: CareerGuides) {
  const master = new AgentMaster().register({
    skill: 'career-discovery',
    handle: (request) => {
      if (request.kind === 'career-guide') return { guide: guides.start(request.career, request.refresh) };
      if (request.kind === 'career-guide-part') return guides.more(request.slug, request.section, { prompt: request.prompt, by: request.by, student: request.student });
      throw new CareerError('This request is not for career discovery.', 400);
    },
  });

  const fail = (e: unknown) => {
    if (e instanceof CareerError) return { body: { error: e.message }, status: e.status };
    throw e;
  };

  app.get('/api/careers/guides', (c) => c.json({ guides: guides.list() }));

  app.get('/api/careers/guides/:slug', (c) => {
    const guide = guides.view(c.req.param('slug'), who(c.req.query('by')));
    return guide ? c.json({ guide }) : c.json({ error: 'No guide for this career yet.' }, 404);
  });

  app.post('/api/careers/guides', async (c) => {
    const body = await c.req.json().catch(() => ({}));
    try {
      const { guide } = master.handle<{ guide: Guide }>({ kind: 'career-guide', career: String(body.career ?? ''), refresh: body.refresh === true });
      return c.json({ guide: guides.view(guide.slug, who(body.by)) }, 202);
    } catch (e) {
      const { body: b, status } = fail(e);
      return c.json(b, status);
    }
  });

  // "Add more": the master reads what the student asked, then one part is researched again for new items.
  app.post('/api/careers/guides/:slug/sections/:section/more', async (c) => {
    const body = await c.req.json().catch(() => ({}));
    try {
      const result = master.handle<{ guide: Guide; ask: GuideAsk }>({
        kind: 'career-guide-part',
        slug: c.req.param('slug'),
        section: c.req.param('section'),
        prompt: typeof body.prompt === 'string' ? body.prompt : '',
        by: who(body.by),
        student: StudentBody.parse(body.student ?? null) as StudentContext | null,
      });
      return c.json(result, 202);
    } catch (e) {
      const { body: b, status } = fail(e);
      return c.json(b, status);
    }
  });

  // Requests to offer in the "Add more" window.
  app.post('/api/careers/guides/:slug/sections/:section/suggest', async (c) => {
    const body = await c.req.json().catch(() => ({}));
    try {
      const prompts = await guides.suggest(c.req.param('slug'), c.req.param('section'), { by: who(body.by), student: StudentBody.parse(body.student ?? null) as StudentContext | null });
      return c.json({ prompts });
    } catch (e) {
      const { body: b, status } = fail(e);
      return c.json(b, status);
    }
  });
}
