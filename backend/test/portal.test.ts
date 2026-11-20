import assert from 'node:assert/strict';
import { test } from 'node:test';
import { SimBrain } from '../src/agents/simBrain.ts';
import { AgentSystem } from '../src/agents/system.ts';
import { mergeTabs, PORTAL_LIMITS } from '../src/agents/portal.ts';
import type { Opportunity, PortalTab } from '../src/agents/types.ts';
import type { AgentsOptions } from '../src/agents/api.ts';
import { createApp } from '../src/app.ts';
import { LocalStore } from '../src/store/local.ts';

const NOW = new Date('2026-11-19T12:00:00Z');

function posting(id: string, over: Partial<Opportunity> = {}): Opportunity {
  return {
    id, type: 'internship', title: `Intern ${id}`, organizer: 'Acme', sourceUrl: `https://acme.example.org/${id}`, actionUrl: `https://acme.example.org/${id}/apply`, format: 'online',
    location: null, field: 'software', tags: [], eligibility: null, eligibleYears: null, deadline: '2026-12-15T23:59:00-08:00', startTime: null, image: null, evidence: [],
    origin: 'prepared', fitExplanation: '', unknowns: [], foundAt: NOW.toISOString(), lastCheckedAt: NOW.toISOString(), baseScore: 0.6,
    foundBy: 'm', alsoSeenAt: [], application: null, ...over,
  };
}

const ACME = posting('opp-acme', {
  application: { prompts: ['Why do you want to work at Acme?', 'Tell us about a challenge you overcame (500 words).'], materials: ['Résumé', 'Unofficial transcript'] },
});
const BARE = posting('opp-bare');

/** An agent system holding the given postings, with its API, and a clock the test can move. */
function setup(opps: Opportunity[] = [ACME, BARE], calendar?: AgentsOptions['calendar']) {
  const clock = { now: NOW };
  const s = new AgentSystem(new SimBrain({ speed: 0, now: () => clock.now }), { now: () => clock.now, feedTarget: 0 });
  const snap = s.memorySnapshot();
  snap.learned.opportunities = structuredClone(opps);
  s.restore(snap);
  const { app } = createApp(new LocalStore(null), {}, { demo: s, calendar });
  const call = async (method: string, path: string, body?: unknown, headers: Record<string, string> = {}) => {
    const res = await app.request(`/api/students/demo${path}`, { method, headers: { 'content-type': 'application/json', ...headers }, body: body === undefined ? undefined : JSON.stringify(body) });
    return { status: res.status, body: (await res.json()) as any };
  };
  return { s, call, clock };
}

const tab = (over: Partial<PortalTab> = {}): Partial<PortalTab> => ({ kind: 'note', title: 'Note', prompt: '', wordLimit: null, body: '', files: [], done: false, ...over });

test('portal: a custom application is made with no posting, as To apply, and nothing is drafted', async () => {
  const { call } = setup();
  const made = await call('POST', '/applications', { title: '  Robotics club  ', organizer: 'Cal Robotics', deadline: '2026-12-10', actionUrl: 'calrobotics.example.org/join' });
  assert.equal(made.status, 201);
  const a = made.body.application;
  assert.match(a.opportunityId, /^custom-[0-9a-f]+$/);
  assert.equal(a.title, 'Robotics club');
  assert.equal(a.status, 'to_apply');
  assert.equal(a.custom, true);
  assert.equal(a.actionUrl, 'https://calrobotics.example.org/join');
  assert.equal(a.deadline, '2026-12-10T00:00:00.000Z');
  assert.equal(a.reminders.length, 3, 'reminders as for any To apply application');
  assert.equal(a.calendar.state, 'link');
  assert.deepEqual(a.portal, { tabs: [], drafted: null }, 'nothing drafted until the page asks');

  const list = await call('GET', '/applications');
  assert.ok(list.body.applications.some((x: any) => x.opportunityId === a.opportunityId && x.custom === true));

  assert.equal((await call('POST', '/applications', { organizer: 'No title' })).status, 400);
  assert.equal((await call('POST', '/applications', { title: 'X', deadline: 'someday' })).status, 400);
  assert.equal((await call('POST', '/applications', { title: 'X', actionUrl: 'javascript:alert(1)' })).status, 400);
  const plain = await call('POST', '/applications', { title: 'Just a title' });
  assert.equal(plain.status, 201);
  assert.equal(plain.body.application.organizer, '');
  assert.equal(plain.body.application.needsDeadline, true);
});

