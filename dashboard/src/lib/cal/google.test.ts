import { describe, expect, it } from 'vitest';
import { fetchGoogleEvents, googleItems } from './google.ts';

const page = (items: unknown[], next?: string) => new Response(JSON.stringify({ items, nextPageToken: next }), { status: 200 });

describe('Google Calendar', () => {
  it('reads every page of the main calendar, leaves out cancelled events, and says when access ran out', async () => {
    const asked: string[] = [];
    const fake = (async (url: string | URL | Request) => {
      const u = String(url);
      asked.push(u);
      // Without the permission to list calendars, the main calendar is read on its own.
      if (u.includes('/users/me/calendarList')) return new Response('{}', { status: 403 });
      if (u.includes('pageToken=p2'))
        return page([{ id: 'b', summary: 'Shift', start: { dateTime: '2026-11-20T18:00:00-08:00' }, end: { dateTime: '2026-11-20T22:00:00-08:00' }, htmlLink: 'https://calendar.google.com/b' }]);
      return page(
        [
          { id: 'a', summary: 'CS 61A midterm', start: { date: '2026-11-23' }, end: { date: '2026-11-24' }, location: 'Wheeler 150' },
          { id: 'x', status: 'cancelled', start: { date: '2026-11-25' } },
        ],
        'p2',
      );
    }) as typeof fetch;
    const events = await fetchGoogleEvents('tok', '2026-11-15', '2027-01-15', fake);
    expect(events.map((e) => e.title)).toEqual(['CS 61A midterm', 'Shift']);
    expect(asked[1]).toContain('/calendars/primary/events?');
    expect(asked[1]).toContain('singleEvents=true');
    expect(events.allCalendars).toBe(false);
    expect(events[0]).toMatchObject({ allDay: true, location: 'Wheeler 150' });

    const expired = (async () => new Response('{}', { status: 401 })) as unknown as typeof fetch;
    void expired;
    await expect(fetchGoogleEvents('old', '2026-11-15', '2026-12-15', expired)).rejects.toMatchObject({ expired: true });
  });

  it("turns events into calendar items: one per day of an all-day event, timed ones with their hours, and none for BearRok's own", () => {
    const items = googleItems(
      [
        { id: 'trip', title: 'Family trip', start: '2026-11-26', end: '2026-11-29', allDay: true, link: null, location: null },
        { id: 'shift', title: 'Shift', start: '2026-11-20T18:00:00', end: '2026-11-20T22:00:00', allDay: false, link: 'https://calendar.google.com/s', location: 'Cafe' },
        { id: 'bearrok-made', title: 'Due: Goldwater', start: '2027-01-29T23:59:00', end: '2027-01-30T00:29:00', allDay: false, link: null, location: null },
      ],
      new Set(['bearrok-made']),
    );
    expect(items.filter((i) => i.title === 'Family trip').map((i) => i.day)).toEqual(['2026-11-26', '2026-11-27', '2026-11-28']);
    const shift = items.find((i) => i.title === 'Shift')!;
    expect(shift).toMatchObject({ kind: 'google', day: '2026-11-20', priority: 'should', opportunityId: null, link: 'https://calendar.google.com/s' });
    expect(shift.why).toBe('6:00 PM – 10:00 PM · Cafe');
    expect(items.some((i) => i.title === 'Due: Goldwater')).toBe(false);
  });
});

