// What the dashboard shows beyond the "do today" list: the week at a glance, what is coming up,
// the application pipeline and the roadmap's next steps. Pure functions over the student's own
// state, so the page only lays them out.
import { applicationInfo } from '../../data/sample.ts';
import type { AppState } from '../../state/store.ts';
import type { ApplicationStatus, Opportunity, RoadmapStep } from '../../types.ts';
import { STATUSES, statusLabel } from '../applications.ts';
import { readinessOf } from '../apps/readiness.ts';
import { addDays, daysBetween, dayRange } from '../cal/days.ts';
import type { CxItem } from '../cal/items.ts';
import { currentRoadmap, planFor } from '../roadmap.ts';

export interface WeekDay {
  day: string;
  /** "Mon", "Tue"… */
  weekday: string;
  /** Day of the month. */
  date: number;
  isToday: boolean;
  /** Open items the student committed to, and open items that only help. */
  must: number;
  should: number;
  done: number;
  items: CxItem[];
}

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

/** The next seven days starting today, each with what falls on it. */
export function weekStrip(items: CxItem[], today: string, days = 7): WeekDay[] {
  return dayRange(today, days).map((day) => {
    const onDay = items.filter((item) => item.day === day);
    const date = new Date(`${day}T12:00:00`);
    return {
      day,
      weekday: WEEKDAYS[date.getDay()]!,
      date: date.getDate(),
      isToday: day === today,
      must: onDay.filter((item) => !item.done && item.priority === 'must').length,
      should: onDay.filter((item) => !item.done && item.priority === 'should').length,
      done: onDay.filter((item) => item.done).length,
      items: onDay,
    };
  });
}

export interface UpcomingItem {
  item: CxItem;
  /** Whole days from today: 0 is today, negative is overdue. */
  daysAway: number;
}

/** Open items from the calendar, overdue first, then soonest, committed before optional. */
export function upcoming(items: CxItem[], today: string, limit = 6, horizon = 21): UpcomingItem[] {
  const last = addDays(today, horizon);
  return items
    .filter((item) => !item.done && item.day <= last)
    .map((item) => ({ item, daysAway: daysBetween(today, item.day) }))
    .sort((a, b) => a.daysAway - b.daysAway || Number(b.item.priority === 'must') - Number(a.item.priority === 'must') || a.item.title.localeCompare(b.item.title))
    .slice(0, limit);
}

/** "Today", "Tomorrow", "In 4 days", "2 days late". */
export function whenText(daysAway: number): string {
  if (daysAway === 0) return 'Today';
  if (daysAway === 1) return 'Tomorrow';
  if (daysAway === -1) return '1 day late';
  return daysAway < 0 ? `${-daysAway} days late` : `In ${daysAway} days`;
}

export interface PipelineItem {
  opportunity: Opportunity;
  /** 0 to 100: how much of the application is ready. */
  readiness: number;
  daysLeft: number | null;
  next: string;
}

export interface PipelineStage {
  status: ApplicationStatus;
  label: string;
  count: number;
  /** The most pressing ones first. */
  items: PipelineItem[];
}

/** Every tracked application, grouped by stage, most urgent first inside each stage. */
export function pipeline(state: AppState, byId: Map<string, Opportunity>, now = Date.now(), perStage = 2): PipelineStage[] {
  const stages = new Map<ApplicationStatus, (PipelineItem & { urgency: number })[]>(STATUSES.map((status) => [status, []]));
  for (const [id, application] of Object.entries(state.applications)) {
    const opportunity = byId.get(id);
    if (!opportunity) continue;
    const readiness = readinessOf(opportunity, application, applicationInfo[id], now);
    stages.get(application.status)?.push({ opportunity, readiness: readiness.score, daysLeft: readiness.daysLeft, next: readiness.next.label, urgency: readiness.urgency });
  }
  return STATUSES.map((status) => {
    const all = stages.get(status)!.sort((a, b) => b.urgency - a.urgency || a.opportunity.title.localeCompare(b.opportunity.title));
    return { status, label: statusLabel[status], count: all.length, items: all.slice(0, perStage).map(({ urgency: _urgency, ...item }) => item) };
  });
}

export interface RoadmapGlance {
  goal: string;
  percent: number;
  done: number;
  total: number;
  /** The next steps not finished yet, in plan order. */
  next: RoadmapStep[];
}

