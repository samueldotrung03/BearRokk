// Turns what people who reached a goal actually did into evidence for the roadmap: how many of
// them did each step, which steps nearly all of them share, and the order to do them in.
import type { PathProfile, Roadmap, RoadmapStep } from '../types.ts';

export interface StepEvidence {
  step: RoadmapStep;
  count: number;
  /** Share of the profiles that did this step, 0 to 1. */
  share: number;
}

export interface Evidence {
  /** How many profiles the roadmap for this goal rests on. */
  total: number;
  byStep: Map<string, StepEvidence>;
  /** Steps most of these people did, most common first. */
  common: StepEvidence[];
  /** Steps only a few of them did: worth doing, but not what got most people in. */
  rare: StepEvidence[];
}

const COMMON_AT = 0.6;
const RARE_BELOW = 0.35;

export function evidenceFor(roadmap: Roadmap, profiles: PathProfile[]): Evidence {
  const relevant = profiles.filter((profile) => profile.goalId === roadmap.goalId);
  const total = relevant.length;
  const all = roadmap.phases
    .flatMap((phase) => phase.steps)
    .map((step) => {
      const count = relevant.filter((profile) => profile.did.includes(step.id)).length;
      return { step, count, share: total ? count / total : 0 };
    });
  const byShare = [...all].sort((a, b) => b.share - a.share);
  return {
    total,
    byStep: new Map(all.map((item) => [item.step.id, item])),
    common: byShare.filter((item) => item.share >= COMMON_AT),
    rare: byShare.filter((item) => item.share < RARE_BELOW),
  };
}

/**
 * Inside each phase, puts the steps more people did first. Phases keep their order, because
 * that order is about time: you cannot apply before you have something to show.
 */
export function orderByEvidence(roadmap: Roadmap, evidence: Evidence): Roadmap {
  if (evidence.total === 0) return roadmap;
  const share = (step: RoadmapStep) => evidence.byStep.get(step.id)?.share ?? 0;
  return {
    ...roadmap,
    phases: roadmap.phases.map((phase) => ({ ...phase, steps: [...phase.steps].sort((a, b) => share(b) - share(a)) })),
  };
}
