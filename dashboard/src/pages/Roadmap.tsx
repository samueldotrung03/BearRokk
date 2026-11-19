import { ArrowUpRight, Check } from 'lucide-react';
import { Link } from 'react-router';
import { stepMeta } from '../components/meta.ts';
import { Card, Page } from '../components/Page.tsx';
import { careerPaths, opportunities, roadmaps } from '../data/sample.ts';
import { daysUntil, dueLabel } from '../lib/time.ts';
import { useStore } from '../state/StoreProvider.tsx';
import type { RoadmapStep } from '../types.ts';

function Step({ step, isNext }: { step: RoadmapStep; isNext: boolean }) {
  const { state, dispatch } = useStore();
  const done = state.doneSteps.includes(step.id);
  const meta = stepMeta[step.kind];
  const linked = opportunities.find((o) => o.id === step.opportunityId && !state.dismissed.includes(o.id));

  return (
    <li className={`flex gap-4 rounded-2xl p-4 transition ${isNext ? 'bg-brand-soft/70' : 'hover:bg-slate-50'}`}>
      <button
        type="button"
        role="checkbox"
        aria-checked={done}
        aria-label={`Mark "${step.title}" as done`}
        onClick={() => dispatch({ type: 'toggleStep', id: step.id })}
        className={`relative mt-0.5 grid size-6 shrink-0 after:absolute after:-inset-2.5 after:content-[''] place-items-center rounded-full border-2 transition ${
          done ? 'border-brand bg-brand text-white' : 'border-slate-300 bg-white hover:border-brand'
        }`}
      >
        {done && <Check className="size-3.5" strokeWidth={3} aria-hidden="true" />}
      </button>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <p className={`font-medium ${done ? 'text-ink-3 line-through' : ''}`}>{step.title}</p>
          {isNext && <span className="rounded-full bg-brand px-2.5 py-0.5 text-xs font-medium text-white">Do this next</span>}
        </div>
        <p className="mt-1 text-sm leading-relaxed text-ink-2">{step.detail}</p>
        <div className="mt-2.5 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-ink-3">
          <span className="flex items-center gap-1.5">
            <meta.icon className="size-4" aria-hidden="true" />
            {meta.label}
          </span>
          {step.due && !done && (
            <span className={daysUntil(step.due) <= 7 ? 'font-medium text-orange-700' : ''}>{dueLabel(step.due)}</span>
          )}
          {linked && (
            <a
              href={linked.actionUrl ?? linked.sourceUrl}
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-1 rounded-full border border-line bg-white px-3 py-1 font-medium text-brand hover:border-brand"
            >
              {linked.title}
              <ArrowUpRight className="size-3.5 shrink-0" aria-hidden="true" />
            </a>
          )}
        </div>
      </div>
    </li>
  );
}

export function Roadmap() {
  const { state } = useStore();
  const roadmap = roadmaps.find((r) => r.goalId === state.goalId);
  const path = careerPaths.find((p) => p.id === state.goalId);

  if (!roadmap) {
    return (
      <Page title="Your roadmap" subtitle={`Goal: ${path?.title ?? 'not chosen yet'}.`}>
        <Card className="p-10 text-center">
          <p className="text-lg font-semibold">No roadmap for this goal yet</p>
          <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-ink-2">
            Only the software engineering goal has steps so far. Pick it in career discovery, or check back once your
            agents are connected.
          </p>
          <Link to="/discover" className="btn-primary mt-6 inline-flex h-10 items-center rounded-xl px-4 text-sm font-medium text-white">
            Back to career discovery
          </Link>
        </Card>
      </Page>
    );
  }

  const steps = roadmap.phases.flatMap((phase) => phase.steps);
  const doneCount = steps.filter((step) => state.doneSteps.includes(step.id)).length;
  const nextId = steps.find((step) => !state.doneSteps.includes(step.id))?.id;
  const percent = Math.round((doneCount / steps.length) * 100);

  return (
    <Page title="Your roadmap" subtitle={roadmap.goal}>
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <ol className="space-y-4">
          {roadmap.phases.map((phase, index) => (
            <li key={phase.id}>
              <Card className="p-3 sm:p-4">
                <div className="flex items-baseline gap-3 px-4 pt-3 pb-2">
                  <span className="font-display text-3xl text-brand">{index + 1}</span>
                  <h2 className="text-lg font-semibold tracking-tight">{phase.title}</h2>
                  <span className="ml-auto text-sm text-ink-3">{phase.window}</span>
                </div>
                <ul>
                  {phase.steps.map((step) => (
                    <Step key={step.id} step={step} isNext={step.id === nextId} />
                  ))}
                </ul>
              </Card>
            </li>
          ))}
        </ol>

        <aside className="space-y-4 lg:sticky lg:top-6 lg:self-start">
          <Card className="p-6">
            <h2 className="font-semibold tracking-tight">Progress</h2>
            <p className="mt-3 font-display text-6xl leading-none">{percent}%</p>
            <div
              className="mt-4 h-2 overflow-hidden rounded-full bg-slate-100"
              role="progressbar"
              aria-valuenow={percent}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label="Roadmap progress"
            >
              <div className="h-full rounded-full bg-brand transition-[width] duration-500" style={{ width: `${percent}%` }} />
            </div>
            <p className="mt-2 text-sm text-ink-3">
              {doneCount} of {steps.length} steps done
            </p>
          </Card>
          <Card className="p-6">
            <h2 className="font-semibold tracking-tight">Where you stand</h2>
            <p className="mt-2 text-sm leading-relaxed text-ink-2">{roadmap.summary}</p>
            <Link to="/discover" className="mt-4 inline-flex min-h-10 items-center text-sm font-medium text-brand">
              Change goal
            </Link>
          </Card>
        </aside>
      </div>
    </Page>
  );
}
