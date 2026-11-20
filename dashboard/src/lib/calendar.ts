// Everything with a date, gathered into one list for the calendar: deadlines, reminders, start
// times and roadmap steps. Each item says whether the student has to do it (they committed to
// it) or should do it (it moves them toward the goal), and why it is there.
import { opportunities, pathProfiles } from '../data/sample.ts';
import type { AppState } from '../state/store.ts';
import type { Opportunity } from '../types.ts';
import { extraStepId } from '../state/store.ts';
import { remindersFor, statusLabel } from './applications.ts';
import { evidenceFor } from './pathways.ts';
import { planFor } from './roadmap.ts';
import { shortDate } from './time.ts';

export type CalendarKind = 'deadline' | 'reminder' | 'starts' | 'step';
/** "must": the student committed to it. "should": it helps, and nothing breaks if it slips. */
export type Priority = 'must' | 'should';

export interface CalendarItem {
  id: string;
  /** ISO time. */
  date: string;
  /** Local calendar day, YYYY-MM-DD. */
  day: string;
  title: string;
  kind: CalendarKind;
  priority: Priority;
  /** One or two sentences on why this is on the calendar. */
  why: string;
  opportunityId: string | null;
  /** Set for roadmap steps, which can be ticked off from the calendar. */
  stepId: string | null;
  done: boolean;
}

export const kindLabel: Record<CalendarKind, string> = {
  deadline: 'Deadline',
  reminder: 'Reminder',
  starts: 'Starts',
  step: 'Roadmap step',
};

export function dayKey(date: Date | string | number): string {
  const d = new Date(date);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/**
 * `found` is what the agents found (the feed and the saved list). Without it the sample set is
 * used, as the pages built on sample data still do.
 */
export function calendarItems(state: AppState, now = Date.now(), found: Opportunity[] = opportunities): CalendarItem[] {
  const items: CalendarItem[] = [];
  const add = (item: Omit<CalendarItem, 'day'>) => items.push({ ...item, day: dayKey(item.date) });
  const statusOf = (id: string | null) => (id ? state.applications[id]?.status : undefined);
  const committed = (id: string | null) => statusOf(id) === 'to_apply' || statusOf(id) === 'applying';

  for (const o of found) {
    if (state.dismissed.includes(o.id)) continue;
    const status = statusOf(o.id);
    const saved = state.saved.includes(o.id);
    const liked = state.liked.includes(o.id);
    if (!status && !saved && !liked && !state.extraSteps.includes(o.id)) continue;
    const reason = status
      ? `You marked this "${statusLabel[status]}".`
      : saved
        ? 'You saved this.'
        : liked
          ? 'You liked this.'
          : 'You started a roadmap for this.';

    if (o.deadline) {
      add({
        id: `deadline-${o.id}`,
        date: o.deadline,
        title: o.title,
        kind: 'deadline',
        priority: committed(o.id) || status === 'applied' ? 'must' : 'should',
        why:
          status === 'applied'
            ? 'You already applied. The deadline stays here for your records.'
            : committed(o.id)
              ? `${reason} The application closes on this day, so it has to be in before then.`
              : `${reason} Its deadline is here in case you decide to go for it. ${o.fitExplanation}`,
        opportunityId: o.id,
        stepId: null,
        done: status === 'applied',
      });
      if (status) {
        for (const reminder of remindersFor(status, o.deadline, now)) {
          if (dayKey(reminder.at) === dayKey(o.deadline)) continue; // the deadline itself is already shown
          add({
            id: `reminder-${o.id}-${reminder.label}`,
            date: reminder.at,
            title: o.title,
            kind: 'reminder',
            priority: 'must',
            why: `${reminder.label}: the deadline is ${shortDate(o.deadline)}. Reminders are set because you marked this "${statusLabel[status]}".`,
            opportunityId: o.id,
            stepId: null,
            done: false,
          });
        }
      }
    }

    if (o.startTime) {
      const going = committed(o.id) || status === 'applied';
      add({
        id: `starts-${o.id}`,
        date: o.startTime,
        title: o.title,
        kind: 'starts',
        priority: going ? 'must' : 'should',
        why: going ? `${reason} It starts on this day.` : `${reason} It starts on this day if you want to go.`,
        opportunityId: o.id,
        stepId: null,
        done: false,
      });
    }
  }

  const plan = planFor(state, found);
  const evidence = evidenceFor(plan.roadmap, pathProfiles);
  for (const step of plan.steps) {
    if (!step.due) continue;
    const own = step.opportunityId ? found.find((o) => o.id === step.opportunityId) : undefined;
    const fromStarted = step.opportunityId !== null && step.id.startsWith(extraStepId(step.opportunityId));
    const seen = evidence.byStep.get(step.id);
    const source = fromStarted
      ? `Part of the roadmap you started for ${own?.title ?? 'this opportunity'}.`
      : seen && seen.count > 0
        ? `${seen.count} of ${evidence.total} people who got this role did this.`
        : `A step toward your goal: ${plan.roadmap.goal}.`;
    add({
      id: `step-${step.id}`,
      date: step.due,
      title: step.title,
      kind: 'step',
      priority: committed(step.opportunityId) ? 'must' : 'should',
      why: `${source} ${step.detail}`,
      opportunityId: step.opportunityId,
      stepId: step.id,
      done: state.doneSteps.includes(step.id),
    });
  }

  const rank = (item: CalendarItem) => (item.priority === 'must' ? 0 : 1);
  return items.sort((a, b) => a.day.localeCompare(b.day) || rank(a) - rank(b) || a.date.localeCompare(b.date));
}
