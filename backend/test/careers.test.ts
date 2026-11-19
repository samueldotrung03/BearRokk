// Career guides on a fake model: no network, no Grok, no Claude.
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { Hono } from 'hono';
import { AgentMaster, routeRequest, SKILLS } from '../src/agents/skills/index.ts';
import { mountCareers } from '../src/careers/api.ts';
import { CareerGuides, mergeSection, slugFor, type Ask } from '../src/careers/guide.ts';
import { unpreparedFormats } from '../src/careers/schemas.ts';

const basics = (over = {}) => ({
  summary: 'Economists build econometric models in Stata and R.',
  dayInLife: ['Check overnight data'],
  whatTheyDo: ['Build models'],
  whereTheyWork: ['Central banks'],
  specialties: [{ name: 'Labor economics', what: 'Jobs and wages' }],
  skills: [{ name: 'Stata', kind: 'tool' }],
  education: null,
  pay: null,
  outlook: null,
  sources: [],
  ...over,
});

const answers: Record<string, unknown> = {
  career_plan: { title: 'Economist', oneLine: 'Studies how people and markets use scarce resources.', field: 'economics', angles: { basics: 'b', voices: 'v', interview: 'i', start: 's' } },
  career_basics: basics(),
  career_voices: { posts: [{ author: 'Real Person', role: 'Economist', handle: '@real', text: 'Real post', takeaway: 'Learn R', topic: 'the work', url: 'https://x.com/real/1', date: '2026-11-01' }] },
  career_voices_sample: { posts: [{ author: 'Maya R.', role: 'Analyst at a mid-size bank', handle: null, text: 'Sample story', takeaway: 'Learn Excel', topic: 'advice', url: null, date: null }] },
  career_voices_summary: { summary: 'People say the work is mostly data. They warn that the first job is hard to get.' },
  career_interview: { formats: [{ name: 'Résumé screen', tests: 'Fit', howToPractice: 'Tailor it', url: null }], questions: [{ kind: 'Résumé screen', question: 'Why economics?', tip: 'A clear reason' }], sources: [] },
  career_start: { steps: [{ title: 'Write a one-page résumé', detail: 'List coursework and projects.', when: 'First semester', resource: null, prepares: ['Résumé screen'] }], resources: [] },
  career_ask: { route: 'career-discovery', focus: 'Pay for new graduates in Canada', reply: 'Looking for pay figures for new graduates in Canada.' },
  career_suggest: { prompts: ['Pay in Canada for new graduates', 'Skills for a sophomore in economics', 'Which specialties hire most'] },
};

type Call = { name: string; tools: string[]; user: string; system: string; at: number };

/** A fake model. Validators echo back what they were given unless `reply` says otherwise. */
function fakeAsk(calls: Call[], fail: string[] = [], reply: (name: string, n: number, user: string) => unknown = (name) => answers[name]): Ask {
  let clock = 0;
  return (async (opts) => {
    calls.push({ name: opts.name, tools: (opts.tools ?? []).map((t) => t.type), user: opts.user, system: opts.system, at: clock++ });
    await new Promise((r) => setTimeout(r, 1));
    if (fail.includes(opts.name)) throw new Error(`${opts.name} broke`);
    const n = calls.filter((c) => c.name === opts.name).length;
    const given = reply(opts.name, n, opts.user);
    if (given === undefined && opts.name.startsWith('career_review_')) {
      return { data: opts.schema.parse({ data: JSON.parse(opts.user.split('WROTE IT:\n')[1]!), removed: [] }) };
    }
    if (given instanceof Error) throw given;
    return { data: opts.schema.parse(given) };
  }) as Ask;
}

const env = (canSearchX: boolean) => ({ live: () => true, provider: () => (canSearchX ? 'grok' : 'claude') as 'grok' | 'claude', canSearchX: () => canSearchX });
const names = (calls: Call[]) => calls.map((c) => c.name);

test('the master routes guides and asks to career discovery, and postings to the opportunity search', () => {
  assert.equal(routeRequest({ kind: 'career-guide', career: 'Nurse', refresh: false }), 'career-discovery');
  assert.equal(routeRequest({ kind: 'career-guide-part', slug: 'nurse', section: 'start', prompt: '', by: 'a', student: null }), 'career-discovery');
  assert.equal(routeRequest({ kind: 'opportunity-run', studentId: 'me', trigger: 'manual' }), 'opportunity-search');
  assert.match(SKILLS['career-discovery'].instructions, /careerDiscovery\.ts/);
  assert.throws(() => new AgentMaster().handle({ kind: 'career-guide', career: 'Nurse', refresh: false }), /No agents are set up for career discovery/);
});

