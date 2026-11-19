// The roadmap as one journey: an ordered line of steps from where the student is to the goal,
// each with what to do, what to master, where to learn it and why it is there. Two kinds:
// a career journey built from the student's career goal, and a job journey built from one posting.
import { pathExtras } from '../../data/discover-extra.ts';
import { stepResources, type Resource } from '../../data/roadmap-extra.ts';
import { opportunityPaths } from '../../data/opportunities-more.ts';
import { applicationInfo, careerPaths, opportunities, pathProfiles, skillOptions } from '../../data/sample.ts';
import type { AppState } from '../../state/store.ts';
import type { ApplicationStatus, Opportunity, StepKind } from '../../types.ts';
import { followUpSteps } from '../apps/followup.ts';
import { evidenceFor } from '../pathways.ts';
import { buildOpportunityRoadmap, currentRoadmap } from '../roadmap.ts';
import { buildCoachContext, estimateHours, formatHours, whyStep } from './context.ts';

export type JourneyMode = 'career' | 'job';

export interface JourneySkill {
  label: string;
  /** Most postings for this path ask for it. */
  core: boolean;
  /** Already on the profile, or covered by a finished step. */
  have: boolean;
}

/** Where a step comes from, which is also how firmly it is meant. */
export type StepSource =
  | 'people' // what people who got there did: a recommendation
  | 'posting' // the posting itself asks for it
  | 'gap' // something the posting names that the profile lacks
  | 'after'; // what to do once the application is sent

export const sourceLabel: Record<StepSource, string> = {
  people: 'Recommended',
  posting: 'From the posting',
  gap: 'Closes a gap',
  after: 'After you apply',
};

export interface JourneyStep {
  id: string;
  /** Position on the path, from 0. */
  index: number;
  kind: StepKind;
  title: string;
  /** What to do, in a sentence or two. */
  detail: string;
  phaseId: string;
  due: string | null;
  done: boolean;
  /** Rough planning estimate, never a measurement. */
  hours: number;
  source: StepSource;
  /** How common it was among people who got there, in words. Null when there is no evidence. */
  strength: string | null;
  /** Skills this step builds. Empty when the step is not about a skill. */
  skills: JourneySkill[];
  /** Free places to learn it. Empty when none is known; the page then points at the school's catalog. */
  resources: Resource[];
  /** Why the step is on the path, each line from data the app has. */
  why: string[];
  /** How many people who reached the goal did this, when known. */
  evidence: { count: number; total: number } | null;
  opportunity: { id: string; title: string; organizer: string } | null;
  /** Concrete things to do for this step, in order. Only on a roadmap built from the student's picks. */
  actions?: string[];
}

/** Something further to add in a category. The id is the board option it stands for, or null when the writer thought of it. */
export interface More {
  id: string | null;
  title: string;
  why: string;
}

export interface JourneyPhase {
  id: string;
  title: string;
  /** When it usually happens ("This semester"), or empty. */
  window: string;
  /** Index of its first step. */
  from: number;
  count: number;
  /** Further recommendations in this category. Only on a roadmap built from the student's picks. */
  more?: More[];
}

/** One person's way in, with no name kept: what the roadmap's evidence rests on. */
export interface Story {
  id: string;
  outcome: string;
  year: string;
  timeline: string[];
  /** Ids of the options on this roadmap that this person did, so their own mix can be shown. */
  did?: string[];
}

/** What the roadmap writer looked at and found, in the order it works. */
export interface Analysis {
  stages: { label: string; result: string }[];
  /** Job journeys only: the posting's qualifications set against the profile. */
  fit: { score: number; met: string[]; missing: string[] } | null;
  stories: Story[];
  /** One line on what the roadmap rests on, for the page's honesty note. */
  basis: string;
  /** Pages the writer read. Empty for the rule-built draft. */
  sources: string[];
  /** A posting's selection process as the writer found it, in order. Empty when nothing was found. */
  process?: { stage: string; detail: string }[];
}

export interface Journey {
  mode: JourneyMode;
  /** The destination, as the student would say it. */
  goal: string;
  summary: string;
  phases: JourneyPhase[];
  steps: JourneyStep[];
  doneCount: number;
  percent: number;
  /** The first step not finished yet; equal to steps.length when all are done. */
  nextIndex: number;
  hoursLeft: number;
  /** Every skill the journey builds, core first, for the "what you will master" strip. */
  skills: JourneySkill[];
  analysis: Analysis;
  /** The journey's own color, so each destination is recognisable at a glance. */
  accent: string;
  /** Steps the student set aside as not for them. */
  skipped: { id: string; title: string }[];
  /** An open journey has no order: its phases are directions and its steps are options to choose from. */
  open: boolean;
  /** Neighbouring careers worth a look. Empty for a posting. */
  related: Related[];
  /** True when this roadmap is a career guide's "How to start", sent over from Career discovery. */
  guide?: boolean;
  /** True when this roadmap was built from the options the student picked. */
  plan?: boolean;
  /** Categories the student picked nothing from, with what they could add. Built roadmaps only. */
  left?: { id: string; title: string; more: More[] }[];
}

export interface Related {
  /** A career path the app holds, or null when the writer named one it does not. */
  id: string | null;
  title: string;
  /** How it connects to this goal and to the student. */
  why: string;
  /** Share of what it asks for that the profile already shows, 0 to 100; null when unknown. */
  match: number | null;
}

