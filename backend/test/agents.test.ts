import assert from 'node:assert/strict';
import { test } from 'node:test';
import { SimBrain } from '../src/agents/simBrain.ts';
import { allocateSlots, buildMemory, categoryWeights, rankFeed } from '../src/agents/scoring.ts';
import { AgentSystem } from '../src/agents/system.ts';
import { Fleet } from '../src/agents/fleet.ts';
import type { Category, Interaction, Opportunity } from '../src/agents/types.ts';
import { createApp } from '../src/app.ts';
import type { AuthUser } from '../src/auth.ts';
import { LocalStore } from '../src/store/local.ts';

const NOW = new Date('2026-11-18T20:00:00Z');
const even: Record<Category, number> = { internship: 1, event: 1, club: 1, program: 1 };
const system = (opts = {}) => new AgentSystem(new SimBrain({ speed: 0, now: () => NOW }), { now: () => NOW, typingPauseMs: 300, ...opts });

function opp(id: string, over: Partial<Opportunity> = {}): Opportunity {
  return {
    id, type: 'internship', title: id, organizer: `Org ${id}`, sourceUrl: `https://example.org/${id}`, actionUrl: null, format: 'online',
    location: null, field: 'software', tags: [], eligibility: null, eligibleYears: null, deadline: null, startTime: null, image: null, evidence: [],
    origin: 'prepared', fitExplanation: '', unknowns: [], foundAt: NOW.toISOString(), lastCheckedAt: NOW.toISOString(), baseScore: 0.6,
    foundBy: 'm', alsoSeenAt: [], application: null, ...over,
  };
}
const act = (opportunityId: string, action: Interaction['action']): Interaction => ({ opportunityId, action, at: NOW.toISOString() });

test('slots: every category wanted gives one manager each', () => {
  assert.deepEqual(allocateSlots(['internship', 'event', 'club', 'program'], even, 4), { internship: 1, event: 1, club: 1, program: 1 });
});

test('slots: internships only puts every manager on internships', () => {
  assert.deepEqual(allocateSlots(['internship'], even, 4), { internship: 4, event: 0, club: 0, program: 0 });
});

test('slots: two categories split by engagement, and all slots are used', () => {
  const split = allocateSlots(['internship', 'club'], { ...even, internship: 3 }, 4);
  assert.deepEqual(split, { internship: 3, event: 0, club: 1, program: 0 });
});

test('slots: a category the student keeps disliking loses its manager', () => {
  const byId = new Map(['e1', 'e2', 'e3'].map((id) => [id, opp(id, { type: 'event' })]));
  const memory = buildMemory(['e1', 'e2', 'e3'].map((id) => act(id, 'dislike')), byId);
  const weights = categoryWeights(memory);
  assert.equal(weights.event, 0);
  assert.equal(allocateSlots(['internship', 'event'], weights, 4).event, 0);
});

test('ranking: a like lifts similar cards, a dislike removes the card and sinks similar ones', () => {
  const cards = [opp('a', { field: 'software', baseScore: 0.66 }), opp('b', { field: 'data', baseScore: 0.6 }), opp('c', { field: 'data', baseScore: 0.58 }), opp('d', { field: 'software', baseScore: 0.62 })];
  const byId = new Map(cards.map((c) => [c.id, c]));
  const order = (interactions: Interaction[]) => rankFeed(cards, buildMemory(interactions, byId), { now: NOW }).map((f) => f.opportunity.id);

  assert.deepEqual(order([]), ['a', 'd', 'b', 'c']);
  assert.deepEqual(order([act('b', 'like')]).slice(0, 2), ['b', 'c']);
  const afterDislike = order([act('a', 'dislike')]);
  assert.ok(!afterDislike.includes('a'));
  assert.equal(afterDislike.at(-1), 'd');
  // Liking again takes the like back.
  assert.deepEqual(order([act('b', 'like'), act('b', 'like')]), ['a', 'd', 'b', 'c']);
});

