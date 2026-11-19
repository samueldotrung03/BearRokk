// HTTP and live-event API for the agent system.
//   /api/students/demo/...  the shared demo student, open to anyone
//   /api/students/me/...    the signed-in student; needs a sign-in token (Google or email and password)
import { readFileSync } from 'node:fs';
import type { Context, Hono } from 'hono';
import { streamSSE } from 'hono/streaming';
import type { AuthUser, Verifier } from '../auth.ts';
import { createDeadlineEvent, deleteEvent } from '../calendar.ts';
import type { AgentSystem } from './system.ts';
import { APPLICATION_STATUSES, CATEGORIES, type Action, type Category, type ClassYear, type Profile } from './types.ts';

export interface AgentsOptions {
  demo: AgentSystem;
  /** Makes the agent system for a student signing in for the first time. */
  forUser?: (user: AuthUser) => AgentSystem;
  verify?: Verifier | null;
  /** Firebase settings handed to the browser so it can start Google sign-in. */
  webConfig?: object | null;
  /** Calendar calls, replaceable in tests. */
  calendar?: { create: typeof createDeadlineEvent; remove: typeof deleteEvent };
}

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

class HttpError extends Error {
  status: 401 | 404 | 503;
  constructor(status: 401 | 404 | 503, message: string) {
    super(message);
    this.status = status;
  }
}

export function mountAgents(app: Hono, opts: AgentsOptions) {
  const signedIn = new Map<string, AgentSystem>();
  const enabled = Boolean(opts.verify && opts.forUser && opts.webConfig);

  async function userOf(c: Context): Promise<AuthUser> {
    if (!enabled) throw new HttpError(503, 'sign-in is not configured on this server');
    // EventSource cannot send headers, so the live stream passes the token in the query string.
    const header = c.req.header('authorization');
    const token = header?.startsWith('Bearer ') ? header.slice(7) : c.req.query('token');
    if (!token) throw new HttpError(401, 'sign in first');
    try {
      return await opts.verify!(token);
    } catch {
      throw new HttpError(401, 'sign-in expired or invalid; sign in again');
    }
  }

  /** The agent system the request is about: the demo student, or the signed-in one. */
  async function systemOf(c: Context): Promise<AgentSystem> {
    const id = c.req.param('id');
    if (id === 'demo') return opts.demo;
    if (id !== 'me') throw new HttpError(404, 'unknown student');
    const user = await userOf(c);
    let system = signedIn.get(user.uid);
    if (!system) {
      system = opts.forUser!(user);
      signedIn.set(user.uid, system);
    }
    return system;
  }

  app.get('/api/auth/config', (c) => c.json(enabled ? { enabled: true, providers: ['google', 'password'], firebase: opts.webConfig } : { enabled: false }));
  app.get('/api/auth/me', async (c) => c.json({ user: await userOf(c) }));

  const base = '/api/students/:id';

  app.get(`${base}/state`, async (c) => {
    const system = await systemOf(c);
    return c.json({ student: system.student(), run: system.currentRun() });
  });
  app.get(`${base}/feed`, async (c) => c.json({ feed: (await systemOf(c)).student().feed }));

  app.put(`${base}/profile`, async (c) => {
    const system = await systemOf(c);
    const patch = cleanProfile(await c.req.json().catch(() => ({})));
    if (Object.keys(patch).length === 0) return c.json({ error: 'nothing to change' }, 400);
    return c.json({ student: system.setProfile(patch) });
  });

  app.post(`${base}/interactions`, async (c) => {
    const system = await systemOf(c);
    const body = await c.req.json().catch(() => ({}));
    if (!ACTIONS.includes(body.action)) return c.json({ error: 'unknown action' }, 400);
    const student = system.interact(String(body.opportunityId ?? ''), body.action);
    return student ? c.json({ student }) : c.json({ error: 'opportunity not found' }, 404);
  });

  app.post(`${base}/runs`, async (c) => {
    const system = await systemOf(c);
    void system.trigger(system.student().runCount === 0 ? 'first' : 'manual');
    return c.json({ ok: true }, 202);
  });

  app.put(`${base}/schedule`, async (c) => {
    const system = await systemOf(c);
    const body = await c.req.json().catch(() => ({}));
    system.setSchedule(Number(body.seconds) || 0);
    return c.json({ student: system.student() });
  });

  app.post(`${base}/reset`, async (c) => {
    const system = await systemOf(c);
    await system.idle();
    system.reset();
    return c.json({ student: system.student() });
  });

  // ---- application manager -------------------------------------------------------------
  const calendar = opts.calendar ?? { create: createDeadlineEvent, remove: deleteEvent };

  app.get(`${base}/applications`, async (c) => c.json({ applications: (await systemOf(c)).listApplications() }));

  // Set a status, save draft answers, or supply a missing deadline. Marking to_apply or applying
  // sets reminders, and puts the deadline on Google Calendar when the request carries the
  // student's Google access token in X-Google-Access-Token (needs the calendar.events permission).
  app.put(`${base}/applications/:oppId`, async (c) => {
    const system = await systemOf(c);
    const oppId = c.req.param('oppId');
    const body = await c.req.json().catch(() => ({}));
    if (body.status !== undefined && !APPLICATION_STATUSES.includes(body.status)) return c.json({ error: 'unknown status' }, 400);
    const drafts = body.drafts && typeof body.drafts === 'object' ? Object.fromEntries(Object.entries(body.drafts).filter(([, v]) => typeof v === 'string').slice(0, 20)) as Record<string, string> : undefined;
    const application = system.setApplication(oppId, { status: body.status, drafts, deadline: typeof body.deadline === 'string' ? body.deadline : undefined });
    if (!application) return c.json({ error: 'opportunity not found' }, 404);

    const google = c.req.header('x-google-access-token');
    const event = application.status === 'to_apply' || application.status === 'applying' ? system.calendarEvent(application) : null;
    if (google) {
      try {
        // Replace rather than duplicate when the deadline or status changes.
        if (application.calendar.eventId) await calendar.remove(google, application.calendar.eventId);
        if (event) {
          const made = await calendar.create(google, event);
          system.setCalendar(oppId, { state: 'synced', eventId: made.eventId, htmlLink: made.htmlLink, error: null });
        } else {
          system.setCalendar(oppId, { state: 'none', eventId: null, htmlLink: null, error: null });
        }
      } catch (e) {
        system.setCalendar(oppId, { error: e instanceof Error ? e.message : String(e) });
      }
    }
    return c.json({ application: system.getApplication(oppId) });
  });

  app.delete(`${base}/applications/:oppId`, async (c) => {
    const system = await systemOf(c);
    const removed = system.removeApplication(c.req.param('oppId'));
    if (!removed) return c.json({ error: 'application not found' }, 404);
    const google = c.req.header('x-google-access-token');
    if (google && removed.calendar.eventId) await calendar.remove(google, removed.calendar.eventId).catch(() => {});
    return c.json({ ok: true });
  });

  // Live updates: the full run snapshot and the student state whenever either changes.
  app.get(`${base}/stream`, async (c) => {
    const system = await systemOf(c);
    return streamSSE(c, async (stream) => {
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
    });
  });

  // `/` is the animated view of the agents; `/console` is the testing console with the profile and feed.
  const page = (name: string) => readFileSync(new URL(`../../public/${name}`, import.meta.url), 'utf8');
  app.get('/', (c) => c.html(page('index.html')));
  app.get('/console', (c) => c.html(page('console.html')));

  return { HttpError };
}

export { HttpError };