test('portal: creating from a posting tracks it as To apply, and one already tracked is left as it is', async () => {
  const { call } = setup();
  const made = await call('POST', '/applications', { opportunityId: ACME.id });
  assert.equal(made.status, 201);
  assert.equal(made.body.application.status, 'to_apply');
  assert.equal(made.body.application.custom, false);
  assert.equal(made.body.application.title, ACME.title);
  assert.deepEqual(made.body.application.portal, { tabs: [], drafted: null });

  await call('PUT', `/applications/${ACME.id}`, { status: 'applying' });
  const again = await call('POST', '/applications', { opportunityId: ACME.id });
  assert.equal(again.status, 200);
  assert.equal(again.body.application.status, 'applying', 'unchanged');
  assert.equal((await call('POST', '/applications', { opportunityId: 'opp-nope' })).status, 404);
});

test('portal: tabs are kept with the account and come back after a restore', async () => {
  const { s, call } = setup();
  const { body } = await call('POST', '/applications', { title: 'Essay contest' });
  const id = body.application.opportunityId;
  const tabs = [tab({ id: 't1', kind: 'question', title: 'Why', prompt: 'Why us?', body: 'Because.', wordLimit: 300 }), tab({ id: 't2', kind: 'upload', title: 'Résumé', files: [{ id: 'f1', name: 'cv.pdf', size: 1200, type: 'application/pdf', addedAt: NOW.toISOString() }] })];
  const saved = await call('PUT', `/applications/${id}/portal`, { tabs });
  assert.equal(saved.status, 200);

  const snap = JSON.parse(JSON.stringify(s.memorySnapshot()));
  const other = new AgentSystem(new SimBrain({ speed: 0, now: () => NOW }), { now: () => NOW, feedTarget: 0 });
  other.restore(snap);
  const back = other.getPortal(id)!;
  assert.deepEqual(back.portal, saved.body.portal);
  assert.equal(back.application.custom, true);
  assert.equal(back.portal.tabs[1]!.files[0]!.name, 'cv.pdf');

  // An application saved before the portal existed comes back with an empty one.
  const old = JSON.parse(JSON.stringify(snap));
  for (const a of old.learned.applications) { delete a.portal; delete a.custom; }
  other.restore(old);
  assert.deepEqual(other.getPortal(id)!.portal, { tabs: [], drafted: null });
  assert.equal(other.getApplication(id)!.custom, false);
});

test('portal: a save is cleaned and cut to size, ids and order kept, and only changed tabs move their time', async () => {
  const { call, clock } = setup();
  const { body } = await call('POST', '/applications', { title: 'Program' });
  const id = body.application.opportunityId;
  const files = Array.from({ length: 25 }, (_, i) => ({ id: `f${i}`, name: `file${i}.pdf`, size: 10, type: 'application/pdf', addedAt: NOW.toISOString(), data: 'base64-contents' }));
  const sent = [
    tab({ id: 'b', kind: 'question', title: 'T'.repeat(300), prompt: 'P'.repeat(3000), body: 'B'.repeat(50_000), wordLimit: -5 }),
    { id: 'x', kind: 'essay', title: 'Unknown kind' },
    'not a tab',
    tab({ id: 'a', kind: 'upload', title: 'Files', files: files as any, source: 'posting' }),
    tab({ id: 'a', kind: 'note', title: 'Same id twice' }),
    tab({ kind: 'note', title: 'No id' }),
  ];
  const res = await call('PUT', `/applications/${id}/portal`, { tabs: sent });
  assert.equal(res.status, 200);
  const out: PortalTab[] = res.body.portal.tabs;
  assert.deepEqual(out.map((t) => t.kind), ['question', 'upload', 'note', 'note'], 'unknown kinds dropped, order kept');
  assert.equal(out[0]!.id, 'b');
  assert.equal(out[1]!.id, 'a');
  assert.ok(out[2]!.id !== 'a' && out[2]!.id, 'a repeated id gets a new one');
  assert.ok(out[3]!.id, 'a tab with no id gets one');
  assert.equal(out[0]!.title.length, PORTAL_LIMITS.title);
  assert.equal(out[0]!.prompt.length, PORTAL_LIMITS.prompt);
  assert.equal(out[0]!.body.length, PORTAL_LIMITS.body);
  assert.equal(out[0]!.wordLimit, null);
  assert.equal(out[1]!.files.length, PORTAL_LIMITS.filesPerTab);
  assert.equal('data' in out[1]!.files[0]!, false, 'file contents are never kept');
  assert.equal(out[1]!.source, 'student', 'a page cannot label its own tab as the posting');
  assert.ok(out.every((t) => t.updatedAt === NOW.toISOString()));

  // Later, one tab edited: only it moves its time.
  clock.now = new Date(NOW.getTime() + 60_000);
  const edited = out.map((t) => (t.id === 'a' ? { ...t, done: true } : t));
  const again: PortalTab[] = (await call('PUT', `/applications/${id}/portal`, { tabs: edited })).body.portal.tabs;
  assert.equal(again.find((t) => t.id === 'a')!.updatedAt, clock.now.toISOString());
  assert.equal(again.find((t) => t.id === 'b')!.updatedAt, NOW.toISOString());

  // At most 40 tabs.
  const many = Array.from({ length: 45 }, (_, i) => tab({ id: `n${i}` }));
  assert.equal((await call('PUT', `/applications/${id}/portal`, { tabs: many })).body.portal.tabs.length, PORTAL_LIMITS.tabs);

  // Too much text for the account is refused, and nothing is lost.
  const huge = Array.from({ length: 10 }, (_, i) => tab({ id: `h${i}`, body: 'x'.repeat(39_000) }));
  assert.equal((await call('PUT', `/applications/${id}/portal`, { tabs: huge })).status, 413);
  assert.equal((await call('GET', `/applications/${id}/portal`)).body.portal.tabs.length, PORTAL_LIMITS.tabs);

  assert.equal((await call('PUT', `/applications/${id}/portal`, { tabs: 'nope' })).status, 400);
  assert.equal((await call('PUT', '/applications/custom-missing/portal', { tabs: [] })).status, 404);
  assert.equal((await call('GET', '/applications/custom-missing/portal')).status, 404);
  assert.equal((await call('POST', '/applications/custom-missing/portal/draft')).status, 404);
});

