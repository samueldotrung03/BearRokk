// The Today page's rules: what matters most today, gathered from the calendar, the roadmap and the
// application manager, and the one sentence that sums it up. Plain functions over the student's own
// data, so a model (Grok, once the agents are connected) can take their place without touching the page.
// Nothing here makes up a date: an item with no stated deadline says so.
import { applicationInfo, opportunities as sampleOpportunities } from '../../data/sample.ts';
import { rankFeedDetailed, signalLabel } from '../../state/ranking.ts';
import type { AppState } from '../../state/store.ts';
import type { ApplicationStatus, Opportunity } from '../../types.ts';
import { STATUSES, statusLabel } from '../applications.ts';
import { readinessOf } from '../apps/readiness.ts';
import { calendarItems, type Priority } from '../calendar.ts';
import { planFor } from '../roadmap.ts';

const DAY = 86_400_000;
/** How far ahead dated items count as something to act on today. */
const ACTION_WINDOW_DAYS = 14;
/** "This week" for the closing list and the brief. */
const WEEK_DAYS = 7;

/** What the action's button does: tick a step, open a card, move an application, or go to a page. */
export type TodayCta =
  | { kind: 'tick'; stepId: string; label: string }
  | { kind: 'open'; opportunityId: string; label: string }
  | { kind: 'move'; opportunityId: string; status: ApplicationStatus; label: string }
  | { kind: 'go'; to: string; label: string };

export type ActionSource = 'application' | 'deadline' | 'starts' | 'step';

export interface TodayAction {
  id: string;
  /** What to do, as a short instruction. */
  title: string;
  /** The opportunity it is about, when the title does not already name it. */
  subject: string | null;
  /** Why it is on the list, in one line. */
  reason: string;
  source: ActionSource;
  priority: Priority;
  /** ISO time from the posting or the plan. Null when none is stated. */
  due: string | null;
  /** Whole calendar days until `due`: 0 is today, negative is overdue. Null when there is no date. */
  daysLeft: number | null;
  opportunityId: string | null;
  cta: TodayCta;
}

export interface ClosingItem {
  opportunity: Opportunity;
  daysLeft: number;
  /** The student is tracking, saved or liked it, as opposed to it only being in the feed. */
  mine: boolean;
  /** Where it comes from: the application status, "Saved", "Liked" or "In your feed". */
  label: string;
}

export interface NewItem {
  opportunity: Opportunity;
  /** The first reason the ranking gives, in plain words. */
  signal: string;
}

export interface ProgressSummary {
  percent: number;
  doneSteps: number;
  totalSteps: number;
  goal: string;
  applications: { status: ApplicationStatus; label: string; count: number }[];
  tracked: number;
  saved: number;
}

export interface TodayView {
  brief: string;
  actions: TodayAction[];
  closing: ClosingItem[];
  /** True for a student who has not tracked, saved or liked anything yet. */
  fresh: boolean;
  newForYou: NewItem[];
  progress: ProgressSummary;
  questions: string[];
}

/** Whole calendar days from today to the day of `iso`, in local time. 0 is today. */
export function calendarDaysUntil(iso: string, now = Date.now()): number {
  const start = (time: number) => {
    const d = new Date(time);
    return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  };
  // Rounded, so a daylight-saving change in between does not shift the count.
  return Math.round((start(new Date(iso).getTime()) - start(now)) / DAY);
}

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;

/** The chip beside an action. A missing date is shown as missing, never guessed. */
export function dueText(action: Pick<TodayAction, 'daysLeft' | 'source'>): string {
  const { daysLeft } = action;
  if (daysLeft === null) return action.source === 'step' ? 'No date set' : 'No deadline listed';
  if (daysLeft < 0) return `${plural(-daysLeft, 'day')} overdue`;
  if (daysLeft === 0) return action.source === 'starts' ? 'Today' : 'Due today';
  if (daysLeft === 1) return action.source === 'starts' ? 'Tomorrow' : 'Due tomorrow';
  return `${daysLeft} days left`;
}