const strengthOf = (share: number) => (share >= 0.6 ? 'Most people did this' : share >= 0.35 ? 'About half did this' : 'A few did this');
const hueOf = (goalId: string | undefined) => pathExtras.find((extra) => extra.pathId === goalId)?.hue ?? '#245bd8';

export type Draft = Omit<JourneyStep, 'index'>;

export function finish(mode: JourneyMode, goal: string, summary: string, groups: { id: string; title: string; window: string; steps: Draft[] }[], skills: JourneySkill[], analysis: Omit<Analysis, 'stages'> & { stages: Analysis['stages'] }, accent: string, skip: string[]): Journey {
  const skipped: Journey['skipped'] = [];
  const steps: JourneyStep[] = [];
  const phases: JourneyPhase[] = [];
  for (const group of groups) {
    const from = steps.length;
    for (const draft of group.steps) {
      // Only a recommendation can be set aside; what a posting asks for stays.
      if (draft.source === 'people' && skip.includes(draft.id) && !draft.done) skipped.push({ id: draft.id, title: draft.title });
      else steps.push({ ...draft, index: steps.length });
    }
    if (steps.length > from) phases.push({ id: group.id, title: group.title, window: group.window, from, count: steps.length - from });
  }
  const doneCount = steps.filter((step) => step.done).length;
  const next = steps.findIndex((step) => !step.done);
  const hoursLeft = steps.filter((step) => !step.done).reduce((sum, step) => sum + step.hours, 0);
  return {
    mode,
    goal,
    summary,
    phases,
    steps,
    doneCount,
    percent: steps.length ? Math.round((doneCount / steps.length) * 100) : 0,
    nextIndex: next === -1 ? steps.length : next,
    hoursLeft,
    skills: [...skills].sort((a, b) => Number(b.core) - Number(a.core) || Number(a.have) - Number(b.have)),
    analysis: { ...analysis, stages: [...analysis.stages, { label: 'Writing your steps', result: `${steps.length} steps, about ${Math.round(hoursLeft)}h of work left` }] },
    accent,
    skipped,
    open: false,
    related: [],
  };
}

const storiesFor = (goalId: string): Story[] =>
  pathProfiles.filter((profile) => profile.goalId === goalId).map((profile) => ({ id: profile.id, outcome: profile.outcome, year: profile.year, timeline: profile.timeline }));

/**
 * The journey to the student's career goal. Nothing here is required: every step is something
 * people who reached the goal did, ranked by how many of them did it, for the student to choose from.
 */
