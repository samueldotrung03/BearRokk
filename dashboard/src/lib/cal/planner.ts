// "Plan my week": places work blocks before each deadline in the hours the student says they have.
// It is a set of plain rules over the calendar's own items, so it never invents a date. Input and
// output are plain data on purpose: a model call (Grok, once the agents are connected) can take
// the same PlanInput and return the same WeekPlan, and the page would not change.
import type { Priority } from '../calendar.ts';
import type { StepKind } from '../../types.ts';
import { dayPhrase, dayRange, daysBetween, hoursLabel, weekdayOf } from './days.ts';
import type { CxItem } from './items.ts';

/** Rough hours per roadmap step kind. Visible in each block's explanation, so the student can judge it. */
export const STEP_EFFORT: Record<StepKind, number> = { learn: 3, build: 3, join: 1, attend: 1, apply: 2 };
const STEP_NOUN: Record<StepKind, string> = {
  learn: 'a learning step',
  build: 'a build step',
  join: 'a join step',
  attend: 'an attend step',
  apply: 'an apply step',
};
/** A full application from nothing: questions, materials, a review. */
export const APPLICATION_HOURS = 4;
/** No single sitting on one thing longer than this, so long work is spread over days. */
export const MAX_BLOCK = 2;
/** Targets due further out than this are left for a later week. */
export const HORIZON_DAYS = 14;
export const DEFAULT_HOURS = [2, 2, 2, 2, 2, 2, 3]; // Sun..Sat

export interface PlanTarget {
  /** The calendar item this work is for. */
  id: string;
  title: string;
  due: string;
  priority: Priority;
  hours: number;
  /** How the hour estimate was reached, in plain words. */
  basis: string;
  /** The item's own reason for being on the calendar. */
  reason: string;
}

export interface AcceptedBlock {
  targetId: string;
  day: string;
  hours: number;
  done: boolean;
}

export interface PlanInput {
  today: string;
  /** Days to plan, starting today. */
  days: number;
  /** Free hours for each weekday, Sunday first. */
  hoursByWeekday: number[];
  targets: PlanTarget[];
  /** Blocks the student already accepted; they use up hours and count toward their target. */
  accepted: AcceptedBlock[];
}

export interface PlanBlock {
  id: string;
  targetId: string;
  day: string;
  hours: number;
  title: string;
  priority: Priority;
  due: string;
  why: string;
}

export interface PlanDay {
  day: string;
  capacity: number;
  accepted: number;
  suggested: number;
}

export interface Shortfall {
  targetId: string;
  title: string;
  priority: Priority;
  due: string;
  missing: number;
}

export interface WeekPlan {
  days: PlanDay[];
  blocks: PlanBlock[];
  shortfalls: Shortfall[];
  /** Past their date: the planner does not schedule work after a due date. */
  overdue: PlanTarget[];
  /** Due beyond the horizon, so not planned this week. */
  later: PlanTarget[];
  /** Hours of work this week asks for, after what is already accepted. */
  needed: number;
  /** Free hours left after accepted blocks. */
  available: number;
  placed: number;
  overloaded: boolean;
  warnings: string[];
}

const roundUpHalf = (hours: number) => Math.ceil(hours * 2 - 1e-9) / 2;
const roundDownHalf = (hours: number) => Math.floor(hours * 2 + 1e-9) / 2;

export interface EffortContext {
  stepKinds: Map<string, StepKind>;
  /** Application parts done and total, by opportunity id. */
  progress: Map<string, { done: number; total: number }>;
}

/** Hours an item needs, or null when it is not work the student does at a desk (reminders, events). */
export function estimateEffort(item: CxItem, ctx: EffortContext): { hours: number; basis: string } | null {
  if (item.done) return null;
  if (item.kind === 'deadline') {
    const progress = item.opportunityId ? ctx.progress.get(item.opportunityId) : undefined;
    if (progress && progress.total > 0) {
      const left = progress.total - progress.done;
      if (left === 0) return { hours: 0.5, basis: 'Every part is ready, so this is a last check and submit.' };
      const hours = Math.max(1, roundUpHalf((APPLICATION_HOURS * left) / progress.total));
      return { hours, basis: `${left} of ${progress.total} application parts are still open (about ${APPLICATION_HOURS}h for a full one).` };
    }
    return { hours: APPLICATION_HOURS, basis: `A rough estimate for a full application.` };
  }
  if (item.kind === 'step' && item.stepId) {
    const kind = ctx.stepKinds.get(item.stepId);
    if (!kind) return null;
    return { hours: STEP_EFFORT[kind], basis: `About ${hoursLabel(STEP_EFFORT[kind])} for ${STEP_NOUN[kind]}.` };
  }
  return null;
}