/** The first sentence of a longer explanation, so each reason fits on one line. */
export function firstSentence(text: string): string {
  const match = /^(.+?[.!?])(\s|$)/.exec(text.trim());
  return match ? match[1]! : text.trim();
}

const SOURCE_ORDER: Record<ActionSource, number> = { application: 0, deadline: 1, starts: 2, step: 3 };

/**
 * Order of the day's actions: what the student committed to before what would help, then
 * anything overdue, then the soonest date, with undated items last.
 */
export function compareActions(a: TodayAction, b: TodayAction): number {
  const priority = (x: TodayAction) => (x.priority === 'must' ? 0 : 1);
  const overdue = (x: TodayAction) => (x.daysLeft !== null && x.daysLeft < 0 ? 0 : 1);
  const days = (x: TodayAction) => x.daysLeft ?? Number.POSITIVE_INFINITY;
  return (
    priority(a) - priority(b) ||
    overdue(a) - overdue(b) ||
    days(a) - days(b) ||
    SOURCE_ORDER[a.source] - SOURCE_ORDER[b.source] ||
    a.title.localeCompare(b.title)
  );
}

/** Ranks the candidates, keeps one action per opportunity (the most urgent), and returns the top few. */
export function rankTodayActions(candidates: TodayAction[], limit = 3): TodayAction[] {
  const seen = new Set<string>();
  const ids = new Set<string>();
  const result: TodayAction[] = [];
  for (const action of [...candidates].sort(compareActions)) {
    if (ids.has(action.id)) continue;
    if (action.opportunityId !== null && seen.has(action.opportunityId)) continue;
    ids.add(action.id);
    if (action.opportunityId !== null) seen.add(action.opportunityId);
    result.push(action);
    if (result.length === limit) break;
  }
  return result;
}

/** Live cards override the sample ones with the same id; tracked sample items stay findable. */
function lookup(list: Opportunity[]): Map<string, Opportunity> {
  return new Map([...sampleOpportunities, ...list].map((o) => [o.id, o]));
}

/** Every action that could be today's: application next steps, dated calendar items and the next roadmap step. */
export function candidateActions(state: AppState, list: Opportunity[], now = Date.now()): TodayAction[] {
  const byId = lookup(list);
  const actions: TodayAction[] = [];

  for (const [id, application] of Object.entries(state.applications)) {
    const o = byId.get(id);
    if (!o || application.status === 'applied' || state.dismissed.includes(id)) continue;
    const { next } = readinessOf(o, application, applicationInfo[id], now);
    if (next.kind === 'closed' || next.kind === 'follow_up') continue;
    actions.push({
      id: `app-${id}`,
      title: next.label,
      subject: o.title,
      reason: next.detail,
      source: 'application',
      priority: application.status === 'interested' ? 'should' : 'must',
      due: o.deadline,
      daysLeft: o.deadline ? calendarDaysUntil(o.deadline, now) : null,
      opportunityId: id,
      cta: next.moveTo
        ? { kind: 'move', opportunityId: id, status: next.moveTo, label: `Move to ${statusLabel[next.moveTo]}` }
        : { kind: 'go', to: '/applications', label: 'Open application' },
    });
  }

  for (const item of calendarItems(state, now)) {
    if (item.done || item.kind === 'reminder') continue;
    // Tracked applications already have their own, more specific next step above.
    if (item.opportunityId && item.kind !== 'step' && state.applications[item.opportunityId]) continue;
    const daysLeft = calendarDaysUntil(item.date, now);
    if (daysLeft > ACTION_WINDOW_DAYS) continue;
    // A passed deadline or start cannot be acted on; an unticked step can still be done late.
    if (daysLeft < 0 && item.kind !== 'step') continue;
    const o = item.opportunityId ? byId.get(item.opportunityId) : undefined;
    if (item.kind === 'step' && item.stepId) {
      actions.push({
        id: `step-${item.stepId}`,
        title: item.title,
        subject: o && !item.title.includes(o.title) ? o.title : null,
        reason: firstSentence(item.why),
        source: 'step',
        priority: item.priority,
        due: item.date,
        daysLeft,
        opportunityId: item.opportunityId,
        cta: { kind: 'tick', stepId: item.stepId, label: 'Mark done' },
      });
    } else if (o && (item.kind === 'deadline' || item.kind === 'starts')) {
      actions.push({
        id: item.id,
        title: item.kind === 'deadline' ? `Decide on ${o.title}` : `${o.title} starts`,
        subject: null,
        reason: item.kind === 'deadline' ? `${firstSentence(item.why)} Its deadline is close.` : firstSentence(item.why),
        source: item.kind,
        priority: item.priority,
        due: item.date,
        daysLeft,
        opportunityId: o.id,
        cta: { kind: 'open', opportunityId: o.id, label: 'Open' },
      });
    }
  }

  // The roadmap's next step is always a candidate, dated or not, so the list is never empty
  // while there is still a plan to work on.
  const plan = planFor(state);
  const next = plan.next;
  if (next && !actions.some((a) => a.id === `step-${next.id}`)) {
    const own = next.opportunityId ? byId.get(next.opportunityId) : undefined;
    const committed = next.opportunityId ? ['to_apply', 'applying'].includes(state.applications[next.opportunityId]?.status ?? '') : false;
    actions.push({
      id: `step-${next.id}`,
      title: next.title,
      subject: own && !next.title.includes(own.title) ? own.title : null,
      reason: `Next step toward your goal: ${plan.roadmap.goal}.`,
      source: 'step',
      priority: committed ? 'must' : 'should',
      due: next.due,
      daysLeft: next.due ? calendarDaysUntil(next.due, now) : null,
      opportunityId: next.opportunityId,
      cta: { kind: 'tick', stepId: next.id, label: 'Mark done' },
    });
  }
  return actions;
}

