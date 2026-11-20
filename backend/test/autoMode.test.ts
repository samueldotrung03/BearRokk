import assert from 'node:assert/strict';
import { test } from 'node:test';
import { cleanTimes, defaultTimes, dueSlots, nextSlot, zonedInstant } from '../src/agents/autoMode.ts';
import { SimBrain } from '../src/agents/simBrain.ts';
import { AgentSystem } from '../src/agents/system.ts';
import { createApp } from '../src/app.ts';
import { LocalStore } from '../src/store/local.ts';

const LA = 'America/Los_Angeles';

test('automode: local times become the right instants, across a clock change', () => {
  assert.equal(zonedInstant('2026-11-19', '09:00', LA).toISOString(), '2026-11-19T17:00:00.000Z');
  assert.equal(zonedInstant('2026-07-01', '09:00', LA).toISOString(), '2026-07-01T16:00:00.000Z');
  assert.deepEqual(defaultTimes(3), ['09:00', '13:00', '18:00']);
  assert.deepEqual(cleanTimes(['18:00', '9:00', '09:00', '09:00', '25:00', 'x']), ['09:00', '18:00']);
});

test('automode: times that passed while the app was closed wait; older than a day, after turning on only', () => {
  const now = new Date('2026-11-19T22:30:00Z'); // 14:30 in Los Angeles
  const times = ['09:00', '13:00', '18:00'];
  // Both of today's passed times are waiting; yesterday's 18:00 too (within a day).
  assert.deepEqual(dueSlots(now, times, LA, null, []), ['2026-11-19T02:00:00.000Z', '2026-11-19T17:00:00.000Z', '2026-11-19T21:00:00.000Z']);
  // Turned on at noon today: only 13:00 is waiting.
  assert.deepEqual(dueSlots(now, times, LA, '2026-11-19T20:00:00Z', []), ['2026-11-19T21:00:00.000Z']);
  // Already run.
  assert.deepEqual(dueSlots(now, times, LA, '2026-11-19T20:00:00Z', ['2026-11-19T21:00:00.000Z']), []);
  assert.equal(nextSlot(now, times, LA), '2026-11-20T02:00:00.000Z');
});

test('automode: runs only while the app is open, one at a time, ten minutes apart', async () => {
  let clock = new Date('2026-11-19T22:30:00Z');
  const now = () => clock;
  const s = new AgentSystem(new SimBrain({ speed: 0, now }), { now, feedTarget: 0 });
  s.setAgentSettings({ models: {}, minimums: {}, kinds: [], auto: { on: true, times: ['09:00', '13:00'], timeZone: LA, since: null } });
  // Turned on just now: nothing earlier today runs.
  assert.equal(s.checkAuto(), false);
  // Pretend it was turned on this morning, and the app was closed through both times.
  (s as any).agentSettings.auto.since = '2026-11-19T15:00:00Z';
  assert.equal(s.checkAuto(), false, 'the app is closed: nothing runs');
  assert.equal(s.autoStatus().waiting, 2);
  const unsubscribe = s.subscribe(() => {}); // the app opens
  assert.equal(s.checkAuto(), true, 'the first waiting search starts when the app opens');
  await s.idle();
  assert.equal(s.student().runCount, 1);
  assert.equal(s.checkAuto(), false, 'the next one waits ten minutes');
  assert.ok(s.autoStatus().startsAt);
  clock = new Date(clock.getTime() + 10 * 60_000 + 1000);
  assert.equal(s.checkAuto(), true, 'then runs');
  await s.idle();
  clock = new Date(clock.getTime() + 11 * 60_000);
  assert.equal(s.checkAuto(), false, 'nothing left today');
  assert.equal(s.student().runCount, 2);
  assert.equal(s.currentRun()!.trigger, 'auto');
  // What has run is kept with the account.
  assert.equal(s.memorySnapshot().learned.autoDone!.length, 2);
  unsubscribe();
});

test('automode: the settings route keeps valid times and the time zone, and turning off stops it', async () => {
  const s = new AgentSystem(new SimBrain({ speed: 0 }), { feedTarget: 0 });
  const { app } = createApp(new LocalStore(null), {}, { demo: s });
  const put = (auto: unknown) => app.request('/api/students/demo/agent-settings', { method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ auto }) });
  const res = (await (await put({ on: true, times: ['18:00', '08:00', 'nope'], timeZone: LA })).json()) as any;
  assert.deepEqual([res.settings.auto.on, res.settings.auto.times, res.settings.auto.timeZone], [true, ['08:00', '18:00'], LA]);
  assert.ok(res.settings.auto.since);
  assert.equal(res.auto.on, true);
  assert.ok(res.auto.nextAt);
  const off = (await (await put({ on: false, times: ['08:00'], timeZone: LA })).json()) as any;
  assert.equal(off.auto.on, false);
});
