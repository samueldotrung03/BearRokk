// The application deadlines coming up: everything marked To apply or Applying on the Saved page,
// soonest first, with whether each is on the student's Google Calendar. While Google Calendar is
// connected the app adds and moves these events itself.
import { CalendarCheck } from 'lucide-react';
import { statusLabel } from '../../lib/applications.ts';
import { dayKey } from '../../lib/calendar.ts';
import { daysUntil, dueLabel, shortDate } from '../../lib/time.ts';
import { useLive } from '../../state/live.tsx';
import { useStore } from '../../state/StoreProvider.tsx';
import type { Opportunity } from '../../types.ts';
import { CalendarStatus, ConnectCalendar } from '../CalendarStatus.tsx';
import type { GoogleSyncState } from '../../lib/cal/google.ts';

export function UpcomingDeadlines({
  found,
  onSelect,
  onOpen,
  googleState = 'off',
  googleAccount = null,
}: {
  found: Opportunity[];
  onSelect: (day: string) => void;
  onOpen: (o: Opportunity) => void;
  /** Connected is only claimed once the calendar has actually been read. */
  googleState?: GoogleSyncState;
  googleAccount?: string | null;
}) {
  const live = useLive();
  const { state } = useStore();
  const byId = new Map(found.map((o) => [o.id, o]));
  const items = Object.entries(state.applications)
    .filter(([, a]) => a.status === 'to_apply' || a.status === 'applying')
    .map(([id, a]) => {
      const o = byId.get(id);
      const deadline = live.applications[id]?.deadline ?? o?.deadline ?? null;
      return o ? { o, status: a.status, deadline } : null;
    })
    .filter((x): x is { o: Opportunity; status: 'to_apply' | 'applying'; deadline: string | null } => x !== null)
    .filter((x) => !x.deadline || daysUntil(x.deadline) >= 0)
    .sort((a, b) => (a.deadline ? Date.parse(a.deadline) : Infinity) - (b.deadline ? Date.parse(b.deadline) : Infinity));
  const onCalendar = items.filter((x) => live.applications[x.o.id]?.calendar.state === 'synced').length;

  return (
    <section aria-labelledby="upcoming-deadlines">
      <div className="flex items-baseline justify-between gap-3">
        <h2 id="upcoming-deadlines" className="font-semibold tracking-tight">
          Upcoming application deadlines
        </h2>
        <span className="text-sm text-ink-3">{items.length}</span>
      </div>

      <div className="mt-3 rounded-xl bg-canvas px-3 py-2.5 text-sm">
        {googleState === 'loading' ? (
          <p className="text-ink-2">Checking your Google Calendar…</p>
        ) : googleState === 'ok' ? (
          <p className="flex items-start gap-2 text-ink-2">
            <CalendarCheck className="mt-0.5 size-4 shrink-0 text-emerald-700" aria-hidden="true" />
            <span>
              <span title={googleAccount ?? undefined}>On your Google Calendar automatically</span>: every To apply and Applying deadline, kept up to date.
              {items.length > 0 && ` ${onCalendar} of ${items.length} on it${live.calendar.syncing ? ', updating…' : '.'}`}
            </span>
          </p>
        ) : (
          <div className="grid gap-2 text-ink-2">
            <p>Connect Google Calendar and BearRok puts these deadlines on it for you, with reminders.</p>
            <ConnectCalendar />
          </div>
        )}
        {live.calendar.errors.length > 0 && <p className="mt-1.5 text-xs text-orange-700">Google Calendar refused some: {live.calendar.errors.join('; ')}</p>}
      </div>

      {items.length === 0 ? (
        <p className="mt-4 text-sm leading-relaxed text-ink-3">
          Nothing yet. Set a saved opportunity to To apply or Applying and its deadline shows here.
        </p>
      ) : (
        <ul className="mt-3 grid gap-2">
          {items.map(({ o, status, deadline }) => {
            const days = deadline ? daysUntil(deadline) : null;
            return (
              <li key={o.id} className="rounded-xl border border-line bg-white p-3">
                <div className="flex items-start justify-between gap-3">
                  <button type="button" onClick={() => onOpen(o)} className="min-w-0 text-left">
                    <span className="line-clamp-2 text-sm font-semibold text-ink hover:underline">{o.title}</span>
                    <span className="block truncate text-xs text-ink-3">
                      {o.organizer} · {statusLabel[status]}
                    </span>
                  </button>
                  {deadline ? (
                    <button
                      type="button"
                      onClick={() => onSelect(dayKey(deadline))}
                      className={`shrink-0 rounded-lg px-2 py-1 text-right text-xs font-semibold ${days !== null && days <= 7 ? 'bg-orange-50 text-orange-700' : 'bg-canvas text-ink-2'}`}
                      title="Show this day on the calendar"
                    >
                      {dueLabel(deadline)}
                      <span className="block font-normal">{shortDate(deadline)}</span>
                    </button>
                  ) : (
                    <span className="shrink-0 text-xs text-ink-3">No deadline</span>
                  )}
                </div>
                <div className="mt-2">
                  <CalendarStatus id={o.id} deadline={deadline} compact />
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