/** Deadlines in the next seven days: the student's own first, then the feed's, soonest first. */
export function closingThisWeek(state: AppState, list: Opportunity[], now = Date.now(), limit = 5): ClosingItem[] {
  const items: ClosingItem[] = [];
  for (const o of lookup(list).values()) {
    if (!o.deadline || state.dismissed.includes(o.id)) continue;
    const status = state.applications[o.id]?.status;
    if (status === 'applied') continue;
    const daysLeft = calendarDaysUntil(o.deadline, now);
    if (daysLeft < 0 || daysLeft > WEEK_DAYS) continue;
    const saved = state.saved.includes(o.id);
    const liked = state.liked.includes(o.id);
    const mine = Boolean(status) || saved || liked;
    // A sample card only counts when the student acted on it or it is in the list shown to them.
    if (!mine && !list.some((x) => x.id === o.id)) continue;
    items.push({ opportunity: o, daysLeft, mine, label: status ? statusLabel[status] : saved ? 'Saved' : liked ? 'Liked' : 'In your feed' });
  }
  return items
    .sort((a, b) => Number(b.mine) - Number(a.mine) || a.daysLeft - b.daysLeft || a.opportunity.title.localeCompare(b.opportunity.title))
    .slice(0, limit);
}

/** The top-ranked cards the student has not opened, saved, dismissed or started tracking. */
export function newForYou(state: AppState, list: Opportunity[], now = Date.now(), limit = 3): NewItem[] {
  const seen = new Set([...state.opened, ...state.saved, ...state.dismissed, ...Object.keys(state.applications)]);
  return rankFeedDetailed(list, state, now)
    .filter((ranked) => !seen.has(ranked.opportunity.id))
    .slice(0, limit)
    .map((ranked) => ({ opportunity: ranked.opportunity, signal: signalLabel[ranked.signals[0] ?? 'explore'] }));
}

