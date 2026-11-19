// HTTP and live-event API for the agent system.
//   /api/students/demo/...  the shared demo student, open to anyone
//   /api/students/me/...    the signed-in student; needs a sign-in token (Google or email and password)
import { readFileSync } from 'node:fs';
import type { Context, Hono } from 'hono';
import { streamSSE } from 'hono/streaming';
import type { AuthUser, Verifier } from '../auth.ts';
import { createDeadlineEvent, deleteEvent } from '../calendar.ts';
import { readResume, RESUME_MAX_BYTES, RESUME_TYPES } from '../resume.ts';
import { exportApplications } from '../sheets.ts';
import type { AgentSystem } from './system.ts';
import { APPLICATION_STATUSES, CATEGORIES, type Action, type Category, type ClassYear, type Profile, type StudentPreferences } from './types.ts';
import { RoadmapRequest, type RoadmapWriter } from '../roadmap.ts';

export interface AgentsOptions {
  demo: AgentSystem;
  /** Makes the agent system for a student signing in for the first time. */
  forUser?: (user: AuthUser) => AgentSystem;
  verify?: Verifier | null;
  /** Firebase settings handed to the browser so it can start Google sign-in. */
  webConfig?: object | null;
  /** Calendar calls, replaceable in tests. */
  calendar?: { create: typeof createDeadlineEvent; remove: typeof deleteEvent };
  sheets?: typeof exportApplications;
  /** Writes a roadmap. Absent when no model is connected; replaceable in tests. */
  roadmap?: RoadmapWriter | null;
  /** How the agents reach Grok, for the settings page. */
  grok?: { connected: boolean; mode: 'api' | 'cli' | 'claude' | 'simulated'; detail: string };
}