export function roadmapGlance(state: AppState, limit = 3): RoadmapGlance {
  const plan = planFor(state);
  return {
    goal: plan.roadmap.goal,
    percent: plan.percent,
    done: plan.doneCount,
    total: plan.steps.length,
    next: plan.steps.filter((step) => !state.doneSteps.includes(step.id)).slice(0, limit),
  };
}

export interface Headline {
  /** Open calendar items in the next seven days, and how many of them are overdue or due today. */
  dueThisWeek: number;
  dueToday: number;
  overdue: number;
  /** Applications not sent yet, and all tracked. */
  inProgress: number;
  tracked: number;
  applied: number;
}

export function headline(state: AppState, items: CxItem[], today: string): Headline {
  const open = items.filter((item) => !item.done);
  const end = addDays(today, 6);
  const statuses = Object.values(state.applications).map((a) => a.status);
  return {
    dueThisWeek: open.filter((item) => item.day >= today && item.day <= end).length,
    dueToday: open.filter((item) => item.day === today).length,
    overdue: open.filter((item) => item.day < today).length,
    inProgress: statuses.filter((status) => status !== 'applied').length,
    tracked: statuses.length,
    applied: statuses.filter((status) => status === 'applied').length,
  };
}

export interface GoalNeed {
  id: string;
  label: string;
  met: boolean;
  /** How it was met, or the roadmap step that would meet it. */
  how: string;
}

/** What the goal asks for, and which of it the student already has: by a skill, or a finished step. */
export function goalNeeds(state: AppState): { met: number; total: number; needs: GoalNeed[] } {
  const roadmap = currentRoadmap(state.goalId);
  const steps = new Map(roadmap.phases.flatMap((phase) => phase.steps).map((step) => [step.id, step.title]));
  const skills = new Set(state.profile.skills.map((skill) => skill.toLowerCase()));
  const needs = roadmap.requirements.map((need) => {
    const bySkill = need.skill !== null && skills.has(need.skill.toLowerCase());
    const byStep = need.stepId !== null && state.doneSteps.includes(need.stepId);
    const step = need.stepId ? steps.get(need.stepId) : undefined;
    const how = bySkill ? `On your profile: ${need.skill}` : byStep ? 'You finished the step for it' : step ? `Step: ${step}` : need.skill ? `Add ${need.skill} to your profile once you have it` : 'Not covered by a step yet';
    return { id: need.id, label: need.label, met: bySkill || byStep, how };
  });
  // What is still missing comes first: that is the part to act on.
  return { met: needs.filter((n) => n.met).length, total: needs.length, needs: [...needs].sort((a, b) => Number(a.met) - Number(b.met)) };
}

export interface ProfileCheck {
  id: string;
  label: string;
  done: boolean;
}

/** How much the agents have to go on. Each item is something the profile page asks for. */
export function profileStrength(state: AppState): { percent: number; checks: ProfileCheck[] } {
  const { profile, preferences } = state;
  const experience = preferences?.experience;
  const checks: ProfileCheck[] = [
    { id: 'major', label: 'Your major', done: profile.major.trim().length > 0 },
    { id: 'about', label: 'A line about you', done: profile.about.trim().length > 0 },
    { id: 'skills', label: 'At least three skills', done: profile.skills.length >= 3 },
    { id: 'fields', label: 'Career interests', done: (preferences?.fields.length ?? 0) > 0 || (profile.careerInterests?.length ?? 0) > 0 || profile.interests.length > 0 },
    { id: 'experience', label: 'One experience', done: (experience?.entries.length ?? 0) > 0 },
    { id: 'links', label: 'LinkedIn or another link', done: Boolean(experience?.linkedin.trim()) || (experience?.links.length ?? 0) > 0 },
    { id: 'notes', label: 'A note for your agents', done: (preferences?.notes.length ?? 0) > 0 },
  ];
  return { percent: Math.round((checks.filter((c) => c.done).length / checks.length) * 100), checks: [...checks].sort((a, b) => Number(a.done) - Number(b.done)) };
}

/** A reminder typed on the dashboard, in the shape the calendar keeps. */
export function quickReminder(title: string, day: string, id: string) {
  return { id, day, title: title.trim(), priority: 'must' as const, note: '', done: false, block: null };
}
