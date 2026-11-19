// "Plan my week": given the hours the student has, pick the open steps that matter most now.
// Urgency comes first because a missed date cannot be made up; among steps that are equally
// urgent, the ones more people who reached the goal did win.
import { daysLeft, dueWords, formatHours, type CoachContext, type CoachStep } from './context.ts';

export interface WeekPick {
  step: CoachStep;
  /** Hours given to the step this week. Less than the step needs when it is only started. */
  hours: number;
  partial: boolean;
  reasons: string[];
}

export interface WeekPlan {
  hours: number;
  used: number;
  picks: WeekPick[];
  /** Urgent steps that did not fit, with why. */
  leftOut: { step: CoachStep; reason: string }[];
  summary: string;
}

/** Higher is more pressing. Exported so tests can check the ordering rules directly. */
export function priority(step: CoachStep, now: number): number {
  let score = 0;
  if (step.due) {
    const days = daysLeft(step.due, now);
    if (days < 0) score += 100;
    else if (days <= 7) score += 60 - days * 3;
    else if (days <= 14) score += 30;
    else if (days <= 30) score += 15;
    else score += 8;
  } else {
    score += 5;
  }
  if (step.evidence) score += step.evidence.share * 30;
  if (step.isNext) score += 10;
  if (step.requirement && !step.requirement.met) score += 8;
  return score;
}

const isUrgent = (step: CoachStep, now: number) => step.due !== null && daysLeft(step.due, now) <= 7;

export function reasonsFor(step: CoachStep, now: number): string[] {
  const reasons: string[] = [];
  if (step.due) {
    const days = daysLeft(step.due, now);
    if (days <= 14) reasons.push(dueWords(step.due, now).replace(/^./, (c) => c.toUpperCase()));
  }
  if (step.evidence && step.evidence.count > 0) reasons.push(`${step.evidence.count} of ${step.evidence.total} people did it`);
  if (step.isNext) reasons.push('Your next step');
  if (step.requirement && !step.requirement.met) reasons.push(`Covers: ${step.requirement.label}`);
  if (reasons.length === 0) reasons.push(step.due ? dueWords(step.due, now) : 'No date set, so it fits around the rest');
  return reasons.slice(0, 3);
}

export function planWeek(ctx: CoachContext, hours: number): WeekPlan {
  const open = ctx.steps
    .filter((s) => !s.done)
    .map((step, order) => ({ step, order, score: priority(step, ctx.now) }))
    .sort((a, b) => b.score - a.score || a.order - b.order)
    .map((item) => item.step);

  let left = hours;
  const picks: WeekPick[] = [];
  const skipped: CoachStep[] = [];

  // First pass: whole steps, most pressing first, skipping any that would not fit.
  for (const step of open) {
    if (left < 0.25) break;
    if (step.hours <= left) {
      picks.push({ step, hours: step.hours, partial: false, reasons: reasonsFor(step, ctx.now) });
      left -= step.hours;
    } else {
      skipped.push(step);
    }
  }

  // Second pass: spare time goes to starting the most pressing urgent step that was too big.
  const big = skipped.find((step) => isUrgent(step, ctx.now));
  if (big && left >= 1) {
    const given = Math.floor(left * 2) / 2;
    picks.push({ step: big, hours: given, partial: true, reasons: ['Start it now', ...reasonsFor(big, ctx.now)].slice(0, 3) });
    left -= given;
  }

  const picked = new Set(picks.map((p) => p.step.id));
  const leftOut = open
    .filter((step) => !picked.has(step.id) && isUrgent(step, ctx.now))
    .map((step) => ({
      step,
      reason: `Needs about ${formatHours(step.hours)} and it is ${dueWords(step.due!, ctx.now)}. Find more time or move something.`,
    }));

  const used = hours - left;
  const urgentCount = picks.filter((p) => isUrgent(p.step, ctx.now)).length;
  const summary =
    picks.length === 0
      ? open.length === 0
        ? 'Every step is done. Nothing to plan.'
        : `No open step fits in ${formatHours(hours)}. The smallest needs ${formatHours(Math.min(...open.map((s) => s.hours)))}.`
      : `${picks.length} ${picks.length === 1 ? 'step' : 'steps'} in ${formatHours(used)} of your ${formatHours(hours)}${
          urgentCount > 0 ? `, ${urgentCount} of them due within a week` : ''
        }.`;

  return { hours, used, picks, leftOut, summary };
}