test('fleet: budget, dedupe and one retry', async () => {
  const fleet = new Fleet({ concurrency: 2, maxJobs: 3, onUpdate: () => {} });
  assert.equal(fleet.claim('x'), true);
  assert.equal(fleet.claim('x'), false);
  let tries = 0;
  const flaky = await fleet.run({ kind: 'scout', managerId: 'm', label: 'flaky' }, async () => {
    if (++tries === 1) throw new Error('boom');
    return { value: 'ok', summary: 'ok' };
  });
  assert.equal(flaky, 'ok');
  assert.equal(await fleet.run({ kind: 'scout', managerId: 'm', label: 'dead' }, async () => { throw new Error('down'); }), null);
  await fleet.run({ kind: 'scout', managerId: 'm', label: 'third' }, async () => ({ value: 1, summary: '' }));
  assert.equal(await fleet.run({ kind: 'scout', managerId: 'm', label: 'over budget' }, async () => ({ value: 1, summary: '' })), null);
  assert.deepEqual(fleet.jobs.map((j) => j.status), ['done', 'failed', 'done', 'skipped']);
});

test('run: master, four search managers, fleet, validators and presentation manager produce a checked feed', async () => {
  const s = system();
  await s.trigger('first');
  const run = s.currentRun()!;
  assert.equal(run.status, 'complete');
  assert.deepEqual(run.agents.map((a) => a.level), ['master', 'manager', 'manager', 'manager', 'manager', 'presentation']);
  assert.deepEqual(run.assignments.map((a) => a.category), ['internship', 'event', 'club', 'program']);
  assert.ok(run.jobs.some((j) => j.kind === 'scout') && run.jobs.some((j) => j.kind === 'extract') && run.jobs.some((j) => j.kind === 'application'));
  assert.ok(run.stats.rejected > 0, 'validation turned something down');
  const feed = s.student().feed;
  assert.equal(feed.length, run.stats.kept);
  // Nothing closed or restricted to upper years reaches a freshman.
  for (const f of feed) {
    assert.ok(!f.opportunity.deadline || Date.parse(f.opportunity.deadline) > NOW.getTime());
    assert.ok(!f.opportunity.eligibleYears || f.opportunity.eligibleYears.includes('Freshman'));
    assert.ok(f.reason.length > 10);
  }
});

test('run: a student who wants only internships gets four internship managers with different lenses', async () => {
  const s = system();
  s.setProfile({ categories: ['internship'] });
  await new Promise((r) => setTimeout(r, 800));
  await s.idle();
  const run = s.currentRun()!;
  assert.equal(run.trigger, 'profile');
  assert.deepEqual(run.assignments.map((a) => a.category), ['internship', 'internship', 'internship', 'internship']);
  assert.equal(new Set(run.assignments.map((a) => a.lens)).size, 4);
  assert.ok(run.stats.merged > 0, 'overlapping managers were deduplicated');
  assert.ok(s.student().feed.every((f) => f.opportunity.type === 'internship'));
  const urls = s.student().feed.map((f) => f.opportunity.sourceUrl);
  assert.equal(new Set(urls).size, urls.length);
});

test('automation: enough reactions start a run on their own, and the next run brings new postings', async () => {
  const s = system({ feedbackThreshold: 3 });
  await s.trigger('first');
  const first = s.student().feed;
  const data = first.filter((f) => f.opportunity.field === 'data').slice(0, 3);
  for (const f of data) s.interact(f.opportunity.id, 'like');
  await s.idle();
  const run = s.currentRun()!;
  assert.equal(run.number, 2);
  assert.equal(run.trigger, 'feedback');
  assert.ok(run.stats.added > 0);
  const after = s.student();
  assert.equal(after.feed[0]!.opportunity.field, 'data');
  assert.equal(after.feedbackSinceRun, 0);
  assert.ok(after.memory.likes.some((l) => l.feature === 'data'));
});

test('API: state, reactions, profile and manual runs', async () => {
  const s = system();
  const { app } = createApp(new LocalStore(null), {}, { demo: s });
  const json = async (method: string, path: string, body?: unknown) => {
    const res = await app.request(path, { method, headers: { 'content-type': 'application/json' }, body: body ? JSON.stringify(body) : undefined });
    return { status: res.status, body: (await res.json()) as any };
  };
  assert.equal((await json('POST', '/api/students/demo/runs')).status, 202);
  await s.idle();
  const state = await json('GET', '/api/students/demo/state');
  assert.equal(state.body.run.status, 'complete');
  const id = state.body.student.feed[0].opportunity.id;
  const liked = await json('POST', '/api/students/demo/interactions', { opportunityId: id, action: 'like' });
  assert.equal(liked.body.student.feed.find((f: any) => f.opportunity.id === id).reaction, 'like');
  assert.equal((await json('POST', '/api/students/demo/interactions', { opportunityId: 'nope', action: 'like' })).status, 404);
  assert.equal((await json('POST', '/api/students/demo/interactions', { opportunityId: id, action: 'shrug' })).status, 400);
  assert.equal((await json('PUT', '/api/students/demo/profile', { year: 'Wizard' })).status, 400);
  const page = await app.request('/');
  assert.equal(page.status, 200);
});

