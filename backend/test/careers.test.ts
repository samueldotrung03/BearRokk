// Career guides on a fake model: no network, no Grok, no Claude.
import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { Hono } from 'hono';
import { mountCareers } from '../src/careers/api.ts';
import { CareerGuides, mergeSection, slugFor, type Ask } from '../src/careers/guide.ts';

const basics = (over = {}) => ({
  summary: 'Economists study data.',
  dayInLife: ['Check overnight data'],
  whatTheyDo: ['Build models'],
  whereTheyWork: ['Central banks'],
  specialties: [{ name: 'Labor economics', what: 'Jobs and wages' }],
  skills: ['Statistics'],
  education: null,
  pay: null,
  outlook: null,
  sources: [],
  ...over,
});

const answers: Record<string, unknown> = {
  career_plan: { title: 'Economist', oneLine: 'Studies how people and markets use scarce resources.', field: 'economics', angles: { basics: 'b', voices: 'v', start: 's', interview: 'i' } },
  career_basics: basics(),
  career_voices: { posts: [{ author: 'Real Person', role: 'Economist', handle: '@real', text: 'Real post', takeaway: 'Learn R', topic: 'the work', url: 'https://x.com/real/1', date: '2026-11-01' }] },
  career_voices_sample: { posts: [{ author: 'Maya R.', role: 'Analyst at a mid-size bank', handle: null, text: 'Sample story', takeaway: 'Learn Excel', topic: 'advice', url: null, date: null }] },
  career_start: { steps: [{ title: 'Take intro economics', detail: 'Start with micro.', when: 'First semester', resource: null }], resources: [] },
  career_interview: { formats: [{ name: 'Case interview', tests: 'Reasoning', howToPractice: 'Practise cases', url: null }], questions: [{ kind: 'Case interview', question: 'How would a tax change demand?', tip: 'Structure first' }], sources: [] },
};

type Call = { name: string; tools: string[]; user: string };

function fakeAsk(calls: Call[], fail: string[] = [], reply: (name: string, n: number) => unknown = (name) => answers[name]): Ask {
  return (async (opts) => {
    calls.push({ name: opts.name, tools: (opts.tools ?? []).map((t) => t.type), user: opts.user });
    if (fail.includes(opts.name)) throw new Error(`${opts.name} broke`);
    return { data: opts.schema.parse(reply(opts.name, calls.filter((c) => c.name === opts.name).length)) };
  }) as Ask;
}

const env = (canSearchX: boolean) => ({ live: () => true, provider: () => (canSearchX ? 'grok' : 'claude') as 'grok' | 'claude', canSearchX: () => canSearchX });

test('a guide is planned, then its four sections are researched, and Grok reads X for the stories', async () => {
  const calls: Call[] = [];
  const guides = new CareerGuides(null, fakeAsk(calls), env(true));
  assert.equal(guides.start('economic').slug, 'economic');
  const guide = (await guides.settled('economic'))!;
  assert.equal(guide.status, 'ready');
  assert.equal(guide.title, 'Economist');
  assert.equal(calls[0]!.name, 'career_plan');
  assert.deepEqual(calls.find((c) => c.name === 'career_voices')!.tools, ['x_search', 'web_search']);
  assert.equal(guide.sections.voices.sample, false);
  assert.equal(guide.sections.voices.data!.posts[0]!.url, 'https://x.com/real/1');
  for (const id of ['basics', 'voices', 'start', 'interview'] as const) assert.equal(guide.sections[id].status, 'done');
});

test('without X search the stories are labelled samples with no links', async () => {
  const calls: Call[] = [];
  const guides = new CareerGuides(null, fakeAsk(calls), env(false));
  guides.start('Economist');
  const guide = (await guides.settled('economist'))!;
  assert.ok(calls.some((c) => c.name === 'career_voices_sample' && c.tools.length === 0));
  assert.ok(!calls.some((c) => c.name === 'career_voices'));
  assert.equal(guide.sections.voices.sample, true);
  assert.equal(guide.sections.voices.data!.posts[0]!.url, null);
});

test('a kept guide is not researched again unless the student searches again', async () => {
  const calls: Call[] = [];
  const guides = new CareerGuides(null, fakeAsk(calls), env(true));
  guides.start('Nurse');
  await guides.settled('nurse');
  const first = calls.length;
  guides.start('nurse');
  assert.equal(calls.length, first);
  guides.start('Nurse', true);
  await guides.settled('nurse');
  assert.equal(calls.length, first * 2);
});

test('a section that fails twice leaves the others and marks only itself', async () => {
  const calls: Call[] = [];
  const guides = new CareerGuides(null, fakeAsk(calls, ['career_interview']), env(true));
  guides.retryMs = 0;
  guides.start('Actuary');
  const guide = (await guides.settled('actuary'))!;
  assert.equal(guide.status, 'ready');
  assert.equal(guide.sections.interview.status, 'failed');
  assert.match(guide.sections.interview.error!, /broke/);
  assert.equal(calls.filter((c) => c.name === 'career_interview').length, 2);
  assert.equal(guide.sections.basics.status, 'done');
});

