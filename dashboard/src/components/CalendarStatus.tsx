// Where one application stands on the student's Google Calendar. The app adds the deadline itself
// once Google Calendar is connected: there is no "add to calendar" link to follow by hand.
import { CalendarCheck, CalendarClock, CalendarPlus, ExternalLink } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useAuth } from '../auth/AuthProvider.tsx';
import { authMessage } from '../auth/errors.ts';
import { useLive } from '../state/live.tsx';
import { useStore } from '../state/StoreProvider.tsx';

/**
 * Connect Google Calendar from wherever a deadline is waiting to be added. The button is never
 * locked: Google's screen opens in a browser tab, and if the student closes that tab without
 * finishing, clicking Connect again simply starts over (or Cancel stops waiting).
 */
export function ConnectCalendar({ className = '' }: { className?: string }) {
  const auth = useAuth();
  const [waiting, setWaiting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const attempt = useRef<AbortController | null>(null);
  useEffect(() => () => attempt.current?.abort(), []);
  if (auth.status !== 'signedIn') return null;

  const connect = async () => {
    attempt.current?.abort();
    const controller = new AbortController();
    attempt.current = controller;
    setWaiting(true);
    setError(null);
    try {
      await auth.connectGoogle('calendar', controller.signal);
    } catch (e) {
      if (attempt.current === controller) setError(authMessage(e));
    } finally {
      if (attempt.current === controller) {
        attempt.current = null;
        setWaiting(false);
      }
    }
  };
  const cancel = () => {
    attempt.current?.abort();
    attempt.current = null;
    setWaiting(false);
  };

  return (
    <span className={`inline-flex flex-wrap items-center gap-2 ${className}`}>
      <button
        type="button"
        onClick={() => void connect()}
        className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-line bg-white px-3 text-sm font-semibold text-ink"
      >
        <CalendarPlus className="size-4" aria-hidden="true" />
        {waiting ? 'Connect again' : 'Connect Google Calendar'}
      </button>
      {waiting && (
        <span className="text-xs text-ink-3">
          Finish in the Google tab that opened. Closed it?{' '}
          <button type="button" onClick={() => void connect()} className="font-semibold text-brand">
            Open it again
          </button>{' '}
          or{' '}
          <button type="button" onClick={cancel} className="font-semibold text-brand">
            cancel
          </button>
          .
        </span>
      )}
      {error && <span className="text-xs text-orange-700">{error}</span>}
    </span>
  );
}

/** One line saying whether this deadline is on the calendar, with the event's link once it is. */
export function CalendarStatus({ id, deadline: posted = null, compact = false }: { id: string; /** The posting's own deadline, used until the account's record arrives. */ deadline?: string | null; compact?: boolean }) {
  const live = useLive();
  const { state } = useStore();
  const status = state.applications[id]?.status ?? 'interested';
  const tracked = live.applications[id];
  const deadline = tracked?.deadline ?? posted;
  if (status !== 'to_apply' && status !== 'applying') {
    return compact ? null : <span className="text-sm text-ink-3">Set it to To apply or Applying and the deadline goes on your Google Calendar.</span>;
  }
  if (!deadline) return <span className="text-sm text-ink-3">No deadline yet. Once there is one, it goes on your calendar.</span>;
  if (tracked?.calendar.state === 'synced') {
    return (
      <span className="inline-flex flex-wrap items-center gap-1.5 text-sm font-medium text-emerald-700">
        <CalendarCheck className="size-4" aria-hidden="true" />
        On your Google Calendar
        {tracked.calendar.htmlLink && (
          <a href={tracked.calendar.htmlLink} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-brand hover:underline">
            Open <ExternalLink className="size-3" aria-hidden="true" />
          </a>
        )}
      </span>
    );
  }
  if (live.calendar.connected) {
    return (
      <span className="inline-flex items-center gap-1.5 text-sm text-ink-2">
        <CalendarClock className="size-4" aria-hidden="true" />
        {tracked?.calendar.error ? `Google Calendar refused it: ${tracked.calendar.error}` : 'Adding it to your Google Calendar…'}
      </span>
    );
  }
  return (
    <span className="inline-flex flex-wrap items-center gap-2 text-sm text-ink-2">
      {!compact && <span>Not on your calendar yet: connect Google Calendar and BearRok adds it.</span>}
      <ConnectCalendar />
    </span>
  );
}
