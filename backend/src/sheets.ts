// Google Sheets: write the student's application tracker to a new spreadsheet in their own Drive.
// Uses the student's Google access token (spreadsheets permission) for that one call; it is not stored.
import type { Application } from './agents/types.ts';

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
