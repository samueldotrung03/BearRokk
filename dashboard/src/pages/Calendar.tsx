// One calendar for everything with a date. The calendar comes first, and beside it the upcoming
// application deadlines (To apply and Applying on the Saved page), which BearRok puts on the
// student's Google Calendar by itself once it is connected. Orange is what the student has to do
// (they committed to it), blue is what they should do (it moves them toward the goal).
// On top of that: a brief of today, a week plan that places work before each deadline, clash
// warnings, the student's own items, three views, filters and export. The planning rules live in
// src/lib/cal so a model can take their place later without touching this page.
import { ChevronLeft, ChevronRight, Plus, TriangleExclamationPoint, Undo2 } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AgendaView } from '../components/calendar/AgendaView.tsx';
import { DayView } from '../components/calendar/DayView.tsx';
import { BriefCard } from '../components/calendar/BriefCard.tsx';
import { FilterBar, ViewToggle, type CalendarView } from '../components/calendar/Controls.tsx';
import { DayPanel, type PersonalActions } from '../components/calendar/DayPanel.tsx';
import { MonthGrid } from '../components/calendar/MonthGrid.tsx';
import { PlanCard } from '../components/calendar/PlanCard.tsx';
import { UpcomingDeadlines } from '../components/calendar/UpcomingDeadlines.tsx';
import { WeekView } from '../components/calendar/WeekView.tsx';
import { Details } from '../components/OpportunityCard.tsx';
import { Card, Page } from '../components/Page.tsx';
import { localAssistant, effortContext } from '../lib/cal/assistant.ts';
import { conflictAdvice } from '../lib/cal/brief.ts';
import { addDays, dayDate, hoursLabel, shortDay, startOfWeek } from '../lib/cal/days.ts';
import {
  ALL_KINDS,
  allFilters,
  findConflicts,
  groupByDay,
  matchesFilters,
  mergeItems,
  type CxFilters,
  type CxItem,
  type CxKind,
  type PersonalItem,
} from '../lib/cal/items.ts';
import { DEFAULT_HOURS, acceptedTitle, targetsFrom, type PlanBlock } from '../lib/cal/planner.ts';
import { calendarItems, dayKey } from '../lib/calendar.ts';
import { deleteGoogleEvent, googleItems, insertGoogleEvent, updateGoogleEvent, useGoogleEvents, type EventDraft, type GoogleSyncState } from '../lib/cal/google.ts';
import { useAuth } from '../auth/AuthProvider.tsx';
import { authMessage } from '../auth/errors.ts';
import { ConnectCalendar } from '../components/CalendarStatus.tsx';
import { useLocal } from '../lib/useLocal.ts';
import { useLive } from '../state/live.tsx';
import { useStore } from '../state/StoreProvider.tsx';
import type { Opportunity } from '../types.ts';
import '../styles/calendar.css';

const VIEWS: CalendarView[] = ['month', 'week', 'day', 'agenda'];
const monthOf = (day: string) => {
  const d = dayDate(day);
  return new Date(d.getFullYear(), d.getMonth(), 1);
};
/** "Nov 15 – 21", or "Nov 29 – Dec 5" when the week crosses a month. */
function weekTitle(start: string): string {
  const end = addDays(start, 6);
  const sameMonth = dayDate(start).getMonth() === dayDate(end).getMonth();
  return `${shortDay(start)} – ${sameMonth ? dayDate(end).getDate() : shortDay(end)}`;
}
const newId = () => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;

// Stored values come back from localStorage as plain JSON; anything malformed falls back to the default.
const validHours = (value: unknown): number[] =>
  Array.isArray(value) && value.length === 7 && value.every((n) => typeof n === 'number' && n >= 0) ? value : DEFAULT_HOURS;
const validFilters = (value: CxFilters | null): CxFilters =>
  value && Array.isArray(value.kinds) && Array.isArray(value.priorities) ? value : allFilters;

