// HTTP and live-event API for the agent system. One demo student for now.
import { readFileSync } from 'node:fs';
import type { Hono } from 'hono';
import { streamSSE } from 'hono/streaming';
import type { AgentSystem } from './system.ts';
import { CATEGORIES, type Action, type Category, type ClassYear, type Profile } from './types.ts';

const ACTIONS: Action[] = ['save', 'like', 'dislike', 'open', 'apply'];
const YEARS: ClassYear[] = ['Freshman', 'Sophomore', 'Junior', 'Senior'];
const strings = (v: unknown) => (Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string').slice(0, 12) : null);

function cleanProfile(body: any): Partial<Profile> {
  const patch: Partial<Profile> = {};
  if (YEARS.includes(body.year)) patch.year = body.year;
  if (typeof body.remoteOk === 'boolean') patch.remoteOk = body.remoteOk;
  if (typeof body.location === 'string' && body.location.trim()) patch.location = body.location.trim().slice(0, 80);
  const interests = strings(body.interests);
  if (interests) patch.interests = interests;
  const skills = strings(body.skills);
  if (skills) patch.skills = skills;
  const categories = strings(body.categories)?.filter((c): c is Category => CATEGORIES.includes(c as Category));
  if (categories?.length) patch.categories = categories;
  return patch;
}

export function mountAgents(app: Hono, system: AgentSystem) {
  const base = '/api/students/demo';

  app.get(`${base}/state`, (c) => c.json({ student: system.student(), run: system.currentRun() }));
  app.get(`${base}/feed`, (c) => c.json({ feed: system.student().feed }));

  app.put(`${base}/profile`, async (c) => {
    const patch = cleanProfile(await c.req.json().catch(() => ({})));
    if (Object.keys(patch).length === 0) return c.json({ error: 'nothing to change' }, 400);
    return c.json({ student: system.setProfile(patch) });
  });

  app.post(`${base}/interactions`, async (c) => {
    const body = await c.req.json().catch(() => ({}));
    if (!ACTIONS.includes(body.action)) return c.json({ error: 'unknown action' }, 400);
    const student = system.interact(String(body.opportunityId ?? ''), body.action);
    return student ? c.json({ student }) : c.json({ error: 'opportunity not found' }, 404);
  });

  app.post(`${base}/runs`, (c) => {
    void system.trigger(system.student().runCount === 0 ? 'first' : 'manual');
    return c.json({ ok: true }, 202);
  });

  app.put(`${base}/schedule`, async (c) => {
    const body = await c.req.json().catch(() => ({}));
    system.setSchedule(Number(body.seconds) || 0);
    return c.json({ student: system.student() });
  });

  app.post(`${base}/reset`, async (c) => {
    await system.idle();
    system.reset();
    return c.json({ student: system.student() });
  });

  // Live updates: the full run snapshot and the student state whenever either changes.
  app.get(`${base}/stream`, (c) =>
    streamSSE(c, async (stream) => {
      const send = (event: string, data: unknown) => stream.writeSSE({ event, data: JSON.stringify(data) }).catch(() => {});
      await send('student', system.student());
      await send('run', system.currentRun());
      const unsubscribe = system.subscribe((event, data) => void send(event, data));
      // Nobody has to ask: the first viewer finds the agents already starting.
      if (system.student().runCount === 0) setTimeout(() => void system.trigger('first'), 900);
      const beat = setInterval(() => void stream.writeSSE({ event: 'ping', data: '1' }).catch(() => {}), 15_000);
      await new Promise<void>((resolve) => stream.onAbort(resolve));
      clearInterval(beat);
      unsubscribe();
    }),
  );

  // The visualization page.
  // `/` is the animated view of the agents; `/console` is the testing console with the profile and feed.
  const page = (name: string) => readFileSync(new URL(`../../public/${name}`, import.meta.url), 'utf8');
  app.get('/', (c) => c.html(page('index.html')));
  app.get('/console', (c) => c.html(page('console.html')));
}
