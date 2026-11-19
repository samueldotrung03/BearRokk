// The student's own Google Calendar, read into BearRok's calendar so their classes, shifts and
// plans sit next to their application deadlines. It uses the same Google access that lets BearRok
// put deadlines on the calendar (calendar.events: view and edit events), and reads the main
// calendar only. Events BearRok made itself are left out, since the deadline is already shown.
import { useEffect, useState } from 'react';
import { useAuth } from '../../auth/AuthProvider.tsx';
import { dayKey } from '../calendar.ts';
import { addDays, dayDate } from './days.ts';
import type { CxItem } from './items.ts';

export interface GoogleEvent {
  id: string;
  /** The calendar it is on, and that calendar's name, for any calendar besides the main one. */
  calendarId?: string;
  calendarName?: string | null;
  title: string;
  /** All-day events: YYYY-MM-DD, with `end` the day after the last day. Timed ones: ISO times. */
  start: string;
  end: string;
  allDay: boolean;
  link: string | null;
  location: string | null;
}

export type GoogleSyncState = 'off' | 'loading' | 'ok' | 'expired' | 'error';

// ---- writing: what the student adds in BearRok goes on their Google Calendar -----------------

/** Something to put on the calendar: a whole day, or a time on that day ("HH:MM"). */
export interface EventDraft {
  title: string;
  day: string;
  time?: string | null;
  endTime?: string | null;
  description?: string;
}

