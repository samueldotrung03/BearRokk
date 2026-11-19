// Getting calendar items out of BearRok: one .ics file for a list of items, and a Google Calendar
// link per item. Application deadlines reuse the helper in src/lib/applications.ts, so the
// Applications page and the calendar make the same entry for the same deadline.
import { googleCalendarUrl } from '../applications.ts';
import type { Opportunity } from '../../types.ts';
import { addDays } from './days.ts';
import { cxKindLabel, type CxItem } from './items.ts';

const stamp = (day: string) => day.replaceAll('-', '');
const escape = (text: string) => text.replace(/[\\;,]/g, (c) => `\\${c}`).replace(/\r?\n/g, '\\n');

/** RFC 5545 asks for lines of at most 75 octets, continued with a leading space. */
function fold(line: string): string {
  const parts: string[] = [];
  let rest = line;
  while (new TextEncoder().encode(rest).length > 75) {
    let cut = 74;
    while (new TextEncoder().encode(rest.slice(0, cut)).length > 74) cut -= 1;
    parts.push(rest.slice(0, cut));
    rest = rest.slice(cut);
  }
  parts.push(rest);
  return parts.join('\r\n ');
}

const summaryOf = (item: CxItem) =>
  `${item.priority === 'must' ? 'Have to do' : 'Should do'} · ${cxKindLabel[item.kind]}: ${item.title}`;

/** All-day entries, one per item, in a single calendar file. */
export function icsCalendar(items: CxItem[], now = new Date()): string {
  const dtstamp = `${now.toISOString().replace(/[-:]/g, '').slice(0, 15)}Z`;
  const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//BearRok//Calendar//EN', 'CALSCALE:GREGORIAN', 'X-WR-CALNAME:BearRok'];
  for (const item of items) {
    lines.push(
      'BEGIN:VEVENT',
      `UID:${item.id}@bearrok`,
      `DTSTAMP:${dtstamp}`,
      `DTSTART;VALUE=DATE:${stamp(item.day)}`,
      `DTEND;VALUE=DATE:${stamp(addDays(item.day, 1))}`,
      `SUMMARY:${escape(summaryOf(item))}`,
      `DESCRIPTION:${escape(`${item.done ? 'Done. ' : ''}Why: ${item.why}`)}`,
      'END:VEVENT',
    );
  }
  lines.push('END:VCALENDAR');
  return lines.map(fold).join('\r\n') + '\r\n';
}

/** A link that opens Google Calendar with the item filled in as an all-day entry. */
export function googleUrlFor(item: CxItem, opportunity?: Opportunity): string {
  if (item.kind === 'deadline' && opportunity) {
    const shared = googleCalendarUrl(opportunity);
    if (shared) return shared;
  }
  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: summaryOf(item),
    dates: `${stamp(item.day)}/${stamp(addDays(item.day, 1))}`,
    details: `Why: ${item.why}`,
  });
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}
