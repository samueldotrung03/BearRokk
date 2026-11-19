// What opens when an event is clicked: what it is, when, why it is there, and what can be done with
// it (open the posting, open it in Google Calendar, edit, delete, tick it off).
import { ArrowUpRight, Check, Pencil, Trash } from 'lucide-react';
import { cxKindLabel, type CxItem } from '../../lib/cal/items.ts';
import { longDay } from '../../lib/cal/days.ts';
import type { Opportunity } from '../../types.ts';
import { EventDialog } from './DayPanel.tsx';

const clock = (iso: string) => new Date(iso).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });

export function EventCard({
  item,
  opportunity,
  onClose,
  onOpenDetails,
  onEdit,
  onDelete,
  onToggleDone,
}: {
  item: CxItem;
  opportunity: Opportunity | null;
  onClose: () => void;
  onOpenDetails: (o: Opportunity) => void;
  onEdit: (personalId: string) => void;
  onDelete: (personalId: string) => void;
  onToggleDone: (item: CxItem) => void;
}) {
  const when = item.timed ? `${longDay(item.day)} · ${clock(item.date)}${item.end ? ` – ${clock(item.end)}` : ''}` : `${longDay(item.day)} · all day`;
  // Google events say nothing about where they came from: the color already says it.
  const label = item.kind === 'google' ? null : item.hours ? 'Work block' : cxKindLabel[item.kind];
  const tickable = item.stepId !== null || item.personalId !== null;
  return (
    <EventDialog onClose={onClose}>
      <div className="cx-event-card" data-kind={item.kind} data-priority={item.priority}>
        {label && <p className="cx-event-kind">{label}</p>}
        <h2 className={`font-display text-3xl leading-tight ${item.done ? 'line-through opacity-60' : ''}`}>{item.title}</h2>
        <p className="mt-1 text-sm font-medium text-ink-2">{when}</p>
        {item.why && <p className="mt-3 text-sm leading-relaxed break-words text-ink-2">{item.why}</p>}
        <div className="mt-5 flex flex-wrap items-center gap-2">
          {opportunity && (
            <button type="button" className="btn-primary inline-flex h-10 items-center gap-1.5 rounded-xl px-4 text-sm font-semibold text-white" onClick={() => onOpenDetails(opportunity)}>
              Open details <ArrowUpRight className="size-4" aria-hidden="true" />
            </button>
          )}
          {item.link && (
            <a href={item.link} target="_blank" rel="noreferrer" className="inline-flex h-10 items-center gap-1.5 rounded-xl border border-line bg-white px-4 text-sm font-semibold text-ink">
              Open in Google Calendar <ArrowUpRight className="size-4" aria-hidden="true" />
            </a>
          )}
          {tickable && (
            <button type="button" className="inline-flex h-10 items-center gap-1.5 rounded-xl border border-line bg-white px-4 text-sm font-semibold text-ink" onClick={() => onToggleDone(item)}>
              <Check className="size-4" aria-hidden="true" /> {item.done ? 'Not done' : 'Done'}
            </button>
          )}
          {item.personalId && item.hours === null && (
            <button type="button" className="inline-flex h-10 items-center gap-1.5 rounded-xl border border-line bg-white px-4 text-sm font-semibold text-ink" onClick={() => onEdit(item.personalId!)}>
              <Pencil className="size-4" aria-hidden="true" /> Edit
            </button>
          )}
          {item.personalId && (
            <button type="button" className="inline-flex h-10 items-center gap-1.5 rounded-xl px-3 text-sm font-semibold text-ink-3 hover:text-orange-700" onClick={() => onDelete(item.personalId!)}>
              <Trash className="size-4" aria-hidden="true" /> Delete
            </button>
          )}
        </div>
      </div>
    </EventDialog>
  );
}
