import { Check, Plus, Target, X } from 'lucide-react';
import type { ReactNode } from 'react';
import type { ClassYear } from '../../types.ts';
import type { AnswerAction } from '../../lib/discover/ask.ts';
import { sameYearCount, type PathInsight } from '../../lib/discover/insight.ts';
import type { PathMatch } from '../../lib/discover/match.ts';
import { MAX_COMPARE } from './MatchList.tsx';
import { LevelPill, PathMark } from './PathMark.tsx';

interface CompareTableProps {
  ids: string[];
  allIds: string[];
  insights: Record<string, PathInsight>;
  matches: Record<string, PathMatch>;
  hues: Record<string, string>;
  goalId: string;
  year: ClassYear;
  onToggle: (pathId: string) => void;
  onAction: (action: AnswerAction) => void;
}

function Meter({ value, of, hue }: { value: number; of: number; hue: string }) {
  return (
    <span className="dc-bar mt-1.5 max-w-40" aria-hidden="true">
      <span style={{ width: `${of ? (value / of) * 100 : 0}%`, background: hue }} />
    </span>
  );
}

/** Two or three paths side by side, on the facts the page already worked out for each. */
export function CompareTable(props: CompareTableProps) {
  const { ids, allIds, insights, matches, hues, goalId, year, onToggle, onAction } = props;
  const shown = ids.filter((id) => insights[id] && matches[id]);
  const best = shown.length ? Math.max(...shown.map((id) => matches[id]!.percent)) : 0;

  const rows: { label: string; cell: (id: string) => ReactNode }[] = [
    {
      label: 'Match for you',
      cell: (id) => (
        <>
          <span className={`font-display text-[30px] leading-none ${matches[id]!.percent === best && shown.length > 1 ? 'text-brand' : 'text-ink'}`}>{matches[id]!.percent}%</span>
          <div className="mt-1.5">
            <LevelPill match={matches[id]!} />
          </div>
        </>
      ),
    },
    { label: 'The work', cell: (id) => <span className="text-ink-2">{insights[id]!.path.oneLine}</span> },
    { label: 'Pace', cell: (id) => insights[id]!.extra?.paceShort ?? <span className="text-ink-3">Not known</span> },
    {
      label: 'Skills you have',
      cell: (id) => (
        <>
          {insights[id]!.skillsHave} of {insights[id]!.skills.length}
          <Meter value={insights[id]!.skillsHave} of={insights[id]!.skills.length} hue={hues[id] ?? '#245bd8'} />
        </>
      ),
    },
    {
      label: 'Core skills to build',
      cell: (id) => {
        const missing = insights[id]!.skills.filter((s) => s.skill.importance === 'core' && s.state !== 'have');
        return missing.length ? <span className="text-ink-2">{missing.map((s) => s.skill.label).join(', ')}</span> : <span className="text-emerald-700">None</span>;
      },
    },
    {
      label: 'People in the sample',
      cell: (id) => {
        const insight = insights[id]!;
        return insight.people.total ? (
          <>
            {insight.people.total} <span className="text-ink-3">· {sameYearCount(insight, year)} as {year.toLowerCase()}s</span>
          </>
        ) : (
          <span className="text-ink-3">Not known</span>
        );
      },
    },
    {
      label: 'What most of them did',
      cell: (id) => {
        const top = insights[id]!.people.common[0];
        return top ? (
          <span className="text-ink-2">
            {top.step.title} <span className="text-ink-3">({top.count} of {insights[id]!.people.total})</span>
          </span>
        ) : (
          <span className="text-ink-3">No clear pattern</span>
        );
      },
    },
    {
      label: 'Roadmap',
      cell: (id) => {
        const plan = insights[id]!.plan;
        return (
          <>
            {plan.phases.length} phases · {plan.steps} steps
            {plan.done > 0 && <span className="text-ink-3"> · {plan.done} done</span>}
          </>
        );
      },
    },
    { label: 'In your feed now', cell: (id) => `${insights[id]!.opportunities.length} ${insights[id]!.opportunities.length === 1 ? 'card' : 'cards'}` },
  ];

  return (
    <section className="dc-panel" aria-labelledby="dc-compare-title">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 id="dc-compare-title" className="font-display text-[30px] leading-tight text-ink">
            Side by side
          </h2>
          <p className="text-sm text-ink-3">Pick up to {MAX_COMPARE} paths.</p>
        </div>
        <div className="flex flex-wrap gap-1.5" role="group" aria-label="Paths to compare">
          {allIds.map((id) => {
            const on = ids.includes(id);
            const full = !on && ids.length >= MAX_COMPARE;
            return (
              <button key={id} type="button" aria-pressed={on} disabled={full} onClick={() => onToggle(id)} className={`dc-chip ${on ? 'is-on' : ''}`}>
                {on ? <X className="size-3.5" aria-hidden="true" /> : <Plus className="size-3.5" aria-hidden="true" />}
                {insights[id]?.path.title}
              </button>
            );
          })}
        </div>
      </div>

      {shown.length < 2 ? (
        <p className="mt-5 rounded-2xl border border-dashed border-line px-4 py-6 text-center text-sm text-ink-3">
          Add {shown.length === 0 ? 'two paths' : 'one more path'} to see them side by side.
        </p>
      ) : (
        <div className="dc-table-wrap mt-5">
          <table className="dc-table">
            <caption className="sr-only">Comparison of {shown.map((id) => insights[id]!.path.title).join(', ')}</caption>
            <thead>
              <tr>
                <td />
                {shown.map((id) => (
                  <th key={id} scope="col">
                    <span className="flex items-center gap-2.5">
                      <PathMark pathId={id} hue={hues[id] ?? '#245bd8'} size="sm" />
                      <span className="text-left font-semibold text-ink">{insights[id]!.path.title}</span>
                    </span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.label}>
                  <th scope="row">{row.label}</th>
                  {shown.map((id) => (
                    <td key={id}>{row.cell(id)}</td>
                  ))}
                </tr>
              ))}
              <tr>
                <th scope="row" />
                {shown.map((id) => (
                  <td key={id}>
                    {goalId === id ? (
                      <button type="button" onClick={() => onAction({ kind: 'openRoadmap', label: '' })} className="dc-action">
                        <Check className="size-3.5" aria-hidden="true" /> Your goal · roadmap
                      </button>
                    ) : (
                      <button type="button" onClick={() => onAction({ kind: 'setGoal', pathId: id, label: '' })} className="dc-action is-primary">
                        <Target className="size-3.5" aria-hidden="true" /> Set as my goal
                      </button>
                    )}
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
