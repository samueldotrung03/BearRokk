// The validation funnel: what the workers found, what each check removed and why, and what
// reached the feed. This is the trust story, so every dropped item keeps its reason.
import { ChevronRight, ShieldCheck } from 'lucide-react';
import { Link } from 'react-router';
import { categoryLabels } from '../../data/agents-extra.ts';
import { FUNNEL_STAGES, funnel, withArticle, type RunState } from '../../lib/agents/engine.ts';
import { Card } from '../Page.tsx';
import { AnimatedNumber } from './AnimatedNumber.tsx';

export function Funnel({ run, reduced }: { run: RunState; reduced: boolean }) {
  const { counts, reasons, pending } = funnel(run.candidates);
  const top = Math.max(1, counts[0] ?? 0);
  const shown = run.candidates.filter((c) => c.stage === 4).sort((a, b) => (b.fit ?? 0) - (a.fit ?? 0));

  return (
    <Card className="p-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 font-semibold tracking-tight">
            <ShieldCheck className="size-[18px] text-brand" aria-hidden="true" />
            Validation funnel
          </h2>
          <p className="mt-0.5 text-sm text-ink-3">Nothing reaches you until a validator checks it against your brief.</p>
        </div>
        <span className="shrink-0 rounded-full bg-brand-soft px-3 py-1 text-xs font-medium text-brand">
          {run.status === 'idle' ? 'Waiting for a run' : pending > 0 ? `${pending} waiting for a validator` : run.status === 'done' ? 'Run complete' : 'Checking'}
        </span>
      </div>

      <ol className="mt-5 space-y-2.5" aria-label="Items left after each check">
        {FUNNEL_STAGES.map((stage, k) => {
          const value = counts[k] ?? 0;
          const dropped = k > 0 ? reasons.filter((r) => r.stage === k) : [];
          return (
            <li key={stage.key} className="ag-funnel-row grid grid-cols-[112px_minmax(0,1fr)] items-center sm:grid-cols-[148px_minmax(0,1fr)_150px] gap-3" data-stage={k}>
              <span className="text-sm font-medium text-ink-2">{stage.label}</span>
              <div className="ag-funnel-track">
                <div className="ag-funnel-bar" style={{ width: `${Math.max(value / top, 0.08) * 100}%` }}>
                  <AnimatedNumber value={value} reduced={reduced} />
                </div>
              </div>
              <span className="hidden truncate text-xs text-ink-3 sm:block" title={dropped.map((r) => `${r.items.length} ${r.label.toLowerCase()}`).join(', ')}>
                {dropped.length > 0 ? (
                  <>
                    <span className="font-semibold text-[#c2334d]">−{dropped.reduce((sum, r) => sum + r.items.length, 0)}</span>{' '}
                    {dropped.map((r) => r.label.toLowerCase()).join(', ')}
                  </>
                ) : k === 0 && value ? (
                  'read in full by the workers'
                ) : null}
              </span>
            </li>
          );
        })}
      </ol>

      <div className="mt-6 grid gap-5 md:grid-cols-2">
        <section aria-labelledby="ag-dropped">
          <h3 id="ag-dropped" className="text-sm font-semibold">
            Why items were dropped
          </h3>
          {reasons.length === 0 ? (
            <p className="mt-2 text-sm text-ink-3">{run.status === 'idle' ? 'Start a run to see the checks.' : 'Nothing dropped yet.'}</p>
          ) : (
            <ul className="mt-2 space-y-2">
              {reasons.map((r) => (
                <li key={r.reason}>
                  <details className="ag-reason">
                    <summary className="flex items-center gap-2 px-3 py-2 text-sm">
                      <ChevronRight className="ag-caret size-4 text-ink-3" aria-hidden="true" />
                      <span className="flex-1 font-medium">{r.label}</span>
                      <span className="grid min-w-6 place-items-center rounded-full bg-[#ffe1e6] px-1.5 text-xs font-semibold text-[#8a1c2f]">{r.items.length}</span>
                    </summary>
                    <ul className="space-y-2 border-t border-line px-3 py-2.5">
                      {r.items.map((c) => (
                        <li key={c.id} className="text-[13px] leading-snug">
                          <p className="font-medium">{c.title}</p>
                          <p className="text-ink-3">{c.note}</p>
                        </li>
                      ))}
                    </ul>
                  </details>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section aria-labelledby="ag-kept">
          <div className="flex items-center justify-between">
            <h3 id="ag-kept" className="text-sm font-semibold">
              Kept for your feed
            </h3>
            {shown.length > 0 && (
              <Link to="/" className="text-xs font-semibold text-brand hover:underline">
                Open feed
              </Link>
            )}
          </div>
          {shown.length === 0 ? (
            <p className="mt-2 text-sm text-ink-3">The presentation manager publishes at the end of a run.</p>
          ) : (
            <ul className="mt-2 space-y-1.5">
              {shown.map((c) => (
                <li key={c.id} className="flex items-center gap-3 rounded-xl px-2 py-1.5 hover:bg-brand-soft" title={c.note}>
                  <span className="w-11 shrink-0 font-display text-lg leading-none text-brand">{Math.round((c.fit ?? 0) * 100)}%</span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium">{c.title}</span>
                    <span className="block truncate text-xs text-ink-3">
                      {categoryLabels[c.category]} · {c.organizer} · found on {withArticle(c.source)}
                    </span>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </Card>
  );
}