export function careerJourney(base: AppState, now = Date.now(), skip: string[] = [], goalId = base.goalId, list: Opportunity[] = opportunities): Journey {
  // Any career can be looked at, not only the one set as the goal.
  const state = goalId === base.goalId ? base : { ...base, goalId };
  const roadmap = currentRoadmap(state.goalId);
  const ctx = buildCoachContext(state, 6, now);
  const byId = new Map(ctx.steps.filter((step) => !step.extra).map((step) => [step.id, step]));
  const mine = new Set(state.profile.skills.map((skill) => skill.toLowerCase()));
  const done = new Set(state.doneSteps);
  const expected = pathExtras.find((extra) => extra.pathId === roadmap.goalId)?.skills ?? [];
  const skill = (s: (typeof expected)[number]): JourneySkill => ({
    label: s.label,
    core: s.importance === 'core',
    have: (s.profileSkill !== null && mine.has(s.profileSkill.toLowerCase())) || (s.stepId !== null && done.has(s.stepId)),
  });

  let common = 0;
  // No order is implied: the options are grouped by the kind of thing they are, the most common first.
  const groups = DIRECTIONS.map((direction) => ({
    id: `direction-${direction.kinds[0]}`,
    title: direction.title,
    window: '',
    steps: roadmap.phases
      .flatMap((phase) => phase.steps)
      .filter((step) => direction.kinds.includes(step.kind))
      .flatMap((step): Draft[] => {
        const coach = byId.get(step.id);
        if (!coach) return [];
        const skills = expected.filter((s) => s.stepId === step.id).map(skill);
        // An option that covers something the goal asks for teaches it, even with no named skill.
        if (skills.length === 0 && coach.requirement) skills.push({ label: coach.requirement.label, core: true, have: coach.requirement.met });
        if (coach.evidence && coach.evidence.share >= 0.6) common += 1;
        return [
          {
            id: step.id,
            kind: step.kind,
            title: step.title,
            detail: step.detail,
            phaseId: `direction-${direction.kinds[0]}`,
            due: step.due,
            done: coach.done,
            hours: coach.hours,
            source: 'people',
            strength: coach.evidence ? strengthOf(coach.evidence.share) : null,
            skills,
            resources: stepResources[step.id] ?? [],
            // An option has no deadline of its own, so the coach's line about one is left out.
            why: whyStep(coach, ctx).filter((line) => line !== step.detail && !/^It (is|was) due/.test(line)),
            evidence: coach.evidence ? { count: coach.evidence.count, total: coach.evidence.total } : null,
            opportunity: coach.opportunity,
          },
        ];
      })
      .sort((x, y) => (y.evidence ? y.evidence.count / y.evidence.total : 0) - (x.evidence ? x.evidence.count / x.evidence.total : 0)),
  }));
  const path = careerPaths.find((p) => p.id === roadmap.goalId);
  const stories = storiesFor(roadmap.goalId);

  // Beyond the main options, everything else the app knows that leads toward this career, so
  // the map is the whole field and not a shortlist.
  const slug = (text: string) => text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40);
  const option = (key: string, kind: StepKind, title: string, detail: string, more: Partial<Draft> = {}): Draft => {
    const id = `opt-${roadmap.goalId}:${key}`;
    return { id, kind, title, detail, phaseId: '', due: null, done: done.has(id), hours: 2, source: 'people', strength: null, skills: [], resources: [], why: [], evidence: null, opportunity: null, ...more };
  };
  const add = (kind: StepKind, drafts: Draft[]) => {
    const group = groups.find((g) => g.id === `direction-${kind}`)!;
    const titles = new Set(group.steps.map((s) => s.title.toLowerCase()));
    group.steps.push(...drafts.filter((d) => !titles.has(d.title.toLowerCase())).map((d) => ({ ...d, phaseId: group.id })));
  };
  add(
    'learn',
    expected
      .filter((s) => s.stepId === null)
      .map((s) => {
        const chip = skill(s);
        return option(`skill-${slug(s.label)}`, 'learn', `Get comfortable with ${s.label.charAt(0).toLowerCase()}${s.label.slice(1)}`, chip.have ? 'Your profile already shows this. Keep it current, and be ready to show where you used it.' : 'People in this career tend to have it. Pick it up through a class, a project or practice, whichever suits you.', {
          hours: 8,
          skills: [chip],
          strength: chip.have ? 'Already on your profile' : s.importance === 'core' ? 'Most postings ask for this' : 'Helps, asked for less often',
          why: [s.importance === 'core' ? 'It comes up in most postings for this career.' : 'It comes up in some postings for this career.'],
        });
      }),
  );
  const linked = new Set(roadmap.phases.flatMap((phase) => phase.steps).flatMap((step) => (step.opportunityId ? [step.opportunityId] : [])));
  for (const o of list) {
    if (!opportunityPaths[o.id]?.includes(roadmap.goalId) || linked.has(o.id) || state.dismissed.includes(o.id)) continue;
    const kind: StepKind = o.type === 'club' ? 'join' : o.type === 'event' || o.type === 'hackathon' ? 'attend' : 'apply';
    add(kind, [
      option(`opp-${o.id}`, kind, kind === 'join' ? `Join ${o.title}` : kind === 'attend' ? `Go to ${o.title}` : `${o.title} at ${o.organizer}`, `From ${o.organizer}, in your feed for this career. ${o.deadline ? `It closes ${new Date(o.deadline).toLocaleDateString('en-US', { month: 'long', day: 'numeric' })}.` : 'No closing date is listed.'}`, {
        hours: kind === 'apply' ? 4 : 2,
        done: done.has(`opt-${roadmap.goalId}:opp-${o.id}`) || state.applications[o.id]?.status === 'applied',
        strength: state.applications[o.id] ? 'You are tracking this' : state.saved.includes(o.id) ? 'You saved this' : null,
        why: ['It is open now and leads toward this career.'],
        opportunity: { id: o.id, title: o.title, organizer: o.organizer },
      }),
    ]);
  }
  // What the people behind this map wrote on their own timelines, with how many of them did each.
  // Lines that say the same thing with a different month or number count as one.
  const seen = new Map<string, { lines: string[]; n: number }>();
  for (const story of stories) {
    for (const key of new Set(story.timeline.map(sameThing))) {
      const line = story.timeline.find((l) => sameThing(l) === key)!;
      const entry = seen.get(key) ?? { lines: [], n: 0 };
      if (!entry.lines.includes(line)) entry.lines.push(line);
      entry.n += 1;
      seen.set(key, entry);
    }
  }
  const did = [...seen.values()]
    .sort((x, y) => y.n - x.n)
    .map(({ lines, n }) => ({ line: lines[0]!, n, others: lines.slice(1) }))
    .map(({ line, n, others }) =>
      option(`did-${slug(line)}`, kindOf(line), line, `On the path of ${n === 1 ? 'one person' : `${n} people`} who reached ${path?.title ?? 'this goal'}${others.length ? `; others put it as "${others.join('", "')}"` : ''}. Their version of it, in their words; yours can look different.`, {
        phaseId: 'direction-did',
        hours: 6,
        strength: strengthOf(n / stories.length),
        evidence: { count: n, total: stories.length },
        why: [`${n} of the ${stories.length} people whose paths the app holds list this before they got in.`],
      }),
    );
  groups.push({ id: 'direction-did', title: 'What people actually did', window: '', steps: did });

  const { profile } = state;
  const journey = finish(
    'career',
    roadmap.goal,
    path?.oneLine ?? roadmap.summary,
    groups,
    expected.map(skill),
    {
      stages: [
        { label: 'Reading your profile', result: [profile.major || 'No major yet', profile.year, `${profile.skills.length} skills`].join(' · ') },
        { label: 'Reading how people got in', result: `${stories.length} people who reached ${path?.title ?? 'this goal'}` },
        { label: 'Ranking what they did', result: `${common} things most of them did` },
      ],
      fit: null,
      sources: [],
      stories,
      basis: `Options drawn from ${stories.length} sample paths of people who reached this goal. None of them is required, and there is no set order.`,
    },
    hueOf(roadmap.goalId),
    skip,
  );
  // Each person's own mix of these options: what they ticked off, and what they wrote on their timeline.
  const onMap = new Set(journey.steps.map((s) => s.id));
  const mixes = pathProfiles
    .filter((profile) => profile.goalId === roadmap.goalId)
    .map((profile) => ({ id: profile.id, outcome: profile.outcome, year: profile.year, timeline: profile.timeline, did: [...profile.did, ...profile.timeline.map((line) => `opt-${roadmap.goalId}:did-${slug(seen.get(sameThing(line))?.lines[0] ?? line)}`)].filter((id) => onMap.has(id)) }));
  const open = asOptions(journey);
  return { ...open, analysis: { ...open.analysis, stories: mixes }, related: relatedPaths(state, roadmap.goalId) };
}

