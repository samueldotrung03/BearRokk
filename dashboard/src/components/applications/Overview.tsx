// The top of the page: the status funnel (which also filters the list) and the "what to do
// next" strip, every tracked application's single next step ranked by urgency.
import { ChevronRight, LayoutList, Search, SquareKanban, Target, X } from 'lucide-react';
import { STATUSES, statusLabel } from '../../lib/applications.ts';
import { sortLabel, type SortKey } from '../../lib/apps/board.ts';
import { rankActions } from '../../lib/apps/readiness.ts';
import { dueLabel } from '../../lib/time.ts';
import type { ApplicationStatus } from '../../types.ts';
import { NextButton } from './Summary.tsx';
import type { GoTo, Item } from './shared.tsx';

const stageNote: Record<ApplicationStatus, string> = {
  interested: 'Thinking about it',
  to_apply: 'Decided to apply',
  applying: 'Working on it',
  applied: 'Sent',
};

export function Funnel({
  counts,
  filter,
  onFilter,
}: {
  counts: Record<ApplicationStatus, number>;
  filter: ApplicationStatus | 'all';
  onFilter: (status: ApplicationStatus | 'all') => void;
}) {
  const total = STATUSES.reduce((sum, s) => sum + counts[s], 0);
  return (
    <div className="ap-funnel" role="group" aria-label="Applications by status. Pick one to filter the list.">
      {STATUSES.map((status, index) => (
        <div key={status} className="contents">
          {index > 0 && <ChevronRight className="ap-funnel-arrow size-4" aria-hidden="true" />}
          <button type="button" aria-pressed={filter === status} onClick={() => onFilter(filter === status ? 'all' : status)} className="ap-stage">
            <span className="font-display text-[44px] leading-none text-ink">{counts[status]}</span>
            <span className="mt-1.5 text-sm font-semibold">{statusLabel[status]}</span>
            <span className="text-xs text-ink-3">{stageNote[status]}</span>
            <span className="ap-stage-bar" aria-hidden="true">
              <span style={{ width: total ? `${(counts[status] / total) * 100}%` : 0 }} />
            </span>
          </button>
        </div>
      ))}
    </div>
  );
}

export function NextUp({ items, goTo }: { items: Item[]; goTo: GoTo }) {
  const ranked = rankActions(items.map((item) => ({ id: item.opportunity.id, readiness: item.readiness }))).filter(
    (a) => a.action.kind !== 'follow_up' && a.action.kind !== 'closed',
  );
  if (ranked.length === 0) return null;
  const byId = new Map(items.map((i) => [i.opportunity.id, i]));
  const top = ranked.slice(0, 3);
  const average = Math.round(items.reduce((sum, i) => sum + i.readiness.score, 0) / items.length);

  return (
    <section className="ap-nextup" aria-labelledby="ap-nextup-title">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h2 id="ap-nextup-title" className="flex items-center gap-2 text-lg font-semibold tracking-tight">
            <Target className="size-5 text-brand" aria-hidden="true" />
            What to do next
          </h2>
          <p className="text-sm text-ink-3">Ranked by how close each deadline is and how much is left.</p>
        </div>
        <p className="text-sm text-ink-3">
          Average readiness <span className="font-display text-2xl text-ink">{average}</span>
        </p>
      </div>
      <ol className="mt-4 grid gap-3 md:grid-cols-3">
        {top.map((entry, index) => {
          const item = byId.get(entry.id)!;
          const o = item.opportunity;
          return (
            <li key={entry.id} className="ap-next-tile" data-first={index === 0}>
              <div className="flex items-start justify-between gap-3">
                <span className="font-display text-4xl leading-none text-brand/80" aria-hidden="true">
                  {index + 1}
                </span>
                <span className={`ap-chip-quiet ${item.readiness.daysLeft !== null && item.readiness.daysLeft <= 7 ? 'ap-chip-hot' : ''}`}>
                  {o.deadline ? dueLabel(o.deadline) : 'No deadline stated'}
                </span>
              </div>
              <p className="mt-3 text-[15px] leading-snug font-semibold text-ink">{entry.action.label}</p>
              <p className="mt-0.5 truncate text-sm text-ink-2">
                {o.organizer} · {o.title}
              </p>
              <p className="mt-1 text-xs leading-relaxed text-ink-3">{entry.action.detail}</p>
              <div className="mt-auto pt-3">
                <NextButton item={item} goTo={goTo} tone={index === 0 ? 'solid' : 'soft'} />
              </div>
            </li>
          );
        })}
      </ol>
    </section>
  );
}

export type View = 'list' | 'board';

export function Toolbar({
  query,
  onQuery,
  sort,
  onSort,
  view,
  onView,
  filter,
  onClearFilter,
  shown,
}: {
  query: string;
  onQuery: (value: string) => void;
  sort: SortKey;
  onSort: (value: SortKey) => void;
  view: View;
  onView: (value: View) => void;
  filter: ApplicationStatus | 'all';
  onClearFilter: () => void;
  shown: number;
}) {
  return (
    <div className="ap-toolbar">
      <label className="ap-search">
        <Search className="size-4 text-ink-3" aria-hidden="true" />
        <span className="sr-only">Search applications</span>
        <input type="search" value={query} onChange={(event) => onQuery(event.target.value)} placeholder="Search by name, organizer or tag" />
      </label>
      {filter !== 'all' && (
        <button type="button" onClick={onClearFilter} className="ap-chip" aria-label={`Clear the ${statusLabel[filter]} filter`}>
          {statusLabel[filter]}
          <X className="size-3.5" aria-hidden="true" />
        </button>
      )}
      <span className="text-sm text-ink-3 tabular-nums" aria-live="polite">
        {shown} shown
      </span>
      <div className="ml-auto flex items-center gap-2">
        <label className="ap-select">
          <span className="sr-only">Sort by</span>
          <select value={sort} onChange={(event) => onSort(event.target.value as SortKey)}>
            {(Object.keys(sortLabel) as SortKey[]).map((key) => (
              <option key={key} value={key}>
                {sortLabel[key]}
              </option>
            ))}
          </select>
        </label>
        <div className="app-status" role="group" aria-label="View">
          <button type="button" aria-pressed={view === 'list'} onClick={() => onView('list')} className="inline-flex items-center gap-1.5">
            <LayoutList className="size-4" aria-hidden="true" />
            List
          </button>
          <button type="button" aria-pressed={view === 'board'} onClick={() => onView('board')} className="inline-flex items-center gap-1.5">
            <SquareKanban className="size-4" aria-hidden="true" />
            Board
          </button>
        </div>
      </div>
    </div>
  );
}
