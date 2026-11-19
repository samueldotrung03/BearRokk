// Every tracked deadline in one .ics file. Each entry reuses the single-deadline file from
// src/lib/applications.ts, so the calendar entries match the per-application download exactly.
// Alarms are added only while the student still has to send it (to apply or applying), the same
// rule the on-page reminders follow. Applied ones and postings without a deadline are left out.
import { icsFile } from '../applications.ts';
import type { ApplicationStatus, Opportunity } from '../../types.ts';

const ALARMS = [
  { trigger: '-P7D', text: '7 days before' },
  { trigger: '-P2D', text: '2 days before' },
  // All-day entries start at midnight; nine hours in is a reminder the student will see.
  { trigger: 'PT9H', text: 'On the day' },
];

// Commas, semicolons and backslashes are separators in .ics text, so they are escaped.
const icsText = (text: string) => text.replace(/[\\;,]/g, (c) => `\\${c}`);

export function wantsReminders(status: ApplicationStatus): boolean {
  return status === 'to_apply' || status === 'applying';
}

/** The items the export would include, so the page can say how many before downloading. */
export function exportable(items: { opportunity: Opportunity; status: ApplicationStatus }[]) {
  return items.filter(({ opportunity, status }) => opportunity.deadline !== null && status !== 'applied');
}

export function allDeadlinesIcs(items: { opportunity: Opportunity; status: ApplicationStatus }[]): string | null {
  const events = exportable(items).flatMap(({ opportunity, status }) => {
    const lines = (icsFile(opportunity) ?? '').split('\r\n');
    const start = lines.indexOf('BEGIN:VEVENT');
    const end = lines.indexOf('END:VEVENT');
    if (start < 0 || end < 0) return [];
    const alarms = wantsReminders(status)
      ? ALARMS.flatMap(({ trigger, text }) => ['BEGIN:VALARM', 'ACTION:DISPLAY', `TRIGGER:${trigger}`, `DESCRIPTION:${icsText(`${text}: ${opportunity.title}`)}`, 'END:VALARM'])
      : [];
    return [...lines.slice(start, end), ...alarms, 'END:VEVENT'];
  });
  if (events.length === 0) return null;
  return ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//BearRok//Applications//EN', 'X-WR-CALNAME:BearRok deadlines', ...events, 'END:VCALENDAR'].join('\r\n');
}
