// The dashboard journey: one request, two searches, save, restart, and a second account.
import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { SimBrain } from '../src/agents/simBrain.ts';
import { AgentSystem } from '../src/agents/system.ts';
import { createApp } from '../src/app.ts';
import type { AuthUser } from '../src/auth.ts';
import { LocalStore } from '../src/store/local.ts';

const NOW = new Date('2026-11-20T15:00:00Z');
const DEMO = 'Find a beginner-friendly coding club near Berkeley and an online hackathon next month';

function backendOn(file: string | null, brains: SimBrain[] = []) {
  const users: Record<string, AuthUser> = {
    'token-ana': { uid: 'u1', name: 'Ana Lima', email: null, picture: null, provider: 'google', emailVerified: true },
    'token-ben': { uid: 'u2', name: 'Ben Ode', email: null, picture: null, provider: 'google', emailVerified: true },
  };
  const made = new Map<string, AgentSystem>();
  const store = new LocalStore(file);
  const { app } = createApp(
    store,
    {},
    {
      demo: new AgentSystem(new SimBrain({ speed: 0, now: () => NOW }), { now: () => NOW, feedTarget: 0 }),
      webConfig: { apiKey: 'k', projectId: 'p', authDomain: 'p.firebaseapp.com' },
      verify: async (token) => users[token] ?? Promise.reject(new Error('bad token')),
      saveDelayMs: 5,
      forUser: (user) => {
        const s = new AgentSystem(brains.shift() ?? new SimBrain({ speed: 0, now: () => NOW }), { now: () => NOW, feedTarget: 0 }, { name: user.name!.split(' ')[0]! });
        made.set(user.uid, s);
        return s;
      },
    },
  );
  const call = async (method: string, path: string, token?: string, body?: unknown, headers: Record<string, string> = {}) => {
    const res = await app.request(path, {
      method,
      headers: { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}), ...headers },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    return { status: res.status, body: (await res.json()) as any };
  };
  const settle = async (uid: string) => {
    await made.get(uid)?.idle();
    await new Promise((r) => setTimeout(r, 40));
  };
  return { call, made, settle };
}

