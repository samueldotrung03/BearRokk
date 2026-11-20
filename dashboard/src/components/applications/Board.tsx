// Board view: one column per status. Cards can be dragged between columns, or moved with the
// arrow buttons on each card, which work from the keyboard and with screen readers. Every move
// is announced, so the result is clear without seeing the board.
import { ChevronLeft, ChevronRight, GripVertical } from 'lucide-react';
import { useState } from 'react';
import { STATUSES, statusLabel } from '../../lib/applications.ts';
import { neighborStatus } from '../../lib/apps/board.ts';
import { dueLabel } from '../../lib/time.ts';
import { useStore } from '../../state/StoreProvider.tsx';
import type { ApplicationStatus } from '../../types.ts';
import { typeMeta } from '../meta.ts';
import { scoreTone, type Item } from './shared.tsx';

const columnNote: Record<ApplicationStatus, string> = {
  interested: 'Thinking about it',
  to_apply: 'Decided, not started',
  applying: 'Working on it',
  applied: 'Sent',
};

export function Board({ items, onOpen }: { items: Item[]; onOpen: (id: string) => void }) {
  const { dispatch } = useStore();
  const [over, setOver] = useState<ApplicationStatus | null>(null);
  const [dragging, setDragging] = useState<string | null>(null);
  const [announce, setAnnounce] = useState('');

  function move(item: Item, status: ApplicationStatus, direction?: 'left' | 'right') {
    if (item.application.status === status) return;
    const id = item.opportunity.id;
    dispatch({ type: 'setApplication', id, status });
    setAnnounce(`${item.opportunity.title} moved to ${statusLabel[status]}.`);
    // The card is rebuilt in its new column, so focus goes back to the same arrow there, or to
    // the other arrow when the card reached the end of the board.
    if (direction) {
      requestAnimationFrame(() => {
        const card = document.querySelector(`[data-card="${id}"]`);
        const same = card?.querySelector<HTMLButtonElement>(`[data-dir="${direction}"]:not(:disabled)`);
        (same ?? card?.querySelector<HTMLButtonElement>('[data-dir]:not(:disabled)'))?.focus();
      });
    }
  }

  return (
    <>
      <p className="sr-only" aria-live="assertive">
        {announce}
      </p>
      <div className="ap-board">
        {STATUSES.map((status) => {
          const column = items.filter((i) => i.application.status === status);
          return (
            <section
              key={status}
              className="ap-column"
              data-over={over === status}
              aria-labelledby={`ap-col-${status}`}
              onDragOver={(event) => {
                if (!dragging) return;
                event.preventDefault();
                event.dataTransfer.dropEffect = 'move';
                setOver(status);
              }}
              onDragLeave={(event) => {
                if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setOver(null);
              }}
              onDrop={(event) => {
                event.preventDefault();
                const id = event.dataTransfer.getData('text/plain');
                const item = items.find((i) => i.opportunity.id === id);
                if (item) move(item, status);
                setOver(null);
                setDragging(null);
              }}
            >
              <header className="flex items-baseline justify-between px-1 pb-2">
                <div>
                  <h3 id={`ap-col-${status}`} className="text-sm font-semibold text-ink">
                    {statusLabel[status]}
                  </h3>
                  <p className="text-xs text-ink-3">{columnNote[status]}</p>
                </div>
                <span className="font-display text-2xl leading-none text-ink-3">{column.length}</span>
              </header>
              <ul className="flex min-h-24 flex-col gap-2.5">
                {column.map((item) => (
                  <BoardCard
                    key={item.opportunity.id}
                    item={item}
                    dragging={dragging === item.opportunity.id}
                    onDragStart={() => setDragging(item.opportunity.id)}
                    onDragEnd={() => {
                      setDragging(null);
                      setOver(null);
                    }}
                    onMove={(to, direction) => move(item, to, direction)}
                    onOpen={() => onOpen(item.opportunity.id)}
                  />
                ))}
                {column.length === 0 && <li className="ap-drop-hint">Drop a card here</li>}
              </ul>
            </section>
          );
        })}
      </div>
    </>
  );
}

function BoardCard({
  item,
  dragging,
  onDragStart,
  onDragEnd,
  onMove,
  onOpen,
}: {
  item: Item;
  dragging: boolean;
  onDragStart: () => void;
  onDragEnd: () => void;
  onMove: (status: ApplicationStatus, direction: 'left' | 'right') => void;
  onOpen: () => void;
}) {
  const { opportunity: o, application, readiness } = item;
  const left = neighborStatus(application.status, -1);
  const right = neighborStatus(application.status, 1);
  const Icon = typeMeta[o.type].icon;
  const urgent = readiness.daysLeft !== null && readiness.daysLeft <= 7 && application.status !== 'applied';

  return (
    <li
      className="ap-card"
      data-card={o.id}
      data-dragging={dragging}
      draggable
      onDragStart={(event) => {
        event.dataTransfer.setData('text/plain', o.id);
        event.dataTransfer.effectAllowed = 'move';
        onDragStart();
      }}
      onDragEnd={onDragEnd}
    >
      <div className="flex items-start gap-2">
        <GripVertical className="mt-0.5 size-4 shrink-0 cursor-grab text-ink-3/60" aria-hidden="true" />
        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-1.5 text-xs text-ink-3">
            <Icon className="size-3.5" aria-hidden="true" />
            <span className="truncate">{o.organizer}</span>
          </p>
          <button type="button" onClick={onOpen} className="mt-0.5 text-left text-sm leading-snug font-semibold text-ink hover:text-brand">
            {o.title}
          </button>
        </div>
      </div>

      <div className="mt-2.5 flex items-center gap-2">
        <div className="ap-mini-bar" data-tone={scoreTone(readiness.score)} aria-hidden="true">
          <span style={{ width: `${readiness.score}%` }} />
        </div>
        <span className="text-xs text-ink-3 tabular-nums">{readiness.score}% ready</span>
      </div>
      <p className={`mt-1.5 text-xs ${urgent ? 'font-semibold text-orange-700' : 'text-ink-3'}`}>{o.deadline ? dueLabel(o.deadline) : 'No deadline on the posting'}</p>
      <p className="mt-1 line-clamp-2 text-xs text-ink-2">
        <span className="font-semibold text-ink">Next:</span> {readiness.next.label}
      </p>

      <div className="mt-2.5 flex items-center justify-between gap-1 border-t border-line pt-2">
        <button
          type="button"
          className="ap-move"
          data-dir="left"
          disabled={!left}
          onClick={() => left && onMove(left, 'left')}
          aria-label={left ? `Move ${o.title} to ${statusLabel[left]}` : 'Already in the first column'}
        >
          <ChevronLeft className="size-4" aria-hidden="true" />
        </button>
        <button type="button" onClick={onOpen} className="text-xs font-semibold text-brand hover:underline">
          Open
        </button>
        <button
          type="button"
          className="ap-move"
          data-dir="right"
          disabled={!right}
          onClick={() => right && onMove(right, 'right')}
          aria-label={right ? `Move ${o.title} to ${statusLabel[right]}` : 'Already in the last column'}
        >
          <ChevronRight className="size-4" aria-hidden="true" />
        </button>
      </div>
    </li>
  );
}
