// The roadmap at a glance, shown beside the feed: how far along the student is, the one thing
// to do next, and what follows. Steps can be ticked off here without leaving the feed.
import { ArrowRight, Check } from 'lucide-react';
import { Link } from 'react-router';
import { planFor } from '../lib/roadmap.ts';
import { daysUntil, dueLabel } from '../lib/time.ts';
import { useOpportunities } from '../state/live.tsx';
import { useStore } from '../state/StoreProvider.tsx';
import { stepMeta } from './meta.ts';

const RADIUS = 34;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

export function RoadmapPanel({ highlight }: { highlight?: (opportunityId: string | null) => void }) {
  const { state, dispatch } = useStore();
  const { roadmap, steps, doneCount, percent, next } = planFor(state, useOpportunities());
  const after = steps.filter((step) => !state.doneSteps.includes(step.id) && step.id !== next?.id).slice(0, 3);

  return (
    <aside className="feed-roadmap glass" aria-label="Your roadmap">
      <div className="flex items-center gap-4">
        <svg viewBox="0 0 80 80" className="size-[76px] shrink-0 -rotate-90" role="img" aria-label={`Roadmap ${percent}% done`}>
          <circle cx="40" cy="40" r={RADIUS} fill="none" stroke="rgb(21 43 67 / 0.1)" strokeWidth="7" />
          <circle
            cx="40"
            cy="40"
            r={RADIUS}
            fill="none"
            stroke="var(--color-brand)"
            strokeWidth="7"
            strokeLinecap="round"
            strokeDasharray={CIRCUMFERENCE}
            strokeDashoffset={CIRCUMFERENCE * (1 - percent / 100)}
            className="transition-[stroke-dashoffset] duration-700"
          />
          <text x="40" y="40" className="rotate-90" style={{ transformOrigin: '40px 40px' }} textAnchor="middle" dominantBaseline="central" fontSize="19" fontWeight="700" fill="var(--color-ink)">
            {percent}%
          </text>
        </svg>
        <div className="min-w-0">
          <p className="text-xs font-semibold tracking-wide text-ink-3 uppercase">Your roadmap</p>
          <p className="mt-0.5 leading-snug font-semibold">{roadmap.goal}</p>
          <p className="mt-0.5 text-sm text-ink-3">
            {doneCount} of {steps.length} steps done
          </p>
        </div>
      </div>

      {next ? (
        <div
          className="feed-roadmap-next"
          onPointerEnter={() => highlight?.(next.opportunityId)}
          onPointerLeave={() => highlight?.(null)}
        >
          <p className="text-xs font-semibold text-brand">Do this next</p>
          <div className="mt-1.5 flex gap-3">
            <button
              type="button"
              role="checkbox"
              aria-checked={false}
              aria-label={`Mark "${next.title}" as done`}
              onClick={() => dispatch({ type: 'toggleStep', id: next.id })}
              className="mt-0.5 grid size-6 shrink-0 place-items-center rounded-full border-2 border-brand/50 bg-white text-transparent transition hover:border-brand hover:text-brand"
            >
              <Check className="size-3.5" strokeWidth={3} aria-hidden="true" />
            </button>
            <div className="min-w-0">
              <p className="leading-snug font-semibold">{next.title}</p>
              <p className="mt-1 line-clamp-2 text-sm leading-snug text-ink-2">{next.detail}</p>
              {next.due && (
                <p className={`mt-1.5 text-sm ${daysUntil(next.due) <= 7 ? 'font-semibold text-orange-700' : 'text-ink-3'}`}>{dueLabel(next.due)}</p>
              )}
            </div>
          </div>
        </div>
      ) : (
        <div className="feed-roadmap-next">
          <p className="font-semibold">Every step is done.</p>
          <p className="mt-1 text-sm text-ink-2">Pick a new goal on the Roadmap page.</p>
        </div>
      )}

      {after.length > 0 && (
        <ol className="feed-roadmap-list">
          {after.map((step) => {
            const Icon = stepMeta[step.kind].icon;
            return (
              <li key={step.id} onPointerEnter={() => highlight?.(step.opportunityId)} onPointerLeave={() => highlight?.(null)}>
                <span className="feed-roadmap-dot">
                  <Icon className="size-3.5" aria-hidden="true" />
                </span>
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{step.title}</p>
                  <p className="text-xs text-ink-3">
                    {stepMeta[step.kind].label}
                    {step.due ? ` · ${dueLabel(step.due)}` : ''}
                  </p>
                </div>
              </li>
            );
          })}
        </ol>
      )}

      <Link to="/roadmap" className="feed-roadmap-link">
        Open the full roadmap
        <ArrowRight className="size-4" aria-hidden="true" />
      </Link>
    </aside>
  );
}
