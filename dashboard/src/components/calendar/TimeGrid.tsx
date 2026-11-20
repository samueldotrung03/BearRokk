// The Day and Week views as a time grid, the way a calendar app lays out a day: a column of hours,
// one column per day, an all-day row on top, events placed at their real times and as long as they
// last, and a line at the current time. It scrolls inside the calendar's fixed frame, opening on
// the working day. Clicking an event opens its card; clicking a day's heading opens that day.
import { useEffect, useMemo, useRef, useState } from 'react';
import { dayDate } from '../../lib/cal/days.ts';
import type { CxItem } from '../../lib/cal/items.ts';
import type { PlanBlock } from '../../lib/cal/planner.ts';
import { hoursLabel } from '../../lib/cal/days.ts';

const HOUR = 48;
const MIN_MINUTES = 30;

const minutesOf = (iso: string) => {
  const d = new Date(iso);
  return d.getHours() * 60 + d.getMinutes();
};

const clock = (iso: string) => new Date(iso).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });

interface Placed {
  item: CxItem;
  top: number;
  height: number;
  col: number;
  cols: number;
}

/** Timed items laid out side by side where they overlap. */
function place(items: CxItem[]): Placed[] {
  const timed = items
    .filter((i) => i.timed)
    .map((item) => {
      const start = minutesOf(item.date);
      const end = item.end && new Date(item.end).toDateString() === new Date(item.date).toDateString() ? minutesOf(item.end) : start + 45;
      return { item, start, end: Math.max(end, start + MIN_MINUTES) };
    })
    .sort((a, b) => a.start - b.start || b.end - a.end);
  const out: Placed[] = [];
  let cluster: (typeof timed[number] & { col: number })[] = [];
  let clusterEnd = -1;
  const flush = () => {
    const cols = Math.max(1, ...cluster.map((c) => c.col + 1));
    for (const c of cluster) out.push({ item: c.item, top: (c.start / 60) * HOUR, height: ((c.end - c.start) / 60) * HOUR, col: c.col, cols });
    cluster = [];
  };
  for (const t of timed) {
    if (t.start >= clusterEnd && cluster.length) flush();
    const taken = new Set(cluster.filter((c) => c.end > t.start).map((c) => c.col));
    let col = 0;
    while (taken.has(col)) col++;
    cluster.push({ ...t, col });
    clusterEnd = Math.max(clusterEnd, t.end);
  }
  if (cluster.length) flush();
  return out;
}

export function TimeGrid({
  days,
  today,
  byDay,
  blocksByDay,
  onOpen,
  onOpenDay,
}: {
  days: string[];
  today: string;
  byDay: Map<string, CxItem[]>;
  blocksByDay: Map<string, PlanBlock[]>;
  onOpen: (item: CxItem) => void;
  onOpenDay: (day: string) => void;
}) {
  const scroller = useRef<HTMLDivElement>(null);
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(timer);
  }, []);

  // Open on the working day: half an hour before the first timed event, or 8 AM.
  const first = useMemo(() => {
    const starts = days.flatMap((d) => (byDay.get(d) ?? []).filter((i) => i.timed).map((i) => minutesOf(i.date)));
    return Math.min(8 * 60, ...starts);
  }, [days, byDay]);
  useEffect(() => {
    if (scroller.current) scroller.current.scrollTop = Math.max(0, ((first - 30) / 60) * HOUR);
    // Only when the days shown change, not on every refresh of the events.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [days.join()]);

  const allDay = days.map((d) => ({ day: d, items: (byDay.get(d) ?? []).filter((i) => !i.timed), blocks: blocksByDay.get(d) ?? [] }));
  const tz = new Intl.DateTimeFormat('en-US', { timeZoneName: 'short' }).formatToParts(new Date()).find((p) => p.type === 'timeZoneName')?.value ?? '';
  const nowTop = (minutesOf(new Date(now).toISOString()) / 60) * HOUR;
  const single = days.length === 1;

  return (
    <div className="cx-tg" data-single={single} style={{ ['--cx-tg-days' as string]: days.length }}>
      <div className="cx-tg-head">
        <div className="cx-tg-corner">{tz}</div>
        {days.map((d) => {
          const date = dayDate(d);
          return (
            <button key={d} type="button" className="cx-tg-dayhead" data-today={d === today} onClick={() => onOpenDay(d)} aria-label={`Open ${date.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}`}>
              <span className="cx-tg-wd">{date.toLocaleDateString('en-US', { weekday: 'short' })}</span>
              <span className="cx-tg-num">{date.getDate()}</span>
            </button>
          );
        })}
      </div>

      <div className="cx-tg-allday">
        <div className="cx-tg-corner cx-tg-allday-label">All day</div>
        {allDay.map(({ day, items, blocks }) => (
          <div key={day} className="cx-tg-allday-cell" data-today={day === today}>
            {items.slice(0, single ? 8 : 3).map((item) => (
              <button key={item.id} type="button" className="cx-tg-chip" data-priority={item.priority} data-kind={item.kind} data-done={item.done} onClick={() => onOpen(item)} title={item.title}>
                {item.title}
              </button>
            ))}
            {blocks.slice(0, single ? 3 : 1).map((b) => (
              <span key={b.id} className="cx-tg-chip cx-tg-ghost" data-priority={b.priority} title={b.why}>
                {hoursLabel(b.hours)} · {b.title}
              </span>
            ))}
            {items.length > (single ? 8 : 3) && (
              <button type="button" className="cx-tg-more" onClick={() => onOpenDay(day)}>
                +{items.length - (single ? 8 : 3)}
              </button>
            )}
          </div>
        ))}
      </div>

      <div ref={scroller} className="cx-tg-scroll">
        <div className="cx-tg-body" style={{ height: 24 * HOUR }}>
          <div className="cx-tg-rail" aria-hidden="true">
            {Array.from({ length: 24 }, (_, h) => (
              <span key={h} style={{ top: h * HOUR }}>
                {h === 0 ? '' : new Date(2000, 0, 1, h).toLocaleTimeString('en-US', { hour: 'numeric' })}
              </span>
            ))}
          </div>
          {days.map((d) => (
            <div key={d} className="cx-tg-col" data-today={d === today}>
              {place(byDay.get(d) ?? []).map(({ item, top, height, col, cols }) => (
                <button
                  key={item.id}
                  type="button"
                  className="cx-tg-event"
                  data-priority={item.priority}
                  data-kind={item.kind}
                  data-done={item.done}
                  style={{ top, height: height - 2, left: `calc(${(col / cols) * 100}% + 2px)`, width: `calc(${100 / cols}% - 4px)` }}
                  onClick={() => onOpen(item)}
                  title={`${item.title} · ${clock(item.date)}`}
                >
                  <span className="cx-tg-ev-title">{item.title}</span>
                  {height >= 40 && <span className="cx-tg-ev-time">{clock(item.date)}{item.end ? ` – ${clock(item.end)}` : ''}</span>}
                </button>
              ))}
              {d === today && <span className="cx-tg-now" style={{ top: nowTop }} aria-hidden="true" />}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
