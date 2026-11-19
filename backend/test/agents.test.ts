import assert from 'node:assert/strict';
import { test } from 'node:test';
import { SimBrain } from '../src/agents/simBrain.ts';
import { allocateSlots, buildMemory, categoryWeights, rankFeed } from '../src/agents/scoring.ts';
import { AgentSystem } from '../src/agents/system.ts';
import { Fleet } from '../src/agents/fleet.ts';
import type { Category, Interaction, Opportunity } from '../src/agents/types.ts';
import { createApp } from '../src/app.ts';
import { LocalStore } from '../src/store/local.ts';

const NOW = new Date('2026-11-18T20:00:00Z');
const even: Record<Category, number> = { internship: 1, event: 1, club: 1, program: 1 };
const system = (opts = {}) => new AgentSystem(new SimBrain({ speed: 0, now: () => NOW }), { now: () => NOW, ...opts });

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
  const { app } = createApp(new LocalStore(null), {}, s);
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
