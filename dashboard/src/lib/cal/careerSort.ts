// The calendar's "Career only" filter. The agents' model sorts the student's own Google Calendar
// events into career-related and personal (backend: POST /calendar/sort). Each event is sorted once
// and the answer kept in this browser, so turning the filter on again costs nothing. What the
// student added in BearRok and their application deadlines are never sorted: they always show.
import { useEffect, useMemo, useState } from 'react';
import { useLocal } from '../useLocal.ts';
import { useLive } from '../../state/live.tsx';
import type { GoogleEvent } from './google.ts';

export interface EventVerdict {
  career: boolean;
  kind: string;
  reason: string;
}

/** One key per event, across all the student's calendars. */
export const eventKey = (e: Pick<GoogleEvent, 'id' | 'calendarId'>) => `${e.calendarId ?? 'primary'}|${e.id}`;

const BATCH = 60;

/**
 * The Google events the calendar shows. With the filter on, only ones sorted as personal are
 * hidden; one not sorted yet stays until it has been, so nothing vanishes on a guess.
 */
export function careerOnlyEvents(events: GoogleEvent[], verdicts: Record<string, EventVerdict>, on: boolean, keepUnsorted = false): GoogleEvent[] {
  if (!on) return events;
  // An event not sorted yet waits hidden, so classes do not flash up; if sorting cannot run at all,
  // it shows rather than the calendar going empty.
  return events.filter((e) => {
    const v = verdicts[eventKey(e)];
    return v ? v.career : keepUnsorted;
  });
}

export function useCareerSort(events: GoogleEvent[], on: boolean): { verdicts: Record<string, EventVerdict>; sorting: number; failed: boolean } {
  const live = useLive();
  // v2: classes and coursework are no longer career; answers saved under the old rule are not reused.
  const [stored, setStored] = useLocal<Record<string, EventVerdict>>('bearrok.calendar.sorted.v2', {});
  const [failed, setFailed] = useState(false);
  const verdicts = useMemo(() => (stored && typeof stored === 'object' ? stored : {}), [stored]);
  const [sorting, setSorting] = useState(0);
  // Each distinct event once, by key.
  const unsorted = useMemo(() => {
    const seen = new Map<string, GoogleEvent>();
    for (const e of events) if (!verdicts[eventKey(e)]) seen.set(eventKey(e), e);
    return [...seen.entries()];
  }, [events, verdicts]);

  useEffect(() => {
    if (!on || unsorted.length === 0 || live.status !== 'connected') return;
    let stopped = false;
    const batch = unsorted.slice(0, BATCH);
    setSorting(unsorted.length);
    void live
      .request('/calendar/sort', {
        method: 'POST',
        body: JSON.stringify({ events: batch.map(([key, e]) => ({ id: key, title: e.title, calendar: e.calendarName ?? null, location: e.location })) }),
      })
      .then(async (res) => {
        if (stopped) return;
        if (!res.ok) {
          setFailed(true);
          return;
        }
        setFailed(false);
        const { verdicts: got } = (await res.json()) as { verdicts: ({ id: string } & EventVerdict)[] };
        // The next batch, if any, starts when these land and the list of unsorted ones shrinks.
        setStored((current) => ({ ...(current ?? {}), ...Object.fromEntries(got.map(({ id, ...v }) => [id, v])) }));
      })
      .catch(() => !stopped && setFailed(true))
      .finally(() => !stopped && setSorting(0));
    return () => {
      stopped = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [on, unsorted.length, live.status]);

  return { verdicts, sorting: on ? sorting : 0, failed: failed || live.status === 'offline' };
}
