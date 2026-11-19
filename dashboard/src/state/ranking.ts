// Feed ranking, modeled on the stages of the open-source X/Twitter recommendation algorithm
// (github.com/twitter/the-algorithm): candidate sourcing, visibility filtering, an engagement
// score built as a weighted sum of predicted actions, then heuristics such as diversity.
// No code from that repository is used; it is Scala behind trained models and licensed AGPL-3.0.
// This is a small, readable stand-in that runs in the browser on the student's own history.
import { currentRoadmap } from '../lib/roadmap.ts';
import type { Opportunity, OpportunityType } from '../types.ts';
import { extraStepId, type AppState } from './store.ts';

export type Signal = 'profile' | 'saved-like' | 'liked-like' | 'roadmap' | 'closing' | 'new' | 'explore';

export const signalLabel: Record<Signal, string> = {
  profile: 'Fits your profile',
  'saved-like': 'Like ones you saved',
  'liked-like': 'Like ones you liked',
  roadmap: 'On your roadmap',
  closing: 'Closing soon',
  new: 'New today',
  explore: 'Something different',
};

export interface RankedOpportunity {
  opportunity: Opportunity;
  score: number;
  /** Where the candidate came from, in Twitter's terms. */
  source: 'in-network' | 'out-of-network';
  signals: Signal[];
}

/**
 * How much each predicted action is worth. Twitter's heavy ranker does the same with likes,
 * replies and reports; a strong negative weight makes one "not for me" outweigh several opens.
 */
export const WEIGHTS = { open: 0.5, save: 1, dismiss: -1.6 };

const OUT_OF_NETWORK_SCALE = 0.75; // Twitter scales out-of-network candidates by the same factor
const DIVERSITY_DECAY = 0.82; // each earlier card of the same type costs this much
const DIVERSITY_FLOOR = 0.55;
const RECENCY_HALF_LIFE_HOURS = 72;
const HOUR = 3_600_000;
const DAY = 24 * HOUR;

const clamp = (value: number) => Math.min(1, Math.max(0, value));

/**
 * Types that lead to the same kind of thing. Reacting to one says a little about the others in
 * its family, the way Twitter carries a like over to similar authors.
 */
const FAMILY: Record<OpportunityType, 'career' | 'community'> = {
  internship: 'career',
  research: 'career',
  scholarship: 'career',
  event: 'community',
  hackathon: 'community',
  club: 'community',
};
const FAMILY_SHARE = 0.5; // a reaction to a sibling type counts half

interface History {
  saves: Map<OpportunityType, number>;
  likes: Map<OpportunityType, number>;
  opens: Map<OpportunityType, number>;
  dismissals: Map<OpportunityType, number>;
}

function countByType(ids: string[], byId: Map<string, Opportunity>): Map<OpportunityType, number> {
  const counts = new Map<OpportunityType, number>();
  for (const id of ids) {
    const type = byId.get(id)?.type;
    if (type) counts.set(type, (counts.get(type) ?? 0) + 1);
  }
  return counts;
}

/** Opportunity ids the roadmap still needs, and the one attached to the very next step. */
function roadmapNeeds(state: AppState): { open: Set<string>; next: string | null } {
  const steps = currentRoadmap(state.goalId).phases.flatMap((phase) => phase.steps);
  const todo = steps.filter((step) => !state.doneSteps.includes(step.id));
  const open = new Set(todo.map((step) => step.opportunityId).filter((id): id is string => id !== null));
  // Opportunities the student added to the roadmap themselves count the same way.
  for (const id of state.extraSteps) if (!state.doneSteps.includes(extraStepId(id))) open.add(id);
  return { open, next: todo[0]?.opportunityId ?? null };
}

