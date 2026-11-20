// The Applications list's controls: search, kind of opportunity, sort, then the status chips with
// how many each would show, and the "due within 7 days" toggle.
import { Search } from 'lucide-react';
import { LIST_KINDS, LIST_SORTS, STATUS_FILTERS, sortLabel, statusFilterLabel, type ListKind, type ListPrefs, type StatusFilter } from '../../../lib/portal/list.ts';
import { typeMeta } from '../../meta.ts';

const kindLabel = (k: ListKind) => (k === 'custom' ? 'Made by you' : typeMeta[k].plural);

export function ListToolbar({
  prefs,
  onPrefs,
  query,
  onQuery,
  counts,
  dueSoonCount,
}: {
  prefs: ListPrefs;
  onPrefs: (next: Partial<ListPrefs>) => void;
  query: string;
  onQuery: (query: string) => void;
  counts: Record<StatusFilter, number>;
  /** How many the toggle would leave, so the student knows before pressing it. */
  dueSoonCount: number;
}) {
  return (
    <div className="flex flex-col gap-3">
      <div className="feed-toolbar">
        <label className="feed-search">
          <Search className="size-[18px] shrink-0 text-ink-3" aria-hidden="true" />
          <span className="sr-only">Search your applications</span>
          <input type="search" value={query} onChange={(event) => onQuery(event.target.value)} placeholder="Search by title or organizer" />
        </label>
        <label className="feed-select">
          <span className="sr-only">Kind of opportunity</span>
          <select value={prefs.kind} onChange={(event) => onPrefs({ kind: event.target.value as ListPrefs['kind'] })}>
            <option value="all">Every kind</option>
            {LIST_KINDS.map((k) => (
              <option key={k} value={k}>
                {kindLabel(k)}
              </option>
            ))}
          </select>
        </label>
        <label className="feed-select">
          <span className="sr-only">Sort by</span>
          <select value={prefs.sort} onChange={(event) => onPrefs({ sort: event.target.value as ListPrefs['sort'] })}>
            {LIST_SORTS.map((s) => (
              <option key={s} value={s}>
                {sortLabel[s]}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="apl-chips" role="group" aria-label="Filter by status">
        {STATUS_FILTERS.map((s) => (
          <button key={s} type="button" className="apl-chip" aria-pressed={prefs.status === s} onClick={() => onPrefs({ status: s })}>
            {statusFilterLabel[s]}
            <span className="apl-chip-count">{counts[s]}</span>
          </button>
        ))}
        <span className="apl-chips-gap" aria-hidden="true" />
        <button type="button" className="apl-chip apl-chip-soon" aria-pressed={prefs.dueSoon} onClick={() => onPrefs({ dueSoon: !prefs.dueSoon })}>
          Due within 7 days
          <span className="apl-chip-count">{dueSoonCount}</span>
        </button>
      </div>
    </div>
  );
}
