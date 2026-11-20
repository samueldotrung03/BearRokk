// What is not tracked yet: cards the student saved or liked, then other postings the agents
// already read an application page for, best fit first. One click starts tracking either.
import { Plus, Sparkles } from 'lucide-react';
import { applicationInfo, opportunities } from '../../data/sample.ts';
import { dueLabel } from '../../lib/time.ts';
import { useStore } from '../../state/StoreProvider.tsx';
import type { Opportunity } from '../../types.ts';
import { typeMeta } from '../meta.ts';
import { Card } from '../Page.tsx';

export function Suggestions() {
  const { state } = useStore();
  const open = (o: Opportunity) =>
    !state.applications[o.id] && !state.dismissed.includes(o.id) && (o.deadline === null || new Date(o.deadline).getTime() > Date.now());
  const saved = opportunities.filter((o) => open(o) && (state.saved.includes(o.id) || state.liked.includes(o.id)));
  const picks = opportunities
    .filter((o) => open(o) && !saved.includes(o) && applicationInfo[o.id])
    .sort((a, b) => b.baseScore - a.baseScore)
    .slice(0, 4);

  return (
    <>
      {saved.length > 0 && (
        <section className="mt-10">
          <h2 className="text-lg font-semibold tracking-tight">Saved or liked, not tracked yet</h2>
          <ul className="mt-3 grid gap-3 sm:grid-cols-2">
            {saved.map((o) => (
              <Suggestion key={o.id} opportunity={o} />
            ))}
          </ul>
        </section>
      )}
      {picks.length > 0 && (
        <section className="mt-10">
          <h2 className="flex items-center gap-2 text-lg font-semibold tracking-tight">
            <Sparkles className="size-4 text-brand" aria-hidden="true" />
            Your agents already read these applications
          </h2>
          <p className="mt-0.5 text-sm text-ink-3">Their questions and materials are ready to work on the moment you track one.</p>
          <ul className="mt-3 grid gap-3 sm:grid-cols-2">
            {picks.map((o) => (
              <Suggestion key={o.id} opportunity={o} showFit />
            ))}
          </ul>
        </section>
      )}
    </>
  );
}

function Suggestion({ opportunity: o, showFit = false }: { opportunity: Opportunity; showFit?: boolean }) {
  const { dispatch } = useStore();
  const info = applicationInfo[o.id];
  const Icon = typeMeta[o.type].icon;
  return (
    <li>
      <Card className="flex items-center gap-3 p-4">
        <span className={`grid size-10 shrink-0 place-items-center rounded-xl ${typeMeta[o.type].tint}`}>
          <Icon className="size-5" aria-hidden="true" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate font-medium">{o.title}</p>
          <p className="truncate text-sm text-ink-3">
            {o.deadline ? dueLabel(o.deadline) : o.organizer}
            {showFit && ` · ${Math.round(o.baseScore * 100)}% fit`}
            {info && ` · ${info.prompts.length} ${info.prompts.length === 1 ? 'question' : 'questions'}, ${info.materials.length} to gather`}
          </p>
        </div>
        <button
          type="button"
          onClick={() => dispatch({ type: 'setApplication', id: o.id, status: 'interested' })}
          className="flex h-9 shrink-0 items-center gap-1.5 rounded-xl border border-line px-3 text-sm font-semibold text-brand hover:border-brand"
          aria-label={`Track ${o.title}`}
        >
          <Plus className="size-4" aria-hidden="true" />
          Track
        </button>
      </Card>
    </li>
  );
}
