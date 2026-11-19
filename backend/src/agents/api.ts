// HTTP and live-event API for the agent system.
//   /api/students/demo/...  the shared demo student, open to anyone
//   /api/students/me/...    the signed-in student; needs a sign-in token (Google or email and password)
import { readFileSync } from 'node:fs';
import type { Context, Hono } from 'hono';
import { streamSSE } from 'hono/streaming';
import type { AuthUser, Verifier } from '../auth.ts';
import { createDeadlineEvent, deleteEvent } from '../calendar.ts';
import { readResume, RESUME_MAX_BYTES, RESUME_TYPES } from '../resume.ts';
import { exportApplications, trackerRows, writeTracker } from '../sheets.ts';
import type { Store } from '../store/index.ts';
import { config } from '../config.ts';
import { randomBytes } from 'node:crypto';
import { allCalendarsIn, consentUrl, exchangeCode, pkce, refreshAccess, revoke, servicesIn, type GoogleService, type OAuthClient } from '../googleOAuth.ts';
import type { AgentSystem } from './system.ts';
import { AGENT_GROUPS, APPLICATION_STATUSES, CATEGORIES, CATEGORY_OF, type Action, type AgentGroup, type AgentSettings, type OppType, type Category, type ClassYear, type Profile, type StudentPreferences } from './types.ts';
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
  /** Writes the saved tracker to Google Sheets, replaceable in tests. */
  tracker?: typeof writeTracker;
  /** Writes a roadmap. Absent when no model is connected; replaceable in tests. */
  roadmap?: RoadmapWriter | null;
  /** Where each student's memory is kept. Without it nothing outlives the backend. */
  memory?: Pick<Store, 'loadStudent' | 'saveStudent' | 'deleteStudent'>;
  /**
   * A lasting Google connection: with an OAuth client, students connect Calendar and Sheets once
   * and the backend keeps them connected. `redirectBase` is where Google sends them back.
   */
  google?: { client: OAuthClient; redirectBase: string; fetch?: typeof fetch } | null;
  /** Told each time a student proves who they are, with the token they proved it with. */
  onToken?: (uid: string, token: string) => void;
  /** How long to wait after a change before saving, so a burst of changes is one write. */
  saveDelayMs?: number;
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

/** The résumé without its file or text, as pages are shown it. */
const resumeInfoOf = (r: { name: string; type: string; size: number; uploadedAt: string; text: string | null } | null) =>
  r ? { name: r.name, type: r.type, size: r.size, uploadedAt: r.uploadedAt, readable: r.text !== null } : null;

class HttpError extends Error {
  status: 401 | 404 | 503;
  constructor(status: 401 | 404 | 503, message: string) {
    super(message);
    this.status = status;
  }
}