test('Add more asks one section for new items only and merges them without repeats', async () => {
  const calls: Call[] = [];
  const more = (name: string, n: number) =>
    name === 'career_interview' && n > 1
      ? {
          formats: [{ name: 'case interview', tests: 'Same format, other words', howToPractice: 'x', url: null }, { name: 'Take-home task', tests: 'Data work', howToPractice: 'Do one', url: null }],
          questions: [{ kind: 'Case interview', question: 'How would a tax change demand?', tip: null }, { kind: 'Take-home task', question: 'Clean this dataset.', tip: null }],
          sources: [],
        }
      : answers[name];
  const guides = new CareerGuides(null, fakeAsk(calls, [], more), env(true));
  guides.start('Economist');
  await guides.settled('economist');
  const before = calls.length;
  guides.more('economist', 'interview');
  assert.equal(guides.get('economist')!.sections.interview.status, 'working');
  const guide = (await guides.settled('economist'))!;
  const asked = calls.slice(before);
  assert.deepEqual(asked.map((c) => c.name), ['career_interview']);
  assert.match(asked[0]!.user, /ALREADY IN THE SECTION/);
  assert.match(asked[0]!.user, /How would a tax change demand\?/);
  const s = guide.sections.interview;
  assert.equal(s.status, 'done');
  assert.deepEqual(s.data!.formats.map((f) => f.name), ['Case interview', 'Take-home task']);
  assert.equal(s.data!.questions.length, 2);
  assert.equal(s.added!.count, 2);
  assert.equal(guide.sections.basics.added, null);
});

test('Add more that finds nothing keeps the section and says so', async () => {
  const guides = new CareerGuides(null, fakeAsk([], [], (name, n) => (name === 'career_basics' && n > 1 ? new Error('x') : answers[name])), env(true));
  guides.retryMs = 0;
  guides.start('Economist');
  await guides.settled('economist');
  guides.more('economist', 'basics');
  const s = (await guides.settled('economist'))!.sections.basics;
  assert.equal(s.status, 'done');
  assert.equal(s.data!.summary, 'Economists study data.');
  assert.match(s.error!, /Could not find more/);
});

test('Add more is refused while the guide is researching, and for unknown parts', async () => {
  const guides = new CareerGuides(null, fakeAsk([]), env(true));
  guides.start('Economist');
  assert.throws(() => guides.more('economist', 'basics'), /still being researched/);
  await guides.settled('economist');
  assert.throws(() => guides.more('economist', 'salary'), /no such part/);
  assert.throws(() => guides.more('pilot', 'basics'), /No guide/);
});

test('basics merge fills a missing fact and adds only new list items', () => {
  const { data, added } = mergeSection('basics', basics(), basics({ skills: ['statistics', 'Writing'], pay: { figure: '$100k', url: 'https://a' }, summary: 'other' }));
  assert.deepEqual(data.skills, ['Statistics', 'Writing']);
  assert.equal(data.pay!.figure, '$100k');
  assert.equal(data.summary, 'Economists study data.');
  assert.equal(added, 2);
});

test('guides are kept on disk and reloaded, and work cut off by a restart is marked', async () => {
  const file = join(mkdtempSync(join(tmpdir(), 'careers-')), 'guides.json');
  const guides = new CareerGuides(file, fakeAsk([]), env(true));
  guides.start('Architect');
  await guides.settled('architect');
  const reloaded = new CareerGuides(file, fakeAsk([]), env(true));
  assert.equal(reloaded.get('architect')!.title, 'Economist');
  assert.equal(reloaded.list()[0]!.slug, 'architect');

  const slow = new CareerGuides(file, (() => new Promise(() => {})) as unknown as Ask, env(true));
  slow.start('Pilot');
  const cut = new CareerGuides(file, fakeAsk([]), env(true)).get('pilot')!;
  assert.equal(cut.status, 'failed');
  assert.match(cut.sections.basics.error!, /stopped before it finished/);
});

test('simulated agents cannot research, and bad input is refused', () => {
  const guides = new CareerGuides(null, fakeAsk([]), { live: () => false, provider: () => 'simulated', canSearchX: () => false });
  assert.throws(() => guides.start('Pilot'), /Connect Grok/);
  assert.throws(() => guides.start('x'), /between 2 and 60/);
  assert.equal(slugFor('  Data Science / AI  '), 'data-science-ai');
});

test('the routes start a guide, return it by slug, and add more to one part', async () => {
  const app = new Hono();
  const guides = new CareerGuides(null, fakeAsk([]), env(true));
  mountCareers(app, guides);
  const post = await app.request('/api/careers/guides', { method: 'POST', body: JSON.stringify({ career: 'Teacher' }), headers: { 'content-type': 'application/json' } });
  assert.equal(post.status, 202);
  assert.equal((await app.request('/api/careers/guides/teacher/sections/start/more', { method: 'POST' })).status, 409);
  await guides.settled('teacher');
  assert.equal((await app.request('/api/careers/guides/teacher/sections/start/more', { method: 'POST' })).status, 202);
  assert.equal((await app.request('/api/careers/guides/teacher')).status, 200);
  assert.equal((await app.request('/api/careers/guides/nobody')).status, 404);
  assert.equal((await app.request('/api/careers/guides', { method: 'POST', body: JSON.stringify({ career: '' }) })).status, 400);
});