/** Marks a journey as open-ended, and says so where it would otherwise speak of steps and hours left. */
export function asOptions(journey: Journey): Journey {
  const stages = [...journey.analysis.stages.slice(0, -1), { label: 'Laying out your options', result: `${journey.steps.length} options in ${journey.phases.length} directions, in no set order` }];
  return { ...journey, open: true, analysis: { ...journey.analysis, stages } };
}

/** Things to do for one picked option, by the kind of thing it is. Plain defaults until the writer gives its own. */
function actionsFor(step: JourneyStep): string[] {
  const place = step.resources[0]?.label;
  const posting = step.opportunity ? `Open ${step.opportunity.title} and check the date and what it asks for` : null;
  switch (step.kind) {
    case 'learn':
      return [place ? `Start with ${place}` : 'Pick one course or tutorial and start it', `Set aside about ${formatHours(step.hours)} across the next few weeks`, 'Make one small thing that uses it, so you can show it', 'Add it to your profile once you can use it without notes'];
    case 'build':
      return ['Decide the smallest version you could finish', 'Build that version and put it somewhere people can open', 'Write three lines on what it does and what was hard', 'Add it to your resume and your profile'];
    case 'join':
      return [posting ?? 'Find out when it next meets or takes new members', 'Go to one meeting before deciding anything', 'Take on one small task so people get to know your work', 'Ask one member how they got their internship'];
    case 'attend':
      return [posting ?? 'Check the date and sign up', 'Write down two people or companies you want to talk to there', 'Go, and talk to them', 'Follow up within two days with anyone you want to stay in touch with'];
    case 'apply':
      return [posting ?? 'Read what it asks for and note the deadline', 'Fit your resume to it', 'Draft answers to its questions', 'Send it, and mark it applied in Applications'];
  }
}

/** What usually comes next after one kind of thing, for a category the board has nothing more in. General advice, not a finding about anyone. */
const AFTER: Record<StepKind, More[]> = {
  learn: [
    { id: null, title: 'Use it in a project someone else can open', why: 'A skill shows best in something finished that you can link to.' },
    { id: null, title: 'Teach it to one person', why: 'Explaining it shows you where your own gaps are.' },
  ],
  build: [
    { id: null, title: 'Get one person in the field to look at it', why: 'Their comments tell you what a reviewer would notice first.' },
    { id: null, title: 'Write it up in half a page', why: 'You will be asked to talk about it, and the write-up is your answer.' },
  ],
  join: [
    { id: null, title: 'Take on a role with a name', why: 'Running an event or a project inside it gives you something concrete to point to.' },
    { id: null, title: 'Ask two older members how they got their offers', why: 'They went through the same process a year or two ahead of you.' },
    { id: null, title: 'Bring what the group does into your resume', why: 'A pitch, a build or an event you ran there counts as experience.' },
  ],
  attend: [
    { id: null, title: 'Follow up with the people you met', why: 'A short note within two days is what turns a meeting into a contact.' },
    { id: null, title: 'Find the next one before this one fades', why: 'Going regularly is how people start to recognise you.' },
  ],
  apply: [
    { id: null, title: 'Keep a list of what you sent and when', why: 'The Applications page holds it, so nothing is forgotten.' },
    { id: null, title: 'Practise the interview while you wait', why: 'Replies can come with little notice.' },
  ],
};

/**
 * The roadmap built from what the student picked on a career board: their options, grouped by
 * category, each with things to do, and each category ending with what else is worth adding.
 */
export function planJourney(board: Journey, picked: string[]): Journey {
  const steps: JourneyStep[] = [];
  const phases: JourneyPhase[] = [];
  const left: NonNullable<Journey['left']> = [];
  for (const phase of board.phases) {
    const all = board.steps.slice(phase.from, phase.from + phase.count);
    const more = all
      .filter((step) => !picked.includes(step.id) && !step.done)
      .slice(0, 3)
      .map((step) => ({ id: step.id, title: step.title, why: step.strength ? `${step.strength}. ${step.detail}` : step.detail }));
    const mine = all.filter((step) => picked.includes(step.id));
    if (mine.length === 0) {
      if (more.length) left.push({ id: phase.id, title: phase.title, more: more.slice(0, 2) });
      continue;
    }
    // When the board has little left in a category, say what usually comes after what they chose.
    const after = more.length < 2 ? AFTER[mine[0]!.kind].filter((m) => !more.some((x) => x.title === m.title)).slice(0, 3 - more.length) : [];
    phases.push({ ...phase, from: steps.length, count: mine.length, more: [...more, ...after] });
    for (const step of mine) steps.push({ ...step, index: steps.length, actions: actionsFor(step) });
  }
  const doneCount = steps.filter((step) => step.done).length;
  const next = steps.findIndex((step) => !step.done);
  const hoursLeft = steps.filter((step) => !step.done).reduce((sum, step) => sum + step.hours, 0);
  return {
    ...board,
    summary: `Built from the ${steps.length} ${steps.length === 1 ? 'option' : 'options'} you chose, in ${phases.length} ${phases.length === 1 ? 'category' : 'categories'}. Each one has things to do, and each category ends with what else is worth adding.`,
    phases,
    steps,
    doneCount,
    percent: steps.length ? Math.round((doneCount / steps.length) * 100) : 0,
    nextIndex: next === -1 ? steps.length : next,
    hoursLeft,
    analysis: { ...board.analysis, stages: [...board.analysis.stages.slice(0, -1), { label: 'Building from your picks', result: `${steps.length} steps in ${phases.length} ${phases.length === 1 ? 'category' : 'categories'}, about ${Math.round(hoursLeft)}h left` }] },
    skipped: [],
    open: false,
    plan: true,
    left,
  };
}