test('sign-in with Google or email: each signed-in student gets their own agents, separate from the demo', async () => {
  const demo = system();
  const users: Record<string, AuthUser> = {
    'token-ana': { uid: 'u1', name: 'Ana Lima', email: null, picture: null, provider: 'google', emailVerified: true },
    // Ben signed up with email and password, so Firebase has no display name for him.
    'token-ben': { uid: 'u2', name: null, email: 'ben@example.org', picture: null, provider: 'password', emailVerified: false },
  };
  const made: AgentSystem[] = [];
  const { app } = createApp(new LocalStore(null), {}, {
    demo,
    webConfig: { apiKey: 'k', projectId: 'p', authDomain: 'p.firebaseapp.com' },
    verify: async (token) => users[token] ?? Promise.reject(new Error('bad token')),
    forUser: (user) => {
      const s = new AgentSystem(new SimBrain({ speed: 0, now: () => NOW }), { now: () => NOW }, { name: user.name?.split(' ')[0] ?? user.email!.split('@')[0]! });
      made.push(s);
      return s;
    },
  });
  const call = async (method: string, path: string, token?: string, body?: unknown) => {
    const res = await app.request(path, { method, headers: { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}) }, body: body ? JSON.stringify(body) : undefined });
    return { status: res.status, body: (await res.json()) as any };
  };

  assert.deepEqual((await call('GET', '/api/auth/config')).body, { enabled: true, providers: ['google', 'x', 'password'], firebase: { apiKey: 'k', projectId: 'p', authDomain: 'p.firebaseapp.com' } });
  assert.equal((await call('GET', '/api/students/me/state')).status, 401);
  assert.equal((await call('GET', '/api/students/me/state', 'forged')).status, 401);
  assert.equal((await call('GET', '/api/students/someone-else/state', 'token-ana')).status, 404);
  assert.equal((await call('GET', '/api/auth/me', 'token-ana')).body.user.uid, 'u1');

  const ana = await call('GET', '/api/students/me/state', 'token-ana');
  assert.equal(ana.body.student.profile.name, 'Ana');
  // The token in the query string works too (the live stream needs it).
  assert.equal((await app.request('/api/students/me/state?token=token-ben')).status, 200);
  assert.equal(made.length, 2);

  // Ana's run and profile do not touch Ben or the demo student.
  await call('PUT', '/api/students/me/profile', 'token-ana', { categories: ['internship'] });
  await new Promise((r) => setTimeout(r, 800));
  await made[0]!.idle();
  assert.ok((await call('GET', '/api/students/me/state', 'token-ana')).body.student.feed.length > 0);
  const ben = await call('GET', '/api/students/me/state', 'token-ben');
  assert.equal(ben.body.student.profile.name, 'ben');
  assert.equal((await call('GET', '/api/auth/me', 'token-ben')).body.user.provider, 'password');
  assert.equal(ben.body.student.feed.length, 0);
  assert.equal(ben.body.student.profile.categories.length, 4);
  assert.equal((await call('GET', '/api/students/demo/state')).body.student.runCount, 0);
});

test('sign-in off: the demo student still works and /me says why it does not', async () => {
  const { app } = createApp(new LocalStore(null), {}, { demo: system() });
  assert.deepEqual(await (await app.request('/api/auth/config')).json(), { enabled: false });
  assert.equal((await app.request('/api/students/me/state')).status, 503);
  assert.equal((await app.request('/api/students/demo/state')).status, 200);
});

