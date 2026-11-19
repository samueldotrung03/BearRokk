// The agenda: everything from today on as one list grouped by day, with anything overdue first.
// Good for reading the reasons; the day panel beside it still has the actions.
import { ArrowUpRight, Check, TriangleExclamationPoint } from 'lucide-react';
import { addDays, dayLabel, hoursLabel } from '../../lib/cal/days.ts';
import { cxKindLabel, dayLoad, groupByDay, type Conflict, type CxItem } from '../../lib/cal/items.ts';
import type { PlanBlock } from '../../lib/cal/planner.ts';

const LOAD_WORD = ['Free', 'Light', 'Busy', 'Heavy'] as const;

export function AgendaView({
  today,
  selected,
  items,
  blocks,
  conflicts,
  onSelect,
  onAccept,
}: {
  today: string;
  selected: string;
  items: CxItem[];
  blocks: PlanBlock[];
  conflicts: Map<string, Conflict>;
  onSelect: (day: string) => void;
  onAccept: (block: PlanBlock) => void;
}) {
  const overdue = items.filter((item) => item.day < today && !item.done && item.kind !== 'reminder');
  const ahead = groupByDay(items.filter((item) => item.day >= today));
  const blocksByDay = groupByDay(blocks);
  const days = [...new Set([...ahead.keys(), ...blocksByDay.keys()])].sort();

  if (overdue.length === 0 && days.length === 0) {
    return <p className="py-10 text-center text-sm text-ink-2">Nothing from today on matches these filters.</p>;
  }

  return (
    <div className="cx-agenda">
      {overdue.length > 0 && (
        <section className="cx-agenda-day" data-tone="late">
          <h3 className="cx-agenda-head">
            <span>Overdue</span>
            <span className="cx-agenda-meta">{overdue.length} past their date</span>
          </h3>
          <ul className="grid gap-1.5">
            {overdue.map((item) => (
              <Row key={item.id} item={item} today={today} onSelect={onSelect} showDay />
            ))}
          </ul>
        </section>
      )}
      {days.map((day) => {
        const list = ahead.get(day) ?? [];
        const dayBlocks = blocksByDay.get(day) ?? [];
        const load = dayLoad(list, dayBlocks.reduce((sum, b) => sum + b.hours, 0));
        const clash = conflicts.get(day);
        return (
          <section key={day} className="cx-agenda-day" data-selected={day === selected}>
            <h3 className="cx-agenda-head">
              <button type="button" onClick={() => onSelect(day)} className="text-left">
                {dayLabel(day, today)}
                {day <= addDays(today, 1) && <span className="ml-2 font-normal text-ink-3">{new Date(`${day}T12:00:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>}
              </button>
              <span className="cx-agenda-meta">
                {clash && (
                  <span className="cx-clash">
                    <TriangleExclamationPoint className="size-3" strokeWidth={2.5} aria-hidden="true" />
                    {clash.items.length} clash
                  </span>
                )}
                <span className="cx-load-chip" data-level={load.level}>
                  {LOAD_WORD[load.level]}
                </span>
              </span>
            </h3>
            <ul className="grid gap-1.5">
              {list.map((item) => (
                <Row key={item.id} item={item} today={today} onSelect={onSelect} />
              ))}
              {dayBlocks.map((block) => (
                <li key={block.id} className="cx-agenda-row cx-ghost-row" data-priority={block.priority}>
                  <span className="cx-agenda-kind">Suggested · {hoursLabel(block.hours)}</span>
                  <span className="min-w-0 flex-1 truncate font-medium">{block.title}</span>
                  <button type="button" className="cx-accept-mini" onClick={() => onAccept(block)} aria-label={`Accept ${hoursLabel(block.hours)} on ${block.title}`}>
                    <Check className="size-3" strokeWidth={3} aria-hidden="true" /> Accept
                  </button>
                </li>
              ))}
            </ul>
          </section>
        );
      })}
    </div>
  );
}

function Row({ item, today, onSelect, showDay = false }: { item: CxItem; today: string; onSelect: (day: string) => void; showDay?: boolean }) {
  return (
    <li>
      <button type="button" onClick={() => onSelect(item.day)} className="cx-agenda-row" data-kind={item.kind} data-priority={item.priority} data-done={item.done}>
        <span className="cx-agenda-kind">{item.hours ? `Work · ${hoursLabel(item.hours)}` : cxKindLabel[item.kind]}</span>
        <span className="min-w-0 flex-1">
          <span className={`block truncate font-semibold ${item.done ? 'line-through opacity-60' : ''}`}>{item.title}</span>
          <span className="block truncate text-[13px] text-ink-2">{item.why}</span>
        </span>
        {showDay && <span className="shrink-0 text-[13px] text-ink-3">{dayLabel(item.day, today)}</span>}
        <ArrowUpRight className="size-3.5 shrink-0 text-ink-3" aria-hidden="true" />
      </button>
    </li>
  );
}
