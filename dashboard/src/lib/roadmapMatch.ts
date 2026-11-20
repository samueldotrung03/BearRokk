// Connects the feed to the roadmap: which opportunities would move which unfinished step, and
// one coaching line about what to do first. Built by rules over the plan; a model call could
// replace `coachLine` and `opportunitiesForRoadmap` without the panel changing.
import { pathProfiles } from '../data/sample.ts';
import type { AppState } from '../state/store.ts';
import type { Opportunity, OpportunityType, RoadmapStep, StepKind } from '../types.ts';
import { evidenceFor } from './pathways.ts';
import type { Plan } from './roadmap.ts';
import { daysUntil } from './time.ts';

export interface RoadmapMatch {
  opportunity: Opportunity;
  step: RoadmapStep;
  /** True when the roadmap itself names this opportunity for the step. */
  linked: boolean;
  reason: string;
}

const kindOf: Record<OpportunityType, StepKind> = {
  internship: 'apply',
  research: 'apply',
  scholarship: 'apply',
  hackathon: 'build',
  event: 'attend',
  club: 'join',
};

const STOP = new Set(['with', 'your', 'the', 'and', 'for', 'one', 'well', 'enough', 'before', 'into', 'where', 'you', 'get', 'team', 'project', 'write', 'others', 'other', 'apply', 'send', 'work', 'spring', 'learn', 'ship', 'join', 'turn', 'finish', 'course', 'engineer']);
const words = (text: string) => text.toLowerCase().split(/[^a-z0-9+#]+/).filter((word) => word.length > 2 && !STOP.has(word));

/**
 * Opportunities worth doing for the roadmap, in step order: first the ones the roadmap names,
 * then others in the feed that would cover an unfinished step (same topic, or the same kind of
 * activity). `ranked` is the feed in its current order, so better matches for the student win.
 */
export function opportunitiesForRoadmap(plan: Plan, state: AppState, ranked: Opportunity[], limit = 6): RoadmapMatch[] {
  const todo = plan.planned.filter((step) => !state.doneSteps.includes(step.id));
  const pool = ranked.filter((o) => !state.dismissed.includes(o.id));
  const taken = new Set<string>();
  const matches: RoadmapMatch[] = [];
  const take = (opportunity: Opportunity, step: RoadmapStep, linked: boolean, reason: string) => {
    taken.add(opportunity.id);
    matches.push({ opportunity, step, linked, reason });
  };

  for (const step of todo) {
    const own = pool.find((o) => o.id === step.opportunityId);
    if (own && !taken.has(own.id)) take(own, step, true, `Your step: ${step.title}`);
  }
  // By topic: a word from the step shows up in the card's title or tags.
  for (const step of todo) {
    const wanted = words(step.title);
    for (const o of pool) {
      if (taken.has(o.id)) continue;
      // Whole words only, so "ship" does not match "scholarship".
      const card = new Set(words(`${o.title} ${o.tags.join(' ')}`));
      if (wanted.some((word) => card.has(word))) take(o, step, false, `Also covers: ${step.title}`);
    }
  }
  // By kind: another club for a "join" step, another hackathon for a "build" step, and so on.
  for (const step of todo) {
    const o = pool.find((candidate) => !taken.has(candidate.id) && kindOf[candidate.type] === step.kind);
    if (o) take(o, step, false, `Another way to: ${step.title}`);
  }
  return matches.slice(0, limit);
}

/** One sentence on what to do first and why, from the evidence and the due date. */
export function coachLine(plan: Plan, now = Date.now()): string {
  const next = plan.next;
  if (!next) return 'Every step is done. Pick a new goal on the Roadmap page and I will build the next plan.';
  const evidence = evidenceFor(plan.roadmap, pathProfiles);
  const seen = evidence.byStep.get(next.id);
  const parts: string[] = [`Start with "${next.title}".`];
  if (seen && seen.count > 0) parts.push(`${seen.count} of ${evidence.total} people who got this role did it.`);
  if (next.due) {
    const days = daysUntil(next.due, now);
    parts.push(days <= 0 ? 'It is due today.' : days === 1 ? 'It is due tomorrow.' : `You have ${days} days.`);
  }
  if (plan.percent > 0) parts.push(`You are ${plan.percent}% of the way there.`);
  return parts.join(' ');
}