function scoreOne(o: Opportunity, history: History, needs: ReturnType<typeof roadmapNeeds>, now: number): RankedOpportunity {
  // Reactions to this type count in full, reactions to sibling types in part.
  const felt = (counts: Map<OpportunityType, number>) => {
    let total = 0;
    for (const [type, count] of counts) {
      if (type === o.type) total += count;
      else if (FAMILY[type] === FAMILY[o.type]) total += count * FAMILY_SHARE;
    }
    return total;
  };
  const saves = felt(history.saves);
  const likes = felt(history.likes);
  const opens = history.opens.get(o.type) ?? 0;
  const dismissals = felt(history.dismissals);
  const onRoadmap = needs.open.has(o.id);

  // Candidate sourcing. "In network" is anything tied to what the student already engages with.
  // A reaction to a sibling type nudges the score but does not bring a card in network.
  const direct = (history.saves.get(o.type) ?? 0) + (history.likes.get(o.type) ?? 0) + opens;
  const source = direct > 0 || onRoadmap ? 'in-network' : 'out-of-network';

  // Predicted actions: the agent's fit score, moved by what the student did with this type before.
  // A like asks for more of the same; it counts for a little less than a save.
  const pOpen = clamp(0.6 * o.baseScore + 0.1 * opens + 0.05 * saves + 0.05 * likes);
  const pSave = clamp(0.5 * o.baseScore + 0.15 * saves + 0.1 * likes);
  const pDismiss = clamp(0.04 + 0.18 * dismissals);
  let score = WEIGHTS.open * pOpen + WEIGHTS.save * pSave + WEIGHTS.dismiss * pDismiss;

  const signals: Signal[] = [];
  if (o.baseScore >= 0.8) signals.push('profile');
  if ((history.saves.get(o.type) ?? 0) > 0) signals.push('saved-like');
  else if ((history.likes.get(o.type) ?? 0) > 0) signals.push('liked-like');

  if (source === 'out-of-network') score *= OUT_OF_NETWORK_SCALE;

  if (o.id === needs.next) score *= 1.25;
  else if (onRoadmap) score *= 1.1;
  if (onRoadmap) signals.push('roadmap');

  const daysLeft = o.deadline ? (new Date(o.deadline).getTime() - now) / DAY : null;
  if (daysLeft !== null && daysLeft <= 7) {
    score *= 1.15;
    signals.push('closing');
  } else if (daysLeft !== null && daysLeft <= 14) {
    score *= 1.05;
  }

  // Recency: a fresh find gets up to 20% more than an old one.
  const ageHours = Math.max(0, now - new Date(o.foundAt).getTime()) / HOUR;
  score *= 0.8 + 0.2 * 0.5 ** (ageHours / RECENCY_HALF_LIFE_HOURS);
  if (ageHours < 24) signals.push('new');

  if (signals.length === 0) signals.push('explore');
  return { opportunity: o, score, source, signals };
}

/** Runs the whole pipeline and returns the feed in display order, with the reasons for each card. */
export function rankFeedDetailed(opportunities: Opportunity[], state: AppState, now = Date.now()): RankedOpportunity[] {
  const byId = new Map(opportunities.map((o) => [o.id, o]));
  const history: History = {
    saves: countByType(state.saved, byId),
    likes: countByType(state.liked, byId),
    opens: countByType(state.opened, byId),
    dismissals: countByType(state.dismissed, byId),
  };
  const needs = roadmapNeeds(state);

  // Visibility filtering: nothing the student removed, nothing already closed.
  const scored = opportunities
    .filter((o) => !state.dismissed.includes(o.id))
    .filter((o) => !o.deadline || new Date(o.deadline).getTime() >= now)
    .map((o) => scoreOne(o, history, needs, now));

  // Diversity, as Twitter does per author: pick the best remaining card each time, with every
  // card of a type already placed making the next one of that type a little less attractive.
  const placed = new Map<OpportunityType, number>();
  const result: RankedOpportunity[] = [];
  const pool = [...scored];
  while (pool.length > 0) {
    let best = 0;
    let bestScore = -Infinity;
    pool.forEach((candidate, index) => {
      const repeats = placed.get(candidate.opportunity.type) ?? 0;
      const adjusted = candidate.score * Math.max(DIVERSITY_FLOOR, DIVERSITY_DECAY ** repeats);
      if (adjusted > bestScore) {
        best = index;
        bestScore = adjusted;
      }
    });
    const [chosen] = pool.splice(best, 1);
    placed.set(chosen!.opportunity.type, (placed.get(chosen!.opportunity.type) ?? 0) + 1);
    result.push(chosen!);
  }
  return result;
}

export function rankFeed(opportunities: Opportunity[], state: AppState, now = Date.now()): Opportunity[] {
  return rankFeedDetailed(opportunities, state, now).map((ranked) => ranked.opportunity);
}
