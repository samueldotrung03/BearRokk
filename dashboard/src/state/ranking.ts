// Feed ranking, modeled on the stages of the open-source X/Twitter recommendation algorithm
// (github.com/twitter/the-algorithm): candidate sourcing, visibility filtering, an engagement
// score built as a weighted sum of predicted actions, then heuristics such as diversity.
// No code from that repository is used; it is Scala behind trained models and licensed AGPL-3.0.
// This is a small, readable stand-in that runs in the browser on the student's own history.
import { opportunityPaths } from '../data/opportunities-more.ts';
import { careerPaths } from '../data/sample.ts';
import { currentRoadmap } from '../lib/roadmap.ts';
import type { Opportunity, OpportunityType } from '../types.ts';
import { extraStepId, type AppState } from './store.ts';

export type Signal = 'goal' | 'profile' | 'saved-like' | 'liked-like' | 'roadmap' | 'closing' | 'new' | 'explore';

export const signalLabel: Record<Signal, string> = {
  goal: 'Toward your goal',
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

const GOAL_BOOST = 1.45; // leads to the career the student chose
const OTHER_FIELD_SCALE = 0.55; // belongs to a field the student is not aiming at
const OUT_OF_NETWORK_SCALE = 0.75; // Twitter scales out-of-network candidates by the same factor
const DIVERSITY_DECAY = 0.82; // each earlier card of the same type costs this much
const DIVERSITY_FLOOR = 0.55;
const RECENCY_HALF_LIFE_HOURS = 72;
const RECENCY_FLOOR = 0.8; // what a long-known card keeps of its score
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

const groupOf = (pathId: string) => careerPaths.find((path) => path.id === pathId)?.group;

/**
 * How an opportunity sits against the student's goal: it leads there, it belongs to another
 * field altogether, or it is open to anyone (a fair, most scholarships) and is left alone.
 */
function goalFit(o: Opportunity, goalId: string): 'goal' | 'other-field' | 'neutral' {
  const paths = opportunityPaths[o.id];
  if (!paths || paths.length === 0) return 'neutral';
  if (paths.includes(goalId)) return 'goal';
  const group = groupOf(goalId);
  // Neighbouring paths in the same field (data work for a software student) stay as they are.
  if (!group || paths.some((path) => groupOf(path) === group)) return 'neutral';
  return 'other-field';
}

/** How much the student's reactions weigh on one card: its own type in full, sibling types in part. */
interface Felt {
  saves: number;
  likes: number;
  opens: number;
  dismissals: number;
}

/** Predicted open, save and dismiss, weighted into one engagement score, before any boost. */
function engagement(baseScore: number, felt: Felt): number {
  // The agent's fit score, moved by what the student did with this type before.
  // A like asks for more of the same; it counts for a little less than a save.
  const pOpen = clamp(0.6 * baseScore + 0.1 * felt.opens + 0.05 * felt.saves + 0.05 * felt.likes);
  const pSave = clamp(0.5 * baseScore + 0.15 * felt.saves + 0.1 * felt.likes);
  const pDismiss = clamp(0.04 + 0.18 * felt.dismissals);
  return WEIGHTS.open * pOpen + WEIGHTS.save * pSave + WEIGHTS.dismiss * pDismiss;
}

/** Each multiplier applied after the engagement score, kept so the reasons can quote it. */
type BoostKind = 'goal' | 'other-field' | 'out-of-network' | 'roadmap-next' | 'roadmap' | 'closing' | 'recency';

interface Breakdown {
  felt: Felt;
  engagement: number;
  boosts: { kind: BoostKind; factor: number }[];
  score: number;
  source: RankedOpportunity['source'];
  signals: Signal[];
  fit: ReturnType<typeof goalFit>;
  daysLeft: number | null;
  ageHours: number;
}

function breakdown(o: Opportunity, history: History, needs: ReturnType<typeof roadmapNeeds>, goalId: string, now: number): Breakdown {
  // Reactions to this type count in full, reactions to sibling types in part.
  const sum = (counts: Map<OpportunityType, number>) => {
    let total = 0;
    for (const [type, count] of counts) {
      if (type === o.type) total += count;
      else if (FAMILY[type] === FAMILY[o.type]) total += count * FAMILY_SHARE;
    }
    return total;
  };
  const felt: Felt = {
    saves: sum(history.saves),
    likes: sum(history.likes),
    opens: history.opens.get(o.type) ?? 0,
    dismissals: sum(history.dismissals),
  };
  const onRoadmap = needs.open.has(o.id);

  // Candidate sourcing. "In network" is anything tied to what the student already engages with.
  // A reaction to a sibling type nudges the score but does not bring a card in network.
  const direct = (history.saves.get(o.type) ?? 0) + (history.likes.get(o.type) ?? 0) + felt.opens;
  const source = direct > 0 || onRoadmap ? 'in-network' : 'out-of-network';

  const base = engagement(o.baseScore, felt);
  let score = base;
  const boosts: Breakdown['boosts'] = [];
  const boost = (kind: BoostKind, factor: number) => {
    score *= factor;
    boosts.push({ kind, factor });
  };

  const signals: Signal[] = [];
  const fit = goalFit(o, goalId);
  if (fit === 'goal') {
    boost('goal', GOAL_BOOST);
    signals.push('goal');
  } else if (fit === 'other-field') {
    boost('other-field', OTHER_FIELD_SCALE);
  }
  // The prepared fit score was written for the sample student, so it only speaks for their own field.
  if (o.baseScore >= 0.8 && fit !== 'other-field') signals.push('profile');
  if ((history.saves.get(o.type) ?? 0) > 0) signals.push('saved-like');
  else if ((history.likes.get(o.type) ?? 0) > 0) signals.push('liked-like');

  if (source === 'out-of-network') boost('out-of-network', OUT_OF_NETWORK_SCALE);

  if (o.id === needs.next) boost('roadmap-next', 1.25);
  else if (onRoadmap) boost('roadmap', 1.1);
  if (onRoadmap) signals.push('roadmap');

  const daysLeft = o.deadline ? (new Date(o.deadline).getTime() - now) / DAY : null;
  if (daysLeft !== null && daysLeft <= 7) {
    boost('closing', 1.15);
    signals.push('closing');
  } else if (daysLeft !== null && daysLeft <= 14) {
    boost('closing', 1.05);
  }

  // Recency: a fresh find gets up to 20% more than an old one.
  const ageHours = Math.max(0, now - new Date(o.foundAt).getTime()) / HOUR;
  boost('recency', RECENCY_FLOOR + (1 - RECENCY_FLOOR) * 0.5 ** (ageHours / RECENCY_HALF_LIFE_HOURS));
  if (ageHours < 24) signals.push('new');

  if (signals.length === 0) signals.push('explore');
  return { felt, engagement: base, boosts, score, source, signals, fit, daysLeft, ageHours };
}

function scoreOne(o: Opportunity, history: History, needs: ReturnType<typeof roadmapNeeds>, goalId: string, now: number): RankedOpportunity {
  const { score, source, signals } = breakdown(o, history, needs, goalId, now);
  return { opportunity: o, score, source, signals };
}

/** The student's history and roadmap, read once for a whole ranking. */
function prepare(opportunities: Opportunity[], state: AppState) {
  const byId = new Map(opportunities.map((o) => [o.id, o]));
  const history: History = {
    saves: countByType(state.saved, byId),
    likes: countByType(state.liked, byId),
    opens: countByType(state.opened, byId),
    dismissals: countByType(state.dismissed, byId),
  };
  return { history, needs: roadmapNeeds(state) };
}

/** Runs the whole pipeline and returns the feed in display order, with the reasons for each card. */
export function rankFeedDetailed(opportunities: Opportunity[], state: AppState, now = Date.now()): RankedOpportunity[] {
  const { history, needs } = prepare(opportunities, state);

  // Visibility filtering: nothing the student removed, nothing already closed.
  const scored = opportunities
    .filter((o) => !state.dismissed.includes(o.id))
    .filter((o) => !o.deadline || new Date(o.deadline).getTime() >= now)
    .map((o) => scoreOne(o, history, needs, state.goalId, now));

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

// "Why am I seeing this?" Every reason below is one ingredient of the score above, and its size is
// how far the score would fall or rise without that ingredient, so nothing is claimed that the
// ranking did not actually use. Diversity is left out: it changes the order, not a card's score.

export type ReasonKind =
  | 'goal'
  | 'other-field'
  | 'fit'
  | 'saved'
  | 'liked'
  | 'opened'
  | 'disliked'
  | 'explore'
  | 'roadmap'
  | 'closing'
  | 'new';

export interface Reason {
  kind: ReasonKind;
  /** One plain sentence for the student. */
  text: string;
  direction: 'up' | 'down';
  strength: 'slight' | 'some' | 'strong';
  /** The card's score minus what it would be without this one thing. */
  effect: number;
}

/** A fit score the agents would give a middling match; the fit reason is measured against it. */
const NEUTRAL_FIT = 0.5;
/** Changes smaller than this share of the score are real but too small to be worth a line. */
const MIN_SHOWN = 0.02;

const NOUN: Record<OpportunityType, [string, string]> = {
  internship: ['internship', 'internships'],
  event: ['event', 'events'],
  club: ['club', 'clubs'],
  hackathon: ['competition', 'competitions'],
  research: ['research position', 'research positions'],
  scholarship: ['scholarship', 'scholarships'],
};
const noun = (type: OpportunityType, count: number) => NOUN[type][count === 1 ? 0 : 1];

function listWords(items: string[]): string {
  if (items.length <= 1) return items[0] ?? '';
  return `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`;
}

/** Names the reactions that count for a card, as in "this one, 2 other internships and 1 research position". */
function tally(counts: Map<OpportunityType, number>, o: Opportunity, self: boolean, siblings: boolean): string {
  const items: string[] = [];
  if (self) items.push('this one');
  const same = (counts.get(o.type) ?? 0) - (self ? 1 : 0);
  if (same > 0) items.push(`${same} other ${noun(o.type, same)}`);
  if (siblings) {
    for (const [type, count] of counts) {
      if (type !== o.type && FAMILY[type] === FAMILY[o.type] && count > 0) items.push(`${count} ${noun(type, count)}`);
    }
  }
  return listWords(items);
}

/** The reasons behind one ranked card, biggest first, each with its direction and rough strength. */
export function explain(ranked: RankedOpportunity, state: AppState, opportunities: Opportunity[], now = Date.now()): Reason[] {
  const o = ranked.opportunity;
  const { history, needs } = prepare(opportunities, state);
  const b = breakdown(o, history, needs, state.goalId, now);
  const lift = b.boosts.reduce((product, item) => product * item.factor, 1);
  const plural = NOUN[o.type][1];

  // Size is measured against the larger of the score with and without the reason, so a boost and
  // a cut of the same factor read the same and the share never passes 1.
  const sized: { reason: Reason; share: number }[] = [];
  const add = (kind: ReasonKind, text: string, effect: number) => {
    const share = Math.abs(effect) / Math.max(Math.abs(b.score), Math.abs(b.score - effect), 1e-9);
    if (share < MIN_SHOWN) return;
    const strength = share >= 0.3 ? 'strong' : share >= 0.08 ? 'some' : 'slight';
    sized.push({ reason: { kind, text, effect, direction: effect > 0 ? 'up' : 'down', strength }, share });
  };
  // An ingredient of the engagement score: its share, carried through the same boosts.
  const engagementShare = (change: Partial<Felt>, baseScore = o.baseScore) =>
    (b.engagement - engagement(baseScore, { ...b.felt, ...change })) * lift;

  // The fit score speaks only for the student's own field, as with the "Fits your profile" chip.
  if (b.fit !== 'other-field') {
    const fit = Math.round(o.baseScore * 100);
    const text =
      o.baseScore >= NEUTRAL_FIT
        ? `Your agents rate it ${fit} out of 100 for your profile`
        : `Your agents rate it only ${fit} out of 100 for your profile`;
    add('fit', text, engagementShare({}, NEUTRAL_FIT));
  }

  const direct = (counts: Map<OpportunityType, number>) => (counts.get(o.type) ?? 0) > 0;
  if (b.felt.saves > 0) {
    const what = tally(history.saves, o, state.saved.includes(o.id), true);
    add('saved', direct(history.saves) ? `You saved ${what}` : `You saved ${what}, which count a little toward ${plural}`, engagementShare({ saves: 0 }));
  }
  if (b.felt.likes > 0) {
    const what = tally(history.likes, o, state.liked.includes(o.id), true);
    add('liked', direct(history.likes) ? `You liked ${what}` : `You liked ${what}, which count a little toward ${plural}`, engagementShare({ likes: 0 }));
  }
  if (b.felt.opens > 0) {
    add('opened', `You opened ${tally(history.opens, o, state.opened.includes(o.id), false)}`, engagementShare({ opens: 0 }));
  }
  if (b.felt.dismissals > 0) {
    const what = tally(history.dismissals, o, state.dismissed.includes(o.id), true);
    add('disliked', `You disliked ${what}, so ${plural} are shown ${direct(history.dismissals) ? 'less' : 'a little less'}`, engagementShare({ dismissals: 0 }));
  }

  for (const { kind, factor } of b.boosts) {
    const effect = kind === 'recency' ? b.score - (b.score * RECENCY_FLOOR) / factor : b.score - b.score / factor;
    if (kind === 'goal') {
      const goal = careerPaths.find((path) => path.id === state.goalId)?.title ?? 'the career you chose';
      add('goal', `It leads toward your goal, ${goal}`, effect);
    } else if (kind === 'other-field') {
      const fields = [...new Set((opportunityPaths[o.id] ?? []).map(groupOf).filter((g): g is NonNullable<typeof g> => !!g))];
      const text =
        fields.length > 1
          ? `It is from fields you are not aiming at (${fields.join(', ')}), so it is shown lower`
          : `It is from ${fields[0] ?? 'another field'}, a field you are not aiming at, so it is shown lower`;
      add('other-field', text, effect);
    } else if (kind === 'out-of-network') {
      add('explore', 'Nothing in your history points to it yet, so it sits a little lower. It is here so you can try something different', effect);
    } else if (kind === 'roadmap' || kind === 'roadmap-next') {
      const step = currentRoadmap(state.goalId)
        .phases.flatMap((phase) => phase.steps)
        .find((s) => s.opportunityId === o.id && !state.doneSteps.includes(s.id));
      const lead = kind === 'roadmap-next' ? 'It is the next step on your roadmap' : 'It is on your roadmap';
      add('roadmap', step ? `${lead}: ${step.title}` : `${lead}, because you added it`, effect);
    } else if (kind === 'closing' && b.daysLeft !== null) {
      const days = Math.ceil(b.daysLeft);
      add('closing', days <= 0 ? 'It closes today' : days === 1 ? 'It closes tomorrow' : `It closes in ${days} days`, effect);
    } else if (kind === 'recency') {
      const days = Math.floor(b.ageHours / 24);
      add('new', days === 0 ? 'Found today' : days === 1 ? 'Found yesterday' : `Found ${days} days ago, so it still counts as new`, effect);
    }
  }

  return sized.sort((x, y) => y.share - x.share).map((item) => item.reason);
}
