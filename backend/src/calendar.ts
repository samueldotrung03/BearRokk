// Google Calendar: put an application deadline on the student's own calendar.
// The browser gets a Google access token with the calendar.events permission at sign-in and passes
// it along with the request. The backend uses it for that one call and does not store it.

export interface DeadlineEvent {
  title: string;
  /** ISO time of the deadline. The event is placed on that calendar day. */
  deadline: string;
  description: string;
}

export interface CalendarResult {
  eventId: string;
  htmlLink: string | null;
}

const API = 'https://www.googleapis.com/calendar/v3/calendars/primary/events';
const DAY = 86_400_000;
const day = (iso: string, addDays = 0) => new Date(Date.parse(iso) + addDays * DAY).toISOString().slice(0, 10);

/** Pop-up reminders Google shows before an all-day event: a week before, two days before, and that morning. */
const REMINDER_MINUTES = [7 * 24 * 60, 2 * 24 * 60, 0];

export function eventBody(e: DeadlineEvent) {
  return {
    summary: e.title,
    description: e.description,
    start: { date: day(e.deadline) },
    end: { date: day(e.deadline, 1) },
    transparency: 'transparent',
    reminders: { useDefault: false, overrides: REMINDER_MINUTES.map((minutes) => ({ method: 'popup', minutes })) },
  };
}

export async function createDeadlineEvent(accessToken: string, e: DeadlineEvent, fetchImpl: typeof fetch = fetch): Promise<CalendarResult> {
  const res = await fetchImpl(API, {
    method: 'POST',
    headers: { authorization: `Bearer ${accessToken}`, 'content-type': 'application/json' },
    body: JSON.stringify(eventBody(e)),
    signal: AbortSignal.timeout(15_000),
  });
  if (!res.ok) throw new Error(`Google Calendar ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const body = (await res.json()) as { id: string; htmlLink?: string };
  return { eventId: body.id, htmlLink: body.htmlLink ?? null };
}

export async function deleteEvent(accessToken: string, eventId: string, fetchImpl: typeof fetch = fetch): Promise<void> {
  const res = await fetchImpl(`${API}/${encodeURIComponent(eventId)}`, {
    method: 'DELETE',
    headers: { authorization: `Bearer ${accessToken}` },
    signal: AbortSignal.timeout(15_000),
  });
  // Already gone counts as deleted.
  if (!res.ok && res.status !== 404 && res.status !== 410) throw new Error(`Google Calendar ${res.status}`);
}

/** A link that opens Google Calendar with the event filled in. Works without any permission. */
export function addToCalendarUrl(e: DeadlineEvent): string {
  const compact = (d: string) => d.replaceAll('-', '');
  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: e.title,
    dates: `${compact(day(e.deadline))}/${compact(day(e.deadline, 1))}`,
    details: e.description,
  });
  return `https://calendar.google.com/calendar/render?${params}`;
}
