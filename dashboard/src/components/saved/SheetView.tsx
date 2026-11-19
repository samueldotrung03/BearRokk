// The saved list as a spreadsheet: one row per saved posting with its status, deadline, details
// and every link. This sheet is always here, with its columns set even before anything is saved.
// The rows come from the backend, so this table and a Google Sheet made from it say the same
// thing. "Create Google Sheet" asks Google for access and makes a new sheet in the student's
// Drive, which then updates on its own while Google Sheets is connected.
import { Download, ExternalLink, Sheet, Unlink } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useAuth } from '../../auth/AuthProvider.tsx';
import { authMessage } from '../../auth/errors.ts';
import { relativeTime } from '../../lib/time.ts';
import { useLive } from '../../state/live.tsx';

interface SheetData {
  header: string[];
  rows: string[][];
  ids: string[];
}

const isUrl = (v: string) => /^https?:\/\//.test(v);

/** The sheet's columns, the same as the backend's TRACKER_HEADER, so the sheet has them before it loads. */
export const SHEET_COLUMNS = [
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

/** Blank rows below the last entry, so it reads as a sheet waiting to be filled. */
const MIN_ROWS = 14;

/** A cell: links become links, the calendar column's "Add: <link>" a short one. */
function Cell({ value, column }: { value: string; column: string }) {
  if (!value) return <span className="text-ink-3">—</span>;
  if (value.startsWith('Add: ') && isUrl(value.slice(5)))
    return (
      <a href={value.slice(5)} target="_blank" rel="noreferrer" className="font-medium text-brand hover:underline">
        Add to calendar
      </a>
    );
  if (value.startsWith('Another listing: ') && isUrl(value.slice(17)))
    return (
      <a href={value.slice(17)} target="_blank" rel="noreferrer" className="text-brand hover:underline">
        Another listing
      </a>
    );
  if (isUrl(value)) {
    const label = column === 'Calendar' ? 'Open event' : column === 'Apply link' ? 'Apply' : column === 'Official page' ? 'Open' : 'Link';
    return (
      <a href={value} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 font-medium text-brand hover:underline">
        {label}
        <ExternalLink className="size-3" aria-hidden="true" />
      </a>
    );
  }
  return <>{value}</>;
}

const csv = (rows: string[][]) => rows.map((r) => r.map((v) => (/[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v)).join(',')).join('\n');

export function SheetView({ refreshKey }: { refreshKey: string }) {
  const auth = useAuth();
  const live = useLive();
  const [data, setData] = useState<SheetData | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [busy, setBusy] = useState<'link' | 'sync' | null>(null);
  // The sheet updates itself (live.tsx); this view only writes once, when the sheet is created.
  const [message, setMessage] = useState<string | null>(null);
  const linking = useRef<AbortController | null>(null);
  // Leaving the page stops waiting for Google.
  useEffect(() => () => linking.current?.abort(), []);

  // Read again whenever what is saved, or where it stands, changes.
  useEffect(() => {
    let stale = false;
    void live
      .request('/sheet')
      .then(async (res) => {
        if (!res.ok) throw new Error(String(res.status));
        const body = (await res.json()) as SheetData;
        if (!stale) {
          setData(body);
          setLoadError(false);
        }
      })
      .catch(() => !stale && setLoadError(true));
    return () => {
      stale = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refreshKey, live.status]);

  const sync = async (token: string) => {
    setBusy('sync');
    setMessage(null);
    const res = await live.request('/sheet/sync', { method: 'POST', headers: { 'x-google-access-token': token } }).catch(() => null);
    const body = res ? ((await res.json().catch(() => ({}))) as { error?: string }) : { error: 'The backend cannot be reached.' };
    setMessage(res?.ok ? (live.sheet ? 'Your Google Sheet is up to date.' : 'Your Google Sheet is created in your Drive.') : `Could not write to Google Sheets: ${body.error ?? 'unknown error'}`);
    setBusy(null);
  };

  // Create: ask Google for Sheets access if this session has none, then make the sheet in their Drive.
  // Clicking again while Google's tab is open starts over, so a closed tab never leaves it stuck.
  const link = async () => {
    linking.current?.abort();
    setBusy(null);
    setMessage(null);
    try {
      let token = auth.google.sheets;
      if (!token) {
        const controller = new AbortController();
        linking.current = controller;
        setMessage('Finish in the Google tab that opened. Closed it? Press the button again.');
        await auth.connectGoogle('sheets', controller.signal);
        if (linking.current !== controller) return;
        // The new token reaches this component on the next render; the backend gets it from there.
        setBusy(null);
        setMessage('Google Sheets connected. Creating your sheet…');
        return;
      }
      await sync(token);
    } catch (e) {
      // Started over or cancelled: nothing to report.
      if (e instanceof DOMException && e.name === 'AbortError') return;
      setMessage(authMessage(e));
      setBusy(null);
    }
  };

  // Right after connecting, write the sheet once with the new token.
  const pendingFirstWrite = message === 'Google Sheets connected. Creating your sheet…';
  useEffect(() => {
    if (pendingFirstWrite && auth.google.sheets) void sync(auth.google.sheets);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingFirstWrite, auth.google.sheets]);

  const download = () => {
    if (!data) return;
    const blob = new Blob([csv([data.header, ...data.rows])], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `bearrok-saved-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const sheet = live.sheet;
  const connected = Boolean(auth.google.sheets);
  const signedIn = auth.status === 'signedIn';
  const header = useMemo(() => (data?.header.length ? data.header : SHEET_COLUMNS), [data]);
  const rows = data?.rows ?? [];
  const blanks = Math.max(0, MIN_ROWS - rows.length);

  return (
    <div className="saved-sheet">
      <div className="saved-sheet-bar">
        <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-emerald-50 text-emerald-700" aria-hidden="true">
          <Sheet className="size-5" />
        </span>
        <div className="min-w-0 flex-1">
          {sheet ? (
            <>
              <p className="text-sm font-semibold text-ink">Also in your Google Sheet</p>
              <p className="text-sm text-ink-2">
                {connected ? 'Updates on its own whenever you save, unsave or change a status.' : 'Google access has run out, so it is not updating. Connect Google Sheets to resume; nothing is lost meanwhile.'} Last updated{' '}
                {relativeTime(sheet.syncedAt)}.
              </p>
            </>
          ) : (
            <>
              <p className="text-sm font-semibold text-ink">Your saved list as a spreadsheet</p>
              <p className="text-sm text-ink-2">Every saved opportunity is logged here with its details and application links. Create a Google Sheet to have a copy in your own Drive.</p>
            </>
          )}
          {message && <p className="mt-1 text-sm text-ink-2">{message}</p>}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {sheet && (
            <a href={sheet.url} target="_blank" rel="noreferrer" className="inline-flex h-10 items-center gap-1.5 rounded-xl border border-line bg-white px-3.5 text-sm font-semibold text-ink">
              Open in Google Sheets <ExternalLink className="size-3.5" aria-hidden="true" />
            </a>
          )}
          {!(sheet && connected) && signedIn && (
            <button type="button" onClick={() => void link()} disabled={busy !== null} className="btn-primary inline-flex h-10 items-center gap-1.5 rounded-xl px-3.5 text-sm font-semibold text-white disabled:opacity-60">
              <Sheet className="size-4" aria-hidden="true" /> {sheet ? 'Connect Google Sheets' : 'Create Google Sheet'}
            </button>
          )}
          <button type="button" onClick={download} disabled={!data?.rows.length} className="inline-flex h-10 items-center gap-1.5 rounded-xl border border-line bg-white px-3.5 text-sm font-semibold text-ink disabled:opacity-50">
            <Download className="size-4" aria-hidden="true" /> Download
          </button>
          {sheet && (
            <button
              type="button"
              onClick={() => void live.request('/sheet', { method: 'DELETE' })}
              title="Stop updating this Google Sheet. The file stays in your Drive, and Create Google Sheet makes a new one."
              className="inline-flex h-10 items-center gap-1.5 rounded-xl px-2.5 text-sm font-semibold text-ink-3 hover:text-ink"
            >
              <Unlink className="size-4" aria-hidden="true" /> Unlink
            </button>
          )}
        </div>
      </div>

      {(loadError || !data || rows.length === 0) && (
        <p className="border-b border-line px-5 py-2.5 text-sm text-ink-3">
          {loadError
            ? 'Your saved list cannot be loaded right now; it fills in here once the app can reach your account.'
            : !data
              ? 'Loading your saved list…'
              : 'Nothing saved yet. Save cards in the feed and each one is logged here as a row.'}
        </p>
      )}
      <div className="saved-sheet-scroll" tabIndex={0} aria-label="Saved opportunities spreadsheet">
        <table className="saved-sheet-table">
          <thead>
            <tr>
              <th scope="col" className="saved-sheet-num">
                <span className="sr-only">Row</span>
              </th>
              {header.map((h) => (
                <th key={h} scope="col" data-column={h}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <tr key={data?.ids[i] ?? i}>
                <td className="saved-sheet-num">{i + 1}</td>
                {row.map((value, j) => (
                  <td key={j} data-column={header[j]} className={j === 0 ? 'font-semibold text-ink' : undefined}>
                    <Cell value={value} column={header[j] ?? ''} />
                  </td>
                ))}
              </tr>
            ))}
            {Array.from({ length: blanks }, (_, i) => (
              <tr key={`blank-${i}`} className="saved-sheet-blank" aria-hidden="true">
                <td className="saved-sheet-num">{rows.length + i + 1}</td>
                {header.map((h) => (
                  <td key={h} data-column={h} />
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
