// The side column of the calendar, after Starship's: Schedule recommendation (the day's brief,
// clashes and the week planner) and the Google Calendar connection (which account, how many
// calendars, the Career only filter). Deadlines are their own card (UpcomingDeadlines).
import { ArrowRight, ArrowUpRight, CalendarDays, Sparkles, TriangleExclamationPoint } from 'lucide-react';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useAuth } from '../../auth/AuthProvider.tsx';
import type { Brief } from '../../lib/cal/brief.ts';
import { shortDay } from '../../lib/cal/days.ts';
import type { GoogleSyncState } from '../../lib/cal/google.ts';
import type { Conflict } from '../../lib/cal/items.ts';
import { ConnectCalendar } from '../CalendarStatus.tsx';

export function SideCard({ title, icon, children }: { title: string; icon?: ReactNode; children: ReactNode }) {
  return (
    <section className="cx-side">
      <div className="cx-side-head">
        <h2>{title}</h2>
        {icon}
      </div>
      {children}
    </section>
  );
}

export function ScheduleCard({
  brief,
  today,
  clashes,
  planOpen,
  onTogglePlan,
  onJump,
  source,
}: {
  /** Who wrote this: says plainly when it is fixed rules rather than the agents. */
  source: string;
  brief: Brief;
  today: string;
  clashes: Conflict[];
  planOpen: boolean;
  onTogglePlan: () => void;
  onJump: (day: string) => void;
}) {
  return (
    <SideCard title="Schedule recommendation" icon={<Sparkles className="size-4 text-brand" aria-hidden="true" />}>
      <p className="text-[15px] leading-snug font-semibold text-ink">{brief.headline}</p>
      {brief.lines.length > 0 && (
        <ul className="mt-2 grid gap-1.5">
          {brief.lines.slice(0, 3).map((line, i) => (
            <li key={i} className="flex items-start gap-2 text-sm leading-snug text-ink-2">
              <span className="cx-side-dot mt-1.5" data-tone={line.tone} aria-hidden="true" />
              <span className="min-w-0 flex-1">{line.text}</span>
              {line.day && line.day !== today && (
                <button type="button" onClick={() => onJump(line.day!)} className="shrink-0 text-xs font-semibold text-brand" aria-label={`Show ${shortDay(line.day)}`}>
                  Show <ArrowRight className="inline size-3" aria-hidden="true" />
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
      {clashes.length > 0 && (
        <div className="mt-3 grid gap-1">
          {clashes.slice(0, 3).map((c) => (
            <button key={c.day} type="button" onClick={() => onJump(c.day)} className="flex items-center gap-1.5 text-left text-sm font-medium text-orange-700">
              <TriangleExclamationPoint className="size-3.5 shrink-0" strokeWidth={2.5} aria-hidden="true" />
              <span className="min-w-0 flex-1 truncate">
                {shortDay(c.day)}: {c.items.map((i) => i.title).join(' + ')}
              </span>
            </button>
          ))}
        </div>
      )}
      <button type="button" onClick={onTogglePlan} className="mt-4 inline-flex h-9 items-center rounded-lg border border-line bg-white px-3 text-sm font-semibold text-ink" aria-pressed={planOpen}>
        {planOpen ? 'Hide the week plan' : 'Plan my week'}
      </button>
      <p className="mt-3 text-xs text-ink-3">{source}</p>
    </SideCard>
  );
}

/** Connect a different Google account in place of the one connected now. */
function SwitchAccount() {
  const auth = useAuth();
  const [waiting, setWaiting] = useState(false);
  const attempt = useRef<AbortController | null>(null);
  useEffect(() => () => attempt.current?.abort(), []);
  return (
    <button
      type="button"
      className="text-sm font-semibold text-brand hover:underline"
      onClick={async () => {
        attempt.current?.abort();
        const controller = new AbortController();
        attempt.current = controller;
        setWaiting(true);
        try {
          await auth.connectGoogle('calendar', controller.signal, { switchAccount: true });
        } catch {
          // The card shows the state on the next read.
        } finally {
          if (attempt.current === controller) setWaiting(false);
        }
      }}
    >
      {waiting ? 'Waiting for Google… (click to reopen)' : 'Use a different account'}
    </button>
  );
}

export function GoogleCard({
  state,
  account,
  calendars,
  allCalendars,
  updatedAt,
  careerNote,
}: {
  state: GoogleSyncState;
  account: string | null;
  calendars: number;
  allCalendars: boolean;
  updatedAt: number | null;
  careerNote: string | null;
}) {
  const ago = updatedAt ? Math.round((Date.now() - updatedAt) / 60_000) : null;
  const status = state === 'ok' ? 'Connected' : state === 'loading' ? 'Checking…' : state === 'expired' ? 'Access ran out' : state === 'error' ? 'Could not be read' : 'Not connected';
  return (
    <SideCard title="Google Calendar">
      <div className="flex items-start gap-3">
        <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-canvas text-ink-2" aria-hidden="true">
          <CalendarDays className="size-5" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-1.5 text-sm font-semibold text-ink">
            <span className="cx-side-status" data-state={state} aria-hidden="true" />
            {status}
          </p>
          {account && <p className="truncate text-sm text-ink-2" title={account}>{account}</p>}
          {state === 'ok' && (
            <p className="text-xs text-ink-3">
              {allCalendars ? `${calendars} ${calendars === 1 ? 'calendar' : 'calendars'}` : 'Main calendar'} · updated {ago === 0 || ago === null ? 'just now' : `${ago} min ago`}
            </p>
          )}
        </div>
      </div>
      {state === 'ok' ? (
        <>
          <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1">
            <a href={`https://calendar.google.com/calendar/r${account ? `?authuser=${encodeURIComponent(account)}` : ''}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-sm font-semibold text-brand hover:underline">
              Open Google Calendar <ArrowUpRight className="size-3.5" aria-hidden="true" />
            </a>
            <SwitchAccount />
          </div>
          {/* Only career-related Google events are shown; this says how many personal ones are left out. */}
          {careerNote && <p className="mt-3 border-t border-line pt-3 text-xs text-ink-3">{careerNote}</p>}
        </>
      ) : state === 'loading' ? null : (
        <div className="mt-3">
          <ConnectCalendar />
        </div>
      )}
    </SideCard>
  );
}
