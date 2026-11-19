import { ArrowUp, Check, Columns3, Info } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import type { PathMatch } from '../../lib/discover/match.ts';
import { LevelPill, PathMark, Percent } from './PathMark.tsx';

interface MatchListProps {
  ranked: PathMatch[];
  titles: Record<string, string>;
  oneLines: Record<string, string>;
  hues: Record<string, string>;
  selectedId: string;
  goalId: string;
  compare: string[];
  onSelect: (pathId: string) => void;
  onToggleCompare: (pathId: string) => void;
}

export const MAX_COMPARE = 3;

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

/** Every path, ranked for this student, with the one-line reason and a compare toggle. */
export function MatchList(props: MatchListProps) {
  const { ranked, titles, oneLines, hues, selectedId, goalId, compare, onSelect, onToggleCompare } = props;
  const climbers = useClimbers(ranked.map((m) => m.pathId));

  return (
    <section className="dc-panel flex flex-col" aria-labelledby="dc-matches-title">
      <div className="flex items-baseline justify-between gap-3">
        <h2 id="dc-matches-title" className="text-sm font-semibold text-ink">
          Your matches
        </h2>
        <span className="text-xs text-ink-3">Updates as you answer</span>
      </div>

      <ol className="mt-3 grid grid-cols-1 gap-2">
        {ranked.map((m, index) => {
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
                  {index + 1}
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
        })}
      </ol>

      <p className="mt-auto flex items-start gap-1.5 pt-4 text-xs leading-relaxed text-ink-3">
        <Info className="mt-px size-3.5 shrink-0" aria-hidden="true" />
        Matches are built on this device from your answers and profile. Grok will answer once the agents are connected.
      </p>
    </section>
  );
}