/** Whether the student's Google Calendar is showing here, whose it is, and how to connect or switch. */
function GoogleSyncLine({
  state,
  count,
  updatedAt,
  account,
  calendars,
  allCalendars,
}: {
  state: GoogleSyncState;
  count: number;
  updatedAt: number | null;
  account: string | null;
  calendars: number;
  allCalendars: boolean;
}) {
  const ago = updatedAt ? Math.round((Date.now() - updatedAt) / 60_000) : null;
  return (
    <div className="cx-google-line mt-3" data-state={state}>
      <span className="cx-google-dot" aria-hidden="true" />
      {state === 'ok' ? (
        <>
          <span className="min-w-0" title={account ?? undefined}>
            Synced with {allCalendars ? `${calendars} Google ${calendars === 1 ? 'calendar' : 'calendars'}` : 'Google Calendar'} · {count === 0 ? 'no events nearby' : `${count} ${count === 1 ? 'event' : 'events'}`} · updated{' '}
            {ago === 0 || ago === null ? 'just now' : `${ago} min ago`}
          </span>
          <a
            href={`https://calendar.google.com/calendar/r${account ? `?authuser=${encodeURIComponent(account)}` : ''}`}
            target="_blank"
            rel="noreferrer"
            className="font-semibold text-brand hover:underline"
          >
            Open Google Calendar
          </a>
          {count === 0 && allCalendars && <span className="text-ink-3">If your events are in another Google account, switch to it:</span>}
          <SwitchAccount />
        </>
      ) : state === 'loading' ? (
        <span>Checking your Google Calendar…</span>
      ) : state === 'expired' ? (
        <>
          <span>Google access has run out, so your events are not showing.</span>
          <ConnectCalendar />
        </>
      ) : state === 'error' ? (
        <span>Your Google Calendar could not be read just now. It is tried again in a few minutes.</span>
      ) : (
        <>
          <span>Not connected. Connect Google Calendar to see your events here and send what you add to it.</span>
          <ConnectCalendar />
        </>
      )}
    </div>
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
      className="font-semibold text-brand hover:underline"
      onClick={async () => {
        attempt.current?.abort();
        const controller = new AbortController();
        attempt.current = controller;
        setWaiting(true);
        try {
          await auth.connectGoogle('calendar', controller.signal, { switchAccount: true });
        } catch {
          // Shown by the line itself on the next read.
        } finally {
          if (attempt.current === controller) setWaiting(false);
        }
      }}
    >
      {waiting ? 'Waiting for Google… (click to reopen)' : 'Use a different Google account'}
    </button>
  );
}

interface Toast {
  text: string;
  undo: PersonalItem[] | null;
}

