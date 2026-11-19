// The month view: six weeks of days. Arrow keys move the selected day (Home and End go to the
// week's ends, Page Up and Page Down change month). Only the selected day is in the tab order,
// so Tab leaves the grid in one press instead of forty-two.
import { TriangleExclamationPoint } from 'lucide-react';
import { useEffect, useRef } from 'react';
import { dayKey } from '../../lib/calendar.ts';
import { DAY_NAMES, dayRange, startOfWeek, hoursLabel } from '../../lib/cal/days.ts';
import { dayLoad, type Conflict, type CxItem } from '../../lib/cal/items.ts';
import type { PlanBlock } from '../../lib/cal/planner.ts';
import { moveByKey } from './keys.ts';

const LOAD_WORD = ['', 'light day', 'busy day', 'heavy day'] as const;

export function MonthGrid({
  month,
  today,
  selected,
  byDay,
  blocksByDay,
  conflicts,
  onSelect,
}: {
  month: Date;
  today: string;
  selected: string;
  byDay: Map<string, CxItem[]>;
  blocksByDay: Map<string, PlanBlock[]>;
  conflicts: Map<string, Conflict>;
  onSelect: (day: string) => void;
}) {
  const grid = useRef<HTMLDivElement>(null);
  const wantFocus = useRef(false);
  const first = dayKey(new Date(month.getFullYear(), month.getMonth(), 1, 12));
  const cells = dayRange(startOfWeek(first), 42);
  const weeks = Array.from({ length: 6 }, (_, index) => cells.slice(index * 7, index * 7 + 7));

  // After a key moves the selection, focus follows it, even when the month changed under it.
  useEffect(() => {
    if (!wantFocus.current) return;
    wantFocus.current = false;
    grid.current?.querySelector<HTMLButtonElement>(`[data-day="${selected}"]`)?.focus();
  }, [selected, month]);

  return (
    <div
      ref={grid}
      className="cal-grid cx-month"
      role="grid"
      aria-label={month.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
      onKeyDown={(event) => {
        const next = moveByKey(event, selected);
        if (!next) return;
        event.preventDefault();
        wantFocus.current = true;
        onSelect(next);
      }}
    >
      <div role="row" className="cx-row">
        {DAY_NAMES.map((name) => (
          <div key={name} className="cal-weekday" role="columnheader">
            {name}
          </div>
        ))}
      </div>
      {weeks.map((week) => (
        <div role="row" className="cx-row" key={week[0]}>
          {week.map((key) => {
            const date = new Date(`${key}T12:00:00`);
            const list = byDay.get(key) ?? [];
            const blocks = blocksByDay.get(key) ?? [];
            const load = dayLoad(list, blocks.reduce((sum, b) => sum + b.hours, 0));
            const clash = conflicts.get(key);
            const shown = list.slice(0, 2);
            const ghosts = blocks.slice(0, Math.max(0, 2 - shown.length));
            const hidden = list.length + blocks.length - shown.length - ghosts.length;
            const label = [
              date.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' }),
              `${list.length} ${list.length === 1 ? 'item' : 'items'}`,
              blocks.length > 0 ? `${blocks.length} suggested work ${blocks.length === 1 ? 'block' : 'blocks'}` : '',
              load.level > 0 ? LOAD_WORD[load.level] : '',
              clash ? `${clash.items.length} commitments clash` : '',
            ]
              .filter(Boolean)
              .join(', ');
            return (
              <button
                key={key}
                type="button"
                role="gridcell"
                data-day={key}
                tabIndex={key === selected ? 0 : -1}
                className="cal-cell cx-cell"
                data-outside={date.getMonth() !== month.getMonth()}
                data-today={key === today}
                data-past={key < today}
                aria-selected={key === selected}
                aria-label={label}
                onClick={() => onSelect(key)}
              >
                <span className="flex items-center justify-between gap-1">
                  <span className="cal-day">{date.getDate()}</span>
                  {hidden > 0 && <span className="cal-more ml-auto">+{hidden}</span>}
                  {clash && (
                    <span className="cx-clash" title={`${clash.items.length} things you committed to land on this day`}>
                      <TriangleExclamationPoint className="size-3" strokeWidth={2.5} aria-hidden="true" />
                      {clash.items.length}
                    </span>
                  )}
                </span>
                {shown.map((item) => (
                  <span key={item.id} className="cal-pill" data-priority={item.priority} data-done={item.done} data-kind={item.kind}>
                    {item.title}
                  </span>
                ))}
                {ghosts.map((block) => (
                  <span key={block.id} className="cx-ghost-pill" data-priority={block.priority}>
                    {hoursLabel(block.hours)} · {block.title}
                  </span>
                ))}
                {load.level > 0 && <span className="cx-load" data-level={load.level} aria-hidden="true" />}
              </button>
            );
          })}
        </div>
      ))}
    </div>
  );
}
