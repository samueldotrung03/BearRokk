import { describe, expect, it } from 'vitest';
import { careerOnlyEvents, eventKey } from './careerSort.ts';
import type { GoogleEvent } from './google.ts';

const ev = (id: string, title: string, calendarId?: string): GoogleEvent => ({ id, title, start: '2026-11-20T10:00:00', end: '2026-11-20T11:00:00', allDay: false, link: null, location: null, calendarId });

describe('Career only', () => {
  const events = [ev('a', 'Career fair'), ev('b', 'Dentist'), ev('c', 'Not sorted yet'), ev('a', 'Same id, other calendar', 'school')];
  const verdicts = {
    [eventKey(events[0]!)]: { career: true, kind: 'event', reason: 'A career event' },
    [eventKey(events[1]!)]: { career: false, kind: 'personal', reason: 'Looks personal' },
    [eventKey(events[3]!)]: { career: false, kind: 'personal', reason: 'Looks personal' },
  };

  it('shows only events sorted as career; unsorted ones wait hidden unless sorting cannot run', () => {
    expect(careerOnlyEvents(events, verdicts, true).map((e) => e.title)).toEqual(['Career fair']);
    expect(careerOnlyEvents(events, verdicts, true, true).map((e) => e.title)).toEqual(['Career fair', 'Not sorted yet']);
  });

  it('hides nothing when it is off', () => {
    expect(careerOnlyEvents(events, verdicts, false)).toHaveLength(4);
  });

  it('tells apart events with the same id on different calendars', () => {
    expect(eventKey(events[0]!)).not.toBe(eventKey(events[3]!));
  });
});