test('typed request: club near Berkeley and online hackathon, then save survives a restart', async () => {
  const file = join(mkdtempSync(join(tmpdir(), 'bearok-request-')), 'store.json');
  const first = backendOn(file);
  const created = await first.call('POST', '/api/students/me/runs', 'token-ana', { request: DEMO });
  assert.equal(created.status, 202);
  assert.equal(created.body.started, true);
  assert.equal(created.body.followUp, null);
  await first.settle('u1');

  const state = (await first.call('GET', '/api/students/me/state', 'token-ana')).body;
  assert.equal(state.run.status, 'complete');
  assert.equal(state.run.error, null);
  assert.equal(state.student.provider, 'simulated');
  const cards = state.student.feed.map((f: any) => f.opportunity);
  const club = cards.find((o: any) => o.type === 'club' && String(o.location).includes('Berkeley'));
  const hack = cards.find((o: any) => o.type === 'hackathon' && o.format === 'online');
  assert.ok(club, 'a Berkeley club is in the feed');
  assert.ok(hack, 'an online hackathon is in the feed');
  assert.equal(club.id, state.student.feed.find((f: any) => f.opportunity.id === club.id).opportunity.id);
  assert.ok(cards.every((o: any) => o.type !== 'hackathon' || o.format !== 'in_person'));
  assert.match(club.sourceUrl, /^https:\/\//);
  assert.ok(club.lastCheckedAt);
  assert.ok(club.evidence.length > 0);
  assert.equal(club.origin, 'prepared');
  const clubReason = state.student.feed.find((f: any) => f.opportunity.id === club.id).reason;
  const hackReason = state.student.feed.find((f: any) => f.opportunity.id === hack.id).reason;
  assert.match(clubReason, /Berkeley/);
  assert.match(hackReason, /online/);
  const undated = cards.find((o: any) => o.type === 'club' && o.unknowns.some((u: any) => u.label === 'Sign-up deadline unknown'));
  assert.ok(undated, 'a club with no stated deadline stays unknown');

  const save = await first.call('POST', '/api/students/me/interactions', 'token-ana', { opportunityId: club.id, action: 'save' }, { 'idempotency-key': 'save-club' });
  assert.equal(save.status, 200);
  const replay = await first.call('POST', '/api/students/me/interactions', 'token-ana', { opportunityId: club.id, action: 'save' }, { 'idempotency-key': 'save-club' });
  assert.equal(replay.body.replayed, true);
  await first.settle('u1');
  const saved = (await first.call('GET', '/api/students/me/state', 'token-ana')).body.student;
  assert.ok(saved.saved.includes(club.id));
  assert.ok(saved.feed.some((f: any) => f.opportunity.id === club.id && f.saved));
  assert.ok(saved.savedItems.some((f: any) => f.opportunity.id === club.id));

  await first.call('POST', '/api/students/me/interactions', 'token-ana', { opportunityId: hack.id, action: 'like' });
  await first.call('POST', '/api/students/me/interactions', 'token-ana', { opportunityId: hack.id, action: 'dislike' });
  const reactions = (await first.call('GET', '/api/students/me/state', 'token-ana')).body.student;
  assert.equal(reactions.feed.find((f: any) => f.opportunity.id === hack.id), undefined);
  assert.ok(!reactions.liked.includes(hack.id));

  const second = backendOn(file);
  const after = (await second.call('GET', '/api/students/me/state', 'token-ana')).body.student;
  assert.ok(after.saved.includes(club.id));
  assert.ok(after.savedItems.some((f: any) => f.opportunity.id === club.id));
  assert.equal(after.savedItems.find((f: any) => f.opportunity.id === club.id).opportunity.sourceUrl, club.sourceUrl);

  const ben = (await second.call('GET', '/api/students/me/state', 'token-ben')).body.student;
  assert.equal(ben.saved.length, 0);
  assert.equal(ben.feed.length, 0);
  assert.equal(ben.savedItems.length, 0);
});

test('an empty search, an unknown deadline, and a provider failure stay distinct', async () => {
  class Boom extends SimBrain {
    runs = 0;
    override async master(input: Parameters<SimBrain['master']>[0]) {
      this.runs++;
      if (this.runs > 2) throw new Error('provider unavailable');
      return super.master(input);
    }
  }
  const file = join(mkdtempSync(join(tmpdir(), 'bearok-fail-')), 'store.json');
  const api = backendOn(file, [new Boom({ speed: 0, now: () => NOW })]);
  const empty = await api.call('POST', '/api/students/me/runs', 'token-ana', { request: 'Find an in-person robotics club in Antarctica' });
  assert.equal(empty.body.followUp, null);
  await api.settle('u1');
  const none = (await api.call('GET', '/api/students/me/state', 'token-ana')).body;
  assert.equal(none.run.status, 'complete');
  assert.equal(none.run.error, null);
  assert.equal(none.student.feed.length, 0);

  const found = await api.call('POST', '/api/students/me/runs', 'token-ana', { request: DEMO });
  assert.equal(found.status, 202);
  await api.settle('u1');
  const mid = (await api.call('GET', '/api/students/me/state', 'token-ana')).body.student;
  const club = mid.feed.find((f: any) => f.opportunity.type === 'club');
  assert.ok(club);
  await api.call('POST', '/api/students/me/interactions', 'token-ana', { opportunityId: club.opportunity.id, action: 'save' });
  await api.settle('u1');

  await api.call('POST', '/api/students/me/runs', 'token-ana');
  await api.settle('u1');
  const failed = (await api.call('GET', '/api/students/me/state', 'token-ana')).body;
  assert.equal(failed.run.status, 'failed');
  assert.match(failed.run.error, /provider unavailable/);
  assert.ok(failed.student.saved.includes(club.opportunity.id));
  assert.ok(failed.student.savedItems.some((f: any) => f.opportunity.id === club.opportunity.id));
});

test('a request with a missing place asks one follow-up and does not search yet', async () => {
  const api = backendOn(null);
  const asked = await api.call('POST', '/api/students/me/runs', 'token-ana', {
    request: 'Find a beginner-friendly coding club and an online hackathon next month',
  });
  assert.equal(asked.status, 200);
  assert.equal(asked.body.started, false);
  assert.match(asked.body.followUp, /club/);
  assert.equal(api.made.get('u1')!.currentRun(), null);
});
