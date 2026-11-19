// The roadmap answers "what do I actually need to do to get there?". It starts from a goal,
// compares what that goal asks for with what the student has, lays the gap out as ordered
// actions tied to real opportunities from the feed, and changes as the student acts. On top of
// that sit a coach that answers questions from the plan, a week planner, a readiness score and
// a timeline. Their logic is pure and lives in src/lib/roadmapx; this file wires it to the page.
import { Check, Circle, LayoutList, Plus, Sparkles, TrendingUp, X } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router';
import { Coach } from '../components/roadmap/Coach.tsx';
import { ExportButton, Milestones } from '../components/roadmap/Momentum.tsx';
import { reveal } from '../components/roadmap/motion.ts';
import { PathEvidence } from '../components/roadmap/PathEvidence.tsx';
import { ReadinessCard } from '../components/roadmap/ReadinessCard.tsx';
import { stepDomId, StepRow } from '../components/roadmap/StepRow.tsx';
import { Timeline } from '../components/roadmap/Timeline.tsx';
import { WeekPlanner } from '../components/roadmap/WeekPlanner.tsx';
import { typeMeta } from '../components/meta.ts';
import { Card, Page } from '../components/Page.tsx';
import { pathGroups } from '../data/fields.ts';
import { applicationInfo, careerPaths, opportunities, pathProfiles } from '../data/sample.ts';
import { evidenceFor } from '../lib/pathways.ts';
import { buildOpportunityRoadmap, currentRoadmap } from '../lib/roadmap.ts';
import type { CoachAction } from '../lib/roadmapx/coach.ts';
import { buildCoachContext, daysLeft, dueShort, formatHours } from '../lib/roadmapx/context.ts';
import { roadmapAsText } from '../lib/roadmapx/exportText.ts';
import { milestones, streak, syncDoneLog, type DoneLog } from '../lib/roadmapx/milestones.ts';
import { pace, readiness } from '../lib/roadmapx/readiness.ts';
import { useLocal } from '../lib/useLocal.ts';
import { useStore } from '../state/StoreProvider.tsx';
import '../styles/roadmap.css';

type View = 'phases' | 'timeline';