export function Calendar() {
  const { state } = useStore();
  const today = dayKey(Date.now());
  const [storedView, setView] = useLocal<CalendarView>('bearrok.calendar.view', 'month');
  // v2: filters saved before Google Calendar events existed would hide them, so those are not reused.
  const [storedFilters, setFilters] = useLocal<CxFilters>('bearrok.calendar.filters.v2', allFilters);
  const [storedPersonal, setPersonal] = useLocal<PersonalItem[]>('bearrok.calendar.personal', []);
  const [storedHours, setHours] = useLocal<number[]>('bearrok.calendar.hours', DEFAULT_HOURS);
  const [planOpen, setPlanOpen] = useLocal<boolean>('bearrok.calendar.planOpen', false);
  const view = VIEWS.includes(storedView) ? storedView : 'month';
  const filters = validFilters(storedFilters);
  const personal = useMemo(() => (Array.isArray(storedPersonal) ? storedPersonal : []), [storedPersonal]);
  const hours = validHours(storedHours);

  const [month, setMonth] = useState(() => monthOf(today));
  const [selected, setSelected] = useState(today);
  const [details, setDetails] = useState<Opportunity | null>(null);
  const [toast, setToast] = useState<Toast | null>(null);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(null), 5000);
    return () => window.clearTimeout(timer);
  }, [toast]);

  // What the agents found and the student saved, not the sample cards.
  const live = useLive();
  const found = useMemo(() => {
    const byId = new Map<string, Opportunity>();
    for (const o of [...live.opportunities, ...live.savedCards]) byId.set(o.id, o);
    return [...byId.values()];
  }, [live.opportunities, live.savedCards]);
  // Everything the page shows is derived from the store and the page's own saved state.
  // BearRok's own items: deadlines, reminders, steps and what the student added. Planning, the brief
  // and the counts are worked out from these alone.
  const own = useMemo(() => mergeItems(calendarItems(state, Date.now(), found), personal), [state, personal, found]);
  // The student's Google Calendar for the weeks around what is on screen, shown with everything else.
  // Events BearRok made for a deadline are left out: the deadline itself is already here.
  const rangeFrom = addDays(startOfWeek(dayKey(month)), -7);
  const rangeTo = [addDays(rangeFrom, 56), addDays(today, 61)].sort().at(-1)!;
  const google = useGoogleEvents(rangeFrom, rangeTo);
  // Events BearRok made, for a deadline or for something the student added here, are shown once:
  // as BearRok's own item, not again as a Google event.
  const ownEventIds = useMemo(
    () =>
      new Set([
        ...Object.values(live.applications).flatMap((a) => (a.calendar.eventId ? [a.calendar.eventId] : [])),
        ...personal.flatMap((p) => (p.google ? [p.google.eventId] : [])),
      ]),
    [live.applications, personal],
  );
  const all = useMemo(() => {
    const rank = (item: CxItem) => (item.priority === 'must' ? 0 : 1);
    return [...own, ...googleItems(google.events, ownEventIds)].sort((a, b) => a.day.localeCompare(b.day) || rank(a) - rank(b) || a.date.localeCompare(b.date));
  }, [own, google.events, ownEventIds]);
  const shown = useMemo(() => all.filter((item) => matchesFilters(item, filters)), [all, filters]);
  const byDay = useMemo(() => groupByDay(shown), [shown]);
  // Clashes are found on everything, not only what the filters show: hiding a kind does not remove the clash.
  const conflicts = useMemo(() => findConflicts(all), [all]);
  const conflictByDay = useMemo(() => new Map(conflicts.map((c) => [c.day, c])), [conflicts]);
  const ctx = useMemo(() => effortContext(state), [state]);
  const plan = useMemo(
    () =>
      localAssistant.planWeek({
        today,
        days: 7,
        hoursByWeekday: hours,
        targets: targetsFrom(own, ctx),
        accepted: personal.flatMap((p) => (p.block ? [{ targetId: p.block.targetId, day: p.day, hours: p.block.hours, done: p.done }] : [])),
      }),
    [today, hours, all, ctx, personal],
  );
  const brief = useMemo(
    () => localAssistant.brief({ today, name: state.profile.name, items: own, conflicts, plan }),
    [today, state.profile.name, own, conflicts, plan],
  );
  const visibleBlocks = useMemo(
    () => (planOpen ? plan.blocks.filter((block) => filters.priorities.includes(block.priority)) : []),
    [planOpen, plan, filters],
  );
  const blocksByDay = useMemo(() => groupByDay(visibleBlocks), [visibleBlocks]);
  const planDays = useMemo(() => new Map(plan.days.map((d) => [d.day, d])), [plan]);
  const kindCounts = useMemo(() => {
    const counts = new Map<CxKind, number>(ALL_KINDS.map((kind) => [kind, 0]));
    for (const item of all) if (filters.priorities.includes(item.priority)) counts.set(item.kind, counts.get(item.kind)! + 1);
    return counts;
  }, [all, filters]);

  const select = useCallback((day: string) => {
    setSelected(day);
    setMonth((current) => {
      const next = monthOf(day);
      return next.getTime() === current.getTime() ? current : next;
    });
  }, []);
  const goToday = () => select(today);
  const move = (by: number) => {
    if (view === 'week') select(addDays(selected, by * 7));
    else if (view === 'day') select(addDays(selected, by));
    else setMonth(new Date(month.getFullYear(), month.getMonth() + by, 1));
  };
  const unit = view === 'week' ? 'week' : view === 'day' ? 'day' : 'month';
  // Opening an item from the day view shows its opportunity, from the feed or the saved list.
  const openItem = (item: { opportunityId: string | null }) => {
    const o = item.opportunityId ? found.find((x) => x.id === item.opportunityId) : undefined;
    if (o) setDetails(o);
  };

  // ---- what is added here goes on the student's Google Calendar too --------------------------
  const auth = useAuth();
  const googleToken = auth.google.calendar;
  const draftOf = (p: PersonalItem): EventDraft => ({
    title: p.title,
    day: p.day,
    time: p.time ?? null,
    endTime: p.endTime ?? null,
    description: [p.block ? `${hoursLabel(p.block.hours)} of work, planned in BearRok. ${p.block.why}` : '', p.note, 'Added from BearRok.'].filter(Boolean).join('\n\n'),
  });
  const pushing = useRef(new Set<string>());
  const pushToGoogle = useCallback(
    async (p: PersonalItem) => {
      if (!googleToken || p.google || pushing.current.has(p.id)) return;
      pushing.current.add(p.id);
      try {
        const made = await insertGoogleEvent(googleToken, draftOf(p));
        setPersonal((list) => list.map((x) => (x.id === p.id ? { ...x, google: made } : x)));
        google.refresh();
      } catch {
        // Tried again the next time the page loads with Google connected.
      } finally {
        pushing.current.delete(p.id);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [googleToken],
  );
  // Anything added while Google was not connected goes there once it is.
  useEffect(() => {
    if (!googleToken) return;
    for (const p of personal) if (!p.google && !p.done && p.day >= today) void pushToGoogle(p);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [googleToken, personal.length]);
  const removeFromGoogle = (list: PersonalItem[]) => {
    if (!googleToken) return;
    for (const p of list) if (p.google) void deleteGoogleEvent(googleToken, p.google.eventId).catch(() => {});
  };
  const [addRequest, setAddRequest] = useState(0);

  // Personal items, and plan blocks once accepted (they become personal items with a `block`).
  const remember = (text: string) => setToast({ text, undo: personal });
  /** Undo: put the list back, and Google Calendar with it. */
  const restore = (previous: PersonalItem[]) => {
    const before = new Set(previous.map((p) => p.id));
    const now = new Set(personal.map((p) => p.id));
    // Added since: their events come off Google Calendar. Removed since: they go back on.
    removeFromGoogle(personal.filter((p) => !before.has(p.id)));
    const next = previous.map((p) => (now.has(p.id) ? p : { ...p, google: null }));
    setPersonal(next);
    for (const p of next) if (!p.google && !p.done) void pushToGoogle(p);
  };
  const toPersonal = (block: PlanBlock): PersonalItem => ({
    id: newId(),
    day: block.day,
    title: acceptedTitle(block),
    priority: block.priority,
    note: '',
    done: false,
    block: { targetId: block.targetId, hours: block.hours, why: block.why },
  });
  const accept = (block: PlanBlock) => {
    remember(`Added ${hoursLabel(block.hours)} on "${block.title}" to ${block.day === today ? 'today' : shortDay(block.day)}.`);
    const item = toPersonal(block);
    setPersonal((list) => [...list, item]);
    void pushToGoogle(item);
  };
  const acceptAll = () => {
    remember(`Added ${plan.blocks.length} work blocks to your calendar.`);
    const items = plan.blocks.map(toPersonal);
    setPersonal((list) => [...list, ...items]);
    for (const item of items) void pushToGoogle(item);
  };
  const windowEnd = addDays(today, 6);
  const acceptedInWindow = personal.filter((p) => p.block && p.day >= today && p.day <= windowEnd);
  const clearAccepted = () => {
    const clear = new Set(acceptedInWindow.filter((p) => !p.done).map((p) => p.id));
    remember(`Cleared ${clear.size} accepted ${clear.size === 1 ? 'block' : 'blocks'}. Ticked-off ones stay.`);
    removeFromGoogle(personal.filter((p) => clear.has(p.id)));
    setPersonal((list) => list.filter((p) => !clear.has(p.id)));
  };
  const actions: PersonalActions = {
    add: (fields) => {
      const item: PersonalItem = { ...fields, id: newId(), done: false, block: null };
      setPersonal((list) => [...list, item]);
      select(item.day);
      void pushToGoogle(item);
    },
    update: (id, patch) => {
      const current = personal.find((p) => p.id === id);
      setPersonal((list) => list.map((p) => (p.id === id ? { ...p, ...patch } : p)));
      // A change to what or when moves the Google event too; ticking it done does not.
      const moved = current && ['title', 'day', 'time', 'endTime', 'note'].some((k) => k in patch);
      if (current?.google && googleToken && moved) void updateGoogleEvent(googleToken, current.google.eventId, draftOf({ ...current, ...patch })).then(google.refresh, () => {});
      if (patch.day) select(patch.day);
    },
    remove: (id) => {
      const gone = personal.find((p) => p.id === id);
      if (gone) remember(`Removed "${gone.title}".`);
      if (gone) removeFromGoogle([gone]);
      setPersonal((list) => list.filter((p) => p.id !== id));
    },
  };

  const weekEnd = addDays(today, 6);
  const open = own.filter((item) => !item.done);
  const thisWeek = open.filter((item) => item.day >= today && item.day <= weekEnd);
  const overdue = open.filter((item) => item.day < today && item.kind !== 'reminder');
  const upcoming = open.filter((item) => item.day > selected && item.day >= today).slice(0, 5);
  const clashesAhead = conflicts.filter((c) => c.day >= today && c.day <= addDays(today, 13));
  const tiles = [
    { label: 'Have to do this week', count: thisWeek.filter((item) => item.priority === 'must').length, tone: 'must' },
    { label: 'Should do this week', count: thisWeek.filter((item) => item.priority === 'should').length, tone: 'should' },
    { label: 'Overdue', count: overdue.length, tone: 'late' },
    { label: clashesAhead.length === 1 ? 'Day with a clash, next 2 weeks' : 'Days with clashes, next 2 weeks', count: clashesAhead.length, tone: 'late' },
  ];

  const dayAll = all.filter((item) => item.day === selected);
  const dayItems = byDay.get(selected) ?? [];
  const dayConflict = conflictByDay.get(selected);
  const weekStart = startOfWeek(selected);
  const title =
    view === 'month'
      ? month.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
      : view === 'week'
        ? weekTitle(weekStart)
        : view === 'day'
          ? dayDate(selected).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })
          : 'Agenda';

  return (
    <Page
      title="Calendar"
      subtitle="Everything with a date in one place, with your application deadlines beside it."
    >
      <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_380px]">
        <Card className="cx-frame min-w-0 p-5">
          {/* The header keeps one size in every view: the title has a fixed size and is cut short
              rather than pushing the controls around, and the controls never appear or vanish. */}
          <div className="cx-cal-head">
            <h2 className="cx-cal-title" title={title}>
              {title}
            </h2>
            <div className="cx-cal-nav">
              <button type="button" onClick={goToday} className="cal-nav px-3 text-sm font-semibold">
                Today
              </button>
              {/* The agenda is one running list from today: its arrows are hidden but keep their place. */}
              <button type="button" onClick={() => move(-1)} aria-label={`Previous ${unit}`} className="cal-nav w-9" style={view === 'agenda' ? { visibility: 'hidden' } : undefined}>
                <ChevronLeft className="size-4" aria-hidden="true" />
              </button>
              <button type="button" onClick={() => move(1)} aria-label={`Next ${unit}`} className="cal-nav w-9" style={view === 'agenda' ? { visibility: 'hidden' } : undefined}>
                <ChevronRight className="size-4" aria-hidden="true" />
              </button>
            </div>
          </div>
          <div className="cx-cal-tools mt-3">
            <ViewToggle view={view} onChange={setView} />
            <button
              type="button"
              onClick={() => setAddRequest((n) => n + 1)}
              aria-label="Add event"
              title="Add event"
              className="btn-primary grid size-9 shrink-0 place-items-center rounded-[10px] text-white"
            >
              <Plus className="size-5" aria-hidden="true" />
            </button>
          </div>

          <GoogleSyncLine state={google.state} count={google.events.length} updatedAt={google.updatedAt} account={google.account} calendars={google.calendars} allCalendars={google.allCalendars} />

          <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
            <FilterBar filters={filters} counts={kindCounts} onChange={setFilters} />
            {planOpen && visibleBlocks.length > 0 && <span className="cx-legend-ghost">Suggested blocks</span>}
          </div>

          {/* The same size in every view and every day: what does not fit scrolls inside. */}
          <div key={view} className="cx-view cx-view-box mt-4">
            {view === 'month' && (
              <MonthGrid month={month} today={today} selected={selected} byDay={byDay} blocksByDay={blocksByDay} conflicts={conflictByDay} onSelect={select} />
            )}
            {view === 'week' && (
              <WeekView
                today={today}
                selected={selected}
                byDay={byDay}
                blocksByDay={blocksByDay}
                planDays={planOpen ? planDays : new Map()}
                conflicts={conflictByDay}
                onSelect={select}
                onAccept={accept}
              />
            )}
            {view === 'day' && (
              <DayView day={selected} today={today} items={dayItems} blocks={blocksByDay.get(selected) ?? []} conflict={dayConflict} onOpen={openItem} />
            )}
            {view === 'agenda' && (
              <AgendaView today={today} selected={selected} items={shown} blocks={visibleBlocks} conflicts={conflictByDay} onSelect={select} onAccept={accept} />
            )}
          </div>
          <p className="mt-3 text-xs text-ink-3">
            {view === 'day'
              ? 'The arrows above move one day.'
              : view === 'agenda'
                ? 'Everything from today on, in date order.'
                : `Arrow keys move the day, Home and End jump to the week's ends${view === 'month' ? ', Page Up and Page Down change month' : ''}.`}
          </p>
        </Card>

        <aside className="grid gap-4 lg:sticky lg:top-6">
          <Card className="cx-side-card p-5">
            <UpcomingDeadlines found={found} onSelect={select} onOpen={setDetails} googleState={google.state} googleAccount={google.account} />
          </Card>

          <Card className="cx-side-card p-5">
            <DayPanel
              key={selected}
              day={selected}
              today={today}
              items={dayItems}
              hiddenCount={dayAll.length - dayItems.length}
              blocks={blocksByDay.get(selected) ?? []}
              conflict={dayConflict}
              conflictAdvice={dayConflict ? conflictAdvice(dayConflict, plan, today) : null}
              personal={personal}
              found={found}
              addRequest={addRequest}
              googleConnected={Boolean(googleToken)}
              actions={actions}
              onOpen={setDetails}
              onAccept={accept}
            />
          </Card>

          {(overdue.length > 0 || upcoming.length > 0 || clashesAhead.length > 0) && (
            <Card className="p-5">
              {clashesAhead.length > 0 && (
                <>
                  <h2 className="flex items-center gap-1.5 font-semibold tracking-tight text-orange-700">
                    <TriangleExclamationPoint className="size-4" strokeWidth={2.5} aria-hidden="true" /> Clashes ahead
                  </h2>
                  <ul className="mt-2 mb-4 grid gap-1">
                    {clashesAhead.map((c) => (
                      <li key={c.day}>
                        <button type="button" onClick={() => select(c.day)} className="cal-next" data-priority="must">
                          <span className="truncate">{c.items.map((item) => item.title).join(' + ')}</span>
                          <span>{shortDay(c.day)}</span>
                        </button>
                      </li>
                    ))}
                  </ul>
                </>
              )}
              {overdue.length > 0 && (
                <>
                  <h2 className="font-semibold tracking-tight text-orange-700">Overdue</h2>
                  <ul className="mt-2 mb-4 grid gap-1">
                    {overdue.map((item) => (
                      <li key={item.id}>
                        <button type="button" onClick={() => select(item.day)} className="cal-next" data-priority={item.priority}>
                          <span className="truncate">{item.title}</span>
                          <span>{shortDay(item.day)}</span>
                        </button>
                      </li>
                    ))}
                  </ul>
                </>
              )}
              {upcoming.length > 0 && (
                <>
                  <h2 className="font-semibold tracking-tight">Coming up</h2>
                  <ul className="mt-2 grid gap-1">
                    {upcoming.map((item) => (
                      <li key={item.id}>
                        <button type="button" onClick={() => select(item.day)} className="cal-next" data-priority={item.priority}>
                          <span className="truncate">{item.title}</span>
                          <span>{shortDay(item.day)}</span>
                        </button>
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </Card>
          )}
        </aside>
      </div>

      <div className="mt-4 grid items-stretch gap-4 lg:grid-cols-[minmax(0,1fr)_380px]">
        <BriefCard
          brief={brief}
          today={today}
          source={localAssistant.source}
          planOpen={planOpen}
          overloaded={plan.overloaded}
          onTogglePlan={() => setPlanOpen(!planOpen)}
          onJump={select}
        />
        <div className="grid grid-cols-2 gap-3">
          {tiles.map((tile) => (
            <Card key={tile.label} className="cal-tile cx-tile">
              <span className="cal-tile-count" data-tone={tile.tone} data-zero={tile.count === 0}>
                {tile.count}
              </span>
              <span className="text-sm leading-snug font-medium text-ink-2">{tile.label}</span>
            </Card>
          ))}
        </div>
      </div>

      {planOpen && (
        <PlanCard
          plan={plan}
          today={today}
          hours={hours}
          accepted={acceptedInWindow}
          source={localAssistant.source}
          onHours={(weekday, value) => setHours(hours.map((h, index) => (index === weekday ? value : h)))}
          onAccept={accept}
          onAcceptAll={acceptAll}
          onUnaccept={actions.remove}
          onClearAccepted={clearAccepted}
          onClose={() => setPlanOpen(false)}
          onJump={select}
        />
      )}


      <div className="cx-toast-zone" aria-live="polite">
        {toast && (
          <div className="cx-toast" key={toast.text}>
            <span>{toast.text}</span>
            {toast.undo && (
              <button
                type="button"
                onClick={() => {
                  restore(toast.undo!);
                  setToast(null);
                }}
              >
                <Undo2 className="size-3.5" aria-hidden="true" /> Undo
              </button>
            )}
          </div>
        )}
      </div>

      {details && <Details opportunity={details} onClose={() => setDetails(null)} />}
    </Page>
  );
}
