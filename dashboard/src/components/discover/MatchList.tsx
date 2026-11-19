import { ArrowUp, Check, ChevronDown, Columns3, Info } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { groupByField, type PathMatch } from '../../lib/discover/match.ts';
import { LevelPill, PathMark, Percent } from './PathMark.tsx';

interface MatchListProps {
  ranked: PathMatch[];
  titles: Record<string, string>;
  oneLines: Record<string, string>;
  hues: Record<string, string>;
  /** The field each path belongs to, and the order the fields are listed in. */
  groups: Record<string, string>;
  groupOrder: string[];
  selectedId: string;
  goalId: string;
  compare: string[];
  onSelect: (pathId: string) => void;
  onToggleCompare: (pathId: string) => void;
}

export const MAX_COMPARE = 3;

/** How many matches show before the student asks to see every field. */
export const TOP_MATCHES = 5;

/**
 * Remembers where each path stood last time, so a path that climbs after an answer gets a brief
 * "moved up" mark. That makes the link between an answer and the ranking visible.
 */
function useClimbers(order: string[]): Set<string> {
  const previous = useRef(order);
  const [climbers, setClimbers] = useState<Set<string>>(new Set());
  const key = order.join('|');
  useEffect(() => {
    const before = previous.current;
    const up = order.filter((id, index) => before.indexOf(id) > index);
    previous.current = order;
    if (up.length === 0) return;
    setClimbers(new Set(up));
    const id = window.setTimeout(() => setClimbers(new Set()), 1600);
    return () => window.clearTimeout(id);
    // `key` stands for `order`, which is a new array on every render.
  }, [key]);
  return climbers;
}

/**
 * The best few paths for this student, with the one-line reason and a compare toggle. "Show all
 * fields" lists every path under its field, so a long list stays easy to scan.
 */
export function MatchList(props: MatchListProps) {
  const { ranked, titles, oneLines, hues, groups, groupOrder, selectedId, goalId, compare, onSelect, onToggleCompare } = props;
  const climbers = useClimbers(ranked.map((m) => m.pathId));
  const [showAll, setShowAll] = useState(false);
  const rankOf = new Map(ranked.map((m, index) => [m.pathId, index + 1]));

  // The goal and the path open below stay in view even when they rank below the top few.
  const top = ranked.slice(0, TOP_MATCHES);
  const pinned = ranked.slice(TOP_MATCHES).filter((m) => m.pathId === goalId || m.pathId === selectedId);

  const row = (m: PathMatch) => {
    const selected = m.pathId === selectedId;
    const inCompare = compare.includes(m.pathId);
    const compareFull = !inCompare && compare.length >= MAX_COMPARE;
    return (
      <li key={m.pathId} className={`dc-match ${selected ? 'is-selected' : ''}`}>
        <button
          type="button"
          onClick={() => onSelect(m.pathId)}
          aria-pressed={selected}
          aria-label={`${titles[m.pathId]}, ${m.percent} percent match. Show details`}
          className="dc-match-main"
        >
          <span className="dc-rank" aria-hidden="true">
            {rankOf.get(m.pathId)}
          </span>
          <PathMark pathId={m.pathId} hue={hues[m.pathId] ?? '#245bd8'} />
          <span className="min-w-0 flex-1 text-left">
            <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
              <span className="font-semibold text-ink">{titles[m.pathId]}</span>
              {goalId === m.pathId && (
                <span className="flex items-center gap-1 rounded-full bg-brand-soft px-2 py-0.5 text-[11px] font-medium text-brand">
                  <Check className="size-3" aria-hidden="true" /> Goal
                </span>
              )}
              {climbers.has(m.pathId) && (
                <span className="dc-climb">
                  <ArrowUp className="size-3" aria-hidden="true" /> moved up
                </span>
              )}
            </span>
            <span className="mt-0.5 block truncate text-[13px] text-ink-3">{oneLines[m.pathId]}</span>
            <span className="dc-bar mt-2" aria-hidden="true">
              <span style={{ width: `${m.percent}%`, background: hues[m.pathId] }} />
            </span>
          </span>
          <span className="flex flex-col items-end gap-1">
            <Percent value={m.percent} className="text-[34px]" />
            <LevelPill match={m} />
          </span>
        </button>
        <button
          type="button"
          onClick={() => onToggleCompare(m.pathId)}
          disabled={compareFull}
          aria-pressed={inCompare}
          title={compareFull ? `Compare up to ${MAX_COMPARE} paths at once` : inCompare ? 'Remove from compare' : 'Add to compare'}
          aria-label={`${inCompare ? 'Remove' : 'Add'} ${titles[m.pathId]} ${inCompare ? 'from' : 'to'} compare`}
          className={`dc-compare-toggle ${inCompare ? 'is-on' : ''}`}
        >
          <Columns3 className="size-3.5" aria-hidden="true" />
        </button>
      </li>
    );
  };

  return (
    <section className="dc-panel flex flex-col" aria-labelledby="dc-matches-title">
      <div className="flex items-baseline justify-between gap-3">
        <h2 id="dc-matches-title" className="text-sm font-semibold text-ink">
          Your matches
        </h2>
        <span className="text-xs text-ink-3">{showAll ? 'Every path, by field' : 'Updates as you answer'}</span>
      </div>

      {showAll ? (
        <div className="dc-fields mt-3">
          {groupByField(ranked, groups, groupOrder).map((group) => (
            <section key={group.field} aria-label={group.field}>
              <h3 className="dc-field-title">{group.field}</h3>
              <ol className="grid grid-cols-1 gap-2">{group.matches.map(row)}</ol>
            </section>
          ))}
        </div>
      ) : (
        <ol className="mt-3 grid grid-cols-1 gap-2">
          {top.map(row)}
          {pinned.map(row)}
        </ol>
      )}

      {ranked.length > TOP_MATCHES && (
        <button type="button" onClick={() => setShowAll((open) => !open)} aria-expanded={showAll} className="dc-soft dc-show-all mt-3">
          {showAll ? 'Show top matches only' : `Show all fields · ${ranked.length} paths`}
          <ChevronDown className={`size-4 transition-transform ${showAll ? 'rotate-180' : ''}`} aria-hidden="true" />
        </button>
      )}

      <p className="mt-auto flex items-start gap-1.5 pt-4 text-xs leading-relaxed text-ink-3">
        <Info className="mt-px size-3.5 shrink-0" aria-hidden="true" />
        Matches are built on this device from your answers and profile. Grok will answer once the agents are connected.
      </p>
    </section>
  );
}
