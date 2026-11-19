// The calendar's "AI": one interface for planning the week and writing the brief. Today it is
// the local rules in planner.ts and brief.ts. When the agents are connected, a Grok-backed
// assistant takes the same inputs and returns the same shapes, and the page stays as it is.
import { opportunities, applicationInfo } from '../../data/sample.ts';
import type { AppState } from '../../state/store.ts';
import type { StepKind } from '../../types.ts';
import { progressOf } from '../applications.ts';
import { planFor } from '../roadmap.ts';
import { buildBrief, type Brief, type BriefInput } from './brief.ts';
import { planWeek, type EffortContext, type PlanInput, type WeekPlan } from './planner.ts';

export interface CalendarAssistant {
  /** Who produced the result, shown to the student so they know what they are looking at. */
  source: string;
  planWeek(input: PlanInput): WeekPlan;
  brief(input: BriefInput): Brief;
}

export const localAssistant: CalendarAssistant = {
  source: 'Built from your own dates by simple rules. Grok will plan once the agents are connected.',
  planWeek,
  brief: buildBrief,
};

/** What the effort estimates need from the store: step kinds and how far each application is. */
export function effortContext(state: AppState): EffortContext {
  const stepKinds = new Map<string, StepKind>(planFor(state).steps.map((step) => [step.id, step.kind]));
  const progress = new Map<string, { done: number; total: number }>();
  for (const o of opportunities) {
    const application = state.applications[o.id];
    if (application) progress.set(o.id, progressOf(application, applicationInfo[o.id]));
  }
  return { stepKinds, progress };
}
