// Signing in and storing a memory without a service account, as the app does on a student's laptop.
import assert from 'node:assert/strict';
import { createSign, generateKeyPairSync, X509Certificate } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { SimBrain } from '../src/agents/simBrain.ts';
import { AgentSystem } from '../src/agents/system.ts';
import type { StudentMemory } from '../src/agents/types.ts';
import { createApp } from '../src/app.ts';
import type { AuthUser } from '../src/auth.ts';
import { idTokenVerifier } from '../src/idToken.ts';
import { LocalStore } from '../src/store/local.ts';
import { fromFields, toFields, UserFirestore } from '../src/store/userFirestore.ts';

const NOW = new Date('2026-11-19T12:00:00Z');
const b64 = (v: unknown) => Buffer.from(JSON.stringify(v)).toString('base64url');

/** A signing key with a certificate, standing in for one of Google's. */
function signer() {
  const dir = mkdtempSync(join(tmpdir(), 'bearok-cert-'));
  const { privateKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
  const keyFile = join(dir, 'key.pem');
  writeFileSync(keyFile, privateKey.export({ type: 'pkcs8', format: 'pem' }));
  const cert = execFileSync('openssl', ['req', '-new', '-x509', '-key', keyFile, '-subj', '/CN=test', '-days', '2'], { encoding: 'utf8' });
  assert.ok(new X509Certificate(cert));
  const sign = (claims: object, kid = 'key-1', alg = 'RS256') => {
    const body = `${b64({ alg, kid, typ: 'JWT' })}.${b64(claims)}`;
    return `${body}.${createSign('RSA-SHA256').update(body).sign(privateKey).toString('base64url')}`;
  };
  return { cert, sign };
}

test('sign-in token: accepted only when Google signed it for this project and it has not expired', async () => {
  const google = signer();
  const other = signer();
  let fetched = 0;
  const verify = idTokenVerifier('bearok-test', {
    now: () => NOW.getTime(),
    fetchCerts: async () => {
      fetched++;
      return { certs: { 'key-1': google.cert }, maxAgeMs: 3_600_000 };
    },
  });
  const seconds = NOW.getTime() / 1000;
  const good = { aud: 'bearok-test', iss: 'https://securetoken.google.com/bearok-test', sub: 'u1', iat: seconds - 60, exp: seconds + 3000, name: 'Ana Lima', firebase: { sign_in_provider: 'google.com' } };

  const claims = await verify(google.sign(good));
  assert.equal(claims.sub, 'u1');
  assert.equal(claims.name, 'Ana Lima');
  await verify(google.sign(good));
  assert.equal(fetched, 1, 'the keys are fetched once and reused');

  await assert.rejects(verify(other.sign(good)), /signature/);
  await assert.rejects(verify(google.sign({ ...good, aud: 'someone-elses-project' })), /another project/);
  await assert.rejects(verify(google.sign({ ...good, iss: 'https://securetoken.google.com/someone-elses-project' })), /issuer/);
  await assert.rejects(verify(google.sign({ ...good, exp: seconds - 4000 })), /expired/);
  await assert.rejects(verify(google.sign({ ...good, sub: '' })), /no account/);
  await assert.rejects(verify(google.sign(good, 'key-9')), /unknown key/);
  // A token that claims no signature at all is refused.
  await assert.rejects(verify(`${b64({ alg: 'none', kid: 'key-1' })}.${b64(good)}.`), /signing/);
  await assert.rejects(verify('not-a-token'), /not a sign-in token/);
  // Changing what a signed token says breaks it.
  const [h, , s] = google.sign(good).split('.');
  await assert.rejects(verify(`${h}.${b64({ ...good, sub: 'u2' })}.${s}`), /signature/);
});

/** Firestore's web API, in memory: documents by name, and only the account in the token may touch its own. */
function fakeFirestore() {
  const docs = new Map<string, unknown>();
  const calls: string[] = [];
  let down = false;
  const fetcher = (async (url: string | URL | Request, init?: RequestInit) => {
    const uid = /Bearer token-of-(\w+)/.exec(String((init?.headers as Record<string, string>)?.authorization))?.[1];
    const reply = (status: number, body: unknown = {}) => new Response(JSON.stringify(body), { status });
    if (down) return reply(503, { error: 'unavailable' });
    if (!uid) return reply(401, { error: 'unauthenticated' });
    const address = String(url);
    calls.push(`${init?.method ?? 'GET'} ${address.split('/documents')[1]}`);
    const own = (name: string) => name.includes(`/documents/students/${uid}`);
    if (address.endsWith(':commit')) {
      const { writes } = JSON.parse(String(init!.body));
      if (!writes.every((w: any) => own(w.update?.name ?? w.delete))) return reply(403, { error: 'permission denied' });
      for (const w of writes) w.update ? docs.set(w.update.name, w.update.fields) : docs.delete(w.delete);
      return reply(200);
    }
    const name = address.slice(address.indexOf('projects/'));
    if (!own(name)) return reply(403, { error: 'permission denied' });
    return docs.has(name) ? reply(200, { name, fields: docs.get(name) }) : reply(404);
  }) as typeof fetch;
  return { fetcher, docs, calls, fail: (v: boolean) => (down = v) };
}

async function memoryOfARun(): Promise<StudentMemory> {
  const s = new AgentSystem(new SimBrain({ speed: 0, now: () => NOW }), { now: () => NOW, feedTarget: 0 });
  s.setProfile({ preferences: { fields: ['Data'], topField: 'Data', answers: { minPay: '20' }, lists: { skip: ['a', 'b'] }, checks: { remote: true }, notes: [{ title: 'Wanted', body: 'Paid work with data' }], experience: { linkedin: '', links: [], entries: [] } } });
  await s.trigger('first');
  await s.idle();
  s.interact(s.student().feed[0]!.opportunity.id, 'like');
  return s.memorySnapshot();
}

test('account store: a memory written as the student reads back the same, and no account can reach another', async () => {
  const memory = await memoryOfARun();
  const cloud = fakeFirestore();
  const store = new UserFirestore('bearok-test', (id) => `token-of-${id}`, cloud.fetcher);

  assert.equal(await store.loadStudent('u1'), null);
  await store.saveStudent('u1', memory);
  const back = await store.loadStudent('u1');
  assert.deepEqual(back, JSON.parse(JSON.stringify(memory)));
  // The same three documents the service-account store uses.
  assert.deepEqual([...cloud.docs.keys()].map((k) => k.split('/documents/')[1]).sort(), ['students/u1', 'students/u1/memory/learned', 'students/u1/memory/profile']);

  // Numbers, nulls, empty lists and nested records all survive the typed form.
  const odd = { n: 3, f: 0.25, big: 1.5e300, t: true, none: null, empty: [], deep: { list: [{ a: 1 }, 'x', null], blank: {} }, text: '' };
  assert.deepEqual(fromFields(JSON.parse(JSON.stringify(toFields(odd)))), odd);

  // Ben's sign-in cannot read or overwrite Ana's memory.
  const asBen = new UserFirestore('bearok-test', () => 'token-of-u2', cloud.fetcher);
  await assert.rejects(asBen.loadStudent('u1'), /403/);
  await assert.rejects(asBen.saveStudent('u1', memory), /403/);
  // With no current sign-in nothing is sent at all.
  const signedOut = new UserFirestore('bearok-test', () => null, cloud.fetcher);
  await assert.rejects(signedOut.saveStudent('u1', memory), /no current sign-in/);

  await store.deleteStudent('u1');
  assert.equal(cloud.docs.size, 0);
});

test('account store: a memory that cannot be loaded is not replaced by an empty one, and a failed save is tried again', async () => {
  const cloud = fakeFirestore();
  const tokens = new Map<string, string>();
  const account = new UserFirestore('bearok-test', (id) => tokens.get(id) ?? null, cloud.fetcher);
  await new UserFirestore('bearok-test', () => 'token-of-u1', cloud.fetcher).saveStudent('u1', await memoryOfARun());
  const stored = JSON.stringify([...cloud.docs]);

  const user: AuthUser = { uid: 'u1', name: 'Ana Lima', email: null, picture: null, provider: 'google', emailVerified: true };
  const made: AgentSystem[] = [];
  const { app } = createApp(new LocalStore(null), {}, {
    demo: new AgentSystem(new SimBrain({ speed: 0, now: () => NOW }), { now: () => NOW, feedTarget: 0 }),
    webConfig: { apiKey: 'k', projectId: 'bearok-test', authDomain: 'x' },
    verify: async (token) => (token === 'token-of-u1' ? user : Promise.reject(new Error('bad token'))),
    onToken: (uid, token) => tokens.set(uid, token),
    memory: account,
    saveDelayMs: 5,
    forUser: () => {
      const s = new AgentSystem(new SimBrain({ speed: 0, now: () => NOW }), { now: () => NOW, feedTarget: 0 });
      made.push(s);
      return s;
    },
  });
  const call = async (method: string, path: string, body?: unknown) => {
    const res = await app.request(path, { method, headers: { 'content-type': 'application/json', authorization: 'Bearer token-of-u1' }, body: body ? JSON.stringify(body) : undefined });
    return { status: res.status, body: (await res.json()) as any };
  };
  const pause = () => new Promise((r) => setTimeout(r, 40));

  // The cloud is unreachable when Ana opens the app: she is told, and nothing is overwritten.
  cloud.fail(true);
  assert.equal((await call('GET', '/api/students/me/state')).status, 503);
  await pause();
  assert.equal(JSON.stringify([...cloud.docs]), stored);

  // Once it is back, her memory loads as it was.
  cloud.fail(false);
  const state = (await call('GET', '/api/students/me/state')).body.student;
  assert.equal(state.runCount, 1);
  assert.equal(state.memory.counts.like, 1);
  assert.equal(state.profile.preferences.notes[0].body, 'Paid work with data');

  // A save that fails is kept and goes through the next time she is heard from.
  cloud.fail(true);
  const target = state.feed[1].opportunity.id;
  await call('POST', '/api/students/me/interactions', { opportunityId: target, action: 'save' });
  await pause();
  assert.equal(JSON.stringify([...cloud.docs]), stored, 'nothing reached the cloud while it was down');
  cloud.fail(false);
  await call('GET', '/api/auth/me');
  await pause();
  const after = await account.loadStudent('u1');
  assert.deepEqual(after!.learned.interactions.map((i) => i.action), ['like', 'save']);
});