test('a guide runs master, managers, fleet researchers, validators and presentation, with how to start after the interviews', async () => {
  const calls: Call[] = [];
  const guides = new CareerGuides(null, fakeAsk(calls), env(true));
  assert.equal(guides.start('economic').slug, 'economic');
  const guide = (await guides.settled('economic'))!;
  assert.equal(guide.status, 'ready');
  assert.equal(guide.title, 'Economist');
  assert.equal(calls[0]!.name, 'career_plan');
  for (const id of ['basics', 'voices', 'interview', 'start'] as const) {
    assert.equal(guide.sections[id].status, 'done');
    assert.ok(names(calls).includes(`career_review_${id}`), `${id} was validated`);
  }
  // Each agent is told it belongs to the career discovery skill, not the opportunity search.
  assert.ok(calls.every((c) => /career discovery skill/.test(c.system)));
  assert.deepEqual(calls.find((c) => c.name === 'career_voices')!.tools, ['x_search', 'web_search']);
  // How to start begins only once the interviews are validated, and is told their formats.
  const start = calls.find((c) => c.name === 'career_start')!;
  assert.ok(start.at > calls.find((c) => c.name === 'career_review_interview')!.at);
  assert.match(start.user, /INTERVIEW FORMATS TO PREPARE FOR[\s\S]*- Résumé screen/);
  assert.deepEqual(guide.sections.start.data!.steps[0]!.prepares, ['Résumé screen']);
  assert.match(guide.sections.voices.data!.summary!, /^People say/);
  assert.ok(guide.activity.some((e) => /Routed "economic" to career discovery/.test(e.text)));
  assert.ok(guide.activity.some((e) => e.agent === 'The basics researcher' && e.tone === 'good'));
});

test('every guide is planned and presented to the same shape, whatever the career', async () => {
  const calls: Call[] = [];
  const guides = new CareerGuides(null, fakeAsk(calls), env(false));
  guides.start('Electrician');
  await guides.settled('electrician');
  const plan = calls.find((c) => c.name === 'career_plan')!.system;
  assert.match(plan, /same four parts in the same order for every career/);
  assert.match(plan, /a trade, a profession/);
  assert.match(plan, /summary of exactly two short sentences/);
  assert.match(calls.find((c) => c.name === 'career_voices_summary')!.system, /for every kind of career/);
});

test('the basics researcher is told to use technical keywords, never soft skills', async () => {
  const calls: Call[] = [];
  const guides = new CareerGuides(null, fakeAsk(calls), env(true));
  guides.start('Economist');
  await guides.settled('economist');
  const sys = calls.find((c) => c.name === 'career_basics')!.system;
  assert.match(sys, /technical keywords/);
  assert.match(sys, /Never soft skills/);
  assert.match(sys, /kind is tool .*method .*knowledge .*credential/s);
});

test('a validator takes out what breaks the rules before the part is saved', async () => {
  const reply = (name: string) =>
    name === 'career_review_basics' ? { data: basics({ skills: [{ name: 'Stata', kind: 'tool' }] }), removed: [{ item: 'Communication', reason: 'soft skill' }] } : name === 'career_basics' ? basics({ skills: [{ name: 'Stata', kind: 'tool' }, { name: 'Communication', kind: 'knowledge' }] }) : answers[name];
  const guides = new CareerGuides(null, fakeAsk([], [], reply), env(true));
  guides.start('Economist');
  const guide = (await guides.settled('economist'))!;
  assert.deepEqual(guide.sections.basics.data!.skills.map((s) => s.name), ['Stata']);
  assert.ok(guide.activity.some((e) => e.agent === 'The basics validator' && /Took out 1: soft skill/.test(e.text)));
});

test('a part whose validator cannot answer keeps what the researcher found, and says so', async () => {
  const guides = new CareerGuides(null, fakeAsk([], ['career_review_start']), env(true));
  guides.start('Economist');
  const guide = (await guides.settled('economist'))!;
  assert.equal(guide.sections.start.status, 'done');
  assert.ok(guide.activity.some((e) => /kept as the researcher wrote it/.test(e.text)));
});

