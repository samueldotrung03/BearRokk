// The application manager's rules, kept apart from the pages so they can be tested. They follow
// section 6 of backend/AGENT_SYSTEM.md: four statuses, reminders at 7 days, 2 days and the day of
// the deadline while the student still has to apply, and a calendar entry that needs no sign-in.
import type { Application, ApplicationInfo, ApplicationStatus, Opportunity } from '../types.ts';

export const STATUSES: ApplicationStatus[] = ['interested', 'to_apply', 'applying', 'applied'];

export const statusLabel: Record<ApplicationStatus, string> = {
  interested: 'Interested',
  to_apply: 'To apply',
  applying: 'Applying',
  applied: 'Applied',
};

const DAY = 86_400_000;

export interface Reminder {
  label: string;
  at: string;
  /** The reminder's day has already gone by. */
  past: boolean;
}

/** Reminders exist only while there is still something to send, and only when a deadline is known. */
export function remindersFor(status: ApplicationStatus, deadline: string | null, now = Date.now()): Reminder[] {
  if (!deadline || (status !== 'to_apply' && status !== 'applying')) return [];
  const due = new Date(deadline).getTime();
  return [
    { label: '7 days before', days: 7 },
    { label: '2 days before', days: 2 },
    { label: 'On the day', days: 0 },
  ].map(({ label, days }) => {
    const at = due - days * DAY;
    return { label, at: new Date(at).toISOString(), past: at < now };
  });
}

/** How much of an application is finished: materials ticked off plus prompts with a draft. */
export function progressOf(application: Application, info: ApplicationInfo | undefined): { done: number; total: number } {
  if (!info) return { done: 0, total: 0 };
  const drafted = info.prompts.filter((_, index) => (application.drafts[index] ?? '').trim() !== '').length;
  const gathered = info.materials.filter((name) => application.materialsDone.includes(name)).length;
  return { done: drafted + gathered, total: info.prompts.length + info.materials.length };
}

const pad = (value: number) => String(value).padStart(2, '0');
const dateStamp = (date: Date) => `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}`;

/** An all-day entry on the deadline: the start day and, as calendars expect, the day after. */
function allDay(deadline: string): [string, string] {
  const start = new Date(deadline);
  return [dateStamp(start), dateStamp(new Date(start.getFullYear(), start.getMonth(), start.getDate() + 1))];
}

const eventTitle = (o: Opportunity) => `Deadline: ${o.title} (${o.organizer})`;
const eventDetails = (o: Opportunity) => `Apply here: ${o.actionUrl ?? o.sourceUrl}`;

/** A link that opens Google Calendar with the deadline filled in. Needs no sign-in from the app. */
export function googleCalendarUrl(o: Opportunity): string | null {
  if (!o.deadline) return null;
  const [start, end] = allDay(o.deadline);
  const params = new URLSearchParams({ action: 'TEMPLATE', text: eventTitle(o), dates: `${start}/${end}`, details: eventDetails(o) });
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

const icsText = (text: string) => text.replace(/[\\;,]/g, (c) => `\\${c}`).replace(/\n/g, '\\n');

/** The same deadline as an .ics file, for Apple Calendar, Outlook and the rest. */
export function icsFile(o: Opportunity): string | null {
  if (!o.deadline) return null;
  const [start, end] = allDay(o.deadline);
  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//BearRok//Applications//EN',
    'BEGIN:VEVENT',
    `UID:${o.id}@bearrok`,
    `DTSTAMP:${dateStamp(new Date())}T000000Z`,
    `DTSTART;VALUE=DATE:${start}`,
    `DTEND;VALUE=DATE:${end}`,
    `SUMMARY:${icsText(eventTitle(o))}`,
    `DESCRIPTION:${icsText(eventDetails(o))}`,
    'END:VEVENT',
    'END:VCALENDAR',
  ].join('\r\n');
}
