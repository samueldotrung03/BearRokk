// Milestones and a week streak, to make steady progress visible. The store keeps which steps
// are done but not when, so this page keeps its own log of when it saw each step get done.
import { DAY, type CoachContext } from './context.ts';

/** Step id to the time it was seen done. Null means it was already done before the log began. */
export type DoneLog = Record<string, string | null>;

/**
 * Brings the log in line with the done steps: new ones get `nowIso`, unticked ones are dropped.
 * On the first run every step already done is recorded without a date, so the streak never
 * claims the student did old work today.
 */
export function syncDoneLog(log: DoneLog | null, doneSteps: string[], nowIso: string): DoneLog {
  const next: DoneLog = {};
  for (const id of doneSteps) {
    if (log === null) next[id] = null;
    else next[id] = id in log ? log[id]! : nowIso;
  }
  return next;
}

export interface Streak {
  /** Weeks in a row, counted back from now, with at least one step done. */
  weeks: number;
  /** Steps finished in the last seven days. */
  thisWeek: number;
}

export function streak(log: DoneLog, now: number): Streak {
  const weekOf = (iso: string) => Math.floor((now - new Date(iso).getTime()) / (7 * DAY));
  const weeks = new Set<number>();
  let thisWeek = 0;
  for (const iso of Object.values(log)) {
    if (!iso) continue;
    const w = weekOf(iso);
    weeks.add(w);
    if (w === 0) thisWeek += 1;
  }
  // A streak still counts when this week has nothing yet: the week is not over.
  let start = weeks.has(0) ? 0 : 1;
  let count = 0;
  while (weeks.has(start)) {
    count += 1;
    start += 1;
  }
  return { weeks: count, thisWeek };
}

export interface Milestone {
  id: string;
  label: string;
  reached: boolean;
  /** What is left, for the next one not reached. */
  toGo: string;
}

export function milestones(ctx: CoachContext): Milestone[] {
  const total = ctx.steps.length;
  const done = ctx.steps.filter((s) => s.done).length;
  const at = (share: number) => Math.ceil(total * share);
  const stepsToGo = (target: number) => {
    const left = Math.max(0, target - done);
    return `${left} ${left === 1 ? 'step' : 'steps'} to go`;
  };
  const metCount = ctx.requirements.filter((r) => r.met).length;
  const reqLeft = ctx.requirements.length - metCount;

  const phases = [...new Map(ctx.steps.filter((s) => !s.extra).map((s) => [s.phaseId, s.phase])).entries()];
  const firstPhase = phases[0];
  const firstPhaseSteps = firstPhase ? ctx.steps.filter((s) => s.phaseId === firstPhase[0]) : [];
  const firstPhaseLeft = firstPhaseSteps.filter((s) => !s.done).length;

  const list: Milestone[] = [
    { id: 'first', label: 'First step done', reached: done >= 1, toGo: stepsToGo(1) },
    ...(firstPhase
      ? [
          {
            id: 'phase-1',
            label: `"${firstPhase[1]}" finished`,
            reached: firstPhaseSteps.length > 0 && firstPhaseLeft === 0,
            toGo: `${firstPhaseLeft} ${firstPhaseLeft === 1 ? 'step' : 'steps'} left in it`,
          },
        ]
      : []),
    { id: 'half', label: 'Halfway there', reached: total > 0 && done >= at(0.5), toGo: stepsToGo(at(0.5)) },
    {
      id: 'requirements',
      label: 'Every requirement met',
      reached: ctx.requirements.length > 0 && reqLeft === 0,
      toGo: `${reqLeft} ${reqLeft === 1 ? 'requirement' : 'requirements'} to go`,
    },
    { id: 'all', label: 'Roadmap complete', reached: total > 0 && done === total, toGo: stepsToGo(total) },
  ];
  return list;
}
