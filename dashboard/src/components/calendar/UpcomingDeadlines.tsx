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
      <div className="cx-side-head">
        <h2 id="upcoming-deadlines">Deadlines</h2>
        <span className="text-sm text-ink-3">{items.length}</span>
      </div>

      {items.length === 0 ? (
        <p className="text-sm leading-relaxed text-ink-3">Nothing due. Deadlines of what you set to To apply or Applying show up here, and go on your Google Calendar.</p>
      ) : (
        <ul className="grid gap-2">
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
