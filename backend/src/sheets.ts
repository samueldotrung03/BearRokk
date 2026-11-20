// Google Sheets: write the student's application tracker to a new spreadsheet in their own Drive.
// Uses the student's Google access token (spreadsheets permission) for that one call; it is not stored.
import type { Application, Opportunity } from './agents/types.ts';

const STATUS_LABEL: Record<Application['status'], string> = { interested: 'Interested', to_apply: 'To apply', applying: 'Applying', applied: 'Applied' };
const HEADER = ['Opportunity', 'Organizer', 'Status', 'Deadline', 'Next reminder', 'Apply at', 'Materials', 'Prompts'];

export function sheetRows(applications: Application[]): string[][] {
  return [
    HEADER,
    ...applications.map((a) => [
      a.title,
      a.organizer,
      STATUS_LABEL[a.status],
      a.deadline ? a.deadline.slice(0, 10) : 'Unknown',
      a.reminders[0] ? `${a.reminders[0].at.slice(0, 10)} (${a.reminders[0].label})` : '',
      a.actionUrl ?? '',
      a.materials.join(', '),
      a.prompts.join(' | '),
    ]),
  ];
}

export async function exportApplications(accessToken: string, applications: Application[], today: Date, fetchImpl: typeof fetch = fetch): Promise<{ spreadsheetId: string; url: string }> {
  const cell = (value: string, bold = false) => ({ userEnteredValue: { stringValue: value }, ...(bold ? { userEnteredFormat: { textFormat: { bold: true } } } : {}) });
  const rows = sheetRows(applications);
  const res = await fetchImpl('https://sheets.googleapis.com/v4/spreadsheets', {
    method: 'POST',
    headers: { authorization: `Bearer ${accessToken}`, 'content-type': 'application/json' },
    signal: AbortSignal.timeout(20_000),
    body: JSON.stringify({
      properties: { title: `BearRok applications ${today.toISOString().slice(0, 10)}` },
      sheets: [
        {
          properties: { title: 'Applications', gridProperties: { frozenRowCount: 1 } },
          data: [{ startRow: 0, startColumn: 0, rowData: rows.map((row, i) => ({ values: row.map((v) => cell(v, i === 0)) })) }],
        },
      ],
    }),
  });
  if (!res.ok) throw new Error(`Google Sheets ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const body = (await res.json()) as { spreadsheetId: string; spreadsheetUrl?: string };
  return { spreadsheetId: body.spreadsheetId, url: body.spreadsheetUrl ?? `https://docs.google.com/spreadsheets/d/${body.spreadsheetId}` };
}

// ---- the Saved tracker: every saved posting with its details and links, in one sheet ----------


/** One row's worth: the posting, where the student stands on it, and when they saved it. */
export interface TrackerItem {
  opportunity: Opportunity | null;
  application: Application | null;
  savedAt: string | null;
}

export const TRACKER_HEADER = [
  'Opportunity',
  'Organizer',
  'Type',
  'Status',
  'Deadline',
  'Days left',
  'Deadline from',
  'Starts',
  'Format',
  'Location',
  'Who can apply',
  'Apply link',
  'Official page',
  'Materials needed',
  'Application questions',
  'Calendar',
  'Next reminder',
  'Saved on',
  'Fit',
];

const TYPE_LABEL: Record<string, string> = { internship: 'Internship', event: 'Event', club: 'Club', hackathon: 'Hackathon', research: 'Research', scholarship: 'Scholarship' };
const FORMAT_LABEL: Record<string, string> = { online: 'Online', in_person: 'In person', hybrid: 'Hybrid' };

/** The tracker as rows of text, header first. The same rows feed the app's sheet and the Google Sheet. */
export function trackerRows(items: TrackerItem[], now: Date): string[][] {
  const day = (iso: string | null | undefined) => (iso ? iso.slice(0, 10) : '');
  return [
    TRACKER_HEADER,
    ...items.map(({ opportunity: o, application: a, savedAt }) => {
      const deadline = a?.deadline ?? o?.deadline ?? null;
      const days = deadline ? Math.ceil((Date.parse(deadline) - now.getTime()) / 86_400_000) : null;
      const source = deadline ? (o?.deadlineSource === 'listing' ? `Another listing: ${o.evidence.find((e) => e.field === 'deadline')?.url ?? ''}`.trim() : a && !o?.deadline ? 'Added by you' : "Organizer's page") : '';
      return [
        o?.title ?? a?.title ?? '',
        o?.organizer ?? a?.organizer ?? '',
        o ? (TYPE_LABEL[o.type] ?? o.type) : '',
        STATUS_LABEL[a?.status ?? 'interested'],
        deadline ? day(deadline) : 'Not stated',
        days === null ? '' : days < 0 ? 'Passed' : String(days),
        source,
        day(o?.startTime),
        o?.format ? FORMAT_LABEL[o.format] ?? o.format : '',
        o?.location ?? '',
        o?.eligibility ?? '',
        a?.actionUrl ?? o?.actionUrl ?? o?.sourceUrl ?? '',
        o?.sourceUrl ?? '',
        (a?.materials.length ? a.materials : (o?.application?.materials ?? [])).join(', '),
        (a?.prompts.length ? a.prompts : (o?.application?.prompts ?? [])).join(' | '),
        a?.calendar.state === 'synced' ? (a.calendar.htmlLink ?? 'On Google Calendar') : a && (a.status === 'to_apply' || a.status === 'applying') ? (deadline ? 'Added once Google Calendar is connected' : 'Needs a deadline') : '',
        a?.reminders[0] ? `${day(a.reminders[0].at)} (${a.reminders[0].label})` : '',
        day(savedAt),
        o ? `${Math.round(o.baseScore * 100)}%` : '',
      ];
    }),
  ];
}

const SHEET_TAB = 'Saved';

/**
 * Write the tracker to the student's linked Google Sheet, replacing what was there, or make a new
 * sheet when none is linked or the linked one is gone. Uses the student's access token for this
 * call only; it is not stored.
 */
export async function writeTracker(
  accessToken: string,
  linked: { spreadsheetId: string } | null,
  rows: string[][],
  today: Date,
  fetchImpl: typeof fetch = fetch,
): Promise<{ spreadsheetId: string; url: string }> {
  const headers = { authorization: `Bearer ${accessToken}`, 'content-type': 'application/json' };
  const api = 'https://sheets.googleapis.com/v4/spreadsheets';
  if (linked) {
    const id = encodeURIComponent(linked.spreadsheetId);
    const range = encodeURIComponent(`${SHEET_TAB}!A1:Z`);
    const clear = await fetchImpl(`${api}/${id}/values/${range}:clear`, { method: 'POST', headers, body: '{}', signal: AbortSignal.timeout(20_000) });
    // A sheet the student deleted, renamed the tab of, or that belongs to another Google account
    // than the one now connected is replaced by a new one; anything else is an error.
    if (clear.ok) {
      const put = await fetchImpl(`${api}/${id}/values/${encodeURIComponent(`${SHEET_TAB}!A1`)}?valueInputOption=RAW`, {
        method: 'PUT',
        headers,
        body: JSON.stringify({ values: rows }),
        signal: AbortSignal.timeout(20_000),
      });
      if (!put.ok) throw new Error(`Google Sheets ${put.status}: ${(await put.text()).slice(0, 200)}`);
      return { spreadsheetId: linked.spreadsheetId, url: `https://docs.google.com/spreadsheets/d/${linked.spreadsheetId}` };
    }
    if (clear.status !== 404 && clear.status !== 400 && clear.status !== 403) throw new Error(`Google Sheets ${clear.status}: ${(await clear.text()).slice(0, 200)}`);
  }
  const cell = (value: string, bold = false) => ({ userEnteredValue: { stringValue: value }, ...(bold ? { userEnteredFormat: { textFormat: { bold: true } } } : {}) });
  const res = await fetchImpl(api, {
    method: 'POST',
    headers,
    signal: AbortSignal.timeout(20_000),
    body: JSON.stringify({
      properties: { title: `BearRok saved opportunities (${today.toISOString().slice(0, 10)})` },
      sheets: [
        {
          properties: { title: SHEET_TAB, gridProperties: { frozenRowCount: 1 } },
          data: [{ startRow: 0, startColumn: 0, rowData: rows.map((row, i) => ({ values: row.map((v) => cell(v, i === 0)) })) }],
        },
      ],
    }),
  });
  if (!res.ok) throw new Error(`Google Sheets ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const body = (await res.json()) as { spreadsheetId: string; spreadsheetUrl?: string };
  return { spreadsheetId: body.spreadsheetId, url: body.spreadsheetUrl ?? `https://docs.google.com/spreadsheets/d/${body.spreadsheetId}` };
}