/** A career the app holds nothing about: an empty map for the writer to fill. */
export function customCareer(goal: string): Journey {
  const journey = finish(
    'career',
    goal,
    '',
    [],
    [],
    { stages: [{ label: 'Reading your profile', result: 'Ready' }], fit: null, sources: [], stories: [], basis: `The app holds no paths for ${goal}, so only the writer can map it.` },
    hueOf(undefined),
    [],
  );
  return asOptions(journey);
}

/** The "How to start" part of a career guide, as the Career discovery page hands it over. */
export interface GuideStart {
  steps: { title: string; detail: string; when?: string | null; resource: { title: string; url: string } | null; prepares?: string[] }[];
  /** Who researched it, so sample steps are never shown as live research. */
  provider: 'grok' | 'claude' | 'simulated';
  sample: boolean;
}

/** Where the Career discovery page leaves a guide's steps for the roadmap page, by career title. */
export const GUIDES_KEY = 'bearrok.roadmap.guides';

/**
 * A career guide's "How to start" drawn as a road: its steps in the guide's own order, grouped by
 * when the guide says to do them. No hours are shown, because the guide gives none.
 */
export function guideJourney(goal: string, guide: GuideStart, doneSteps: string[], skip: string[] = []): Journey {
  const slug = (text: string) => text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40);
  const prefix = `guide-${slug(goal)}`;
  const seen = new Set<string>();
  const groups: { id: string; title: string; window: string; steps: Draft[] }[] = [];
  for (const step of guide.steps) {
    const id = `${prefix}:${slug(step.title)}`;
    if (!step.title.trim() || seen.has(id)) continue;
    seen.add(id);
    const when = step.when?.trim() || 'How to start';
    let group = groups.at(-1);
    if (!group || group.title !== when) {
      group = { id: `${prefix}:phase-${groups.length}`, title: when, window: '', steps: [] };
      groups.push(group);
    }
    const prepares = (step.prepares ?? []).filter((p) => p.trim());
    group.steps.push({
      id,
      kind: kindOf(`${step.title} ${step.detail}`),
      title: step.title,
      detail: step.detail,
      phaseId: group.id,
      due: null,
      done: doneSteps.includes(id),
      hours: 0,
      source: 'people',
      strength: null,
      skills: [],
      resources: step.resource && /^https?:\/\//.test(step.resource.url) ? [{ label: step.resource.title, url: step.resource.url }] : [],
      why: [`It is step ${seen.size} of how to start in the ${goal} career guide.`, ...(prepares.length ? [`It prepares you for ${prepares.join(', ')} in the interviews.`] : [])],
      evidence: null,
      opportunity: null,
    });
  }
  const who = guide.sample || guide.provider === 'simulated' ? 'sample steps, because no model is connected' : guide.provider === 'claude' ? 'researched by Claude, standing in for Grok during testing' : 'researched by Grok';
  const journey = finish(
    'career',
    goal,
    `How to start in ${goal}, step by step, from its career guide. Open a step for what it involves, and tick it off when you have done it.`,
    groups,
    [],
    { stages: [{ label: 'Reading the career guide', result: `How to start in ${goal}` }], fit: null, sources: [], stories: [], basis: `These steps come from the career guide's "How to start" for ${goal} (${who}).` },
    hueOf(undefined),
    skip,
  );
  return { ...journey, guide: true };
}

/** A timeline line with its months and counts taken out, so "Applied in October" and "Applied in November" match. */
const sameThing = (line: string) =>
  line
    .toLowerCase()
    .replace(/\b(january|february|march|april|may|june|july|august|september|october|november|december|spring|summer|fall|winter)\b/g, '#')
    .replace(/\b(\d+|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen|twenty)\b/g, '#')
    .replace(/\s+/g, ' ')
    .trim();

/** The kind of thing a timeline line is, from its own words. */
const kindOf = (line: string): StepKind =>
  /\bappl(y|ied|ication)/i.test(line) ? 'apply' : /\b(club|society|chapter|member|team lead|lead)\b/i.test(line) ? 'join' : /\b(hackathon|fair|session|workshop|jam|conference|competition|shadow)/i.test(line) ? 'attend' : /\b(course|class|certif|learn|study|sql|python)/i.test(line) ? 'learn' : 'build';

