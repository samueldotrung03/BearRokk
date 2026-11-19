// The roadmap answers "what do I actually need to do to get there?". It starts from a goal,
// compares what that goal asks for with what the student has, lays the gap out as ordered
// actions tied to real opportunities from the feed, and changes as the student acts.
import { ArrowUpRight, Check, ChevronDown, Circle, Plus, Sparkles, Users, X } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router';
import { stepMeta, typeMeta } from '../components/meta.ts';
import { Card, Page } from '../components/Page.tsx';
import { StatusSelect } from '../components/StatusSelect.tsx';
import { applicationInfo, careerPaths, opportunities, pathProfiles } from '../data/sample.ts';
import { evidenceFor, type StepEvidence } from '../lib/pathways.ts';
import { buildOpportunityRoadmap, currentRoadmap } from '../lib/roadmap.ts';
import { daysUntil, dueLabel } from '../lib/time.ts';
import { useOpportunities } from '../state/live.tsx';
import { useStore } from '../state/StoreProvider.tsx';
import type { RoadmapStep } from '../types.ts';

function Step({
  step,
  isNext,
  onRemove,
  evidence,
  total = 0,
}: {
  step: RoadmapStep;
  isNext: boolean;
  onRemove?: () => void;
  /** How many of the people who reached this goal did this step. */
  evidence?: StepEvidence;
  total?: number;
}) {
  const { state, dispatch } = useStore();
  const done = state.doneSteps.includes(step.id);
  const meta = stepMeta[step.kind];
  const linked = opportunities.find((o) => o.id === step.opportunityId && !state.dismissed.includes(o.id));
  const tracks = linked && applicationInfo[linked.id];

  return (
    <li className={`flex gap-4 rounded-2xl p-4 transition ${isNext ? 'bg-brand-soft/70' : 'hover:bg-slate-50'}`}>
      <button
        type="button"
        role="checkbox"
        aria-checked={done}
        aria-label={`Mark "${step.title}" as done`}
        onClick={() => dispatch({ type: 'toggleStep', id: step.id })}
        className={`mt-0.5 grid size-6 shrink-0 place-items-center rounded-full border-2 transition ${
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
          {evidence && total > 0 && (
            <span className="path-chip" data-strong={evidence.share >= 0.6}>
              <Users className="size-3.5" aria-hidden="true" />
              {evidence.count} of {total} people did this
            </span>
          )}
          {linked && !onRemove && (
            <a
              href={linked.actionUrl ?? linked.sourceUrl}
              target="_blank"
              rel="noreferrer"
              onClick={() => dispatch({ type: 'opened', id: linked.id })}
              className="flex items-center gap-1 rounded-full border border-line bg-white px-3 py-1 font-medium text-brand hover:border-brand"
            >
              {linked.title}
              <ArrowUpRight className="size-3.5 shrink-0" aria-hidden="true" />
            </a>
          )}
          {tracks && <StatusSelect id={linked.id} />}
          {tracks && state.applications[linked.id] && (
            <Link to="/applications" className="font-medium text-brand">
              Open application
            </Link>
          )}
          {onRemove && (
            <button type="button" onClick={onRemove} className="flex items-center gap-1 font-medium hover:text-ink">
              <X className="size-3.5" aria-hidden="true" />
              Remove
            </button>
          )}
        </div>
      </div>
    </li>
  );
}

/** Where the plan comes from: what people who reached this goal did, counted across profiles. */
function PathEvidence({ goal, common, rare, total }: { goal: string; common: StepEvidence[]; rare: StepEvidence[]; total: number }) {
  const [open, setOpen] = useState(false);
  const profiles = pathProfiles.filter((profile) => profile.goalId === goal);
  if (total === 0) return null;

  return (
    <Card className="overflow-hidden">
      <div className="p-6">
        <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
          <h2 className="flex items-center gap-2 text-lg font-semibold tracking-tight">
            <Users className="size-[18px] text-brand" aria-hidden="true" />
            Built from what people actually did
          </h2>
          <span className="text-sm text-ink-3">{total} profiles of people who got this role · sample data</span>
        </div>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-ink-2">
          Your agents read the public profiles of people who landed this role and noted what each did first. The steps below are
          the ones they share, and inside each phase the most common come first.
        </p>

        <ul className="mt-5 grid gap-x-8 gap-y-3 sm:grid-cols-2">
          {common.slice(0, 6).map((item) => (
            <li key={item.step.id}>
              <div className="flex items-baseline justify-between gap-3 text-sm">
                <span className="truncate font-medium">{item.step.title}</span>
                <span className="shrink-0 text-ink-3">
                  {item.count} of {total}
                </span>
              </div>
              <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-slate-100">
                <div className="h-full rounded-full bg-brand" style={{ width: `${item.share * 100}%` }} />
              </div>
            </li>
          ))}
        </ul>
        {rare.length > 0 && (
          <p className="mt-4 text-sm leading-relaxed text-ink-3">
            Few of them did: {rare.map((item) => `"${item.step.title}" (${item.count} of ${total})`).join(', ')}. Still useful, but
            not what got most people in.
          </p>
        )}
      </div>

      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
        className="flex w-full items-center justify-between border-t border-line px-6 py-3 text-sm font-semibold text-ink-2 hover:bg-slate-50"
      >
        {open ? 'Hide the paths' : `See the ${total} paths`}
        <ChevronDown className={`size-4 transition-transform ${open ? 'rotate-180' : ''}`} aria-hidden="true" />
      </button>
      {open && (
        <ul className="grid gap-3 border-t border-line bg-slate-50/60 p-5 sm:grid-cols-2">
          {profiles.map((profile) => (
            <li key={profile.id} className="rounded-2xl bg-white p-4 shadow-card">
              <p className="text-sm leading-snug font-semibold">{profile.outcome}</p>
              <p className="text-xs text-ink-3">Got it as a {profile.year.toLowerCase()}</p>
              <ol className="path-line mt-3">
                {profile.timeline.map((entry) => (
                  <li key={entry}>{entry}</li>
                ))}
              </ol>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

export function Roadmap() {
  const { state, dispatch } = useStore();
  const roadmap = currentRoadmap(state.goalId);
  const evidence = evidenceFor(roadmap, pathProfiles);

  const planned = roadmap.phases.flatMap((phase) => phase.steps);
  const linkedIds = new Set(planned.map((step) => step.opportunityId));
  const visible = (id: string) => !state.dismissed.includes(id);
  // Steps the student added from the feed, and suggestions for more, come from what the agents found.
  const found = useOpportunities();
  const started = found.filter((o) => state.extraSteps.includes(o.id) && visible(o.id));
  const startedSteps = new Map(started.map((o) => [o.id, buildOpportunityRoadmap(o, applicationInfo[o.id], state.profile.skills)]));
  const extras = [...startedSteps.values()].flat();
  const steps = [...planned, ...extras];
  const isDone = (id: string) => state.doneSteps.includes(id);
  const doneCount = steps.filter((step) => isDone(step.id)).length;
  const next = steps.find((step) => !isDone(step.id));
  const percent = Math.round((doneCount / steps.length) * 100);

  // The gap: each thing the goal asks for is covered by a skill on the profile or a finished step.
  const requirements = roadmap.requirements.map((requirement) => {
    const bySkill = requirement.skill !== null && state.profile.skills.includes(requirement.skill);
    const byStep = requirement.stepId !== null && isDone(requirement.stepId);
    return { ...requirement, met: bySkill || byStep, step: planned.find((step) => step.id === requirement.stepId) };
  });
  const metCount = requirements.filter((requirement) => requirement.met).length;

  // What the student saved or liked shows where they are heading, so it is offered as a step.
  const suggestions = found.filter(
    (o) =>
      (state.saved.includes(o.id) || state.liked.includes(o.id)) &&
      visible(o.id) &&
      !linkedIds.has(o.id) &&
      !state.extraSteps.includes(o.id),
  );

  const upcoming = steps
    .filter((step) => step.due && !isDone(step.id) && daysUntil(step.due) >= 0)
    .sort((a, b) => daysUntil(a.due!) - daysUntil(b.due!))
    .slice(0, 3);

  return (
    <Page title="Your roadmap" subtitle={roadmap.goal}>
      <Card className="mb-6 p-5">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-3">
          <h2 className="font-semibold tracking-tight">Your goal</h2>
          <div className="flex flex-wrap gap-2" role="group" aria-label="Choose a goal">
            {careerPaths.map((path) => (
              <button
                key={path.id}
                type="button"
                aria-pressed={path.id === roadmap.goalId}
                onClick={() => dispatch({ type: 'setGoal', id: path.id })}
                className={`h-9 rounded-full border px-4 text-sm font-medium transition ${
                  path.id === roadmap.goalId ? 'border-brand bg-brand text-white' : 'border-line bg-white text-ink-2 hover:border-slate-300'
                }`}
              >
                {path.title}
              </button>
            ))}
          </div>
          <Link to="/discover" className="ml-auto text-sm font-medium text-brand">
            Not sure? Explore career paths
          </Link>
        </div>
      </Card>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="space-y-4">
          <PathEvidence goal={roadmap.goalId} common={evidence.common} rare={evidence.rare} total={evidence.total} />

          <Card className="p-6">
            <div className="flex items-baseline justify-between gap-3">
              <h2 className="text-lg font-semibold tracking-tight">What this goal asks for</h2>
              <span className="text-sm text-ink-3">
                You have {metCount} of {requirements.length}
              </span>
            </div>
            <ul className="mt-4 grid gap-x-6 gap-y-3 sm:grid-cols-2">
              {requirements.map((requirement) => (
                <li key={requirement.id} className="flex gap-3">
                  {requirement.met ? (
                    <span className="mt-0.5 grid size-5 shrink-0 place-items-center rounded-full bg-emerald-100 text-emerald-700">
                      <Check className="size-3" strokeWidth={3} aria-hidden="true" />
                    </span>
                  ) : (
                    <Circle className="mt-0.5 size-5 shrink-0 text-slate-300" aria-hidden="true" />
                  )}
                  <div className="min-w-0">
                    <p className={`text-sm font-medium ${requirement.met ? 'text-ink' : 'text-ink-2'}`}>{requirement.label}</p>
                    <p className="text-sm text-ink-3">
                      {requirement.met ? 'You have this' : requirement.step ? `Step: ${requirement.step.title}` : 'Add it to your profile when you have it'}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          </Card>

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
                      <Step key={step.id} step={step} isNext={step.id === next?.id} evidence={evidence.byStep.get(step.id)} total={evidence.total} />
                    ))}
                  </ul>
                </Card>
              </li>
            ))}
            {started.map((o) => (
              <li key={o.id}>
                <Card className="p-3 sm:p-4">
                  <div className="flex items-center gap-3 px-4 pt-3 pb-2">
                    <Plus className="size-5 shrink-0 text-brand" aria-hidden="true" />
                    <div className="min-w-0 flex-1">
                      <h2 className="truncate text-lg font-semibold tracking-tight">{o.title}</h2>
                      <p className="text-sm text-ink-3">Roadmap you started for this opportunity</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => dispatch({ type: 'removeStep', id: o.id })}
                      className="flex h-9 shrink-0 items-center gap-1.5 rounded-xl border border-line px-3 text-sm font-medium text-ink-2 hover:bg-slate-50"
                    >
                      <X className="size-4" aria-hidden="true" /> Remove
                    </button>
                  </div>
                  <ul>
                    {startedSteps.get(o.id)!.map((step) => (
                      <Step key={step.id} step={step} isNext={step.id === next?.id} />
                    ))}
                  </ul>
                </Card>
              </li>
            ))}
          </ol>
        </div>

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

          {suggestions.length > 0 && (
            <Card className="p-6">
              <h2 className="flex items-center gap-2 font-semibold tracking-tight">
                <Sparkles className="size-4 text-brand" aria-hidden="true" />
                From what you saved and liked
              </h2>
              <ul className="mt-3 space-y-3">
                {suggestions.map((o) => (
                  <li key={o.id} className="flex items-center gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{o.title}</p>
                      <p className="text-sm text-ink-3">{typeMeta[o.type].label}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => dispatch({ type: 'addStep', id: o.id })}
                      className="flex h-8 shrink-0 items-center gap-1 rounded-lg border border-line px-2.5 text-sm font-semibold text-brand hover:border-brand"
                    >
                      <Plus className="size-3.5" aria-hidden="true" />
                      Start roadmap
                    </button>
                  </li>
                ))}
              </ul>
            </Card>
          )}

          {upcoming.length > 0 && (
            <Card className="p-6">
              <h2 className="font-semibold tracking-tight">Coming up</h2>
              <ul className="mt-3 space-y-3">
                {upcoming.map((step) => (
                  <li key={step.id}>
                    <p className="text-sm font-medium">{step.title}</p>
                    <p className={`text-sm ${daysUntil(step.due!) <= 7 ? 'font-medium text-orange-700' : 'text-ink-3'}`}>{dueLabel(step.due!)}</p>
                  </li>
                ))}
              </ul>
            </Card>
          )}

          <Card className="p-6">
            <h2 className="font-semibold tracking-tight">Where you stand</h2>
            <p className="mt-2 text-sm leading-relaxed text-ink-2">{roadmap.summary}</p>
            <p className="mt-3 text-sm leading-relaxed text-ink-3">
              This plan changes as you do: finishing a step, changing your goal or skills, and what you save and like in the feed all move it, and the
              feed puts your next step first.
            </p>
          </Card>
        </aside>
      </div>
    </Page>
  );
}
