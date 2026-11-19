// One calendar for everything with a date. Orange is what the student has to do (they committed
// to it), blue is what they should do (it moves them toward the goal). Every item says why.
// On top of that: a brief of today, a week plan that places work before each deadline, clash
// warnings, the student's own items, three views, filters and export. The planning rules live in
// src/lib/cal so a model can take their place later without touching this page.
import { ChevronLeft, ChevronRight, Download, TriangleExclamationPoint, Undo2 } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { AgendaView } from '../components/calendar/AgendaView.tsx';
import { BriefCard } from '../components/calendar/BriefCard.tsx';
import { FilterBar, ViewToggle, type CalendarView } from '../components/calendar/Controls.tsx';
import { DayPanel, type PersonalActions } from '../components/calendar/DayPanel.tsx';
import { MonthGrid } from '../components/calendar/MonthGrid.tsx';
import { PlanCard } from '../components/calendar/PlanCard.tsx';
import { WeekView } from '../components/calendar/WeekView.tsx';
import { Details } from '../components/OpportunityCard.tsx';
import { Card, Page } from '../components/Page.tsx';
import { localAssistant, effortContext } from '../lib/cal/assistant.ts';
import { conflictAdvice } from '../lib/cal/brief.ts';
import { addDays, dayDate, hoursLabel, shortDay, startOfWeek } from '../lib/cal/days.ts';
import { icsCalendar } from '../lib/cal/export.ts';
import {
  ALL_KINDS,
  allFilters,
  findConflicts,
  groupByDay,
  matchesFilters,
  mergeItems,
  type CxFilters,
  type CxKind,
  type PersonalItem,
} from '../lib/cal/items.ts';
import { DEFAULT_HOURS, acceptedTitle, targetsFrom, type PlanBlock } from '../lib/cal/planner.ts';
import { calendarItems, dayKey } from '../lib/calendar.ts';
import { useLocal } from '../lib/useLocal.ts';
import { useStore } from '../state/StoreProvider.tsx';
import type { Opportunity } from '../types.ts';
import '../styles/calendar.css';

const VIEWS: CalendarView[] = ['month', 'week', 'agenda'];
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

interface Toast {
  text: string;
  undo: PersonalItem[] | null;
}

export function Calendar() {
  const { state } = useStore();
  const today = dayKey(Date.now());
  const [storedView, setView] = useLocal<CalendarView>('bearrok.calendar.view', 'month');
  const [storedFilters, setFilters] = useLocal<CxFilters>('bearrok.calendar.filters', allFilters);
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

  // Everything the page shows is derived from the store and the page's own saved state.
  const all = useMemo(() => mergeItems(calendarItems(state), personal), [state, personal]);
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
        targets: targetsFrom(all, ctx),
        accepted: personal.flatMap((p) => (p.block ? [{ targetId: p.block.targetId, day: p.day, hours: p.block.hours, done: p.done }] : [])),
      }),
    [today, hours, all, ctx, personal],
  );
  const brief = useMemo(
    () => localAssistant.brief({ today, name: state.profile.name, items: all, conflicts, plan }),
    [today, state.profile.name, all, conflicts, plan],
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
  const ics = useMemo(() => icsCalendar(shown), [shown]);

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
    else setMonth(new Date(month.getFullYear(), month.getMonth() + by, 1));
  };

  // Personal items, and plan blocks once accepted (they become personal items with a `block`).
  const remember = (text: string) => setToast({ text, undo: personal });
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
    setPersonal((list) => [...list, toPersonal(block)]);
  };
  const acceptAll = () => {
    remember(`Added ${plan.blocks.length} work blocks to your calendar.`);
    setPersonal((list) => [...list, ...plan.blocks.map(toPersonal)]);
  };
  const windowEnd = addDays(today, 6);
  const acceptedInWindow = personal.filter((p) => p.block && p.day >= today && p.day <= windowEnd);
  const clearAccepted = () => {
    const clear = new Set(acceptedInWindow.filter((p) => !p.done).map((p) => p.id));
    remember(`Cleared ${clear.size} accepted ${clear.size === 1 ? 'block' : 'blocks'}. Ticked-off ones stay.`);
    setPersonal((list) => list.filter((p) => !clear.has(p.id)));
  };
  const actions: PersonalActions = {
    add: (fields) => setPersonal((list) => [...list, { ...fields, id: newId(), done: false, block: null }]),
    update: (id, patch) => setPersonal((list) => list.map((p) => (p.id === id ? { ...p, ...patch } : p))),
    remove: (id) => {
      const gone = personal.find((p) => p.id === id);
      if (gone) remember(`Removed "${gone.title}".`);
      setPersonal((list) => list.filter((p) => p.id !== id));
    },
  };

  const weekEnd = addDays(today, 6);
  const open = all.filter((item) => !item.done);
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
        : 'Agenda';

  return (
    <Page
      title="Calendar"
      subtitle="Everything with a date in one place: what you have to do, what you should do, and why."
      aside={
        <a
          href={`data:text/calendar;charset=utf-8,${encodeURIComponent(ics)}`}
          download="bearrok-calendar.ics"
          className="cx-export"
          aria-label={`Export ${shown.length} items as an .ics file`}
        >
          <Download className="size-4" aria-hidden="true" />
          Export .ics
          <span>{shown.length}</span>
        </a>
      }
    >
      <div className="grid items-stretch gap-4 lg:grid-cols-[minmax(0,1fr)_380px]">
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

      <div className="mt-4 grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_380px]">
        <Card className="min-w-0 p-5">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="mr-auto font-display text-3xl leading-none">{title}</h2>
            <ViewToggle view={view} onChange={setView} />
            <button type="button" onClick={goToday} className="cal-nav px-3 text-sm font-semibold">
              Today
            </button>
            {view !== 'agenda' && (
              <>
                <button type="button" onClick={() => move(-1)} aria-label={view === 'week' ? 'Previous week' : 'Previous month'} className="cal-nav w-9">
                  <ChevronLeft className="size-4" aria-hidden="true" />
                </button>
                <button type="button" onClick={() => move(1)} aria-label={view === 'week' ? 'Next week' : 'Next month'} className="cal-nav w-9">
                  <ChevronRight className="size-4" aria-hidden="true" />
                </button>
              </>
            )}
          </div>

          <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
            <FilterBar filters={filters} counts={kindCounts} onChange={setFilters} />
            {planOpen && visibleBlocks.length > 0 && <span className="cx-legend-ghost">Suggested blocks</span>}
          </div>

          <div key={view} className="cx-view mt-4">
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
            {view === 'agenda' && (
              <AgendaView today={today} selected={selected} items={shown} blocks={visibleBlocks} conflicts={conflictByDay} onSelect={select} onAccept={accept} />
            )}
          </div>
          {view !== 'agenda' && (
            <p className="mt-3 text-xs text-ink-3">
              Arrow keys move the day, Home and End jump to the week's ends{view === 'month' ? ', Page Up and Page Down change month' : ''}.
            </p>
          )}
        </Card>

        <aside className="grid gap-4 lg:sticky lg:top-6">
          <Card className="p-5">
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

      <div className="cx-toast-zone" aria-live="polite">
        {toast && (
          <div className="cx-toast" key={toast.text}>
            <span>{toast.text}</span>
            {toast.undo && (
              <button
                type="button"
                onClick={() => {
                  setPersonal(toast.undo!);
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