test('applications: to_apply sets reminders and a calendar link on its own; applied clears them', async () => {
  const s = system();
  await s.trigger('first');
  const withDeadline = s.student().feed.find((f) => f.opportunity.deadline && Date.parse(f.opportunity.deadline) - NOW.getTime() > 8 * 86_400_000)!.opportunity;

  const interested = s.setApplication(withDeadline.id, { status: 'interested' })!;
  assert.deepEqual(interested.reminders, []);
  assert.equal(interested.calendar.state, 'none');

  const toApply = s.setApplication(withDeadline.id, { status: 'to_apply' })!;
  assert.deepEqual(toApply.reminders.map((r) => r.label), ['Due in one week', 'Due in two days', 'Due today']);
  assert.equal(toApply.reminders.at(-1)!.at, withDeadline.deadline);
  assert.equal(toApply.calendar.state, 'link');
  assert.match(toApply.calendar.addUrl!, /^https:\/\/calendar\.google\.com\/calendar\/render\?action=TEMPLATE/);

  const applied = s.setApplication(withDeadline.id, { status: 'applied' })!;
  assert.deepEqual(applied.reminders, []);
  assert.equal(applied.calendar.addUrl, null);
  assert.equal(s.student().memory.counts.apply, 1);
  assert.equal(s.setApplication('nope', { status: 'to_apply' }), null);
});

test('applications: no deadline means no invented reminder, until the student supplies one', async () => {
  const s = system();
  await s.trigger('first');
  const open = s.student().feed.find((f) => !f.opportunity.deadline)!.opportunity;
  const app = s.setApplication(open.id, { status: 'applying' })!;
  assert.deepEqual(app.reminders, []);
  assert.equal(app.needsDeadline, true);
  assert.equal(app.calendar.state, 'none');
  const fixed = s.setApplication(open.id, { deadline: '2026-12-20' })!;
  assert.equal(fixed.needsDeadline, false);
  assert.equal(fixed.reminders.length, 3);
});

test('applications API: with a Google token the deadline goes on the calendar, and comes off when applied', async () => {
  const s = system();
  await s.trigger('first');
  const calls: string[] = [];
  const { app } = createApp(new LocalStore(null), {}, {
    demo: s,
    calendar: {
      create: async (token, event) => { calls.push(`create ${token} ${event.title}`); return { eventId: 'evt-1', htmlLink: 'https://calendar.google.com/event?eid=1' }; },
      remove: async (token, id) => { calls.push(`remove ${token} ${id}`); },
    },
  });
  const o = s.student().feed.find((f) => f.opportunity.deadline)!.opportunity;
  const put = async (body: unknown, google?: string) => {
    const res = await app.request(`/api/students/demo/applications/${o.id}`, { method: 'PUT', headers: { 'content-type': 'application/json', ...(google ? { 'x-google-access-token': google } : {}) }, body: JSON.stringify(body) });
    return { status: res.status, body: (await res.json()) as any };
  };

  // Without a token: reminders and the link only.
  const link = await put({ status: 'to_apply' });
  assert.equal(link.body.application.calendar.state, 'link');
  assert.equal(calls.length, 0);

  const synced = await put({ status: 'applying', drafts: { 'Why do you want to join?': 'Because.' } }, 'g-token');
  assert.equal(synced.body.application.calendar.state, 'synced');
  assert.equal(synced.body.application.calendar.eventId, 'evt-1');
  assert.equal(synced.body.application.drafts['Why do you want to join?'], 'Because.');
  assert.match(calls[0]!, /^create g-token Due: /);

  const done = await put({ status: 'applied' }, 'g-token');
  assert.equal(done.body.application.calendar.state, 'none');
  assert.equal(calls.at(-1), 'remove g-token evt-1');

  assert.equal((await put({ status: 'maybe' })).status, 400);
  const list = (await (await app.request('/api/students/demo/applications')).json()) as any;
  assert.equal(list.applications.length, 1);
  assert.equal(list.applications[0].status, 'applied');
});

