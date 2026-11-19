import assert from 'node:assert/strict';
import { test } from 'node:test';
import { sortByRules } from '../src/agents/eventSorter.ts';
import { SimBrain } from '../src/agents/simBrain.ts';
import { AgentSystem } from '../src/agents/system.ts';
import { createApp } from '../src/app.ts';
import { LocalStore } from '../src/store/local.ts';

test('calendar sorting: career events are kept; classes, coursework, work shifts and personal life are not', () => {
  const verdicts = sortByRules([
    { id: '1', title: 'Goldwater application due' },
    { id: '2', title: 'Phone screen with Stripe recruiter' },
    { id: '3', title: 'Engineering Career Fair' },
    { id: '4', title: 'TreeHacks 2027' },
    { id: '5', title: 'CS 61A midterm' },
    { id: '6', title: 'Mom’s birthday dinner' },
    { id: '7', title: 'Dentist' },
    { id: '8', title: 'Lecture', calendar: 'bCourses' },
    { id: '9', title: 'Final Multiple Choice Quiz: Externalities, Public Information closes' },
    { id: '10', title: 'PB101 Foundations of Political Science' },
    { id: '11', title: 'EC1A5 Microeconomics seminar' },
    { id: '12', title: 'Data Science Society general meeting' },
    { id: '13', title: 'Shift at the cafe' },
  ]);
  assert.deepEqual(
    verdicts.map((v) => [v.id, v.career, v.kind]),
    [
      ['1', true, 'opportunity'],
      ['2', true, 'interview'],
      ['3', true, 'event'],
      ['4', true, 'event'],
      ['5', false, 'class'],
      ['6', false, 'personal'],
      ['7', false, 'personal'],
      ['8', false, 'class'],
      ['9', false, 'class'],
      ['10', false, 'class'],
      ['11', false, 'class'],
      ['12', true, 'event'],
      ['13', false, 'work'],
    ],
  );
});

test('calendar sorting: the endpoint sorts what it is sent, at most 80, and ignores events without a title', async () => {
  const s = new AgentSystem(new SimBrain({ speed: 0 }), { feedTarget: 0 });
  const { app } = createApp(new LocalStore(null), {}, { demo: s });
  const events = [{ id: 'a', title: 'Info session: Jane Street' }, { id: 'b', title: 'Gym' }, { id: 'c' }, ...Array.from({ length: 100 }, (_, i) => ({ id: `x${i}`, title: 'Movie night' }))];
  const res = await app.request('/api/students/demo/calendar/sort', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ events }) });
  const { verdicts } = (await res.json()) as { verdicts: { id: string; career: boolean }[] };
  assert.equal(verdicts.length, 79, 'the first 80 sent, less the one with no title');
  assert.deepEqual(verdicts.slice(0, 2).map((v) => [v.id, v.career]), [['a', true], ['b', false]]);
});

test('calendar chat: only a well-formed event is accepted, and without a model nothing is guessed', async () => {
  const { cleanDraft } = await import('../src/agents/eventSorter.ts');
  assert.deepEqual(cleanDraft({ title: ' Stripe interview ', day: '2026-11-20', time: '14:00', endTime: '15:00', note: '' }), { title: 'Stripe interview', day: '2026-11-20', time: '14:00', endTime: '15:00', note: '' });
  assert.equal(cleanDraft({ title: 'x', day: 'Friday', time: null, endTime: null, note: '' }), null, 'a day that is not a date');
  assert.equal(cleanDraft({ title: 'x', day: '2026-11-20', time: '25:00', endTime: null, note: '' })?.time, null, 'a time that is not a time');
  assert.equal(cleanDraft({ title: 'x', day: '2026-11-20', time: '14:00', endTime: '09:00', note: '' })?.endTime, null, 'an end before the start');

  const s = new AgentSystem(new SimBrain({ speed: 0 }), { feedTarget: 0 });
  const { app } = createApp(new LocalStore(null), {}, { demo: s });
  const res = (await (await app.request('/api/students/demo/calendar/ask', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ text: 'career fair friday 1pm', today: '2026-11-19' }) })).json()) as any;
  assert.equal(res.ok, false);
  assert.match(res.reply, /form/);
});