const ACTIONS: Action[] = ['save', 'like', 'dislike', 'open', 'apply'];
const YEARS: ClassYear[] = ['Freshman', 'Sophomore', 'Junior', 'Senior'];
const strings = (v: unknown, max = 12) => (Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string').slice(0, max) : null);

/** The profile page's answers, with sizes capped so a request cannot store arbitrary amounts. */
function cleanPreferences(raw: any): StudentPreferences | null {
  if (!raw || typeof raw !== 'object') return null;
  const fields = (strings(raw.fields, 80) ?? []).map((f) => f.slice(0, 60));
  const answers: Record<string, string> = {};
  for (const [k, v] of Object.entries(raw.answers ?? {}).slice(0, 40)) if (typeof v === 'string' && v.trim()) answers[k.slice(0, 40)] = v.trim().slice(0, 2000);
  const lists: Record<string, string[]> = {};
  if (raw.lists && typeof raw.lists === 'object' && !Array.isArray(raw.lists)) {
    for (const [k, v] of Object.entries(raw.lists).slice(0, 40)) {
      const entries = (Array.isArray(v) ? v : [])
        .filter((x): x is string => typeof x === 'string')
        .map((x) => x.trim().slice(0, 80))
        .filter(Boolean)
        .slice(0, 12);
      if (entries.length) lists[k.slice(0, 40)] = entries;
    }
  }
  const checks: Record<string, boolean> = {};
  for (const [k, v] of Object.entries(raw.checks ?? {}).slice(0, 40)) if (v === true) checks[k.slice(0, 40)] = true;
  const topField = typeof raw.topField === 'string' && fields.includes(raw.topField) ? raw.topField : null;
  const notes = (Array.isArray(raw.notes) ? raw.notes : [])
    .slice(0, 20)
    .map((n: any) => ({ title: typeof n?.title === 'string' ? n.title.trim().slice(0, 80) : '', body: typeof n?.body === 'string' ? n.body.trim().slice(0, 4000) : '' }))
    .filter((n: { title: string; body: string }) => n.title || n.body);
  const str = (v: unknown, max: number) => (typeof v === 'string' ? v.trim().slice(0, max) : '');
  const month = (v: unknown) => (typeof v === 'string' && /^\d{4}-\d{2}$/.test(v) ? v : '');
  const exp = raw.experience && typeof raw.experience === 'object' ? raw.experience : {};
  const experience = {
    linkedin: str(exp.linkedin, 200),
    links: (strings(exp.links, 8) ?? []).map((l) => l.trim().slice(0, 200)).filter(Boolean),
    entries: (Array.isArray(exp.entries) ? exp.entries : [])
      .slice(0, 30)
      .map((e: any) => ({
        kind: str(e?.kind, 40),
        role: str(e?.role, 100),
        organization: str(e?.organization, 100),
        location: str(e?.location, 100),
        start: month(e?.start),
        end: month(e?.end),
        current: e?.current === true,
        summary: str(e?.summary, 1500),
        skills: (strings(e?.skills, 12) ?? []).map((s) => s.trim().slice(0, 40)).filter(Boolean),
        link: str(e?.link, 200),
      }))
      // An entry with nothing in it is not kept.
      .filter((e: any) => e.role || e.organization || e.summary || e.skills.length || e.link || e.start || e.location),
  };
  return { fields, topField, answers, lists, checks, notes, experience };
}

function cleanProfile(body: any): Partial<Profile> {
  const patch: Partial<Profile> = {};
  if (YEARS.includes(body.year)) patch.year = body.year;
  if (typeof body.remoteOk === 'boolean') patch.remoteOk = body.remoteOk;
  for (const field of ['name', 'school', 'major', 'location'] as const) {
    if (typeof body[field] === 'string' && body[field].trim()) patch[field] = body[field].trim().slice(0, 80);
  }
  const interests = strings(body.interests);
  if (interests) patch.interests = interests;
  const skills = strings(body.skills);
  if (skills) patch.skills = skills;
  if (body.preferences !== undefined) {
    const preferences = cleanPreferences(body.preferences);
    if (preferences) patch.preferences = preferences;
  }
  const careerInterests = strings(body.careerInterests);
  if (careerInterests) patch.careerInterests = careerInterests.map((s) => s.slice(0, 60));
  const eventTypes = strings(body.eventTypes);
  if (eventTypes) patch.eventTypes = eventTypes.map((s) => s.slice(0, 60));
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

  // What is connected on the server side, for the settings page. Nothing secret is returned.
  app.get('/api/connections', (c) =>
    c.json({
      grok: opts.grok ?? { connected: false, mode: 'simulated', detail: 'Agents are simulated on sample data.' },
      signIn: enabled,
    }),
  );

  app.get('/api/auth/config', (c) => c.json(enabled ? { enabled: true, providers: ['google', 'x', 'password'], firebase: opts.webConfig } : { enabled: false }));
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

  // A roadmap written for this student. With no model connected it says so, and the dashboard
  // falls back to its own rule-built draft rather than showing invented work as Grok's.
  app.post(`${base}/roadmap`, async (c) => {
    const system = await systemOf(c);
    if (!opts.roadmap) return c.json({ error: 'no model is connected, so no roadmap can be written' }, 503);
    const parsed = RoadmapRequest.safeParse(await c.req.json().catch(() => null));
    if (!parsed.success) return c.json({ error: 'that roadmap request is not valid' }, 400);
    try {
      // The résumé comes from the file this student uploaded, so a request cannot pass one off as theirs.
      const resume = (system.getResume()?.text ?? '').slice(0, 6000);
      const { data, citations } = await opts.roadmap({ ...parsed.data, resume });
      return c.json({ roadmap: data, citations, writer: opts.grok?.mode ?? 'api' });
    } catch (error) {
      return c.json({ error: `the roadmap could not be written: ${error instanceof Error ? error.message : 'unknown error'}` }, 502);
    }
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

  // ---- résumé --------------------------------------------------------------------------
  // The file is sent as the request body, with its type in Content-Type and its name (URL-encoded)
  // in X-File-Name. Only a signed-in student can upload: the demo student is shared.
  app.put(`${base}/resume`, async (c) => {
    if (c.req.param('id') !== 'me') return c.json({ error: 'sign in to upload a résumé' }, 403);
    const system = await systemOf(c);
    const type = (c.req.header('content-type') ?? '').split(';')[0]!.trim();
    if (!RESUME_TYPES.includes(type)) return c.json({ error: 'upload a PDF or a plain text file' }, 415);
    if (Number(c.req.header('content-length') ?? 0) > RESUME_MAX_BYTES) return c.json({ error: 'the file is larger than 5 MB' }, 413);
    const bytes = new Uint8Array(await c.req.arrayBuffer());
    if (bytes.length === 0) return c.json({ error: 'the file is empty' }, 400);
    if (bytes.length > RESUME_MAX_BYTES) return c.json({ error: 'the file is larger than 5 MB' }, 413);
    let name = 'resume';
    try {
      name = decodeURIComponent(c.req.header('x-file-name') ?? 'resume').replace(/[\\/\u0000-\u001f]/g, '').slice(0, 120) || 'resume';
    } catch {
      // keep the default name
    }
    const text = await readResume(bytes, type);
    return c.json({ resume: system.setResume({ name, type, size: bytes.length, uploadedAt: new Date().toISOString(), text, bytes }) });
  });

  app.get(`${base}/resume`, async (c) => {
    if (c.req.param('id') !== 'me') return c.json({ error: 'not found' }, 404);
    const resume = (await systemOf(c)).getResume();
    if (!resume) return c.json({ error: 'no résumé uploaded' }, 404);
    return new Response(resume.bytes.slice().buffer, { headers: { 'content-type': resume.type, 'content-disposition': `attachment; filename*=UTF-8''${encodeURIComponent(resume.name)}` } });
  });

  app.delete(`${base}/resume`, async (c) => {
    if (c.req.param('id') !== 'me') return c.json({ error: 'not found' }, 404);
    (await systemOf(c)).setResume(null);
    return c.json({ resume: null });
  });

  // Settings that change how the agents behave for this student.
  app.get(`${base}/preferences`, async (c) => {
    const system = await systemOf(c);
    return c.json({ reminderDays: system.getReminderDays(), scheduleSeconds: system.student().scheduleSeconds });
  });
  app.put(`${base}/preferences`, async (c) => {
    const system = await systemOf(c);
    const body = await c.req.json().catch(() => ({}));
    if (Array.isArray(body.reminderDays)) system.setReminderDays(body.reminderDays.filter((d: unknown): d is number => typeof d === 'number'));
    // Never more often than every five minutes, so a setting cannot drain the Grok allowance.
    if (typeof body.scheduleSeconds === 'number') system.setSchedule(body.scheduleSeconds <= 0 ? 0 : Math.max(300, Math.min(body.scheduleSeconds, 7 * 86_400)));
    return c.json({ reminderDays: system.getReminderDays(), scheduleSeconds: system.student().scheduleSeconds });
  });

  // A signed-in student removes everything the backend holds about them.
  app.delete(base, async (c) => {
    if (c.req.param('id') !== 'me') return c.json({ error: 'only your own data can be deleted' }, 400);
    const user = await userOf(c);
    const system = signedIn.get(user.uid);
    if (system) {
      system.setSchedule(0);
      await system.idle();
      signedIn.delete(user.uid);
    }
    return c.json({ ok: true });
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

  // Write the application tracker to a new Google Sheet in the student's Drive.
  app.post(`${base}/applications/export`, async (c) => {
    const system = await systemOf(c);
    const google = c.req.header('x-google-access-token');
    if (!google) return c.json({ error: 'connect Google Sheets first' }, 400);
    try {
      const sheet = await (opts.sheets ?? exportApplications)(google, system.listApplications(), new Date());
      return c.json(sheet);
    } catch (e) {
      return c.json({ error: e instanceof Error ? e.message : String(e) }, 502);
    }
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