test('without X search the stories are labelled samples with no links, and still summarised', async () => {
  const calls: Call[] = [];
  const guides = new CareerGuides(null, fakeAsk(calls), env(false));
  guides.start('Economist');
  const guide = (await guides.settled('economist'))!;
  assert.ok(calls.some((c) => c.name === 'career_voices_sample' && c.tools.length === 0));
  assert.ok(!calls.some((c) => c.name === 'career_voices'));
  assert.equal(guide.sections.voices.sample, true);
  assert.equal(guide.sections.voices.data!.posts[0]!.url, null);
  assert.match(calls.find((c) => c.name === 'career_voices_summary')!.system, /sample stories/);
});

test('opening a guide with no summary, or one too long, has the presentation agent write it once', async () => {
  const calls: Call[] = [];
  const guides = new CareerGuides(null, fakeAsk(calls), env(true));
  guides.start('Economist');
  const guide = (await guides.settled('economist'))!;
  guide.sections.voices.data!.summary = null;
  guides.view('economist', null);
  guides.view('economist', null);
  await guides.settled('economist');
  assert.equal(calls.filter((c) => c.name === 'career_voices_summary').length, 2);
  assert.match(guides.get('economist')!.sections.voices.data!.summary!, /^People say/);
  guide.sections.voices.data!.summary = 'word '.repeat(80);
  guides.view('economist', null);
  await guides.settled('economist');
  assert.equal(calls.filter((c) => c.name === 'career_voices_summary').length, 3);
  guides.view('economist', null);
  await guides.settled('economist');
  assert.equal(calls.filter((c) => c.name === 'career_voices_summary').length, 3);
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

test('a researcher that fails twice on the fleet marks only its part; how to start still runs', async () => {
  const calls: Call[] = [];
  const guides = new CareerGuides(null, fakeAsk(calls, ['career_interview']), env(true));
  guides.start('Actuary');
  const guide = (await guides.settled('actuary'))!;
  assert.equal(guide.status, 'ready');
  assert.equal(guide.sections.interview.status, 'failed');
  assert.equal(calls.filter((c) => c.name === 'career_interview').length, 2);
  assert.equal(guide.sections.start.status, 'done');
  assert.match(calls.find((c) => c.name === 'career_start')!.user, /none known/);
});

const student = { year: 'Sophomore', major: 'Economics', school: null, location: 'Toronto', interests: [], careerInterests: [], skills: [], notes: ['I want to work in Canada'] };

test('Add more goes master first, then manager, researcher and validator for that part, and merges new items only', async () => {
  const calls: Call[] = [];
  const more = (name: string, n: number) =>
    name === 'career_basics' && n > 1 ? basics({ skills: [{ name: 'stata', kind: 'tool' }, { name: 'Difference-in-differences', kind: 'method' }], pay: { figure: 'C$70,000 for new graduates', url: 'https://a' } }) : answers[name];
  const guides = new CareerGuides(null, fakeAsk(calls, [], more), env(true));
  guides.start('Economist');
  await guides.settled('economist');
  const before = calls.length;
  const { ask } = guides.more('economist', 'basics', { prompt: 'pay in Canada', by: 'student-1', student });
  assert.equal(ask.status, 'working');
  assert.equal(guides.get('economist')!.sections.basics.status, 'working');
  const guide = (await guides.settled('economist'))!;
  const asked = calls.slice(before);
  assert.deepEqual(names(asked), ['career_ask', 'career_basics', 'career_review_basics']);
  assert.match(asked[0]!.user, /THE STUDENT ASKED: "pay in Canada"/);
  assert.match(asked[0]!.user, /I want to work in Canada/);
  assert.match(asked[1]!.user, /What to look for: Pay for new graduates in Canada/);
  assert.match(asked[1]!.user, /ALREADY IN THE PART/);
  const s = guide.sections.basics;
  assert.deepEqual(s.data!.skills.map((k) => k.name), ['Stata', 'Difference-in-differences']);
  assert.equal(s.data!.pay!.figure, 'C$70,000 for new graduates');
  assert.equal(s.added!.count, 2);
  const kept = guide.asks.find((a) => a.id === ask.id)!;
  assert.equal(kept.status, 'done');
  assert.equal(kept.added, 2);
  assert.match(kept.note!, /new graduates in Canada/);
});

test('each student sees only their own asks', async () => {
  const guides = new CareerGuides(null, fakeAsk([]), env(true));
  guides.start('Economist');
  await guides.settled('economist');
  guides.more('economist', 'basics', { prompt: 'mine', by: 'a' });
  await guides.settled('economist');
  guides.more('economist', 'voices', { prompt: 'theirs', by: 'b' });
  await guides.settled('economist');
  assert.deepEqual(guides.view('economist', 'a')!.asks.map((x) => x.prompt), ['mine']);
  assert.ok(!guides.view('economist', 'a')!.activity.some((e) => /theirs/.test(e.text)));
  assert.deepEqual(guides.view('economist', null)!.asks, []);
});

test('an Add more that asks for postings is routed to the opportunity search and researches nothing', async () => {
  const calls: Call[] = [];
  const reply = (name: string) => (name === 'career_ask' ? { route: 'opportunity-search', focus: '', reply: 'The Feed is where your agents look for internships.' } : answers[name]);
  const guides = new CareerGuides(null, fakeAsk(calls, [], reply), env(true));
  guides.start('Economist');
  await guides.settled('economist');
  const before = calls.length;
  const { ask } = guides.more('economist', 'start', { prompt: 'find me internships in Toronto', by: 'a' });
  const guide = (await guides.settled('economist'))!;
  assert.deepEqual(names(calls.slice(before)), ['career_ask']);
  const kept = guide.asks.find((a) => a.id === ask.id)!;
  assert.equal(kept.status, 'redirected');
  assert.match(kept.note!, /Feed/);
  assert.equal(guide.sections.start.status, 'done');
});

test('new interview formats from Add more get steps in how to start that prepare for them', async () => {
  const calls: Call[] = [];
  const reply = (name: string, n: number) => {
    if (name === 'career_interview' && n > 1) return { formats: [{ name: 'Case interview', tests: 'Reasoning', howToPractice: 'Practise', url: null }], questions: [], sources: [] };
    if (name === 'career_start' && n > 1) return { steps: [{ title: 'Practise cases weekly', detail: 'Work through one case a week.', when: null, resource: null, prepares: ['Case interview'] }], resources: [] };
    return answers[name];
  };
  const guides = new CareerGuides(null, fakeAsk(calls, [], reply), env(true));
  guides.start('Economist');
  await guides.settled('economist');
  const { ask } = guides.more('economist', 'interview', { prompt: 'case interviews', by: 'a' });
  const guide = (await guides.settled('economist'))!;
  const startCall = calls.filter((c) => c.name === 'career_start')[1]!;
  assert.match(startCall.user, /- Case interview/);
  assert.deepEqual(unpreparedFormats(guide), []);
  assert.equal(guide.sections.start.data!.steps.length, 2);
  assert.equal(guide.asks.find((a) => a.id === ask.id)!.added, 2);
});

test('Add more that finds nothing keeps the part and says so', async () => {
  const guides = new CareerGuides(null, fakeAsk([], [], (name, n) => (name === 'career_basics' && n > 1 ? new Error('x') : answers[name])), env(true));
  guides.start('Economist');
  await guides.settled('economist');
  const { ask } = guides.more('economist', 'basics', { prompt: 'more', by: 'a' });
  const guide = (await guides.settled('economist'))!;
  const s = guide.sections.basics;
  assert.equal(s.status, 'done');
  assert.equal(s.data!.summary, 'Economists build econometric models in Stata and R.');
  assert.match(s.error!, /Could not find more/);
  assert.equal(guide.asks.find((a) => a.id === ask.id)!.status, 'failed');
});

test('Add more is refused while the guide is researching, twice at once, and for unknown parts', async () => {
  const guides = new CareerGuides(null, fakeAsk([]), env(true));
  guides.start('Economist');
  assert.throws(() => guides.more('economist', 'basics'), /still being researched/);
  await guides.settled('economist');
  guides.more('economist', 'basics');
  assert.throws(() => guides.more('economist', 'basics'), /already finding more/);
  await guides.settled('economist');
  assert.throws(() => guides.more('economist', 'salary'), /no such part/);
  assert.throws(() => guides.more('pilot', 'basics'), /No guide/);
});

test('suggested requests come from the presentation agent with the student, and are kept', async () => {
  const calls: Call[] = [];
  const guides = new CareerGuides(null, fakeAsk(calls), env(true));
  guides.start('Economist');
  await guides.settled('economist');
  const prompts = await guides.suggest('economist', 'basics', { by: 'a', student });
  assert.equal(prompts.length, 3);
  assert.match(calls.at(-1)!.user, /I want to work in Canada/);
  await guides.suggest('economist', 'basics', { by: 'a', student });
  assert.equal(calls.filter((c) => c.name === 'career_suggest').length, 1);
});

test('basics merge fills a missing fact and adds only new skills', () => {
  const { data, added } = mergeSection('basics', basics() as never, basics({ skills: [{ name: 'stata', kind: 'tool' }, { name: 'Python', kind: 'tool' }], pay: { figure: '$100k', url: 'https://a' }, summary: 'other' }) as never);
  assert.deepEqual(data.skills.map((s) => s.name), ['Stata', 'Python']);
  assert.equal(data.pay!.figure, '$100k');
  assert.equal(data.summary, 'Economists build econometric models in Stata and R.');
  assert.equal(added, 2);
});

test('guides are kept on disk and reloaded; older guides are upgraded and cut-off work is marked', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'careers-'));
  const file = join(dir, 'guides.json');
  const guides = new CareerGuides(file, fakeAsk([]), env(true));
  guides.start('Architect');
  await guides.settled('architect');
  const reloaded = new CareerGuides(file, fakeAsk([]), env(true));
  assert.equal(reloaded.get('architect')!.title, 'Economist');

  const old = join(dir, 'old.json');
  const g = reloaded.get('architect')!;
  const legacy = { ...g, asks: undefined, activity: undefined, sections: { ...g.sections, basics: { ...g.sections.basics, data: { ...g.sections.basics.data, skills: ['Statistics'] } }, voices: { ...g.sections.voices, data: { posts: [] } } } };
  writeFileSync(old, JSON.stringify({ guides: [legacy] }));
  const upgraded = new CareerGuides(old, fakeAsk([]), env(true)).get('architect')!;
  assert.deepEqual(upgraded.sections.basics.data!.skills, [{ name: 'Statistics', kind: 'knowledge' }]);
  assert.equal(upgraded.sections.voices.data!.summary, null);
  assert.deepEqual(upgraded.asks, []);

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

test('the routes go through the master: start a guide, ask for more with a prompt, suggest, and show only your asks', async () => {
  const app = new Hono();
  const guides = new CareerGuides(null, fakeAsk([]), env(true));
  mountCareers(app, guides);
  const json = { 'content-type': 'application/json' };
  const post = await app.request('/api/careers/guides', { method: 'POST', body: JSON.stringify({ career: 'Teacher' }), headers: json });
  assert.equal(post.status, 202);
  const more = (body: unknown) => app.request('/api/careers/guides/teacher/sections/start/more', { method: 'POST', body: JSON.stringify(body), headers: json });
  assert.equal((await more({ prompt: 'x', by: 'u1' })).status, 409);
  await guides.settled('teacher');
  const res = await more({ prompt: 'summer jobs for teachers in training', by: 'u1', student: { ...student, extra: 'ignored' } });
  assert.equal(res.status, 202);
  assert.equal(((await res.json()) as { ask: { prompt: string } }).ask.prompt, 'summer jobs for teachers in training');
  await guides.settled('teacher');
  const mine = (await (await app.request('/api/careers/guides/teacher?by=u1')).json()) as { guide: { asks: unknown[] } };
  const theirs = (await (await app.request('/api/careers/guides/teacher?by=u2')).json()) as { guide: { asks: unknown[] } };
  assert.equal(mine.guide.asks.length, 1);
  assert.equal(theirs.guide.asks.length, 0);
  const sug = await app.request('/api/careers/guides/teacher/sections/start/suggest', { method: 'POST', body: JSON.stringify({ by: 'u1' }), headers: json });
  assert.equal(((await sug.json()) as { prompts: string[] }).prompts.length, 3);
  assert.equal((await app.request('/api/careers/guides/nobody')).status, 404);
  assert.equal((await app.request('/api/careers/guides', { method: 'POST', body: JSON.stringify({ career: '' }) })).status, 400);
});