const firstSentence = (text: string) => (text.match(/^.*?[.!?](\s|$)/)?.[0] ?? text).trim();

/**
 * Work targets from calendar items. A roadmap "apply" step for an application whose deadline is
 * already a target is the same work, so it is dropped rather than planned twice.
 */
export function targetsFrom(items: CxItem[], ctx: EffortContext): PlanTarget[] {
  const deadlineOpps = new Set(
    items.filter((item) => item.kind === 'deadline' && !item.done && item.opportunityId).map((item) => item.opportunityId),
  );
  const targets: PlanTarget[] = [];
  for (const item of items) {
    if (item.kind === 'step' && item.stepId && ctx.stepKinds.get(item.stepId) === 'apply' && deadlineOpps.has(item.opportunityId)) continue;
    const effort = estimateEffort(item, ctx);
    if (!effort) continue;
    targets.push({
      id: item.id,
      title: item.title,
      due: item.day,
      priority: item.priority,
      hours: effort.hours,
      basis: effort.basis,
      reason: firstSentence(item.why),
    });
  }
  return targets;
}

export function planWeek(input: PlanInput): WeekPlan {
  const { today, days } = input;
  const window = dayRange(today, days);
  const end = window[window.length - 1]!;
  const capacity = new Map(window.map((day) => [day, Math.max(0, input.hoursByWeekday[weekdayOf(day)] ?? 0)]));
  const used = new Map(window.map((day) => [day, 0]));
  const acceptedOn = new Map(window.map((day) => [day, 0]));
  const credited = new Map<string, number>();
  for (const block of input.accepted) {
    // An accepted block on a past day that was never ticked off probably did not happen, so its
    // hours are not counted as done and the work is planned again.
    if (block.day < today && !block.done) continue;
    credited.set(block.targetId, (credited.get(block.targetId) ?? 0) + block.hours);
    if (acceptedOn.has(block.day)) {
      acceptedOn.set(block.day, acceptedOn.get(block.day)! + block.hours);
      used.set(block.day, used.get(block.day)! + block.hours);
    }
  }
  const free = (day: string) => Math.max(0, capacity.get(day)! - used.get(day)!);

  const overdue: PlanTarget[] = [];
  const later: PlanTarget[] = [];
  const plannable: { target: PlanTarget; need: number; share: boolean }[] = [];
  for (const target of input.targets) {
    if (target.due < today) {
      overdue.push(target);
      continue;
    }
    if (daysBetween(today, target.due) >= HORIZON_DAYS) {
      later.push(target);
      continue;
    }
    const remaining = Math.max(0, target.hours - (credited.get(target.id) ?? 0));
    if (remaining === 0) continue;
    // A should item due after this week gets its fair share of this week, not all of it, so it
    // does not crowd out work due sooner. Must items are planned in full: finishing early is safe.
    const daysLeft = daysBetween(today, target.due) + 1;
    const share = target.priority === 'should' && target.due > end;
    const need = share ? Math.min(remaining, roundUpHalf((remaining * days) / daysLeft)) : remaining;
    plannable.push({ target, need, share: share && need < remaining });
  }
  // Must items first, then should; inside each, the earliest due date first.
  const rank = (p: Priority) => (p === 'must' ? 0 : 1);
  plannable.sort(
    (a, b) => rank(a.target.priority) - rank(b.target.priority) || a.target.due.localeCompare(b.target.due) || b.need - a.need,
  );

  const blocks: PlanBlock[] = [];
  const shortfalls: Shortfall[] = [];
  for (const { target, need, share } of plannable) {
    const hoursOn = new Map<string, number>();
    let remaining = need;
    // `whole`: only use a day that has room for a full sitting, so a one-hour task is not cut into
    // two half hours while a later day has the full hour free.
    const fill = (allowed: string[], cap: number, whole = false) => {
      for (const day of allowed) {
        if (remaining <= 0) return;
        const room = cap - (hoursOn.get(day) ?? 0);
        if (whole && free(day) < Math.min(remaining, room)) continue;
        const take = roundDownHalf(Math.min(remaining, free(day), room));
        if (take < 0.5) continue;
        hoursOn.set(day, (hoursOn.get(day) ?? 0) + take);
        used.set(day, used.get(day)! + take);
        remaining -= take;
      }
    };
    // Never after the due date. Keep the due day itself for submitting when the days before have room.
    const before = window.filter((day) => day < target.due);
    const onDue = window.filter((day) => day === target.due);
    fill(before, MAX_BLOCK, true);
    fill(before, MAX_BLOCK);
    fill(before, Infinity);
    fill(onDue, Infinity);
    if (remaining > 0) shortfalls.push({ targetId: target.id, title: target.title, priority: target.priority, due: target.due, missing: remaining });

    const parts = [...hoursOn.entries()].sort(([a], [b]) => a.localeCompare(b));
    parts.forEach(([day, hours], index) => {
      blocks.push({
        id: `block-${target.id}-${day}`,
        targetId: target.id,
        day,
        hours,
        title: target.title,
        priority: target.priority,
        due: target.due,
        why: explain(target, day, today, { index, count: parts.length, share, need }),
      });
    });
  }
  blocks.sort((a, b) => a.day.localeCompare(b.day) || rank(a.priority) - rank(b.priority));

  const needed = plannable.reduce((sum, p) => sum + p.need, 0);
  const available = window.reduce((sum, day) => sum + Math.max(0, capacity.get(day)! - acceptedOn.get(day)!), 0);
  const placed = blocks.reduce((sum, block) => sum + block.hours, 0);
  const overloaded = needed > available || shortfalls.some((s) => s.priority === 'must');

  const warnings: string[] = [];
  if (needed > available) {
    warnings.push(`This week asks for ${hoursLabel(needed)} of work and you have ${hoursLabel(available)} open.`);
  }
  for (const s of shortfalls) {
    const beforeDue = window.filter((day) => day < s.due);
    const where = beforeDue.length > 0 ? `Add hours ${beforeDue.slice(0, 2).map((d) => dayPhrase(d, today)).join(' or ')}` : 'There is no open day before it';
    warnings.push(
      `${s.priority === 'must' ? 'Have to do' : 'Should do'}: "${s.title}" needs ${hoursLabel(s.missing)} more than fits before it is due ${dayPhrase(s.due, today)}. ${where}.`,
    );
  }
  for (const target of overdue) {
    warnings.push(`"${target.title}" was due ${dayPhrase(target.due, today)}. It is not planned, because work after a due date does not count. Decide whether to drop it.`);
  }

  return {
    days: window.map((day) => ({ day, capacity: capacity.get(day)!, accepted: acceptedOn.get(day)!, suggested: used.get(day)! - acceptedOn.get(day)! })),
    blocks,
    shortfalls,
    overdue,
    later,
    needed,
    available,
    placed,
    overloaded,
    warnings,
  };
}

function explain(target: PlanTarget, day: string, today: string, part: { index: number; count: number; share: boolean; need: number }): string {
  const daysLeft = daysBetween(day, target.due);
  const order =
    target.priority === 'must'
      ? 'You committed to this, so it gets the earliest open time, before anything you only should do.'
      : 'It moves you toward your goal, so it gets the time left after your have-to items.';
  const timing =
    daysLeft === 0
      ? `Due ${dayPhrase(target.due, today, false)}; only the due day itself had room.`
      : `Due ${dayPhrase(target.due, today, false)}, ${daysLeft === 1 ? 'the day after' : `${daysLeft} days after`} this block.`;
  const split = part.count > 1 ? ` Split into ${part.count} sittings of at most ${MAX_BLOCK}h; this is ${part.index + 1} of ${part.count}.` : '';
  const share = part.share ? ` It is due after this week, so only ${hoursLabel(part.need)} of the ${hoursLabel(target.hours)} is planned now.` : '';
  return `${timing} ${order}${split}${share} ${target.basis} ${target.reason}`.trim();
}

/** The block a suggestion becomes once accepted, as plain fields for a personal item. */
export function acceptedTitle(block: PlanBlock): string {
  return `Work on: ${block.title}`;
}