const DIRECTIONS: { title: string; kinds: StepKind[] }[] = [
  { title: 'Skills to build', kinds: ['learn'] },
  { title: 'Projects to make', kinds: ['build'] },
  { title: 'People and communities', kinds: ['join'] },
  { title: 'Events and experiences', kinds: ['attend'] },
  { title: 'Opportunities to go for', kinds: ['apply'] },
];

const and = (items: string[]) => (items.length > 1 ? `${items.slice(0, -1).join(', ')} and ${items.at(-1)}` : items[0] ?? '');

/** Share of what a path asks for that the profile already shows, 0 to 100; null when the path lists nothing. */
export function pathMatch(state: AppState, pathId: string): number | null {
  const asked = pathExtras.find((extra) => extra.pathId === pathId)?.skills ?? [];
  if (asked.length === 0) return null;
  const mine = shownSkills(state);
  const done = new Set(state.doneSteps);
  const have = asked.filter((s) => (s.profileSkill !== null && mine.has(s.profileSkill.toLowerCase())) || (s.stepId !== null && done.has(s.stepId)));
  return Math.round((have.length / asked.length) * 100);
}

/** Careers next to this one, and the one elsewhere the student's skills fit best, each with how it connects. */
export function relatedPaths(state: AppState, goalId: string, limit = 4): Related[] {
  const here = pathExtras.find((extra) => extra.pathId === goalId);
  const skillsOf = (id: string) => (pathExtras.find((extra) => extra.pathId === id)?.skills ?? []).map((s) => s.label);
  const mine = new Set(skillsOf(goalId).map((label) => label.toLowerCase()));
  const title = (id: string) => careerPaths.find((p) => p.id === id)?.title;
  const near: Related[] = (here?.neighbours ?? []).flatMap((id) => {
    const name = title(id);
    if (!name) return [];
    const shared = skillsOf(id).filter((label) => mine.has(label.toLowerCase())).slice(0, 2);
    return [{ id, title: name, why: shared.length ? `Shares ${and(shared.map((s) => s.toLowerCase()))} with this path, so what you build here carries over.` : 'Rests on much of the same groundwork as this path.', match: pathMatch(state, id) }];
  });
  // One the student may not have thought of: the best fit for their skills outside this neighbourhood.
  const taken = new Set([goalId, ...near.map((r) => r.id)]);
  const other = careerPaths
    .filter((p) => !taken.has(p.id))
    .map((p) => ({ p, match: pathMatch(state, p.id) }))
    .filter((x) => x.match !== null && x.match > 0)
    .sort((x, y) => y.match! - x.match!)[0];
  return [...near.slice(0, limit - (other ? 1 : 0)), ...(other ? [{ id: other.p.id, title: other.p.title, why: `A different field, but your profile already shows ${other.match}% of what it asks for.`, match: other.match }] : [])];
}

export interface CareerHit {
  id: string;
  title: string;
  oneLine: string;
  /** What in the path matched what was typed; empty for suggestions shown before typing. */
  reason: string;
  match: number | null;
}

/**
 * Careers for what the student typed: a career or role by name, a skill it uses, or an interest.
 * With nothing typed, the ones their profile points at.
 */
export function careerSearch(state: AppState, query: string, limit = 100): CareerHit[] {
  const q = query.trim().toLowerCase();
  const hit = (p: (typeof careerPaths)[number], reason: string): CareerHit => ({ id: p.id, title: p.title, oneLine: p.oneLine, reason, match: pathMatch(state, p.id) });
  if (!q) {
    const wanted = new Set([state.goalId, ...(state.profile.careerInterests ?? [])]);
    return [...careerPaths]
      .map((p) => ({ p, match: pathMatch(state, p.id) ?? 0 }))
      .sort((x, y) => Number(wanted.has(y.p.id)) - Number(wanted.has(x.p.id)) || y.match - x.match)
      .slice(0, limit)
      .map(({ p }) => hit(p, p.id === state.goalId ? 'Your goal' : wanted.has(p.id) ? 'On your profile' : ''));
  }
  return careerPaths
    .flatMap((p) => {
      const extra = pathExtras.find((e) => e.pathId === p.id);
      const skill = extra?.skills.find((s) => s.label.toLowerCase().includes(q) || s.profileSkill?.toLowerCase().includes(q));
      const interest = extra?.interests.find((i) => i.toLowerCase().includes(q));
      const expects = p.expects.find((e) => e.toLowerCase().includes(q));
      const rank = p.title.toLowerCase().startsWith(q) ? 0 : p.title.toLowerCase().includes(q) ? 1 : skill ? 2 : interest ? 3 : p.group?.toLowerCase().includes(q) ? 4 : p.oneLine.toLowerCase().includes(q) || expects ? 5 : -1;
      if (rank === -1) return [];
      const reason = rank <= 1 ? '' : skill ? `Uses ${skill.label.toLowerCase()}` : interest ? `For people into ${interest.toLowerCase()}` : rank === 4 ? `In ${p.group}` : expects ? `Expects: ${expects}` : '';
      return [{ rank, result: hit(p, reason) }];
    })
    .sort((x, y) => x.rank - y.rank || (y.result.match ?? 0) - (x.result.match ?? 0))
    .slice(0, limit)
    .map(({ result }) => result);
}

/** Skills the student can show: the profile's list and the ones named on their experiences. */
function shownSkills(state: AppState): Set<string> {
  const fromWork = state.preferences?.experience?.entries.flatMap((entry) => entry.skills) ?? [];
  return new Set([...state.profile.skills, ...fromWork].map((skill) => skill.toLowerCase()));
}

