import { Briefcase, CalendarDays, FlaskConical, GraduationCap, LayoutList, Search, SlidersHorizontal, Trophy, Users, type LucideIcon } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { opportunities, type CategoryId, type Opportunity } from '../data/opportunities.ts';
import {
  activeFilterCount,
  categoryMeta,
  categoryOrder,
  dateLine,
  emptyFilters,
  formatLabel,
  matchesFilters,
  matchesQuery,
  sortLabel,
  sortOpportunities,
  type FeedFilters,
  type SortId,
} from '../lib/catalog.ts';
import { Cover } from './Artwork.tsx';
import { RowActions } from './Actions.tsx';
import { Details } from './Details.tsx';
import { useStudent } from '../state/student.tsx';

const categoryIcon: Record<CategoryId, LucideIcon> = {
  internship: Briefcase,
  event: CalendarDays,
  club: Users,
  competition: Trophy,
  research: FlaskConical,
  scholarship: GraduationCap,
};

export function Feed({ savedOnly = false }: { savedOnly?: boolean }) {
  const student = useStudent();
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<CategoryId | 'all'>('all');
  const [filters, setFilters] = useState<FeedFilters>(emptyFilters);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [sort, setSort] = useState<SortId>('best');
  const [details, setDetails] = useState<Opportunity | null>(null);
  const saved = student.savedSet;

  const pool = savedOnly ? opportunities.filter((item) => saved.has(item.id)) : opportunities;

  const searched = useMemo(() => pool.filter((item) => matchesQuery(item, query) && matchesFilters(item, filters, saved)), [pool, query, filters, saved]);

  const results = useMemo(() => {
    const picked = category === 'all' ? searched : searched.filter((item) => item.category === category);
    return sortOpportunities(picked, sort);
  }, [searched, category, sort]);

  const countFor = (next: CategoryId | 'all') => (next === 'all' ? searched.length : searched.filter((item) => item.category === next).length);

  const panelCount = activeFilterCount(filters);
  const filtersOn = query.trim() !== '' || category !== 'all' || panelCount > 0;

  const reset = () => {
    setQuery('');
    setCategory('all');
    setFilters(emptyFilters);
    setFiltersOpen(false);
  };

  useEffect(() => {
    if (!filtersOpen) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !document.querySelector('.dialog-scrim')) setFiltersOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [filtersOpen]);

  return (
    <div className="feed-scroller">
      <div className="feed-board">
        <div className="feed-heading">
          <h1 className="font-display">{savedOnly ? 'Saved' : 'Feed'}</h1>
          <p>
            {savedOnly ? 'Opportunities you saved from For you and Feed.' : 'Everything your agents found for your request.'} {results.length} of {pool.length} shown.
          </p>
          <span className="prepared">Prepared examples</span>
        </div>

        <div className={savedOnly ? 'feed-layout feed-layout-single' : 'feed-layout'}>
          {!savedOnly && (
            <nav className="feed-cats" aria-label="Categories">
              <button type="button" className="feed-cat" aria-pressed={category === 'all'} onClick={() => setCategory('all')}>
                <LayoutList aria-hidden="true" />
                <span>All</span>
                <span className="feed-cat-count">{countFor('all')}</span>
              </button>
              {categoryOrder.map((item) => {
                const Icon = categoryIcon[item.id];
                return (
                  <button key={item.id} type="button" className="feed-cat" aria-pressed={category === item.id} onClick={() => setCategory(item.id)}>
                    <Icon aria-hidden="true" />
                    <span>{item.label}</span>
                    <span className="feed-cat-count">{countFor(item.id)}</span>
                  </button>
                );
              })}
            </nav>
          )}

          <div className="feed-column">
            <div className="feed-toolbar">
              <label className="feed-search">
                <Search aria-hidden="true" />
                <span className="sr-only">Search by title, organizer, place, or tag</span>
                <input
                  type="search"
                  value={query}
                  placeholder="Search by title, organizer, place or tag"
                  onChange={(event) => setQuery(event.target.value)}
                />
              </label>
              <button
                type="button"
                className="feed-filter-button"
                aria-expanded={filtersOpen}
                data-active={panelCount > 0}
                onClick={() => setFiltersOpen((open) => !open)}
              >
                <SlidersHorizontal aria-hidden="true" />
                Filters
                {panelCount > 0 && <span className="feed-filter-count">{panelCount}</span>}
              </button>
              <label className="feed-select">
                <span className="sr-only">Sort</span>
                <select value={sort} onChange={(event) => setSort(event.target.value as SortId)}>
                  {(Object.keys(sortLabel) as SortId[]).map((id) => (
                    <option key={id} value={id}>
                      {sortLabel[id]}
                    </option>
                  ))}
                </select>
              </label>
              {filtersOpen && (
                <div className="filter-panel" data-overlay="" role="group" aria-label="Filters">
                  <fieldset>
                    <legend>Format</legend>
                    <div className="filter-list" role="radiogroup">
                      {(['any', 'online', 'in_person', 'hybrid'] as const).map((value) => (
                        <button key={value} type="button" role="radio" aria-checked={filters.format === value} onClick={() => setFilters((current) => ({ ...current, format: value }))}>
                          {value === 'any' ? 'Any format' : formatLabel(value)}
                        </button>
                      ))}
                    </div>
                  </fieldset>
                  <fieldset>
                    <legend>Dates</legend>
                    <div className="filter-list" role="radiogroup">
                      {(
                        [
                          ['any', 'Any date'],
                          ['has_deadline', 'Has a deadline'],
                          ['deadline_unknown', 'Deadline unknown'],
                          ['has_start', 'Has a start date'],
                        ] as const
                      ).map(([value, label]) => (
                        <button key={value} type="button" role="radio" aria-checked={filters.timing === value} onClick={() => setFilters((current) => ({ ...current, timing: value }))}>
                          {label}
                        </button>
                      ))}
                    </div>
                  </fieldset>
                  <div className="filter-pills">
                    <button type="button" aria-pressed={filters.savedOnly} onClick={() => setFilters((current) => ({ ...current, savedOnly: !current.savedOnly }))}>
                      Saved only
                    </button>
                  </div>
                  <div className="filter-footer">
                    <button type="button" className="btn-quiet" onClick={() => setFilters(emptyFilters)}>
                      Clear filters
                    </button>
                    <button type="button" className="btn-primary" onClick={() => setFiltersOpen(false)}>
                      Show {results.length}
                    </button>
                  </div>
                </div>
              )}
            </div>

            {results.length === 0 ? (
              <div className="empty-state">
                <h2 className="font-display">{savedOnly && !filtersOn ? 'Nothing saved yet' : 'Nothing matches'}</h2>
                <p>
                  {savedOnly && !filtersOn
                    ? 'Save CodePath from For you and it will show up here after you refresh.'
                    : 'No prepared example matches that search, category, and filters together.'}
                </p>
                {filtersOn && (
                  <button type="button" className="btn-primary" style={{ marginTop: 16 }} onClick={reset}>
                    Reset filters
                  </button>
                )}
              </div>
            ) : (
              <ul className="feed-list">
                {results.map((opportunity) => (
                  <li key={opportunity.id}>
                    <FeedRow opportunity={opportunity} onOpen={() => setDetails(opportunity)} />
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>
      {details && <Details opportunity={details} onClose={() => setDetails(null)} />}
    </div>
  );
}

function FeedRow({ opportunity, onOpen }: { opportunity: Opportunity; onOpen: () => void }) {
  const meta = categoryMeta(opportunity.category);
  return (
    <article className="feed-row">
      <div className="feed-row-media">
        <Cover id={opportunity.art} title="" />
      </div>
      <div className="feed-row-body">
        <div className="chip-row">
          <span className={`meta-chip ${opportunity.category}`}>{meta.singular}</span>
          {dateLine(opportunity).map((part) => (
            <span key={part.text} className={part.unknown ? 'date-note unknown' : 'date-note'}>
              {part.text}
            </span>
          ))}
        </div>
        <h2>
          <button type="button" onClick={onOpen}>
            {opportunity.title}
          </button>
        </h2>
        <p className="byline">
          {opportunity.organizer} · {formatLabel(opportunity.format)} · {opportunity.location}
        </p>
        <p className="fit">{opportunity.fitExplanation}</p>
        <RowActions opportunity={opportunity} />
      </div>
    </article>
  );
}
