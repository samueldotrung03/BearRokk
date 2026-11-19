// Everything the detail view and the compare table say about one path, worked out from the
// sample data: which expected skills the student has, how the people in `pathProfiles` got in,
// which feed cards lead there, and how big the roadmap is. Pure, so it is easy to test and the
// same facts feed the "Ask about this career" answers.
import type { CareerPath, ClassYear, Opportunity, PathProfile, Profile, Roadmap, RoadmapStep } from '../../types.ts';
import type { ExpectedSkill, PathExtra } from '../../data/discover-extra.ts';
import { evidenceFor, type StepEvidence } from '../pathways.ts';
import { hasSkill, relatedOpportunityIds } from './match.ts';

export type SkillState = 'have' | 'planned' | 'missing';

export interface SkillRow {
  skill: ExpectedSkill;
  state: SkillState;
}

export interface PathInsight {
  path: CareerPath;
  extra: PathExtra | undefined;
  roadmap: Roadmap | undefined;
  skills: SkillRow[];
  skillsHave: number;
  /** People in the sample who reached this path, and how they did it. */
  people: {
    total: number;
    byYear: { year: ClassYear; count: number }[];
    common: StepEvidence[];
    timelines: PathProfile[];
  };
  opportunities: { opportunity: Opportunity; saved: boolean; liked: boolean }[];
  plan: {
    phases: { title: string; window: string; steps: number; done: number }[];
    steps: number;
    done: number;
    /** First step not done yet, in the order the roadmap page shows. */
    next: RoadmapStep | undefined;
  };
}

export interface InsightInput {
  path: CareerPath;
  extras: PathExtra[];
  roadmaps: Roadmap[];
  profiles: PathProfile[];
  opportunities: Opportunity[];
  profile: Profile;
  doneSteps: string[];
  saved: string[];
  liked: string[];
  dismissed: string[];
}

const YEARS: ClassYear[] = ['Freshman', 'Sophomore', 'Junior', 'Senior'];

export function pathInsight(input: InsightInput): PathInsight {
  const { path, extras, roadmaps, profiles, opportunities, profile, doneSteps, saved, liked, dismissed } = input;
  const extra = extras.find((e) => e.pathId === path.id);
  const roadmap = roadmaps.find((r) => r.goalId === path.id);
  const planStepIds = new Set((roadmap?.phases ?? []).flatMap((p) => p.steps.map((s) => s.id)));

  // A skill counts as planned when the roadmap has a step for it that is not done yet.
  const skills: SkillRow[] = (extra?.skills ?? []).map((skill) => ({
    skill,
    state: hasSkill(skill, profile, doneSteps) ? 'have' : skill.stepId && planStepIds.has(skill.stepId) ? 'planned' : 'missing',
  }));

  const relevant = profiles.filter((p) => p.goalId === path.id);
  const evidence = roadmap ? evidenceFor(roadmap, profiles) : undefined;

  const related = new Set(relatedOpportunityIds(extra, roadmap, opportunities));
  const leads = opportunities
    .filter((o) => related.has(o.id) && !dismissed.includes(o.id))
    .map((opportunity) => ({ opportunity, saved: saved.includes(opportunity.id), liked: liked.includes(opportunity.id) }))
    // Cards the student already reacted to first, then the agents' best fits.
    .sort((a, b) => Number(b.saved || b.liked) - Number(a.saved || a.liked) || b.opportunity.baseScore - a.opportunity.baseScore);

  const phases = (roadmap?.phases ?? []).map((phase) => ({
    title: phase.title,
    window: phase.window,
    steps: phase.steps.length,
    done: phase.steps.filter((s) => doneSteps.includes(s.id)).length,
  }));
  const allSteps = (roadmap?.phases ?? []).flatMap((p) => p.steps);

  return {
    path,
    extra,
    roadmap,
    skills,
    skillsHave: skills.filter((s) => s.state === 'have').length,
    people: {
      total: relevant.length,
      byYear: YEARS.map((year) => ({ year, count: relevant.filter((p) => p.year === year).length })).filter((y) => y.count > 0),
      common: evidence?.common ?? [],
      // The richest histories make the best examples.
      timelines: [...relevant].sort((a, b) => b.timeline.length - a.timeline.length).slice(0, 3),
    },
    opportunities: leads,
    plan: {
      phases,
      steps: allSteps.length,
      done: allSteps.filter((s) => doneSteps.includes(s.id)).length,
      next: allSteps.find((s) => !doneSteps.includes(s.id)),
    },
  };
}

/** How many of the people in the sample were in the student's class year when they got in. */
export function sameYearCount(insight: PathInsight, year: ClassYear): number {
  return insight.people.byYear.find((y) => y.year === year)?.count ?? 0;
}
