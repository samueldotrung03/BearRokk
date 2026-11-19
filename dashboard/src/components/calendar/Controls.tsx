// The calendar's toolbar pieces: the view switch and the filter chips.
import { CalendarDays, Columns3, List } from 'lucide-react';
import type { Priority } from '../../lib/calendar.ts';
import { ALL_KINDS, allFilters, cxKindLabel, filtersActive, type CxFilters, type CxKind } from '../../lib/cal/items.ts';

export type CalendarView = 'month' | 'week' | 'agenda';
const VIEWS: { id: CalendarView; label: string; icon: typeof List }[] = [
  { id: 'month', label: 'Month', icon: CalendarDays },
  { id: 'week', label: 'Week', icon: Columns3 },
  { id: 'agenda', label: 'Agenda', icon: List },
];

export function ViewToggle({ view, onChange }: { view: CalendarView; onChange: (view: CalendarView) => void }) {
  const index = Math.max(0, VIEWS.findIndex((v) => v.id === view));
  return (
    <div className="cx-views" role="tablist" aria-label="Calendar view" style={{ ['--cx-i' as string]: index }}>
      <span className="cx-views-thumb" aria-hidden="true" />
      {VIEWS.map(({ id, label, icon: Icon }) => (
        <button
          key={id}
          type="button"
          role="tab"
          aria-selected={view === id}
          onClick={() => onChange(id)}
          onKeyDown={(event) => {
            // Left and right move between the tabs, as a tab list should.
            if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
            event.preventDefault();
            const next = VIEWS[(index + (event.key === 'ArrowRight' ? 1 : VIEWS.length - 1)) % VIEWS.length]!;
            onChange(next.id);
            (event.currentTarget.parentElement?.querySelectorAll('button')[VIEWS.indexOf(next)] as HTMLButtonElement | undefined)?.focus();
          }}
          tabIndex={view === id ? 0 : -1}
        >
          <Icon className="size-3.5" aria-hidden="true" />
          {label}
        </button>
      ))}
    </div>
  );
}

const PRIORITY_CHIPS: { id: Priority; label: string; hint: string }[] = [
  { id: 'must', label: 'Have to do', hint: 'You committed to it' },
  { id: 'should', label: 'Should do', hint: 'It moves you toward your goal' },
];

function toggled<T>(list: T[], value: T): T[] {
  return list.includes(value) ? list.filter((v) => v !== value) : [...list, value];
}

export function FilterBar({ filters, counts, onChange }: { filters: CxFilters; counts: Map<CxKind, number>; onChange: (filters: CxFilters) => void }) {
  return (
    <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label="Filters">
      {PRIORITY_CHIPS.map((chip) => (
        <button
          key={chip.id}
          type="button"
          aria-pressed={filters.priorities.includes(chip.id)}
          title={chip.hint}
          onClick={() => onChange({ ...filters, priorities: toggled(filters.priorities, chip.id) })}
          className="cx-chip"
          data-priority={chip.id}
        >
          <span className="cx-chip-dot" aria-hidden="true" />
          {chip.label}
          <span className="sr-only">: {chip.hint}</span>
        </button>
      ))}
      <span className="mx-1 h-5 w-px bg-line" aria-hidden="true" />
      {ALL_KINDS.map((kind) => (
        <button
          key={kind}
          type="button"
          aria-pressed={filters.kinds.includes(kind)}
          onClick={() => onChange({ ...filters, kinds: toggled(filters.kinds, kind) })}
          className="cx-chip"
        >
          {cxKindLabel[kind]}
          <span className="cx-chip-count">{counts.get(kind) ?? 0}</span>
        </button>
      ))}
      {filtersActive(filters) && (
        <button type="button" onClick={() => onChange(allFilters)} className="ml-1 text-sm font-semibold text-brand">
          Show all
        </button>
      )}
    </div>
  );
}