test('portal: drafting turns the posting reader\'s prompts and materials into tabs', async () => {
  const { call } = setup();
  await call('POST', '/applications', { opportunityId: ACME.id });
  const res = await call('POST', `/applications/${ACME.id}/portal/draft`);
  assert.equal(res.status, 200);
  const portal = res.body.portal;
  assert.deepEqual(
    portal.tabs.map((t: PortalTab) => [t.kind, t.title, t.source]),
    [
      ['question', 'Why do you want to work at...', 'posting'],
      ['question', 'Tell us about a challenge you overcame...', 'posting'],
      ['upload', 'Résumé', 'posting'],
      ['upload', 'Transcript', 'posting'],
    ],
    'the simulated agents find the same ones, and they are not added twice',
  );
  assert.equal(portal.tabs[1].wordLimit, 500, 'the word limit the prompt states');
  assert.equal(portal.tabs[1].prompt, 'Tell us about a challenge you overcame (500 words).');
  assert.equal(portal.drafted.found, true);
  assert.equal(portal.drafted.at, NOW.toISOString());

  // A posting whose questions nobody found: nothing is invented.
  await call('POST', '/applications', { opportunityId: BARE.id });
  const bare = (await call('POST', `/applications/${BARE.id}/portal/draft`)).body.portal;
  assert.deepEqual(bare.tabs, []);
  assert.equal(bare.drafted.found, false);
  assert.match(bare.drafted.note, /yourself/);
});

test('portal: drafting never overwrites, moves or repeats what the student has', async () => {
  const { call } = setup();
  await call('POST', '/applications', { opportunityId: ACME.id });
  const mine = [
    tab({ id: 'mine-q', kind: 'question', title: 'My take', prompt: 'why do you want to work at ACME', body: 'My answer.' }),
    tab({ id: 'mine-note', kind: 'note', title: 'Ideas', body: 'Talk about the robot.' }),
    tab({ id: 'mine-cv', kind: 'upload', title: 'resume', prompt: 'My CV' }),
  ];
  const before: PortalTab[] = (await call('PUT', `/applications/${ACME.id}/portal`, { tabs: mine })).body.portal.tabs;
  const after: PortalTab[] = (await call('POST', `/applications/${ACME.id}/portal/draft`)).body.portal.tabs;
  assert.deepEqual(after.slice(0, 3), before, "the student's tabs are untouched and stay first");
  assert.deepEqual(after.slice(3).map((t) => t.title), ['Tell us about a challenge you overcame...', 'Transcript'], 'the question and the résumé already there are not added again');

  // Drafting again adds nothing new.
  const third = (await call('POST', `/applications/${ACME.id}/portal/draft`)).body.portal;
  assert.deepEqual(third.tabs, after);
  assert.match(third.drafted.note, /nothing new/);
});

