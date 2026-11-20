import assert from 'node:assert/strict';
import { test } from 'node:test';
import { GrokBrain } from '../src/agents/grokBrain.ts';
import { SimBrain } from '../src/agents/simBrain.ts';
import { AgentSystem } from '../src/agents/system.ts';
import { createApp } from '../src/app.ts';
import { config } from '../src/config.ts';
import { LocalStore } from '../src/store/local.ts';

const NOW = new Date('2026-11-19T12:00:00Z');

test('agent settings: only listed Grok models and whole-number minimums are kept, with the account', async () => {
  const s = new AgentSystem(new SimBrain({ speed: 0, now: () => NOW }), { now: () => NOW, feedTarget: 0 });
  const { app } = createApp(new LocalStore(null), {}, { demo: s, grok: { connected: true, mode: 'cli', detail: '' } });
  const get = (await (await app.request('/api/students/demo/agent-settings')).json()) as any;
  assert.deepEqual(get.settings, { models: {}, minimums: {} });
  assert.ok(get.models.includes(config.xaiModels.normal));
  assert.equal(get.groups.length, 6);
  assert.equal(get.applied, true);

  const put = await app.request('/api/students/demo/agent-settings', {
    method: 'PUT',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ models: { master: config.xaiModels.high, workers: 'gpt-5', nonsense: config.xaiModels.low }, minimums: { internship: 10, event: 0, club: 2.5, hackathon: 999, nope: 3 } }),
  });
  const saved = ((await put.json()) as any).settings;
  assert.deepEqual(saved, { models: { master: config.xaiModels.high }, minimums: { internship: 10, hackathon: 50 }, kinds: [] });
  assert.deepEqual(s.memorySnapshot().profile.agentSettings, saved, 'kept with the account');
});

test('agent settings: each group uses its chosen Grok model, others their tier', () => {
  const brain = new GrokBrain();
  brain.setModels({ master: 'grok-x', workers: 'grok-y' });
  const model = (brain as any).model.bind(brain);
  if (config.grokTransport === 'claude') {
    assert.equal(model('master', 'tier'), 'tier', 'the Claude test set-up keeps its own models');
  } else {
    assert.equal(model('master', 'tier'), 'grok-x');
    assert.equal(model('workers', 'tier'), 'grok-y');
    assert.equal(model('validators', 'tier'), 'tier');
  }
});

test('agent settings: a minimum keeps the agents searching for that kind until it is met', async () => {
  // A few worker jobs a run, so one search finds too few internships.
  const s = new AgentSystem(new SimBrain({ speed: 0, now: () => NOW }), { now: () => NOW, feedTarget: 0, maxJobs: 8 }, { categories: ['event'] });
  s.setAgentSettings({ models: {}, minimums: { internship: 5 } });
  await s.trigger('first');
  await s.idle();
  const internships = s.student().feed.filter((f) => f.opportunity.type === 'internship').length;
  assert.ok(internships >= 5, `found ${internships}`);
  assert.ok(s.student().runCount > 1, 'more than one search was needed');
  assert.ok(s.student().profile.categories.includes('internship'), 'internships were added to what the student looks for');
  const runs = s.student().runCount;
  await new Promise((r) => setTimeout(r, 30));
  await s.idle();
  assert.equal(s.student().runCount, runs, 'and it stopped once met');
});

test('agent settings: an unreachable minimum stops after the allowed number of searches', async () => {
  const s = new AgentSystem(new SimBrain({ speed: 0, now: () => NOW }), { now: () => NOW, feedTarget: 0, maxJobs: 8 });
  s.setAgentSettings({ models: {}, minimums: { scholarship: 50 } });
  await s.trigger('first');
  await s.idle();
  assert.ok(s.student().runCount <= 13, `ran ${s.student().runCount} times`);
  assert.ok(s.currentRun()!.log.some((l) => /scholarships you asked for/.test(l.text)));
});

test('agent settings: the kinds ticked are the ones searches cover, and they show in the feed', async () => {
  const s = new AgentSystem(new SimBrain({ speed: 0, now: () => NOW }), { now: () => NOW, feedTarget: 0 }, { categories: ['internship'] });
  const { app } = createApp(new LocalStore(null), {}, { demo: s });
  await app.request('/api/students/demo/agent-settings', { method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ kinds: ['event', 'club', 'nonsense', 'event'] }) });
  assert.deepEqual(s.getAgentSettings().kinds, ['event', 'club']);
  await s.trigger('first');
  assert.deepEqual([...new Set(s.currentRun()!.assignments.map((a) => a.category))].sort(), ['club', 'event']);
  assert.ok(s.student().feed.some((f) => f.opportunity.type === 'event' || f.opportunity.type === 'club'));
  // Unticking every kind goes back to what the profile asks for.
  s.setAgentSettings({ models: {}, minimums: {}, kinds: [] });
  await s.trigger('manual');
  assert.deepEqual([...new Set(s.currentRun()!.assignments.map((a) => a.category))], ['internship']);
});