/**
 * The journey to one posting, written for this student: the posting's qualifications are checked
 * against the profile, what is missing becomes a step, what people who got similar roles did is
 * added as recommendations, and the application's own parts follow, worked back from its date.
 * Once it is sent, the journey turns into what to do while waiting.
 */
export function jobJourney(state: AppState, o: Opportunity, now = Date.now(), skip: string[] = []): Journey {
  const info = applicationInfo[o.id];
  const application = state.applications[o.id];
  const applied = application?.status === 'applied';
  const done = new Set(state.doneSteps);
  const shown = shownSkills(state);
  const from = { id: o.id, title: o.title, organizer: o.organizer };

  const asked = o.tags.filter((tag) => skillOptions.includes(tag));
  const met = asked.filter((tag) => shown.has(tag.toLowerCase()));
  const missing = asked.filter((tag) => !shown.has(tag.toLowerCase()));
  const raw = buildOpportunityRoadmap(o, info, [...shown].map((s) => asked.find((tag) => tag.toLowerCase() === s) ?? s), now);

  const step = (s: (typeof raw)[number], phaseId: string, source: StepSource): Draft => {
    const named = /^Get comfortable with (.+)$/.exec(s.title)?.[1];
    return {
      id: s.id,
      kind: s.kind,
      title: s.title,
      detail: s.detail,
      phaseId,
      due: s.due,
      done: done.has(s.id),
      hours: estimateHours(s, o.type),
      source,
      strength: null,
      skills: named ? [{ label: named, core: true, have: done.has(s.id) }] : [],
      resources: [],
      why: [
        source === 'gap'
          ? `${o.organizer} names ${named ?? 'this'} in the posting and nothing on your profile or experience shows it yet.`
          : `It comes from the posting for ${o.title} at ${o.organizer}, worked back from its ${o.deadline ? 'deadline' : 'date'}.`,
      ],
      evidence: null,
      opportunity: from,
    };
  };

  // What people who got roles like this one did, that this student has not done yet.
  const goalId = opportunityPaths[o.id]?.[0];
  const roadmap = goalId ? currentRoadmap(goalId) : null;
  const evidence = roadmap ? evidenceFor(roadmap, pathProfiles) : null;
  const stories = goalId ? storiesFor(goalId) : [];
  const people: Draft[] = !roadmap || !evidence
    ? []
    : roadmap.phases
        .flatMap((phase) => phase.steps)
        .map((s) => ({ s, seen: evidence.byStep.get(s.id) }))
        .filter(({ s, seen }) => seen && seen.share >= 0.5 && s.opportunityId !== o.id && s.kind !== 'apply')
        .sort((a, b) => b.seen!.share - a.seen!.share)
        .slice(0, 3)
        .map(({ s, seen }): Draft => ({
          id: s.id,
          kind: s.kind,
          title: s.title,
          detail: s.detail,
          phaseId: 'job-gaps',
          due: null,
          done: done.has(s.id),
          hours: estimateHours(s),
          source: 'people',
          strength: strengthOf(seen!.share),
          skills: [],
          resources: stepResources[s.id] ?? [],
          why: [`${seen!.count} of the ${evidence.total} people who got roles like this one did this before they got in.`],
          evidence: { count: seen!.count, total: evidence.total },
          opportunity: null,
        }));

  const is = (kinds: StepKind[], skillStep: boolean) => (s: (typeof raw)[number]) => kinds.includes(s.kind) && s.id.includes(':skill-') === skillStep;
  const groups = applied
    ? [
        {
          id: 'job-after',
          title: 'After you apply',
          window: 'Now',
          steps: followUpSteps(o, info).map((f): Draft => ({
            id: `extra-${o.id}:after-${f.id}`,
            kind: f.id === 'prep' ? 'learn' : 'build',
            // The follow-up list was written for the Applications page, where notes sit under it.
            title: f.label.replace(/ (in your notes )?below/, (_, notes) => (notes ? ' in your application notes' : '')),
            detail: `Part of following through on your application to ${o.organizer}.`,
            phaseId: 'job-after',
            due: null,
            done: done.has(`extra-${o.id}:after-${f.id}`),
            hours: f.id === 'prep' ? 1.5 : 0.25,
            source: 'after',
            strength: null,
            skills: [],
            resources: [],
            why: ['The application is sent. These keep it from going quiet and get you ready for a reply.'],
            evidence: null,
            opportunity: from,
          })),
        },
        { id: 'job-gaps', title: 'While you wait', window: 'Next', steps: people },
      ]
    : [
        { id: 'job-understand', title: 'Understand it', window: 'First', steps: raw.filter(is(['learn'], false)).map((s) => step(s, 'job-understand', 'posting')) },
        { id: 'job-gaps', title: 'Close the gaps', window: 'Then', steps: [...raw.filter(is(['learn'], true)).map((s) => step(s, 'job-gaps', 'gap')), ...people] },
        { id: 'job-prepare', title: 'Get ready', window: 'Then', steps: raw.filter(is(['build'], false)).map((s) => step(s, 'job-prepare', 'posting')) },
        { id: 'job-go', title: 'Go for it', window: 'Last', steps: raw.filter(is(['apply', 'join', 'attend'], false)).map((s) => step(s, 'job-go', 'posting')) },
      ];

  const count = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;
  const parts = [`${count(asked.length, 'skill')} named`, count(info?.materials.length ?? 0, 'material'), count(info?.prompts.length ?? 0, 'question')];
  // Said from this student's own profile; the posting's stored blurb was written for someone else.
  const list = (items: string[]) => (items.length > 1 ? `${items.slice(0, -1).join(', ')} and ${items.at(-1)}` : items[0] ?? '');
  const fitWords = !asked.length
    ? `${o.organizer} names no specific skill in this posting, so the roadmap is about the application itself.`
    : !missing.length
      ? `${o.organizer} asks for ${list(asked)}, and your profile shows ${asked.length === 1 ? 'it' : 'all of it'}.`
      : !met.length
        ? `${o.organizer} asks for ${list(asked)}. None of it is on your profile yet, so ${applied ? 'the roadmap covers it while you wait' : 'the roadmap starts there'}.`
        : `${o.organizer} asks for ${list(asked)}. Your profile shows ${list(met)}; ${list(missing)} ${missing.length === 1 ? 'is' : 'are'} still to come.`;
  const score = asked.length ? Math.round((met.length / asked.length) * 100) : Math.round(o.baseScore * 100);
  return finish(
    'job',
    `${o.title} at ${o.organizer}`,
    fitWords,
    groups,
    asked.map((tag) => ({ label: tag, core: true, have: shown.has(tag.toLowerCase()) || done.has(`extra-${o.id}:skill-${tag}`) })),
    {
      stages: [
        { label: 'Reading the posting', result: parts.join(' · ') },
        { label: 'Checking it against your profile', result: asked.length ? `${met.length} of ${asked.length} skills on your profile` : 'It names no specific skill' },
        { label: 'Reading how people got in', result: stories.length ? `${stories.length} people who got roles like this` : 'No paths on file for this kind of role yet' },
      ],
      fit: { score, met, missing },
      sources: [],
      stories,
      basis: `Written from the posting's own details, your profile, and ${stories.length} sample paths of people who got similar roles.`,
    },
    hueOf(goalId),
    skip,
  );
}

