import assert from 'node:assert/strict';
import { test } from 'node:test';
import { lineupNames, planLineup } from '../src/agents/lineup.ts';
import { SimBrain } from '../src/agents/simBrain.ts';
import { AgentSystem } from '../src/agents/system.ts';

const even = { internship: 1, event: 1, club: 1, program: 1 };
const NOW = new Date('2026-11-19T12:00:00Z');

test('lineup: one kind ticked puts all four managers on it', () => {
  assert.deepEqual(lineupNames(planLineup(['internship'], even, 4)), ['Internships manager 1', 'Internships manager 2', 'Internships manager 3', 'Internships manager 4']);
});

test('lineup: two kinds share four managers, the one engaged with most gets the spare first', () => {
  const l = planLineup(['scholarship', 'internship'], { ...even, program: 3 }, 4);
  assert.deepEqual(lineupNames(l), ['Internships manager 1', 'Internships manager 2', 'Scholarships manager 1', 'Scholarships manager 2']);
  const l3 = planLineup(['internship', 'event', 'hackathon'], { ...even, event: 5 }, 4);
  assert.deepEqual(lineupNames(l3), ['Internships manager', 'Events manager 1', 'Events manager 2', 'Hackathons manager']);
});

test('lineup: more than four kinds shows the first four; the rest share the program manager', () => {
  const l = planLineup(['scholarship', 'research', 'hackathon', 'club', 'event', 'internship'], even, 4);
  assert.deepEqual(lineupNames(l), ['Internships manager', 'Events manager', 'Clubs manager', 'Hackathons manager']);
  assert.deepEqual(l[3]!.also, ['research', 'scholarship']);
});

test('lineup: a run with only internships ticked has four internship managers, and the page is told before it runs', async () => {
  const s = new AgentSystem(new SimBrain({ speed: 0, now: () => NOW }), { now: () => NOW, feedTarget: 0 }, { categories: ['event', 'club'] });
  s.setAgentSettings({ models: {}, minimums: {}, kinds: ['internship'] });
  assert.deepEqual(s.student().nextManagers!.map((m) => m.name), ['Internships manager 1', 'Internships manager 2', 'Internships manager 3', 'Internships manager 4']);
  await s.trigger('first');
  const managers = s.currentRun()!.agents.filter((a) => a.level === 'manager');
  assert.deepEqual(managers.map((m) => m.name), ['Internships manager 1', 'Internships manager 2', 'Internships manager 3', 'Internships manager 4']);
  assert.ok(managers.every((m) => m.role.startsWith('Internships')));
});