test('portal: merging keeps a drafted tab the student wrote in, and respects the tab limit', () => {
  const written: PortalTab = { id: 'w', kind: 'question', title: 'Old', prompt: 'Old prompt', wordLimit: null, body: 'Draft', files: [], source: 'agents', done: false, updatedAt: NOW.toISOString() };
  const incoming: PortalTab = { ...written, id: 'n', title: 'New', prompt: 'Old prompt!', body: '' };
  const { tabs, added } = mergeTabs([written], [incoming, { ...incoming, id: 'm', prompt: 'Another' }]);
  assert.deepEqual(tabs.map((t) => t.id), ['w', 'm']);
  assert.equal(tabs[0], written);
  assert.equal(added.length, 1);
  const full = Array.from({ length: PORTAL_LIMITS.tabs }, (_, i) => ({ ...written, id: `t${i}`, prompt: `p${i}` }));
  assert.equal(mergeTabs(full, [{ ...incoming, prompt: 'more' }]).tabs.length, PORTAL_LIMITS.tabs);
});

test('portal: a custom application with no posting or link is not searched for', async () => {
  const { call } = setup();
  const id = (await call('POST', '/applications', { title: 'Mentorship program' })).body.application.opportunityId;
  const portal = (await call('POST', `/applications/${id}/portal/draft`)).body.portal;
  assert.deepEqual(portal.tabs, []);
  assert.equal(portal.drafted.found, false);
  assert.match(portal.drafted.note, /no posting or link/);
  assert.match(portal.drafted.note, /yourself/);
});

test('portal: a custom application can be marked applied, goes on the tracker and calendar, and is removed', async () => {
  const calls: string[] = [];
  const { s, call } = setup([ACME], {
    create: async (_token, event) => { calls.push(`create ${event.title}`); return { eventId: 'evt-9', htmlLink: 'https://calendar.google.com/event?eid=9' }; },
    remove: async (_token, eventId) => { calls.push(`remove ${eventId}`); },
  });
  const google = { 'x-google-access-token': 'g-token' };
  const id = (await call('POST', '/applications', { title: 'Hackathon team', deadline: '2026-12-01T17:00:00Z' })).body.application.opportunityId;

  const synced = await call('PUT', `/applications/${id}`, { status: 'applying' }, google);
  assert.equal(synced.status, 200);
  assert.equal(synced.body.application.calendar.state, 'synced');
  assert.deepEqual(calls, ['create Due: Hackathon team'], 'no organizer, so none is named');

  const sheet = await call('GET', '/sheet');
  const row = sheet.body.rows[sheet.body.ids.indexOf(id)];
  assert.equal(row[0], 'Hackathon team');
  assert.equal(row[3], 'Applying');

  const done = await call('PUT', `/applications/${id}`, { status: 'applied' }, google);
  assert.equal(done.body.application.status, 'applied');
  assert.deepEqual(done.body.application.reminders, []);
  assert.equal(calls.at(-1), 'remove evt-9');
  assert.equal(s.student().memory.counts.apply, 0, 'no posting to rank, so no apply signal');

  const removed = await call('DELETE', `/applications/${id}`);
  assert.equal(removed.status, 200);
  assert.equal(s.getApplication(id), null);
  assert.equal((await call('GET', `/applications/${id}/portal`)).status, 404);
  assert.equal((await call('DELETE', `/applications/${id}`)).status, 404);
});

test('portal: unsaving a posting keeps its application when the student has written in it', async () => {
  const { s, call } = setup();
  s.interact(ACME.id, 'save');
  assert.equal(s.getApplication(ACME.id)!.status, 'interested');
  await call('PUT', `/applications/${ACME.id}/portal`, { tabs: [tab({ id: 'n', body: 'notes' })] });
  s.interact(ACME.id, 'save');
  assert.ok(s.getApplication(ACME.id), 'kept');
});

test('review fixes: non-Latin prompts are not added twice, and prototype names are not kinds', async () => {
  const { normalise } = await import('../src/agents/portal.ts');
  assert.equal(normalise('你为什么想加入我们？'), '你为什么想加入我们');
  assert.notEqual(normalise('Почему вы хотите работать у нас?'), '');
});