/** One hour after "HH:MM", stopping at the end of the day. */
const hourAfter = (hhmm: string) => {
  const [h, m] = hhmm.split(':').map(Number) as [number, number];
  return h >= 23 ? '23:59' : `${String(h + 1).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
};

/** The event as Google Calendar wants it, in the student's own time zone. */
export function eventBody(d: EventDraft, timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone) {
  const base = { summary: d.title, description: d.description ?? 'Added from BearRok.', source: { title: 'BearRok', url: 'https://bearrok.app' } };
  if (!d.time) return { ...base, start: { date: d.day }, end: { date: addDays(d.day, 1) } };
  const end = d.endTime && d.endTime > d.time ? d.endTime : hourAfter(d.time);
  return { ...base, start: { dateTime: `${d.day}T${d.time}:00`, timeZone }, end: { dateTime: `${d.day}T${end}:00`, timeZone } };
}

const EVENTS = 'https://www.googleapis.com/calendar/v3/calendars/primary/events';

async function call(token: string, url: string, init: RequestInit, fetchImpl: typeof fetch) {
  const res = await fetchImpl(url, { ...init, headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' } });
  if (res.status === 401) throw Object.assign(new Error('Google access has run out'), { expired: true });
  return res;
}

export async function insertGoogleEvent(token: string, d: EventDraft, fetchImpl: typeof fetch = fetch): Promise<{ eventId: string; link: string | null }> {
  const res = await call(token, EVENTS, { method: 'POST', body: JSON.stringify(eventBody(d)) }, fetchImpl);
  if (!res.ok) throw new Error(`Google Calendar ${res.status}`);
  const body = (await res.json()) as { id: string; htmlLink?: string };
  return { eventId: body.id, link: body.htmlLink ?? null };
}

export async function updateGoogleEvent(token: string, eventId: string, d: EventDraft, fetchImpl: typeof fetch = fetch) {
  const res = await call(token, `${EVENTS}/${encodeURIComponent(eventId)}`, { method: 'PATCH', body: JSON.stringify(eventBody(d)) }, fetchImpl);
  if (!res.ok) throw new Error(`Google Calendar ${res.status}`);
}

/** Removing an event that is already gone is not an error. */
export async function deleteGoogleEvent(token: string, eventId: string, fetchImpl: typeof fetch = fetch) {
  const res = await call(token, `${EVENTS}/${encodeURIComponent(eventId)}`, { method: 'DELETE' }, fetchImpl);
  if (!res.ok && res.status !== 404 && res.status !== 410) throw new Error(`Google Calendar ${res.status}`);
}

export interface GoogleCalendarRead extends Array<GoogleEvent> {
  /** The Google account the calendars belong to. */
  account?: string;
  /** How many calendars were read. */
  calendars?: number;
  /** False when only the main calendar could be read: seeing the others needs one more permission. */
  allCalendars?: boolean;
}

const API = 'https://www.googleapis.com/calendar/v3';

/** Events on one calendar between two days, repeating ones expanded. */
async function eventsOn(token: string, calendarId: string, from: string, to: string, fetchImpl: typeof fetch): Promise<{ events: GoogleEvent[]; name?: string }> {
  const events: GoogleEvent[] = [];
  let name: string | undefined;
  let page: string | undefined;
  for (let i = 0; i < 4; i++) {
    const params = new URLSearchParams({
      timeMin: dayDate(from).toISOString(),
      timeMax: dayDate(to).toISOString(),
      singleEvents: 'true',
      orderBy: 'startTime',
      maxResults: '250',
      ...(page ? { pageToken: page } : {}),
    });
    const res = await fetchImpl(`${API}/calendars/${encodeURIComponent(calendarId)}/events?${params}`, { headers: { authorization: `Bearer ${token}` } });
    if (res.status === 401) throw Object.assign(new Error('Google access has run out'), { expired: true });
    if (!res.ok) throw new Error(`Google Calendar ${res.status}`);
    const body = (await res.json()) as { items?: any[]; nextPageToken?: string; summary?: string };
    name ??= body.summary;
    for (const e of body.items ?? []) {
      if (e.status === 'cancelled' || !e.start) continue;
      const allDay = Boolean(e.start.date);
      events.push({
        id: String(e.id),
        title: typeof e.summary === 'string' && e.summary.trim() ? e.summary.trim() : '(No title)',
        start: allDay ? e.start.date : e.start.dateTime,
        end: allDay ? (e.end?.date ?? e.start.date) : (e.end?.dateTime ?? e.start.dateTime),
        allDay,
        link: typeof e.htmlLink === 'string' ? e.htmlLink : null,
        // Some feeds put a web address where the place goes; that is not somewhere to be.
        location: typeof e.location === 'string' && e.location.trim() && !/^(https?|webcal):\/\//i.test(e.location.trim()) ? e.location.trim() : null,
      });
    }
    page = body.nextPageToken;
    if (!page) break;
  }
  return { events, name };
}

/**
 * Events on every calendar the student shows in Google Calendar (their own, shared ones, school,
 * holidays) between two days. Without the permission to list calendars, the main calendar only.
 */
export async function fetchGoogleEvents(token: string, from: string, to: string, fetchImpl: typeof fetch = fetch): Promise<GoogleCalendarRead> {
  const list = await fetchImpl(`${API}/users/me/calendarList?minAccessRole=reader&maxResults=100`, { headers: { authorization: `Bearer ${token}` } });
  if (list.status === 401) throw Object.assign(new Error('Google access has run out'), { expired: true });
  const out: GoogleCalendarRead = [];
  if (!list.ok) {
    // No permission to see the list: the main calendar is still readable.
    const { events, name } = await eventsOn(token, 'primary', from, to, fetchImpl);
    out.push(...events);
    out.account = name;
    out.calendars = 1;
    out.allCalendars = false;
    return out;
  }
  const body = (await list.json()) as { items?: { id: string; summary?: string; summaryOverride?: string; primary?: boolean; selected?: boolean; hidden?: boolean }[] };
  // The calendars ticked in Google Calendar's own sidebar, main one first.
  const calendars = (body.items ?? []).filter((c) => c.selected !== false && !c.hidden).sort((a, b) => Number(Boolean(b.primary)) - Number(Boolean(a.primary)));
  const results = await Promise.all(
    calendars.map((c) =>
      eventsOn(token, c.id, from, to, fetchImpl)
        .then((r) => ({ c, ...r }))
        .catch((e: { expired?: boolean }) => {
          if (e?.expired) throw e;
          return { c, events: [] as GoogleEvent[], name: undefined };
        }),
    ),
  );
  for (const { c, events } of results) {
    for (const e of events) out.push({ ...e, calendarId: c.id, calendarName: c.primary ? null : (c.summaryOverride ?? c.summary ?? null) });
  }
  out.account = calendars.find((c) => c.primary)?.id;
  out.calendars = calendars.length;
  out.allCalendars = true;
  return out;
}

const time = (iso: string) => new Date(iso).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });

/** Google events as calendar items: one per day they cover (up to two weeks for a long one). */
export function googleItems(events: GoogleEvent[], hideIds: Set<string> = new Set()): CxItem[] {
  const items: CxItem[] = [];
  for (const e of events) {
    if (hideIds.has(e.id)) continue;
    const where = e.calendarName ? [e.calendarName] : [];
    const key = e.calendarId ? `${e.calendarId}-${e.id}` : e.id;
    const base = { title: e.title, kind: 'google' as const, priority: 'should' as const, opportunityId: null, stepId: null, done: false, personalId: null, note: '', hours: null, link: e.link };
    if (e.allDay) {
      // The end date of an all-day event is the day after it ends.
      for (let day = e.start, n = 0; day < e.end && n < 14; day = addDays(day, 1), n++) {
        items.push({ ...base, id: `google-${key}-${day}`, day, date: dayDate(day).toISOString(), why: ['All day', e.location, ...where].filter(Boolean).join(' · ') });
      }
    } else {
      const day = dayKey(e.start);
      items.push({ ...base, id: `google-${key}`, day, date: new Date(e.start).toISOString(), why: [`${time(e.start)} – ${time(e.end)}`, e.location, ...where].filter(Boolean).join(' · ') });
    }
  }
  return items;
}

/**
 * The student's Google events for a range of days, kept fresh: read again when the range or the
 * Google access changes, every five minutes, and when the window comes back into focus.
 */
export function useGoogleEvents(
  from: string,
  to: string,
): { events: GoogleEvent[]; state: GoogleSyncState; updatedAt: number | null; account: string | null; calendars: number; allCalendars: boolean; refresh: () => void } {
  const auth = useAuth();
  const token = auth.google.calendar;
  const [events, setEvents] = useState<GoogleEvent[]>([]);
  const [state, setState] = useState<GoogleSyncState>(token ? 'loading' : 'off');
  const [updatedAt, setUpdatedAt] = useState<number | null>(null);
  const [account, setAccount] = useState<string | null>(null);
  const [calendars, setCalendars] = useState({ count: 0, all: false });
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const refresh = () => setTick((n) => n + 1);
    const timer = window.setInterval(refresh, 5 * 60_000);
    window.addEventListener('focus', refresh);
    return () => {
      clearInterval(timer);
      window.removeEventListener('focus', refresh);
    };
  }, []);

  useEffect(() => {
    if (!token) {
      setState('off');
      setEvents([]);
      return;
    }
    let stale = false;
    setState((s) => (s === 'ok' ? s : 'loading'));
    fetchGoogleEvents(token, from, to)
      .then((list) => {
        if (stale) return;
        setEvents(list);
        setAccount(list.account ?? null);
        setCalendars({ count: list.calendars ?? 1, all: list.allCalendars === true });
        setState('ok');
        setUpdatedAt(Date.now());
      })
      .catch((e: { expired?: boolean }) => !stale && setState(e?.expired ? 'expired' : 'error'));
    return () => {
      stale = true;
    };
  }, [token, from, to, tick]);

  return { events, state, updatedAt, account, calendars: calendars.count, allCalendars: calendars.all, refresh: () => setTick((n) => n + 1) };
}