export function progressSummary(state: AppState): ProgressSummary {
  const plan = planFor(state);
  const counts = new Map<ApplicationStatus, number>();
  for (const application of Object.values(state.applications)) counts.set(application.status, (counts.get(application.status) ?? 0) + 1);
  return {
    percent: plan.percent,
    doneSteps: plan.doneCount,
    totalSteps: plan.steps.length,
    goal: plan.roadmap.goal,
    applications: STATUSES.filter((status) => counts.has(status)).map((status) => ({ status, label: statusLabel[status], count: counts.get(status)! })),
    tracked: Object.keys(state.applications).length,
    saved: state.saved.length,
  };
}

export function isFresh(state: AppState): boolean {
  return Object.keys(state.applications).length === 0 && state.saved.length === 0 && state.liked.length === 0 && state.extraSteps.length === 0;
}

const WORDS = ['No', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten'];
const countWord = (n: number) => WORDS[n] ?? String(n);
/** Drops a closing full stop so the text can sit inside a sentence. */
const inline = (text: string) => text.replace(/[.]+$/, '');
const closesWhen = (days: number) => (days === 0 ? 'closing today' : days === 1 ? 'closing tomorrow' : `in ${days} days`);
const named = (action: TodayAction) => (action.subject ? `${inline(action.title)} for ${inline(action.subject)}` : inline(action.title));

/** The one sentence at the top of the page: the single most important thing today. */
export function briefSentence({ actions, closing, fresh }: { actions: TodayAction[]; closing: ClosingItem[]; fresh: boolean }): string {
  const overdue = actions.filter((a) => a.daysLeft !== null && a.daysLeft < 0);
  if (overdue.length > 0) {
    const first = overdue[0]!;
    return overdue.length === 1
      ? `One thing is overdue: ${named(first)}. Start there.`
      : `${countWord(overdue.length)} things are overdue. Start with ${named(first)}.`;
  }
  const mine = closing.filter((c) => c.mine);
  if (mine.length > 0) {
    const first = mine[0]!;
    return mine.length === 1
      ? `One thing closes this week: ${inline(first.opportunity.title)}, ${closesWhen(first.daysLeft)}.`
      : `${countWord(mine.length)} things close this week. The first is ${inline(first.opportunity.title)}, ${closesWhen(first.daysLeft)}.`;
  }
  const top = actions[0];
  if (top) {
    if (top.daysLeft === null) return `The most useful thing today: ${named(top)}.`;
    const when = top.daysLeft === 0 ? 'due today' : top.daysLeft === 1 ? 'due tomorrow' : `due in ${top.daysLeft} days`;
    return `The most useful thing today: ${named(top)}, ${when}.`;
  }
  if (closing.length > 0) {
    const first = closing[0]!;
    const closes = first.daysLeft === 0 ? 'closes today' : first.daysLeft === 1 ? 'closes tomorrow' : `closes in ${first.daysLeft} days`;
    return `Nothing of yours is due. In your feed, ${inline(first.opportunity.title)} ${closes}.`;
  }
  return fresh
    ? 'Nothing is due yet. Save a few things from your feed and they will show up here.'
    : 'Nothing is due this week. A good day to look through your feed.';
}

/** Questions for the assistant that fit what the page is showing. */
export function askQuestions({ closing, fresh }: { closing: ClosingItem[]; fresh: boolean }): string[] {
  if (fresh) return ['Find the best matches', 'Which career path fits me?', 'What should I do this week?'];
  if (closing.some((c) => c.mine)) return ['What are my deadlines?', 'What should I do today?', 'Am I on track?'];
  return ['What should I do today?', 'Am I on track?', 'Find the best matches'];
}

/** Everything the Today page shows, from the store, the cards on screen and the current time. */
export function buildToday(state: AppState, list: Opportunity[], now = Date.now()): TodayView {
  const actions = rankTodayActions(candidateActions(state, list, now));
  const closing = closingThisWeek(state, list, now);
  const fresh = isFresh(state);
  return {
    brief: briefSentence({ actions, closing, fresh }),
    actions,
    closing,
    fresh,
    newForYou: newForYou(state, list, now),
    progress: progressSummary(state),
    questions: askQuestions({ closing, fresh }),
  };
}
