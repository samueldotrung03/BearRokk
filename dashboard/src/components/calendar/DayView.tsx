// The day view: one day in full. Items with a time of their own (a deadline at 5 PM, an event at
// 6) sit on a timeline by the hour; the rest of the day's items, and any suggested work blocks,
// are listed above it as "All day". It scrolls inside the calendar's fixed frame.
import { TriangleExclamationPoint } from 'lucide-react';
import { dayDate, dayLabel, hoursLabel } from '../../lib/cal/days.ts';
import { cxKindLabel, type Conflict, type CxItem } from '../../lib/cal/items.ts';
import type { PlanBlock } from '../../lib/cal/planner.ts';

/** Minutes after midnight, or null for an item that has no time of its own. */
function timeOf(item: CxItem): number | null {
  // Reminders, roadmap steps and the student's own items are for the day, not a moment in it.
  if (item.kind === 'reminder' || item.kind === 'step' || item.kind === 'personal') return null;
  if (item.kind === 'google' && item.why.startsWith('All day')) return null;
  const d = new Date(item.date);
  const minutes = d.getHours() * 60 + d.getMinutes();
  if (item.kind === 'google') return minutes;
  return minutes === 0 || minutes === 12 * 60 ? null : minutes;
}

const clock = (minutes: number) => new Date(2000, 0, 1, Math.floor(minutes / 60), minutes % 60).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });

const FIRST_HOUR = 7;
const LAST_HOUR = 23;

function Entry({ item, onOpen }: { item: CxItem; onOpen: (item: CxItem) => void }) {
  if (item.kind === 'google') {
    return (
      <a href={item.link ?? undefined} target="_blank" rel="noreferrer" className="cx-day-item" data-kind="google" data-priority={item.priority}>
        <span className="text-xs font-semibold tracking-wide uppercase opacity-75">Google Calendar</span>
        <span className="block text-sm leading-snug font-semibold">{item.title}</span>
        {item.why && <span className="mt-0.5 block text-xs leading-relaxed opacity-80">{item.why}</span>}
      </a>
    );
  }
  return (
    <button type="button" onClick={() => onOpen(item)} className="cx-day-item" data-priority={item.priority} data-done={item.done} disabled={!item.opportunityId}>
      <span className="text-xs font-semibold tracking-wide uppercase opacity-75">{cxKindLabel[item.kind]}</span>
      <span className="block text-sm leading-snug font-semibold">{item.title}</span>
      {item.why && <span className="mt-0.5 block text-xs leading-relaxed opacity-80">{item.why}</span>}
    </button>
  );
}

export function DayView({
  day,
  today,
  items,
  blocks,
  conflict,
  onOpen,
}: {
  day: string;
  today: string;
  items: CxItem[];
  blocks: PlanBlock[];
  conflict: Conflict | undefined;
  /** Open an item's opportunity. */
  onOpen: (item: CxItem) => void;
}) {
  const allDay = items.filter((item) => timeOf(item) === null);
  const timed = items.filter((item) => timeOf(item) !== null).sort((a, b) => timeOf(a)! - timeOf(b)!);
  // Hours shown: the working day, stretched to take in anything timed outside it.
  const first = Math.min(FIRST_HOUR, ...timed.map((item) => Math.floor(timeOf(item)! / 60)));
  const last = Math.max(LAST_HOUR, ...timed.map((item) => Math.floor(timeOf(item)! / 60)));
  const hours = Array.from({ length: last - first + 1 }, (_, i) => first + i);
  const date = dayDate(day);

  return (
    <div className="cx-dayview" aria-label={date.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}>
      <div className="cx-dayview-head">
        <p className="text-sm font-semibold text-ink-2">{dayLabel(day, today)}</p>
        {conflict && (
          <p className="flex items-center gap-1.5 text-sm font-semibold text-orange-700">
            <TriangleExclamationPoint className="size-4" strokeWidth={2.5} aria-hidden="true" />
            {conflict.items.length} things you committed to land today
          </p>
        )}
      </div>

      <section className="cx-dayview-allday" aria-label="All day">
        <h3>All day</h3>
        {allDay.length === 0 && blocks.length === 0 ? (
          <p className="text-sm text-ink-3">Nothing for the whole day.</p>
        ) : (
          <div className="grid gap-2">
            {allDay.map((item) => (
              <Entry key={item.id} item={item} onOpen={onOpen} />
            ))}
            {blocks.map((block) => (
              <div key={block.id} className="cx-day-block" data-priority={block.priority}>
                <span className="text-xs font-semibold tracking-wide uppercase opacity-75">Suggested · {hoursLabel(block.hours)}</span>
                <span className="block text-sm font-semibold">{block.title}</span>
              </div>
            ))}
          </div>
        )}
      </section>

      <ol className="cx-dayview-hours" aria-label="By the hour">
        {hours.map((hour) => {
          const here = timed.filter((item) => Math.floor(timeOf(item)! / 60) === hour);
          return (
            <li key={hour} className="cx-dayview-hour">
              <span className="cx-dayview-time">{clock(hour * 60)}</span>
              <div className="grid gap-2">
                {here.map((item) => (
                  <div key={item.id}>
                    <span className="mb-1 block text-xs font-semibold text-ink-3">{clock(timeOf(item)!)}</span>
                    <Entry item={item} onOpen={onOpen} />
                  </div>
                ))}
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