test('calendar: an all-day event on the deadline with three pop-up reminders', async () => {
  const { eventBody, createDeadlineEvent, addToCalendarUrl } = await import('../src/calendar.ts');
  const event = { title: 'Due: Data Analyst Intern (Harbor Data Co)', deadline: '2026-12-05T23:59:00.000Z', description: 'Apply: https://example.org/x' };
  const body = eventBody(event);
  assert.deepEqual(body.start, { date: '2026-12-05' });
  assert.deepEqual(body.end, { date: '2026-12-06' });
  assert.deepEqual(body.reminders.overrides.map((o) => o.minutes), [10080, 2880, 0]);
  assert.match(addToCalendarUrl(event), /dates=20261205%2F20261206/);
  let seen: Request | null = null;
  const fake = (async (url: any, init: any) => { seen = new Request(url, init); return Response.json({ id: 'abc', htmlLink: 'https://calendar.google.com/e' }); }) as typeof fetch;
  assert.deepEqual(await createDeadlineEvent('tok', event, fake), { eventId: 'abc', htmlLink: 'https://calendar.google.com/e' });
  assert.equal(seen!.headers.get('authorization'), 'Bearer tok');
  assert.equal(new URL(seen!.url).pathname, '/calendar/v3/calendars/primary/events');
});

