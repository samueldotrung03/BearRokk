// One flat, plain-data picture of the student's roadmap: every step with its phase, due date,
// done mark, hours, evidence and the requirement it covers. The coach, the week planner, the
// readiness score and the export all read this, so they agree with each other, and a real model
// call can be handed the same object as JSON later.
import { extraStepHours, stepHours } from '../../data/roadmap-extra.ts';
import { opportunities, pathProfiles } from '../../data/sample.ts';
import type { Opportunity } from '../../types.ts';
import type { AppState } from '../../state/store.ts';
import type { OpportunityType, Profile, RoadmapStep, StepKind } from '../../types.ts';
import { evidenceFor } from '../pathways.ts';
import { planFor } from '../roadmap.ts';

export const DAY = 86_400_000;

export interface CoachStep {
  id: string;
  title: string;
  detail: string;
  kind: StepKind;
  /** Phase title, or the opportunity's title for a roadmap the student started. */
  phase: string;
  phaseId: string;
  /** True for steps of a roadmap started for one opportunity. */
  extra: boolean;
  due: string | null;
  done: boolean;
  /** Rough planning estimate, never a measurement. */
  hours: number;
  /** How many of the profiles behind this goal did the step. Null when there is no evidence. */
  evidence: { count: number; total: number; share: number } | null;
  /** The goal requirement this step covers, if any. */
  requirement: { label: string; met: boolean } | null;
  opportunity: { id: string; title: string; organizer: string } | null;
  isNext: boolean;
}

export interface CoachRequirement {
  id: string;
  label: string;
  met: boolean;
  /** How it is met or can be met. */
  skill: string | null;
  stepId: string | null;
}

export interface CoachContext {
  goal: string;
  summary: string;
  profile: Profile;
  steps: CoachStep[];
  requirements: CoachRequirement[];
  /** How many profiles of people who reached the goal the evidence rests on. */
  profiles: number;
  hoursPerWeek: number;
  now: number;
}

const kindHours: Record<StepKind, number> = { learn: 6, build: 6, join: 2, attend: 3, apply: 1.5 };

/** A rough hour count for a step: the hand-set value, else a rule from its id, else its kind. */
export function estimateHours(step: RoadmapStep, type?: OpportunityType): number {
  const set = stepHours[step.id];
  if (set !== undefined) return set;
  const key = step.id.includes(':') ? step.id.slice(step.id.indexOf(':') + 1) : '';
  if (key in extraStepHours) return extraStepHours[key]!;
  if (key.startsWith('skill-')) return 4;
  if (key.startsWith('material-')) return 1;
  if (key.startsWith('prompt-')) return 1.5;
  // A hackathon's "attend" is the whole weekend; an event's is an evening.
  if (key === 'attend') return type === 'hackathon' ? 10 : 2;
  return kindHours[step.kind];
}

/** `found` is the postings a step may point to: what the agents found. The sample set without it. */
export function buildCoachContext(state: AppState, hoursPerWeek: number, now = Date.now(), found: Opportunity[] = opportunities): CoachContext {
  const plan = planFor(state, found);
  const evidence = evidenceFor(plan.roadmap, pathProfiles);
  const done = new Set(state.doneSteps);
  const skills = state.profile.skills;

  const requirements: CoachRequirement[] = plan.roadmap.requirements.map((r) => ({
    id: r.id,
    label: r.label,
    skill: r.skill,
    stepId: r.stepId,
    met: (r.skill !== null && skills.includes(r.skill)) || (r.stepId !== null && done.has(r.stepId)),
  }));

  const phaseOf = new Map<string, { id: string; title: string }>();
  plan.roadmap.phases.forEach((phase) => phase.steps.forEach((step) => phaseOf.set(step.id, phase)));

  const steps = plan.steps.map((step): CoachStep => {
    const o = found.find((candidate) => candidate.id === step.opportunityId);
    const phase = phaseOf.get(step.id);
    const ev = evidence.byStep.get(step.id);
    const requirement = requirements.find((r) => r.stepId === step.id);
    return {
      id: step.id,
      title: step.title,
      detail: step.detail,
      kind: step.kind,
      phase: phase?.title ?? o?.title ?? 'Added steps',
      phaseId: phase?.id ?? `extra-${o?.id ?? 'other'}`,
      extra: !phase,
      due: step.due,
      done: done.has(step.id),
      hours: estimateHours(step, o?.type),
      evidence: ev && evidence.total > 0 ? { count: ev.count, total: evidence.total, share: ev.share } : null,
      requirement: requirement ? { label: requirement.label, met: requirement.met } : null,
      opportunity: o ? { id: o.id, title: o.title, organizer: o.organizer } : null,
      isNext: step.id === plan.next?.id,
    };
  });

  return {
    goal: plan.roadmap.goal,
    summary: plan.roadmap.summary,
    profile: state.profile,
    steps,
    requirements,
    profiles: evidence.total,
    hoursPerWeek,
    now,
  };
}

/**
 * Calendar days from today to a due date. Counting by date, not by 24-hour blocks, keeps the
 * words in line with the date shown next to them: a step dated today says "due today".
 */
export function daysLeft(due: string, now: number): number {
  const day = (time: number) => {
    const d = new Date(time);
    return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  };
  return Math.round((day(new Date(due).getTime()) - day(now)) / DAY);
}

/** The short label under a step, in the same style as the rest of the app. */
export function dueShort(due: string, now: number): string {
  const days = daysLeft(due, now);
  if (days < 0) return `Overdue by ${-days} ${-days === 1 ? 'day' : 'days'}`;
  if (days === 0) return 'Due today';
  if (days === 1) return 'Due tomorrow';
  if (days <= 14) return `${days} days left`;
  return `Due ${new Date(due).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`;
}

export function formatHours(hours: number): string {
  if (hours < 1) return `${Math.round(hours * 60)} min`;
  return `${Number.isInteger(hours) ? hours : hours.toFixed(1)}h`;
}

export function dueWords(due: string, now: number): string {
  const days = daysLeft(due, now);
  if (days < 0) return `overdue by ${-days} ${-days === 1 ? 'day' : 'days'}`;
  if (days === 0) return 'due today';
  if (days === 1) return 'due tomorrow';
  return `due in ${days} days`;
}

export const list = (items: string[]) =>
  items.length <= 1 ? (items[0] ?? '') : `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`;

/**
 * "Why this step", in sentences that each rest on one field of the data. When the data has no
 * evidence for a step, it says so instead of making a reason up.
 */
export function whyStep(step: CoachStep, ctx: CoachContext): string[] {
  const lines: string[] = [];
  if (step.evidence) {
    const { count, total, share } = step.evidence;
    const weight = share >= 0.6 ? 'Most of them did it' : share < 0.35 ? 'Only a few did, so it is a bonus rather than a must' : 'About half did';
    lines.push(`${count} of the ${total} people who got this role did this before they got in. ${weight}.`);
  } else if (step.extra && step.opportunity) {
    lines.push(`It comes from the posting for ${step.opportunity.title}, not from other people's paths.`);
  } else {
    lines.push('There is no profile evidence for this step yet.');
  }
  if (step.requirement) {
    lines.push(
      step.requirement.met
        ? `It covers "${step.requirement.label}", which you already meet.`
        : `It covers "${step.requirement.label}", one of the things this goal asks for that you do not have yet.`,
    );
  }
  lines.push(step.detail);
  if (step.due && !step.done) lines.push(`It is ${dueWords(step.due, ctx.now)}.`);
  return lines;
}