export function mountAgents(app: Hono, opts: AgentsOptions) {
  const signedIn = new Map<string, Promise<AgentSystem>>();
  const saving = new Map<string, NodeJS.Timeout>();
  /** Students whose last save did not go through, and how to try it again. */
  const unsaved = new Map<string, () => void>();

  /**
   * Tie a student's agents to their stored memory: put back what was saved under their account,
   * then save again after every change.
   */
  async function remember(key: string, system: AgentSystem): Promise<AgentSystem> {
    const memory = opts.memory;
    if (!memory) return system;
    // If the saved memory cannot be read, the student is not given an empty one in its place:
    // saving that would wipe what is stored. The request fails and the next one tries again.
    const saved = await memory.loadStudent(key);
    if (saved) system.restore(saved);
    // Cards stored before pictures were looked for get them now, not on the next search.
    void system.fillPictures();
    const write = () => {
      saving.delete(key);
      memory.saveStudent(key, system.memorySnapshot()).then(
        () => unsaved.delete(key),
        (e) => {
          // Kept, and tried again on the next change or the next time the student connects.
          unsaved.set(key, write);
          console.error(`could not save the memory of ${key}: ${e instanceof Error ? e.message : e}`);
        },
      );
    };
    system.onChange(() => {
      if (saving.has(key)) return;
      const timer = setTimeout(write, opts.saveDelayMs ?? 400);
      timer.unref();
      saving.set(key, timer);
    });
    return system;
  }
  /** The guest student's memory is kept too, under a name no account id can have. */
  const demo = remember('guest:demo', opts.demo).catch((e) => {
    console.error('could not load the guest memory:', e);
    return opts.demo;
  });
  const enabled = Boolean(opts.verify && opts.forUser && opts.webConfig);

  async function userOf(c: Context): Promise<AuthUser> {
    if (!enabled) throw new HttpError(503, 'sign-in is not configured on this server');
    // EventSource cannot send headers, so the live stream passes the token in the query string.
    const header = c.req.header('authorization');
    const token = header?.startsWith('Bearer ') ? header.slice(7) : c.req.query('token');
    if (!token) throw new HttpError(401, 'sign in first');
    try {
      const user = await opts.verify!(token);
      opts.onToken?.(user.uid, token);
      // A save that failed while the student was away is tried again now that they are back.
      unsaved.get(user.uid)?.();
      return user;
    } catch {
      throw new HttpError(401, 'sign-in expired or invalid; sign in again');
    }
  }

  /** The agent system the request is about: the demo student, or the signed-in one. */
  async function systemOf(c: Context): Promise<AgentSystem> {
    const id = c.req.param('id');
    if (id === 'demo') return demo;
    if (id !== 'me') throw new HttpError(404, 'unknown student');
    const user = await userOf(c);
    // The memory is keyed by the account, so it follows the student to any device they sign in on.
    let system = signedIn.get(user.uid);
    if (!system) {
      system = remember(user.uid, opts.forUser!(user));
      signedIn.set(user.uid, system);
    }
    try {
      return await system;
    } catch (e) {
      if (signedIn.get(user.uid) === system) signedIn.delete(user.uid);
      console.error(`could not load the memory of ${user.uid}:`, e);
      throw new HttpError(503, 'your saved data could not be loaded; check the connection and try again');
    }
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

  // Stop the search in flight. What it already checked stays; nothing follows on its own.
  app.post(`${base}/runs/stop`, async (c) => {
    const system = await systemOf(c);
    return c.json({ stopped: system.stop() });
  });

  // Search again now; with { type } the search is for more of that one kind of opportunity.
  app.post(`${base}/runs`, async (c) => {
    const system = await systemOf(c);
    const body = await c.req.json().catch(() => ({}));
    if (typeof body?.type === 'string' && body.type in CATEGORY_OF) void system.searchFor(body.type as OppType);
    else void system.trigger(system.student().runCount === 0 ? 'first' : 'manual');
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
    const system = await signedIn.get(user.uid);
    if (system) {
      system.onChange(() => {});
      system.setSchedule(0);
      await system.idle();
      signedIn.delete(user.uid);
    }
    clearTimeout(saving.get(user.uid));
    saving.delete(user.uid);
    await opts.memory?.deleteStudent(user.uid);
    return c.json({ ok: true });
  });

  // The student's memory as the agents read it: the part they wrote, and the part the app learned.
  app.get(`${base}/memory`, async (c) => {
    const system = await systemOf(c);
    const { profile, learned } = system.memorySnapshot();
    const count = (action: Action) => learned.interactions.filter((i) => i.action === action).length;
    return c.json({
      profile: { profile: profile.profile, resume: resumeInfoOf(profile.resume), reminderDays: profile.reminderDays, scheduleSeconds: profile.scheduleSeconds },
      learned: {
        counts: { saves: count('save'), likes: count('like'), dislikes: count('dislike'), opens: count('open'), applies: count('apply'), found: learned.opportunities.length, rejected: learned.rejected.length, searches: learned.searches.length, runs: learned.runs.length },
        summary: system.student().memory,
        interactions: learned.interactions.slice(-200),
        searches: learned.searches.slice(-100),
        runs: learned.runs,
        found: learned.opportunities.map((o) => ({ id: o.id, title: o.title, organizer: o.organizer, type: o.type, sourceUrl: o.sourceUrl, deadline: o.deadline, foundAt: o.foundAt, lastCheckedAt: o.lastCheckedAt })),
        rejected: learned.rejected,
      },
      stored: Boolean(opts.memory),
    });
  });

  app.post(`${base}/reset`, async (c) => {
    const system = await systemOf(c);
    await system.idle();
    system.reset();
    return c.json({ student: system.student() });
  });

  // ---- the lasting Google connection ---------------------------------------------------------
  const oauth = opts.google ?? null;
  const redirectUri = oauth ? `${oauth.redirectBase}/auth/google/callback` : '';
  /** Consent screens opened and not yet answered, by state. They expire after ten minutes. */
  const consents = new Map<string, { system: AgentSystem; verifier: string; expires: number; services: GoogleService[]; replace: boolean }>();
  /** Access tokens already traded for, so Google is not asked on every call. */
  const access = new WeakMap<AgentSystem, { token: string; expires: number }>();

  /**
   * An access token for one Google service: the one the request carries, or one made from the
   * student's lasting connection. Null when neither has it.
   */
  async function googleToken(c: Context, system: AgentSystem, service: GoogleService): Promise<string | null> {
    const sent = c.req.header('x-google-access-token');
    if (sent) return sent;
    const grant = system.getGoogle();
    if (!oauth || !grant || !grant.services.includes(service)) return null;
    const cached = access.get(system);
    if (cached && cached.expires > Date.now() + 60_000) return cached.token;
    try {
      const fresh = await refreshAccess(oauth.client, grant.refreshToken, oauth.fetch);
      access.set(system, { token: fresh.access_token, expires: Date.now() + fresh.expires_in * 1000 });
      return fresh.access_token;
    } catch (e) {
      // The student took the access back in their Google account: forget the connection.
      if ((e as { revoked?: boolean }).revoked) system.setGoogle(null);
      return null;
    }
  }

  app.get('/api/google/config', (c) => c.json({ enabled: Boolean(oauth) }));

  // ---- agent settings: models per agent group (Grok only) and minimums per kind ------------------
  const GROUP_LABEL: Record<AgentGroup, string> = {
    master: 'Master agent',
    managers: 'Search managers',
    workers: 'Worker fleet (scouts, readers, deadline finders)',
    validators: 'Validation agents',
    presentation: 'Presentation manager',
    helpers: 'Helpers (pictures, calendar)',
  };
  const grokModels = () => [...new Set([config.xaiModels.high, config.xaiModels.normal, config.xaiModels.low, config.xaiModel].filter(Boolean))];

  app.get(`${base}/agent-settings`, async (c) => {
    const system = await systemOf(c);
    return c.json({
      settings: system.getAgentSettings(),
      groups: AGENT_GROUPS.map((id) => ({ id, label: GROUP_LABEL[id], tier: id === 'workers' || id === 'helpers' ? config.xaiModels.low : config.xaiModels.normal })),
      models: grokModels(),
      // Whether the choices are in use now: only while the agents run on Grok.
      applied: opts.grok?.mode === 'api' || opts.grok?.mode === 'cli',
    });
  });

  app.put(`${base}/agent-settings`, async (c) => {
    const system = await systemOf(c);
    const body = await c.req.json().catch(() => ({}));
    const allowed = new Set(grokModels());
    const models = Object.fromEntries(
      AGENT_GROUPS.flatMap((g) => (typeof body?.models?.[g] === 'string' && allowed.has(body.models[g]) ? [[g, body.models[g]]] : [])),
    ) as AgentSettings['models'];
    const minimums = Object.fromEntries(
      Object.keys(CATEGORY_OF).flatMap((t) => {
        const n = Number(body?.minimums?.[t]);
        return Number.isInteger(n) && n > 0 ? [[t, Math.min(n, 50)]] : [];
      }),
    ) as AgentSettings['minimums'];
    const kinds = (Array.isArray(body?.kinds) ? body.kinds : []).filter((k: unknown): k is Category => CATEGORIES.includes(k as Category));
    system.setAgentSettings({ models, minimums, kinds: [...new Set(kinds)] as Category[] });
    return c.json({ settings: system.getAgentSettings() });
  });

  // The calendar's chat box: a sentence becomes an event the page then adds (and puts on Google
  // Calendar), or a question back when something is missing.
  app.post(`${base}/calendar/ask`, async (c) => {
    const system = await systemOf(c);
    const body = await c.req.json().catch(() => ({}));
    const text = typeof body?.text === 'string' ? body.text.trim().slice(0, 300) : '';
    if (!text) return c.json({ ok: false, reply: 'Say what to add and when.' });
    const today = typeof body?.today === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(body.today) ? body.today : new Date().toISOString().slice(0, 10);
    const timeZone = typeof body?.timeZone === 'string' && body.timeZone.length < 60 ? body.timeZone : 'UTC';
    try {
      return c.json(await system.draftCalendarEvent(text, today, timeZone));
    } catch (e) {
      return c.json({ ok: false, reply: `That could not be added just now: ${e instanceof Error ? e.message : 'unknown error'}` });
    }
  });

  // The calendar's "Career only" filter: the agents' model sorts the student's own calendar events
  // into career-related and personal. Only titles, calendar names and places are sent, 80 at most.
  app.post(`${base}/calendar/sort`, async (c) => {
    const system = await systemOf(c);
    const body = await c.req.json().catch(() => ({}));
    const text = (v: unknown, max: number) => (typeof v === 'string' && v.trim() ? v.trim().slice(0, max) : null);
    const events = (Array.isArray(body?.events) ? body.events : [])
      .slice(0, 80)
      .flatMap((e: any) => (text(e?.id, 300) && text(e?.title, 200) ? [{ id: text(e.id, 300)!, title: text(e.title, 200)!, calendar: text(e.calendar, 120), location: text(e.location, 120) }] : []));
    return c.json({ verdicts: await system.sortCalendarEvents(events) });
  });

  app.get(`${base}/google`, async (c) => {
    const system = await systemOf(c);
    const grant = system.getGoogle();
    return c.json({ enabled: Boolean(oauth), services: grant?.services ?? [], connectedAt: grant?.connectedAt ?? null, allCalendars: grant?.allCalendars === true });
  });

  // The address of Google's consent screen for Calendar and Sheets, for the page to open in the
  // student's browser. Asked for with the sign-in header, so no BearRok token goes into a URL.
  app.post(`${base}/google/connect`, async (c) => {
    if (!oauth) return c.json({ error: 'Google connection is not set up on this server' }, 503);
    if (c.req.param('id') !== 'me') return c.json({ error: 'sign in first' }, 401);
    const system = await systemOf(c);
    const user = await userOf(c);
    const body = await c.req.json().catch(() => ({}));
    const asked: unknown[] = Array.isArray(body?.services) ? body.services : ['calendar', 'sheets'];
    const wanted = asked.filter((s): s is GoogleService => s === 'calendar' || s === 'sheets');
    // Switching to another Google account starts afresh: nothing from the old one is carried over.
    const switching = body?.switchAccount === true;
    const services = switching ? wanted : [...new Set([...wanted, ...(system.getGoogle()?.services ?? [])])];
    const { verifier, challenge } = pkce();
    const state = randomBytes(24).toString('base64url');
    for (const [k, v] of consents) if (v.expires < Date.now()) consents.delete(k);
    consents.set(state, { system, verifier, expires: Date.now() + 10 * 60_000, services: services.length ? services : ['calendar', 'sheets'], replace: switching });
    return c.json({ url: consentUrl(oauth.client, { redirectUri, services: services.length ? services : ['calendar', 'sheets'], state, challenge, loginHint: switching ? null : user.email, chooseAccount: switching }) });
  });

  // Google sends the student back here with a code, which is traded for the lasting connection.
  app.get('/auth/google/callback', async (c) => {
    const page = (title: string, text: string, status: 200 | 400 | 502 = 200) =>
      c.html(
        `<!doctype html><meta charset="utf-8"><title>BearRok</title><body style="font:16px system-ui;display:grid;place-items:center;min-height:90vh;margin:0;background:#f3f7fc;color:#152b43"><div style="max-width:420px;text-align:center"><h1 style="font-size:22px">${title}</h1><p>${text}</p></div></body>`,
        status,
      );
    const pending = consents.get(c.req.query('state') ?? '');
    if (!oauth || !pending) return page('That link has expired', 'Go back to BearRok and press Connect again.', 400);
    consents.delete(c.req.query('state')!);
    if (c.req.query('error')) return page('Not connected', 'Google access was not given. You can close this window.', 400);
    try {
      const tokens = await exchangeCode(oauth.client, c.req.query('code') ?? '', pending.verifier, redirectUri, oauth.fetch);
      const previous = pending.system.getGoogle();
      const before = pending.replace ? null : previous;
      // The old account's access is given back when the student switches to another one.
      if (pending.replace && previous && previous.refreshToken !== tokens.refresh_token) void revoke(previous.refreshToken, oauth.fetch);
      const refreshToken = tokens.refresh_token ?? before?.refreshToken;
      if (!refreshToken) return page('Not connected', 'Google did not give BearRok lasting access. Press Connect again.', 502);
      const granted = servicesIn(tokens.scope);
      const services = [...new Set([...(before?.services ?? []), ...granted])];
      pending.system.setGoogle({ refreshToken, services, connectedAt: new Date().toISOString(), allCalendars: allCalendarsIn(tokens.scope) || (before?.allCalendars ?? false) });
      access.set(pending.system, { token: tokens.access_token, expires: Date.now() + tokens.expires_in * 1000 });
      // Google's consent screen has a box for each permission, unticked to start with. Continuing
      // without ticking them gives BearRok nothing it can use, so the student is told plainly.
      const missing = pending.services.filter((s) => !services.includes(s));
      const name = { calendar: 'Google Calendar', sheets: 'Google Sheets' };
      if (missing.length) {
        return page(
          `${missing.map((s) => name[s]).join(' and ')} not allowed`,
          `Google did not give BearRok access to ${missing.map((s) => name[s]).join(' or ')}. Go back to BearRok, press Connect again, and on Google's screen tick ${missing.length === 2 ? 'both permissions (or "Select all")' : 'the permission'} before you press Continue. If Google showed no boxes to tick, the app's Google setup does not list these permissions yet.`,
          400,
        );
      }
      return page('Google is connected', 'BearRok keeps your calendar and sheet up to date from now on, and will not ask again. You can close this window and go back to the app.');
    } catch (e) {
      return page('Not connected', `Google said: ${e instanceof Error ? e.message : String(e)}`, 502);
    }
  });

  // A fresh access token for the page, for reading the student's own calendar.
  app.post(`${base}/google/token`, async (c) => {
    const system = await systemOf(c);
    const body = await c.req.json().catch(() => ({}));
    const service: GoogleService = body?.service === 'sheets' ? 'sheets' : 'calendar';
    const token = await googleToken(c, system, service);
    if (!token) return c.json({ error: 'not connected' }, 404);
    return c.json({ accessToken: token, expiresAt: access.get(system)?.expires ?? Date.now() + 50 * 60_000 });
  });

  app.delete(`${base}/google`, async (c) => {
    const system = await systemOf(c);
    const grant = system.getGoogle();
    if (grant) await revoke(grant.refreshToken, oauth?.fetch);
    access.delete(system);
    system.setGoogle(null);
    return c.json({ services: [] });
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

    const google = await googleToken(c, system, 'calendar');
    const event = application.status === 'to_apply' || application.status === 'applying' ? system.calendarEvent(application) : null;
    if (google) {
      try {
        // Replace rather than duplicate when the deadline or status changes.
        if (application.calendar.eventId) await calendar.remove(google, application.calendar.eventId);
        if (event) {
          const made = await calendar.create(google, event);
          system.setCalendar(oppId, { state: 'synced', eventId: made.eventId, htmlLink: made.htmlLink, error: null, syncedDeadline: application.deadline });
        } else {
          system.setCalendar(oppId, { state: 'none', eventId: null, htmlLink: null, error: null, syncedDeadline: null });
        }
      } catch (e) {
        system.setCalendar(oppId, { error: e instanceof Error ? e.message : String(e) });
      }
    }
    return c.json({ application: system.getApplication(oppId) });
  });

  /**
   * Bring the student's Google Calendar in line with their applications: every To apply or
   * Applying application with a deadline gets one event, a changed deadline moves it, and one that
   * is no longer active loses it. The app calls this on its own whenever Google Calendar is
   * connected, so nobody has to add events by hand.
   */
  app.post(`${base}/calendar/sync`, async (c) => {
    const system = await systemOf(c);
    const google = await googleToken(c, system, 'calendar');
    if (!google) return c.json({ error: 'connect Google Calendar first' }, 400);
    let added = 0;
    let removed = 0;
    const errors: string[] = [];
    for (const app of system.listApplications()) {
      const active = app.status === 'to_apply' || app.status === 'applying';
      const event = active ? system.calendarEvent(app) : null;
      const current = app.calendar.state === 'synced' && app.calendar.syncedDeadline === app.deadline;
      try {
        if (event && !current) {
          if (app.calendar.eventId) await calendar.remove(google, app.calendar.eventId).catch(() => {});
          const made = await calendar.create(google, event);
          system.setCalendar(app.opportunityId, { state: 'synced', eventId: made.eventId, htmlLink: made.htmlLink, error: null, syncedDeadline: app.deadline });
          added++;
        } else if (!event && app.calendar.eventId) {
          await calendar.remove(google, app.calendar.eventId);
          system.setCalendar(app.opportunityId, { state: 'none', eventId: null, htmlLink: null, error: null, syncedDeadline: null });
          removed++;
        }
      } catch (e) {
        const message = e instanceof Error ? e.message : String(e);
        system.setCalendar(app.opportunityId, { error: message });
        errors.push(`${app.title}: ${message}`);
      }
    }
    return c.json({ added, removed, errors });
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

  // The saved tracker: every saved posting with its status, deadline, details and links. The app
  // shows these rows as its own spreadsheet, and writes the same rows to a linked Google Sheet.
  app.get(`${base}/sheet`, async (c) => {
    const system = await systemOf(c);
    const [header, ...rows] = trackerRows(system.trackerItems(), new Date());
    return c.json({ header, rows, ids: system.trackerItems().map((i) => i.opportunity?.id ?? i.application!.opportunityId), linked: system.getSheet() });
  });

  // Write the tracker to the student's linked Google Sheet, linking a new one the first time.
  app.post(`${base}/sheet/sync`, async (c) => {
    const system = await systemOf(c);
    const google = await googleToken(c, system, 'sheets');
    if (!google) return c.json({ error: 'connect Google Sheets first' }, 400);
    try {
      const now = new Date();
      const written = await (opts.tracker ?? writeTracker)(google, system.getSheet(), trackerRows(system.trackerItems(), now), now);
      system.setSheet({ ...written, syncedAt: now.toISOString() });
      return c.json({ linked: system.getSheet() });
    } catch (e) {
      return c.json({ error: e instanceof Error ? e.message : String(e) }, 502);
    }
  });

  // Stop writing to the linked sheet. The file stays in the student's Drive.
  app.delete(`${base}/sheet`, async (c) => {
    const system = await systemOf(c);
    system.setSheet(null);
    return c.json({ linked: null });
  });

  app.delete(`${base}/applications/:oppId`, async (c) => {
    const system = await systemOf(c);
    const removed = system.removeApplication(c.req.param('oppId'));
    if (!removed) return c.json({ error: 'application not found' }, 404);
    const google = await googleToken(c, system, 'calendar');
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
      // A student coming back to a remembered feed that is short gets it topped up.
      else setTimeout(() => {
        system.fillIfShort();
        void system.fillPictures();
      }, 900);
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
