// The week view: seven columns, each with the day's items and, while the plan is open, its
// suggested work blocks with a one-click Accept. Arrow keys move the selected day as in the month.
import { Check, TriangleExclamationPoint } from 'lucide-react';
import { useEffect, useRef } from 'react';
import { dayDate, dayRange, hoursLabel, startOfWeek } from '../../lib/cal/days.ts';
import { cxKindLabel, dayLoad, type Conflict, type CxItem } from '../../lib/cal/items.ts';
import type { PlanBlock, PlanDay } from '../../lib/cal/planner.ts';
import { moveByKey } from './keys.ts';

export function WeekView({
  today,
  selected,
  byDay,
  blocksByDay,
  planDays,
  conflicts,
  onSelect,
  onAccept,
}: {
  today: string;
  selected: string;
  byDay: Map<string, CxItem[]>;
  blocksByDay: Map<string, PlanBlock[]>;
  planDays: Map<string, PlanDay>;
  conflicts: Map<string, Conflict>;
  onSelect: (day: string) => void;
  onAccept: (block: PlanBlock) => void;
}) {
  const root = useRef<HTMLDivElement>(null);
  const wantFocus = useRef(false);
  const days = dayRange(startOfWeek(selected), 7);

  useEffect(() => {
    if (!wantFocus.current) return;
    wantFocus.current = false;
    root.current?.querySelector<HTMLButtonElement>(`[data-day="${selected}"]`)?.focus();
  }, [selected]);

  return (
    <div
      ref={root}
      className="cx-week"
      role="grid"
      aria-label="Week"
      onKeyDown={(event) => {
        if (!(event.target instanceof HTMLElement) || !event.target.dataset.day) return;
        const next = moveByKey(event, selected);
        if (!next) return;
        event.preventDefault();
        wantFocus.current = true;
        onSelect(next);
      }}
    >
      <div role="row" className="cx-row">
        {days.map((day) => {
          const date = dayDate(day);
          const list = byDay.get(day) ?? [];
          const blocks = blocksByDay.get(day) ?? [];
          const load = dayLoad(list, blocks.reduce((sum, b) => sum + b.hours, 0));
          const plan = planDays.get(day);
          const clash = conflicts.get(day);
          return (
            <div key={day} role="gridcell" className="cx-week-col" data-selected={day === selected} data-today={day === today} data-past={day < today}>
              <button
                type="button"
                data-day={day}
                tabIndex={day === selected ? 0 : -1}
                aria-pressed={day === selected}
                aria-label={`${date.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}, ${list.length} items`}
                onClick={() => onSelect(day)}
                className="cx-week-head"
              >
                <span className="text-xs font-semibold tracking-wide text-ink-3 uppercase">
                  {date.toLocaleDateString('en-US', { weekday: 'short' })}
                </span>
                <span className="cx-week-num">{date.getDate()}</span>
                <span className="cx-meter" aria-hidden="true">
                  <span data-level={load.level} style={{ width: `${Math.min(100, load.score * 18)}%` }} />
                </span>
                {plan && (
                  <span className="text-[11px] font-medium text-ink-3">
                    {hoursLabel(plan.accepted + plan.suggested)} of {hoursLabel(plan.capacity)}
                  </span>
                )}
              </button>
              {clash && (
                <p className="cx-week-clash">
                  <TriangleExclamationPoint className="size-3 shrink-0" strokeWidth={2.5} aria-hidden="true" />
                  {clash.items.length} commitments
                </p>
              )}
              <ul className="grid gap-1.5">
                {list.map((item) => (
                  <li key={item.id}>
                    <button type="button" onClick={() => onSelect(day)} className="cx-week-item" data-priority={item.priority} data-done={item.done}>
                      <span className="text-[10px] font-semibold tracking-wide uppercase opacity-70">
                        {item.hours ? `Work block · ${hoursLabel(item.hours)}` : cxKindLabel[item.kind]}
                      </span>
                      <span className="line-clamp-3">{item.title}</span>
                    </button>
                  </li>
                ))}
                {blocks.map((block) => (
                  <li key={block.id} className="cx-ghost" data-priority={block.priority}>
                    <span className="text-[10px] font-semibold tracking-wide uppercase opacity-70">Suggested · {hoursLabel(block.hours)}</span>
                    <span className="line-clamp-2 text-[12px] leading-snug font-medium">{block.title}</span>
                    <button type="button" className="cx-accept-mini" onClick={() => onAccept(block)} aria-label={`Accept ${hoursLabel(block.hours)} on ${block.title}`}>
                      <Check className="size-3" strokeWidth={3} aria-hidden="true" /> Accept
                    </button>
                  </li>
                ))}
              </ul>
              {list.length === 0 && blocks.length === 0 && <p className="px-1 text-xs text-ink-3">Free</p>}
            </div>
          );
        })}
      </div>
    </div>
  );
}