/** Postings worth a job roadmap: the ones the student is tracking, then saved, then the best of the rest. */
export function jobChoices(state: AppState, list: Opportunity[], limit = 8): Opportunity[] {
  const applies = (o: Opportunity) => o.type === 'internship' || o.type === 'research' || o.type === 'scholarship';
  const rank = (o: Opportunity) => (state.applications[o.id] ? 0 : state.extraSteps.includes(o.id) ? 1 : state.saved.includes(o.id) ? 2 : state.liked.includes(o.id) ? 3 : 4);
  const seen = new Set<string>();
  return list
    .filter((o) => applies(o) && !state.dismissed.includes(o.id) && !seen.has(o.id) && Boolean(seen.add(o.id)))
    .map((o, index) => ({ o, index }))
    .sort((a, b) => rank(a.o) - rank(b.o) || a.index - b.index)
    .slice(0, limit)
    .map(({ o }) => o);
}

export interface Destination {
  opportunity: Opportunity;
  /** The application's stage, or null for one the app is only suggesting. */
  status: ApplicationStatus | null;
}

/**
 * The roadmaps the student gets without choosing anything: one for every application they have,
 * sent or in progress, and, when they track none, the best few from the feed.
 */
export function destinations(state: AppState, list: Opportunity[], byId: Map<string, Opportunity>, suggest = 3): Destination[] {
  // Everything the student has in their applications, whatever kind it is: sent ones first, then the ones in progress.
  const order: ApplicationStatus[] = ['applied', 'applying', 'to_apply', 'interested'];
  const tracked = Object.entries(state.applications)
    .flatMap(([id, application]) => {
      const opportunity = byId.get(id);
      return opportunity ? [{ opportunity, status: application.status }] : [];
    })
    .sort((a, b) => order.indexOf(a.status) - order.indexOf(b.status) || (a.opportunity.deadline ?? '9').localeCompare(b.opportunity.deadline ?? '9'));
  if (tracked.length > 0) return tracked;
  return jobChoices(state, list, suggest).map((opportunity) => ({ opportunity, status: null }));
}

export interface Point {
  x: number;
  y: number;
}

/**
 * Where each step sits on the ground: a path that winds from the near edge (the bottom) toward
 * the goal far away, one extra point at the end for the goal itself.
 */
export function layoutPath(count: number, width: number, spacing: number, margin = 220): { points: Point[]; length: number } {
  const total = count + 1;
  const length = margin * 2 + spacing * count;
  const swing = width * 0.26;
  const points = Array.from({ length: total }, (_, i) => ({
    x: Math.round(width / 2 + Math.sin(i * 1.05 + 0.6) * swing * (i === total - 1 ? 0.25 : 1)),
    y: length - margin - i * spacing,
  }));
  return { points, length };
}

/** A smooth curve through the points, as an SVG path. */
export function curveThrough(points: Point[]): string {
  if (points.length === 0) return '';
  let d = `M ${points[0]!.x} ${points[0]!.y}`;
  for (let i = 1; i < points.length; i += 1) {
    const a = points[i - 1]!;
    const b = points[i]!;
    const mid = (a.y + b.y) / 2;
    d += ` C ${a.x} ${mid}, ${b.x} ${mid}, ${b.x} ${b.y}`;
  }
  return d;
}
