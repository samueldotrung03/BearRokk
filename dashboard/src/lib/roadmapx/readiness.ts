// How ready the student is for the goal, and whether the dates in the plan are being kept.
// Readiness mixes three things on purpose: steps done alone would reward ticking easy steps, so
// the requirements and the steps most people did carry weight too.
import { daysLeft, formatHours, type CoachContext, type CoachStep } from './context.ts';

export interface ReadinessPart {
  key: 'requirements' | 'steps' | 'evidence';
  label: string;
  /** 0 to 1. */
  value: number;
  weight: number;
  detail: string;
}

export interface Readiness {
  /** 0 to 100. */
  score: number;
  parts: ReadinessPart[];
}

export const READINESS_WEIGHTS = { requirements: 0.4, steps: 0.3, evidence: 0.3 } as const;

export function readiness(ctx: CoachContext): Readiness {
  const met = ctx.requirements.filter((r) => r.met).length;
  const reqValue = ctx.requirements.length ? met / ctx.requirements.length : 0;

  const done = ctx.steps.filter((s) => s.done).length;
  const stepValue = ctx.steps.length ? done / ctx.steps.length : 0;

  // Each goal step counts by the share of people who did it, so the common steps move the score
  // most. Steps of started opportunity roadmaps have no evidence and are left out of this part.
  const weighed = ctx.steps.filter((s) => s.evidence);
  const totalWeight = weighed.reduce((sum, s) => sum + s.evidence!.share, 0);
  const doneWeight = weighed.filter((s) => s.done).reduce((sum, s) => sum + s.evidence!.share, 0);
  const evidenceValue = totalWeight > 0 ? doneWeight / totalWeight : stepValue;

  const parts: ReadinessPart[] = [
    {
      key: 'requirements',
      label: 'Requirements met',
      value: reqValue,
      weight: READINESS_WEIGHTS.requirements,
      detail: `${met} of ${ctx.requirements.length}`,
    },
    { key: 'steps', label: 'Steps done', value: stepValue, weight: READINESS_WEIGHTS.steps, detail: `${done} of ${ctx.steps.length}` },
    {
      key: 'evidence',
      label: 'What most people did',
      value: evidenceValue,
      weight: READINESS_WEIGHTS.evidence,
      detail: totalWeight > 0 ? `${Math.round(evidenceValue * 100)}% of the common path` : 'No profiles yet, counted as steps done',
    },
  ];
  const score = Math.round(parts.reduce((sum, part) => sum + part.value * part.weight, 0) * 100);
  return { score, parts };
}

export type PaceStatus = 'on_track' | 'tight' | 'behind';

export interface Pace {
  status: PaceStatus;
  label: string;
  detail: string;
  overdue: CoachStep[];
  /** Open steps due in the next seven days, soonest first. */
  dueThisWeek: CoachStep[];
  hoursDueThisWeek: number;
}

/**
 * Behind means a step's date has passed and it is not done. Tight means the steps due in the
 * next seven days need more hours than the student said they have this week.
 */
export function pace(ctx: CoachContext): Pace {
  const open = ctx.steps.filter((s) => !s.done && s.due);
  const overdue = open.filter((s) => daysLeft(s.due!, ctx.now) < 0);
  const dueThisWeek = open
    .filter((s) => {
      const days = daysLeft(s.due!, ctx.now);
      return days >= 0 && days <= 7;
    })
    .sort((a, b) => daysLeft(a.due!, ctx.now) - daysLeft(b.due!, ctx.now));
  const hoursDueThisWeek = dueThisWeek.reduce((sum, s) => sum + s.hours, 0);

  if (overdue.length > 0) {
    return {
      status: 'behind',
      label: 'Behind',
      detail: `${overdue.length === 1 ? 'One step is' : `${overdue.length} steps are`} past the date: ${overdue.map((s) => `"${s.title}"`).join(', ')}.`,
      overdue,
      dueThisWeek,
      hoursDueThisWeek,
    };
  }
  if (hoursDueThisWeek > ctx.hoursPerWeek) {
    return {
      status: 'tight',
      label: 'Tight week',
      detail: `${dueThisWeek.length} steps are due in the next 7 days, about ${formatHours(hoursDueThisWeek)} of work, and you have ${formatHours(ctx.hoursPerWeek)}.`,
      overdue,
      dueThisWeek,
      hoursDueThisWeek,
    };
  }
  return {
    status: 'on_track',
    label: 'On track',
    detail:
      dueThisWeek.length > 0
        ? `Nothing is overdue, and the ${formatHours(hoursDueThisWeek)} due this week fits in your ${formatHours(ctx.hoursPerWeek)}.`
        : 'Nothing is overdue and nothing is due in the next 7 days.',
    overdue,
    dueThisWeek,
    hoursDueThisWeek,
  };
}