test('desktop sign-in handoff: only the app holding the verifier can collect the result, and only once', async () => {
  const { createHash } = await import('node:crypto');
  const { app } = createApp(new LocalStore(null), {}, { demo: system() });
  const verifier = 'a-long-random-secret-only-the-desktop-app-knows';
  const session = createHash('sha256').update(verifier).digest('hex');
  const post = async (path: string, body: unknown) => {
    const res = await app.request(path, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
    return { status: res.status, body: (await res.json()) as any };
  };

  assert.equal((await app.request('/auth/desktop?session=' + session)).status, 200);
  // Nothing yet: the app keeps waiting.
  assert.equal((await post(`/api/auth/desktop/${session}/claim`, { verifier })).status, 202);
  assert.equal((await post('/api/auth/desktop/not-a-session', { provider: 'google', idToken: 't' })).status, 400);
  assert.equal((await post(`/api/auth/desktop/${session}`, { provider: 'google' })).status, 400);

  assert.equal((await post(`/api/auth/desktop/${session}`, { provider: 'google', idToken: 'google-id-token', accessToken: 'google-access' })).status, 200);
  // A second result cannot replace the first.
  assert.equal((await post(`/api/auth/desktop/${session}`, { provider: 'google', idToken: 'attacker' })).status, 409);
  // Knowing the session id is not enough.
  assert.equal((await post(`/api/auth/desktop/${session}/claim`, { verifier: 'guess' })).status, 403);

  const claimed = await post(`/api/auth/desktop/${session}/claim`, { verifier });
  assert.deepEqual(claimed.body.credential, { provider: 'google', idToken: 'google-id-token', accessToken: 'google-access', secret: null });
  // Collected once, then gone.
  assert.equal((await post(`/api/auth/desktop/${session}/claim`, { verifier })).status, 202);
});

test('settings: connection status, and exporting applications to a Google Sheet', async () => {
  const s = system();
  await s.trigger('first');
  const o = s.student().feed.find((f) => f.opportunity.deadline)!.opportunity;
  s.setApplication(o.id, { status: 'to_apply' });
  let sent: { token: string; rows: number } | null = null;
  const { app } = createApp(new LocalStore(null), {}, {
    demo: s,
    grok: { connected: true, mode: 'cli', detail: 'subscription' },
    sheets: async (token, applications) => { sent = { token, rows: applications.length }; return { spreadsheetId: 'sheet-1', url: 'https://docs.google.com/spreadsheets/d/sheet-1' }; },
  });
  assert.deepEqual(await (await app.request('/api/connections')).json(), { grok: { connected: true, mode: 'cli', detail: 'subscription' }, signIn: false });

  assert.equal((await app.request('/api/students/demo/applications/export', { method: 'POST' })).status, 400);
  const res = await app.request('/api/students/demo/applications/export', { method: 'POST', headers: { 'x-google-access-token': 'g-token' } });
  assert.deepEqual(await res.json(), { spreadsheetId: 'sheet-1', url: 'https://docs.google.com/spreadsheets/d/sheet-1' });
  assert.deepEqual(sent, { token: 'g-token', rows: 1 });

  const { sheetRows } = await import('../src/sheets.ts');
  const rows = sheetRows(s.listApplications());
  assert.equal(rows[0]![0], 'Opportunity');
  assert.deepEqual(rows[1]!.slice(0, 4), [o.title, o.organizer, 'To apply', o.deadline!.slice(0, 10)]);
});

test('preferences: reminder timing, a floor on how often agents run, and deleting your data', async () => {
  const made: AgentSystem[] = [];
  const { app } = createApp(new LocalStore(null), {}, {
    demo: system(),
    webConfig: { apiKey: 'k', projectId: 'p' },
    verify: async (token) => (token === 'ok' ? { uid: 'u1', name: 'Ana', email: null, picture: null, provider: 'google', emailVerified: true } : Promise.reject(new Error('bad'))),
    forUser: () => { const s = system(); made.push(s); return s; },
  });
  const call = async (method: string, path: string, body?: unknown) => {
    const res = await app.request(path, { method, headers: { 'content-type': 'application/json', authorization: 'Bearer ok' }, body: body ? JSON.stringify(body) : undefined });
    return { status: res.status, body: (await res.json()) as any };
  };
  assert.deepEqual((await call('GET', '/api/students/me/preferences')).body, { reminderDays: [7, 2, 0], scheduleSeconds: 0 });

  const s = made[0]!;
  await s.trigger('first');
  const o = s.student().feed.find((f) => f.opportunity.deadline && Date.parse(f.opportunity.deadline) - NOW.getTime() > 8 * 86_400_000)!.opportunity;
  s.setApplication(o.id, { status: 'to_apply' });

  // Reminders already set are redone with the new timing; an empty list turns them off.
  const changed = await call('PUT', '/api/students/me/preferences', { reminderDays: [3, 1], scheduleSeconds: 30 });
  assert.deepEqual(changed.body, { reminderDays: [3, 1], scheduleSeconds: 300 });
  assert.deepEqual(s.getApplication(o.id)!.reminders.map((r) => r.label), ['Due in 3 days', 'Due tomorrow']);
  await call('PUT', '/api/students/me/preferences', { reminderDays: [], scheduleSeconds: 0 });
  assert.deepEqual(s.getApplication(o.id)!.reminders, []);

  assert.equal((await call('DELETE', '/api/students/demo')).status, 400);
  assert.equal((await call('DELETE', '/api/students/me')).status, 200);
  // A fresh, empty student afterwards.
  assert.equal((await call('GET', '/api/students/me/state')).body.student.feed.length, 0);
  assert.equal(made.length, 2);
});

test('profile page answers: ticked fields steer the search and restrictions become rules', async () => {
  const s = system();
  const { app } = createApp(new LocalStore(null), {}, { demo: s });
  const res = await app.request('/api/students/demo/profile', {
    method: 'PUT',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      preferences: {
        fields: ['Biotech / pharma', 'Design / UX'],
        topField: 'Biotech / pharma',
        answers: { minPay: '20', blank: '   ' },
        lists: { skipIndustries: ['gambling', ' tobacco ', '  '], empty: ['', ' '] },
        checks: { remote: true, paidOnly: true, unticked: false },
        notes: [{ title: 'What I want', body: 'A lab where I do real bench work.' }, { title: '', body: '   ' }],
      },
    }),
  });
  const saved = ((await res.json()) as any).student.profile.preferences;
  // Blank answers and unticked boxes are dropped.
  assert.deepEqual(saved, { fields: ['Biotech / pharma', 'Design / UX'], topField: 'Biotech / pharma', answers: { minPay: '20' }, lists: { skipIndustries: ['gambling', 'tobacco'] }, checks: { remote: true, paidOnly: true }, notes: [{ title: 'What I want', body: 'A lab where I do real bench work.' }], experience: { linkedin: '', links: [], entries: [] } });

  await new Promise((r) => setTimeout(r, 800));
  await s.idle();
  const run = s.currentRun()!;
  // The top field leads, ahead of what the demo profile said at sign-up.
  assert.deepEqual(run.brief!.interests.slice(0, 2), ['bio', 'design']);
  assert.ok(run.brief!.hardCriteria.includes('remote only'));
  assert.ok(run.brief!.hardCriteria.includes('paid, at least $20 an hour'));
  assert.ok(run.brief!.avoid.includes('gambling, tobacco'));
  // The note is the first preference and travels in the brief word for word.
  assert.ok(run.brief!.preferences[0]!.includes('real bench work'));
  assert.deepEqual(run.brief!.notes, ['What I want: A lab where I do real bench work.']);
  // The rule is enforced: nothing in person reaches the feed.
  const feed = s.student().feed;
  assert.ok(feed.length > 0);
  assert.ok(feed.every((f) => f.opportunity.format === 'online'));
  assert.ok(run.validations.some((v) => v.reason?.includes('remote only')));
});