describe('adding to Google Calendar', () => {
  it('builds all-day and timed events in the student’s time zone, with an hour when no end is given', async () => {
    const { eventBody } = await import('./google.ts');
    expect(eventBody({ title: 'Career fair', day: '2026-11-24' }, 'America/Los_Angeles')).toMatchObject({ summary: 'Career fair', start: { date: '2026-11-24' }, end: { date: '2026-11-25' } });
    expect(eventBody({ title: 'Study', day: '2026-11-24', time: '14:30' }, 'America/Los_Angeles')).toMatchObject({
      start: { dateTime: '2026-11-24T14:30:00', timeZone: 'America/Los_Angeles' },
      end: { dateTime: '2026-11-24T15:30:00', timeZone: 'America/Los_Angeles' },
    });
    expect(eventBody({ title: 'Lab', day: '2026-11-24', time: '09:00', endTime: '12:00' }, 'UTC').end).toEqual({ dateTime: '2026-11-24T12:00:00', timeZone: 'UTC' });
    // An end before the start is ignored rather than sent to Google.
    expect(eventBody({ title: 'x', day: '2026-11-24', time: '18:00', endTime: '09:00' }, 'UTC').end).toEqual({ dateTime: '2026-11-24T19:00:00', timeZone: 'UTC' });
  });

  it('adds, changes and removes the event, and does not mind one that is already gone', async () => {
    const { insertGoogleEvent, updateGoogleEvent, deleteGoogleEvent } = await import('./google.ts');
    const calls: string[] = [];
    const fake = (async (url: string | URL | Request, init?: RequestInit) => {
      calls.push(`${init?.method} ${String(url).replace('https://www.googleapis.com/calendar/v3/calendars/primary/events', '')}`);
      if (init?.method === 'POST') return new Response(JSON.stringify({ id: 'ev1', htmlLink: 'https://calendar.google.com/ev1' }));
      if (init?.method === 'DELETE') return new Response('', { status: 410 });
      return new Response('{}');
    }) as typeof fetch;
    expect(await insertGoogleEvent('tok', { title: 'Midterm', day: '2026-12-01', time: '10:00' }, fake)).toEqual({ eventId: 'ev1', link: 'https://calendar.google.com/ev1' });
    await updateGoogleEvent('tok', 'ev1', { title: 'Midterm', day: '2026-12-02' }, fake);
    await deleteGoogleEvent('tok', 'ev1', fake);
    expect(calls).toEqual(['POST ', 'PATCH /ev1', 'DELETE /ev1']);
  });
});

describe('every Google calendar', () => {
  it('reads every calendar ticked in Google Calendar, names the ones besides the main calendar, and skips hidden ones', async () => {
    const { fetchGoogleEvents, googleItems } = await import('./google.ts');
    const fake = (async (url: string | URL | Request) => {
      const u = String(url);
      if (u.includes('/users/me/calendarList'))
        return new Response(
          JSON.stringify({
            items: [
              { id: 'school@berkeley.edu', summary: 'bCourses', selected: true },
              { id: 'me@gmail.com', summary: 'me@gmail.com', primary: true, selected: true },
              { id: 'hidden-cal', summary: 'Old', selected: false },
            ],
          }),
        );
      if (u.includes(encodeURIComponent('school@berkeley.edu')))
        return new Response(JSON.stringify({ summary: 'bCourses', items: [{ id: 'm1', summary: 'CS 61A lecture', start: { dateTime: '2026-11-20T10:00:00-08:00' }, end: { dateTime: '2026-11-20T11:00:00-08:00' } }] }));
      if (u.includes(encodeURIComponent('me@gmail.com'))) return new Response(JSON.stringify({ summary: 'me@gmail.com', items: [{ id: 'p1', summary: 'Dentist', start: { date: '2026-11-21' }, end: { date: '2026-11-22' } }] }));
      throw new Error(`hidden calendar was read: ${u}`);
    }) as typeof fetch;
    const events = await fetchGoogleEvents('tok', '2026-11-15', '2026-12-15', fake);
    expect(events.allCalendars).toBe(true);
    expect(events.calendars).toBe(2);
    expect(events.account).toBe('me@gmail.com');
    const items = googleItems(events);
    expect(items.find((i) => i.title === 'CS 61A lecture')!.why).toContain('bCourses');
    expect(items.find((i) => i.title === 'Dentist')!.why).toBe('All day');
  });
});