export function RoadmapList() {
  const { state, dispatch } = useStore();
  const [hours, setHours] = useLocal('bearrok.roadmap.hours', 6);
  const [view, setView] = useLocal<View>('bearrok.roadmap.view', 'phases');
  const [notes, setNotes] = useLocal<Record<string, string>>('bearrok.roadmap.notes', {});
  const [doneLog, setDoneLog] = useLocal<DoneLog | null>('bearrok.roadmap.doneLog', null);
  const [incoming, setIncoming] = useState<{ id: number; question: string } | null>(null);
  const [toast, setToast] = useState<{ text: string; milestone: boolean } | null>(null);
  const toastTimer = useRef<number | undefined>(undefined);
  // The field whose goals are listed. Until the student picks one, it is the current goal's field.
  const [field, setField] = useState<string | null>(null);

  const roadmap = currentRoadmap(state.goalId);
  const goalField = careerPaths.find((path) => path.id === roadmap.goalId)?.group ?? pathGroups[0]!;
  const openField = field ?? goalField;
  const evidence = evidenceFor(roadmap, pathProfiles);
  const ctx = useMemo(() => buildCoachContext(state, hours), [state, hours]);
  const score = readiness(ctx);
  const status = pace(ctx);
  const miles = milestones(ctx);
  const momentum = streak(doneLog ?? {}, ctx.now);

  const planned = roadmap.phases.flatMap((phase) => phase.steps);
  const linkedIds = new Set(planned.map((step) => step.opportunityId));
  const visible = (id: string) => !state.dismissed.includes(id);
  const started = opportunities.filter((o) => state.extraSteps.includes(o.id) && visible(o.id));
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
  const suggestions = opportunities.filter(
    (o) =>
      (state.saved.includes(o.id) || state.liked.includes(o.id)) &&
      visible(o.id) &&
      !linkedIds.has(o.id) &&
      !state.extraSteps.includes(o.id),
  );

  const upcoming = steps
    .filter((step) => step.due && !isDone(step.id) && daysLeft(step.due, ctx.now) >= 0)
    .sort((a, b) => daysLeft(a.due!, ctx.now) - daysLeft(b.due!, ctx.now))
    .slice(0, 3);

  // Keep the done log in step with the store, and cheer when a step or a milestone is reached.
  const previousDone = useRef(state.doneSteps);
  const previousMiles = useRef<Set<string> | null>(null);
  useEffect(() => {
    setDoneLog((log) => syncDoneLog(log, state.doneSteps, new Date().toISOString()));
    const added = state.doneSteps.filter((id) => !previousDone.current.includes(id));
    previousDone.current = state.doneSteps;
    const reached = new Set(miles.filter((m) => m.reached).map((m) => m.id));
    const fresh = previousMiles.current ? miles.find((m) => m.reached && !previousMiles.current!.has(m.id)) : undefined;
    previousMiles.current = reached;
    const step = ctx.steps.find((s) => s.id === added[0]);
    const text = fresh ? `Milestone: ${fresh.label}` : step ? `Done: ${step.title}` : null;
    if (!text) return;
    setToast({ text, milestone: Boolean(fresh) });
    window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToast(null), 3200);
    // Only a change in done marks should cheer; the other values are read from the same render.
  }, [state.doneSteps]);
  useEffect(() => () => window.clearTimeout(toastTimer.current), []);

  const askCoach = (question: string) => {
    setIncoming({ id: Date.now(), question });
    reveal('rm-coach-anchor', 'start');
  };

  const onAction = (action: CoachAction) => {
    if (action.type === 'tick') dispatch({ type: 'toggleStep', id: action.stepId });
    if (action.type === 'show') reveal(stepDomId(action.stepId));
    if (action.type === 'planWeek') {
      // The slider runs from 1 to 20 hours; a question can name any number.
      setHours(Math.min(20, Math.max(1, Math.round(action.hours * 2) / 2)));
      window.setTimeout(() => reveal('rm-week', 'start'), 50);
    }
    if (action.type === 'view') {
      setView(action.view);
      window.setTimeout(() => reveal('rm-plan', 'start'), 50);
    }
  };

  const setNote = (id: string) => (text: string) =>
    setNotes((all) => {
      const { [id]: _old, ...rest } = all;
      return text.trim() ? { ...rest, [id]: text } : rest;
    });

  const stepProps = (id: string) => ({ ctx, note: notes[id] ?? '', onNote: setNote(id), onAsk: askCoach });

  return (
    <Page title="Your roadmap" subtitle={roadmap.goal}>
      <Card className="mb-6 p-5">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-3">
          <h2 className="font-semibold tracking-tight">Your goal</h2>
          <div className="rm-toggle rm-fields" role="group" aria-label="Choose a field">
            {pathGroups.map((group) => (
              <button key={group} type="button" aria-pressed={group === openField} onClick={() => setField(group)}>
                {group}
                {group === goalField && group !== openField && (
                  <>
                    <span className="rm-field-dot" aria-hidden="true" />
                    <span className="sr-only">, your goal is here</span>
                  </>
                )}
              </button>
            ))}
          </div>
          <Link to="/discover" className="ml-auto text-sm font-medium text-brand">
            Not sure? Explore career paths
          </Link>
        </div>
        <div className="mt-3 flex flex-wrap gap-2" role="group" aria-label={`Goals in ${openField}`}>
          {careerPaths
            .filter((path) => (path.group ?? pathGroups[0]) === openField)
            .map((path) => (
              <button
                key={path.id}
                type="button"
                aria-pressed={path.id === roadmap.goalId}
                onClick={() => {
                  dispatch({ type: 'setGoal', id: path.id });
                  setField(null);
                }}
                className={`h-9 rounded-full border px-4 text-sm font-medium transition ${
                  path.id === roadmap.goalId ? 'border-brand bg-brand text-white' : 'border-line bg-white text-ink-2 hover:border-slate-300'
                }`}
              >
                {path.title}
              </button>
            ))}
        </div>
      </Card>

      <div className="mb-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div id="rm-coach-anchor" className="min-w-0 scroll-mt-6">
          <Coach ctx={ctx} onAction={onAction} incoming={incoming} />
        </div>
        <ReadinessCard
          readiness={score}
          pace={status}
          onPlan={() => reveal('rm-week', 'start')}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="min-w-0 space-y-4">
          <div id="rm-week" className="scroll-mt-6">
            <WeekPlanner
              ctx={ctx}
              hours={hours}
              onHours={setHours}
              onTick={(id) => dispatch({ type: 'toggleStep', id })}
              onShow={(id) => reveal(stepDomId(id))}
              onAsk={askCoach}
            />
          </div>

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
                      {requirement.met ? (
                        'You have this'
                      ) : requirement.step ? (
                        <button type="button" onClick={() => reveal(stepDomId(requirement.step!.id))} className="text-left hover:text-brand">
                          Step: {requirement.step.title}
                        </button>
                      ) : (
                        'Add it to your profile when you have it'
                      )}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          </Card>

          <div id="rm-plan" className="flex scroll-mt-6 flex-wrap items-center justify-between gap-3 px-1 pt-2">
            <h2 className="font-display text-3xl leading-none">Your plan</h2>
            <div className="flex flex-wrap items-center gap-2">
              <div className="rm-toggle" role="group" aria-label="How to show the plan">
                <button type="button" aria-pressed={view === 'phases'} onClick={() => setView('phases')}>
                  <LayoutList className="size-4" aria-hidden="true" />
                  Phases
                </button>
                <button type="button" aria-pressed={view === 'timeline'} onClick={() => setView('timeline')}>
                  <TrendingUp className="size-4" aria-hidden="true" />
                  Timeline
                </button>
              </div>
              <ExportButton getText={() => roadmapAsText(ctx, notes)} fileName="bearrok-roadmap.txt" />
            </div>
          </div>

          {view === 'timeline' ? (
            <Timeline ctx={ctx} />
          ) : (
            <ol className="space-y-4">
              {roadmap.phases.map((phase, index) => {
                const left = phase.steps.filter((step) => !isDone(step.id));
                const hoursLeft = ctx.steps.filter((s) => s.phaseId === phase.id && !s.done).reduce((sum, s) => sum + s.hours, 0);
                return (
                  <li key={phase.id}>
                    <Card className="p-3 sm:p-4">
                      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1 px-4 pt-3 pb-2">
                        <span className="font-display text-3xl text-brand">{index + 1}</span>
                        <h2 className="text-lg font-semibold tracking-tight">{phase.title}</h2>
                        <span className="ml-auto text-sm text-ink-3">
                          {phase.window}
                          <span className="rm-phase-meta">
                            {left.length === 0 ? 'All done' : `${phase.steps.length - left.length} of ${phase.steps.length} done · about ${formatHours(hoursLeft)} left`}
                          </span>
                        </span>
                      </div>
                      <ul>
                        {phase.steps.map((step) => (
                          <StepRow
                            key={step.id}
                            step={step}
                            isNext={step.id === next?.id}
                            evidence={evidence.byStep.get(step.id)}
                            total={evidence.total}
                            {...stepProps(step.id)}
                          />
                        ))}
                      </ul>
                    </Card>
                  </li>
                );
              })}
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
                        <StepRow key={step.id} step={step} isNext={step.id === next?.id} {...stepProps(step.id)} />
                      ))}
                    </ul>
                  </Card>
                </li>
              ))}
            </ol>
          )}
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
              <div className="rm-progress-fill h-full rounded-full bg-brand" style={{ width: `${percent}%` }} />
            </div>
            <p className="mt-2 text-sm text-ink-3">
              {doneCount} of {steps.length} steps done
            </p>
            <Milestones items={miles} streak={momentum} />
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
                    <button type="button" onClick={() => reveal(stepDomId(step.id))} className="text-left text-sm font-medium hover:text-brand">
                      {step.title}
                    </button>
                    <p className={`text-sm ${daysLeft(step.due!, ctx.now) <= 7 ? 'font-medium text-orange-700' : 'text-ink-3'}`}>{dueShort(step.due!, ctx.now)}</p>
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

      <div className="rm-toast-wrap" aria-live="polite">
        {toast && (
          <p className="rm-toast" data-milestone={toast.milestone} key={toast.text}>
            {toast.milestone ? <Sparkles className="size-4" aria-hidden="true" /> : <Check className="size-4" strokeWidth={3} aria-hidden="true" />}
            {toast.text}
          </p>
        )}
      </div>
    </Page>
  );
}
