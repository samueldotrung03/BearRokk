// The student's current plan as one ordered list: the goal's own steps, then any feed
// opportunities the student added. Shared by the Roadmap page and the roadmap panel in the feed.
import { applicationInfo, opportunities, pathProfiles, roadmaps, skillOptions } from '../data/sample.ts';
import { extraStepId, type AppState } from '../state/store.ts';
import type { ApplicationInfo, Opportunity, Roadmap, RoadmapStep, StepKind } from '../types.ts';
import { evidenceFor, orderByEvidence } from './pathways.ts';

/**
 * The roadmap for a goal as the student sees it: the plan's steps, ordered inside each phase by
 * how many people who reached the goal actually did them.
 */
export function currentRoadmap(goalId: string): Roadmap {
  const roadmap = roadmaps.find((r) => r.goalId === goalId) ?? roadmaps[0]!;
  return orderByEvidence(roadmap, evidenceFor(roadmap, pathProfiles));
}

const DAY = 86_400_000;

/**
 * Builds the roadmap for one opportunity, when the student asks for it: what to get ready and by
 * when, worked back from its deadline or start. It is made from the posting's own details (its
 * materials, its questions, its dates) and the skills the student does not have yet.
 */
export function buildOpportunityRoadmap(
  o: Opportunity,
  info: ApplicationInfo | undefined,
  skills: string[],
  now = Date.now(),
): RoadmapStep[] {
  const end = o.deadline ?? o.startTime;
  // A date that many days before the deadline, never in the past. Null when no date is stated.
  const before = (days: number): string | null => {
    if (!end) return null;
    return new Date(Math.max(now, new Date(end).getTime() - days * DAY)).toISOString();
  };
  const steps: RoadmapStep[] = [];
  const add = (key: string, kind: StepKind, title: string, detail: string, due: string | null) =>
    steps.push({ id: `${extraStepId(o.id)}:${key}`, kind, title, detail, opportunityId: o.id, due });
  const applying = o.type === 'internship' || o.type === 'research' || o.type === 'scholarship';
  const shorten = (text: string) => (text.length > 64 ? `${text.slice(0, 61).trimEnd()}...` : text);

  add('read', 'learn', 'Read the official posting end to end', `Confirm you are eligible and note anything ${o.organizer} asks for that is not listed here.`, before(14));

  o.tags
    .filter((tag) => skillOptions.includes(tag) && !skills.includes(tag))
    .forEach((skill) => add(`skill-${skill}`, 'learn', `Get comfortable with ${skill}`, `The posting names ${skill} and it is not on your profile yet.`, before(10)));

  if (info?.requiresLogin) {
    add('login', 'learn', "Sign in on the organizer's site to see the questions", 'The questions sit behind a sign-in, so your agents could not read them.', before(10));
  }
  (info?.materials ?? []).forEach((material, index) =>
    add(`material-${index}`, 'build', `Get ready: ${material}`, 'Listed as required on the application page.', before(7)),
  );
  (info?.prompts ?? []).forEach((prompt, index) =>
    add(`prompt-${index}`, 'build', `Draft your answer: ${shorten(prompt)}`, prompt, before(5)),
  );

  if (applying) {
    add('review', 'build', 'Ask someone to review it', 'A friend, an advisor or the career center. Leave time to use what they say.', before(3));
    add('submit', 'apply', 'Submit the application', o.deadline ? 'Send it a day early in case the site is slow.' : 'The posting does not state a deadline, so sooner is safer.', before(1));
  } else if (o.type === 'hackathon') {
    add('register', 'apply', 'Register', 'Spots can run out before the deadline.', before(2));
    add('team', 'join', 'Find a team or sign up to be matched', 'Two to four people with different strengths works well.', before(1));
    add('idea', 'build', 'Pick an idea small enough to finish', 'One feature that works beats three that almost do.', o.startTime);
    add('attend', 'attend', 'Build and present', 'Keep notes as you go; you will want them for the write-up.', o.startTime);
    add('writeup', 'build', 'Write up the project afterwards', 'A short page with what you built and your part in it, for your portfolio.', null);
  } else if (o.type === 'event') {
    add('register', 'apply', 'Register or RSVP', 'So you get reminders and any room change.', before(2));
    add('prepare', 'build', 'Prepare a 30-second introduction and three questions', 'Who you are, what you are looking for, and what you want to learn from them.', before(1));
    add('attend', 'attend', 'Go, and talk to at least two people', 'Ask for a name and the best way to follow up.', o.startTime);
    add('follow', 'join', 'Follow up within two days', 'A short thank-you that mentions what you talked about.', null);
  } else {
    add('first', 'attend', 'Go to the first meeting', 'Introduce yourself and ask what newcomers usually start on.', o.startTime ?? before(0));
    add('join', 'join', 'Join and pick up a first task', 'Something small you can finish in a week.', null);
  }
  return steps;
}

export interface Plan {
  roadmap: Roadmap;
  planned: RoadmapStep[];
  /** Steps of the roadmaps the student started for single opportunities. */
  extras: RoadmapStep[];
  steps: RoadmapStep[];
  doneCount: number;
  percent: number;
  /** The first step not finished yet. */
  next: RoadmapStep | undefined;
}

/** `found` is what the agents found; steps the student added from the feed are built from it. */
export function planFor(state: AppState, found: Opportunity[] = opportunities): Plan {
  const roadmap = currentRoadmap(state.goalId);
  const planned = roadmap.phases.flatMap((phase) => phase.steps);
  const extras = found
    .filter((o) => state.extraSteps.includes(o.id) && !state.dismissed.includes(o.id))
    .flatMap((o) => buildOpportunityRoadmap(o, applicationInfo[o.id], state.profile.skills));
  const steps = [...planned, ...extras];
  const doneCount = steps.filter((step) => state.doneSteps.includes(step.id)).length;
  return {
    roadmap,
    planned,
    extras,
    steps,
    doneCount,
    percent: steps.length ? Math.round((doneCount / steps.length) * 100) : 0,
    next: steps.find((step) => !state.doneSteps.includes(step.id)),
  };
}
