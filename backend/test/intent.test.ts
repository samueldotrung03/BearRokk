import assert from 'node:assert/strict';
import { test } from 'node:test';
import { explainFit, scopeStudentRequest } from '../src/agents/intent.ts';

const TODAY = new Date('2026-11-20T15:00:00Z');
const DEMO = 'Find a beginner-friendly coding club near Berkeley and an online hackathon next month';

test('a club near Berkeley and an online hackathon are searched separately', () => {
  const scoped = scopeStudentRequest(DEMO, TODAY);
  assert.equal(scoped.followUp, null);
  const club = scoped.constraints.find((c) => c.types.includes('club'))!;
  const hack = scoped.constraints.find((c) => c.types.includes('hackathon'))!;
  assert.equal(club.location, 'Berkeley');
  assert.equal(club.format, null);
  assert.deepEqual(club.preferences, ['beginner-friendly', 'coding']);
  assert.equal(hack.format, 'online');
  assert.equal(hack.location, null);
  assert.deepEqual(hack.preferences, []);
  assert.deepEqual([hack.dateFrom, hack.dateTo], ['2026-12-01', '2026-12-31']);
  assert.equal(club.dateFrom, null);
  assert.deepEqual(scoped.categories.sort(), ['club', 'program']);
  assert.ok(!club.requirements.some((r) => r.includes('online')));
  assert.ok(hack.requirements.some((r) => r.includes('online')));
});

test('a follow-up is asked only when one part has no place and the other is online', () => {
  const open = scopeStudentRequest('Find a beginner-friendly coding club and an online hackathon next month', TODAY);
  assert.match(open.followUp ?? '', /club meet online/);
  const answered = scopeStudentRequest('Find a beginner-friendly coding club and an online hackathon next month', TODAY, 'One near Berkeley');
  const club = answered.constraints.find((c) => c.types.includes('club'))!;
  assert.equal(answered.followUp, null);
  assert.equal(club.location, 'Berkeley');
  assert.equal(club.format, 'in_person');
  assert.equal(answered.constraints.find((c) => c.types.includes('hackathon'))!.format, 'online');
});

test('skipping the follow-up searches without inventing a place', () => {
  const skipped = scopeStudentRequest('Find a coding club and an online hackathon', TODAY, '');
  assert.equal(skipped.followUp, null);
  assert.equal(skipped.constraints.find((c) => c.types.includes('club'))!.location, null);
});

test('a fit line names the preference and the listing fact', () => {
  const { constraints } = scopeStudentRequest(DEMO, TODAY);
  const line = explainFit(
    { type: 'hackathon', format: 'online', location: null, tags: ['hackathon'], field: 'software' },
    constraints,
  );
  assert.match(line ?? '', /asked for remote hackathons/);
  assert.match(line ?? '', /fully online/);
  const club = explainFit(
    { type: 'club', format: 'in_person', location: 'Berkeley, CA', tags: ['first-year friendly'], field: 'software' },
    constraints,
  );
  assert.match(club ?? '', /near Berkeley/);
  assert.match(club ?? '', /Berkeley, CA/);
  assert.match(club ?? '', /beginner-friendly/);
  assert.match(club ?? '', /first-year friendly/);
});