test('custom notes come first: they outrank ticked fields and reaction history, and what they rule out never shows', async () => {
  const { noteSignals } = await import('../src/agents/scoring.ts');
  // Words after "no", "don't show", "already applied to" are ruled out, up to a "but".
  const signals = noteSignals([{ title: 'Summer plan', body: "I want security work and hackathons. No finance, but data is fine. I already applied to Harbor Data Co, don't show it again." }]);
  assert.ok(signals.want.includes('security') && signals.want.includes('hackathon') && signals.want.includes('data'));
  assert.deepEqual(signals.avoid, ['finance']);
  // A company name is ruled out as a name, so "Harbor Data Co" does not rule out data work.
  assert.deepEqual(signals.avoidNames, ['harbor data co']);
  assert.ok(!signals.want.includes('finance'));

  const s = system({ feedbackThreshold: 99 });
  await s.trigger('first');
  const before = s.student().feed;
  // History pushes hard the other way: like every software card.
  for (const f of before.filter((x) => x.opportunity.field === 'software').slice(0, 4)) s.interact(f.opportunity.id, 'like');

  // Ticked field says design; the note says security and hackathons, and rules out Harbor Data Co.
  s.setProfile({ preferences: { fields: ['Design / UX'], topField: 'Design / UX', answers: {}, lists: {}, checks: {}, experience: { linkedin: '', links: [], entries: [] }, notes: [{ title: 'Summer plan', body: "I want security work and hackathons. I already applied to Harbor Data Co, don't show it again." }] } });
  await new Promise((r) => setTimeout(r, 800));
  await s.idle();
  const run = s.currentRun()!;
  // The master leads with the note, ahead of the ticked field and the sign-up interests.
  assert.equal(run.brief!.interests[0], 'security');
  assert.ok(run.brief!.interests.indexOf('security') < run.brief!.interests.indexOf('design'));
  assert.ok(run.brief!.preferences[0]!.startsWith('from their note "Summer plan"'));
  assert.ok(run.brief!.avoid.includes('harbor data co'));

  const feed = s.student().feed;
  // What the note rules out is gone, including results found before the note existed.
  assert.ok(before.some((f) => f.opportunity.organizer === 'Harbor Data Co'));
  assert.ok(!feed.some((f) => f.opportunity.organizer === 'Harbor Data Co'));
  // What the note asks for is at the top, above the liked software cards.
  const top = feed.slice(0, 3);
  assert.ok(top.every((f) => f.fromNotes), `top three should come from the notes: ${top.map((f) => f.opportunity.title).join(' | ')}`);
  assert.ok(top.every((f) => f.reason.startsWith('Your notes ask for this')));
  const firstLiked = feed.findIndex((f) => f.reaction === 'like');
  const lastNoted = feed.map((f) => f.fromNotes).lastIndexOf(true);
  assert.ok(firstLiked === -1 || feed.filter((f) => f.fromNotes).length <= firstLiked || lastNoted < feed.length, 'liked cards do not outrank noted ones');
  assert.ok(feed.findIndex((f) => f.fromNotes) < (firstLiked === -1 ? Infinity : firstLiked));
});

test('experience: a résumé is read for the agents, entries are optional throughout, and both shape the search', async () => {
  const made: AgentSystem[] = [];
  const { app } = createApp(new LocalStore(null), {}, {
    demo: system(),
    webConfig: { apiKey: 'k', projectId: 'p' },
    verify: async (token) => (token === 'ok' ? { uid: 'u1', name: 'Ana', email: null, picture: null, provider: 'google', emailVerified: true } : Promise.reject(new Error('bad'))),
    forUser: () => { const s = system(); made.push(s); return s; },
  });
  const auth = { authorization: 'Bearer ok' };
  const upload = (path: string, body: BodyInit, type: string, name = 'My%20R%C3%A9sum%C3%A9.txt', headers: Record<string, string> = auth) =>
    app.request(path, { method: 'PUT', headers: { ...headers, 'content-type': type, 'x-file-name': name }, body });

  // The demo student is shared, so nothing personal can be uploaded to it.
  assert.equal((await upload('/api/students/demo/resume', 'x', 'text/plain', 'r.txt', {})).status, 403);
  assert.equal((await upload('/api/students/me/resume', 'x', 'text/plain', 'r.txt', {})).status, 401);
  assert.equal((await upload('/api/students/me/resume', 'x', 'application/zip')).status, 415);
  assert.equal((await upload('/api/students/me/resume', '', 'text/plain')).status, 400);

  const res = await upload('/api/students/me/resume', 'Ana Lima\nCybersecurity club captain. Built a network scanner in Python.', 'text/plain');
  const info = ((await res.json()) as any).resume;
  assert.deepEqual({ name: info.name, type: info.type, readable: info.readable }, { name: 'My Résumé.txt', type: 'text/plain', readable: true });
  const s = made[0]!;
  // The page is told about the file, never sent the file or its text.
  assert.deepEqual(Object.keys(s.student().resume!).sort(), ['name', 'readable', 'size', 'type', 'uploadedAt']);
  const back = await app.request('/api/students/me/resume', { headers: auth });
  assert.match(await back.text(), /network scanner/);

  // Entries: every part is optional, an empty entry is dropped, odd dates are blanked.
  const put = await app.request('/api/students/me/profile', {
    method: 'PUT',
    headers: { ...auth, 'content-type': 'application/json' },
    body: JSON.stringify({ preferences: { fields: [], experience: { linkedin: ' linkedin.com/in/ana ', links: ['github.com/ana', ''], entries: [{ role: 'Research assistant', organization: 'Saffron Bio', start: '2026-06', end: 'soon', skills: ['Lab work', ' '] }, { organization: 'Robotics team' }, {}] } } }),
  });
  const exp = ((await put.json()) as any).student.profile.preferences.experience;
  assert.equal(exp.linkedin, 'linkedin.com/in/ana');
  assert.deepEqual(exp.links, ['github.com/ana']);
  assert.equal(exp.entries.length, 2);
  assert.deepEqual(exp.entries[0], { kind: '', role: 'Research assistant', organization: 'Saffron Bio', location: '', start: '2026-06', end: '', current: false, summary: '', skills: ['Lab work'], link: '' });

  await new Promise((r) => setTimeout(r, 900));
  await s.idle();
  const brief = s.currentRun()!.brief!;
  // Background adds areas (security from the résumé, bio and hardware from the entries) behind what was asked for.
  assert.ok(brief.interests.includes('security') && brief.interests.includes('bio'));
  assert.ok(brief.interests.indexOf('software') < brief.interests.indexOf('security'), 'stated interests stay ahead of background');
  assert.ok(brief.preferences.includes('builds on their experience: Research assistant at Saffron Bio'));
  assert.ok(brief.preferences.includes('matches the skills on their résumé'));

  assert.equal((await app.request('/api/students/me/resume', { method: 'DELETE', headers: auth })).status, 200);
  assert.equal(s.student().resume, null);
});

test('experience: text is read out of a PDF résumé', async () => {
  const { readResume } = await import('../src/resume.ts');
  const objs: string[] = ['<< /Type /Catalog /Pages 2 0 R >>', '<< /Type /Pages /Kids [3 0 R] /Count 1 >>', '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 300 144] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>', '', '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>'];
  const stream = 'BT /F1 12 Tf 20 100 Td (Maya Tran Python SQL intern) Tj ET';
  objs[3] = `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`;
  let pdf = '%PDF-1.4\n';
  const offsets: number[] = [];
  objs.forEach((o, i) => { offsets.push(pdf.length); pdf += `${i + 1} 0 obj\n${o}\nendobj\n`; });
  const xref = pdf.length;
  pdf += `xref\n0 ${objs.length + 1}\n0000000000 65535 f \n` + offsets.map((o) => `${String(o).padStart(10, '0')} 00000 n \n`).join('') + `trailer\n<< /Size ${objs.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
  assert.equal(await readResume(new TextEncoder().encode(pdf), 'application/pdf'), 'Maya Tran Python SQL intern');
  // A file that is not really a PDF gives no text, and does not throw.
  assert.equal(await readResume(new TextEncoder().encode('not a pdf'), 'application/pdf'), null);
});
