// The roadmap Grok writes. This file builds the request the backend's writer needs from the
// signed-in student's own data, and turns its answer into the same Journey the page draws for
// the rule-built draft, so the page shows whichever one it has.
import { restrictionSections } from '../../data/preferences.ts';
import { applicationInfo, careerPaths } from '../../data/sample.ts';
import type { AppState } from '../../state/store.ts';
import type { StepKind } from '../../types.ts';
import { asOptions, finish, pathMatch, type Destination, type Draft, type Journey, type StepSource, type Story } from './journey.ts';

/** How the roadmap on screen was made. */
export type Writer = 'api' | 'cli';

export interface AiRoadmap {
  summary: string;
  fit: { score: number; met: string[]; missing: string[] };
  phases: {
    title: string;
    window: string;
    more?: { title: string; why: string }[];
    steps: { actions?: string[]; title: string; detail: string; kind: StepKind; source: StepSource; hours: number; skills: string[]; strength: string | null; why: string; resources: { label: string; url: string }[] }[];
  }[];
  howPeopleGotIn: { outcome: string; timeline: string[] }[];
  relatedPaths?: { title: string; why: string }[];
  process?: { stage: string; detail: string }[];
}

export interface AiAnswer {
  roadmap: AiRoadmap;
  citations: string[];
  writer: Writer;
}

const clip = (value: string | null | undefined, max: number) => (value ?? '').trim().slice(0, max);

/** What the student said they will and will not accept, in plain lines. */
function restrictions(state: AppState): string[] {
  const p = state.preferences;
  if (!p) return [];
  return restrictionSections.flatMap((section) => {
    const ticked = section.items.filter((item) => item.kind === 'check' && p.checks[item.id]).map((item) => item.label);
    const typed = section.items.flatMap((item) => {
      const value = item.kind === 'list' ? (p.lists[item.id] ?? []).join(', ') : item.kind === 'check' ? '' : (p.answers[item.id] ?? '');
      return value.trim() ? [`${item.label}: ${clip(value, 150)}`] : [];
    });
    return [...(ticked.length ? [`${section.checksLabel ?? section.title}: ${ticked.join(', ')}`.slice(0, 200)] : []), ...typed];
  });
}

/**
 * The request for one roadmap. It holds only what should change the roadmap (the profile, the
 * goal, the posting and where the application stands), so ticking a step off does not ask for a
 * new one.
 */
export function roadmapRequest(state: AppState, goal: string, dest: Destination | null, known: Story[], chosen: { category: string; title: string }[] = []) {
  const { profile, preferences } = state;
  const o = dest?.opportunity;
  const info = o ? applicationInfo[o.id] : undefined;
  return {
    kind: o ? ('job' as const) : ('career' as const),
    goal: clip(goal, 200),
    profile: {
      major: clip(profile.major, 120),
      year: profile.year,
      school: clip(profile.school, 120),
      about: clip(profile.about, 600),
      skills: profile.skills.slice(0, 40).map((s) => clip(s, 120)),
      interests: [...profile.interests, ...(preferences?.fields ?? [])].slice(0, 20).map((s) => clip(s, 120)),
      experience: (preferences?.experience?.entries ?? [])
        .filter((e) => e.role.trim())
        .slice(0, 12)
        .map((e) => ({ role: clip(e.role, 120), organization: clip(e.organization, 120), summary: clip(e.summary, 400), skills: e.skills.slice(0, 15).map((s) => clip(s, 120)) })),
      notes: (preferences?.notes ?? []).slice(0, 12).map((n) => clip(`${n.title}: ${n.body}`, 400)),
      restrictions: restrictions(state).slice(0, 12),
    },
    posting: o
      ? {
          title: clip(o.title, 200),
          organizer: clip(o.organizer, 120),
          type: o.type,
          // The app holds no full description; the writer reads the posting at its source.
          description: '',
          tags: o.tags.slice(0, 20),
          location: o.location,
          deadline: o.deadline,
          materials: (info?.materials ?? []).slice(0, 12).map((s) => clip(s, 200)),
          prompts: (info?.prompts ?? []).slice(0, 12).map((s) => clip(s, 400)),
          sourceUrl: clip(o.sourceUrl, 400),
          status: dest.status ?? ('suggested' as const),
        }
      : null,
    // What the student picked from the career board; the writer builds the roadmap from these.
    chosen: chosen.slice(0, 60).map((c) => ({ category: clip(c.category, 120), title: clip(c.title, 200) })),
    knownPaths: known.slice(0, 12).map((s) => ({ outcome: clip(s.outcome, 200), timeline: s.timeline.slice(0, 8).map((line) => clip(line, 200)) })),
  };
}
export type RoadmapRequest = ReturnType<typeof roadmapRequest>;

/** What the student picked on a built roadmap, as the writer is told it. */
export const chosenFrom = (plan: Journey) => plan.phases.flatMap((phase) => plan.steps.slice(phase.from, phase.from + phase.count).map((step) => ({ category: phase.title, title: step.title })));

/**
 * The writer's version of a roadmap built from the student's picks. The picks themselves stay as
 * they are, so nothing the student chose can go missing; the writer adds what to do for each
 * and what else to add in each category.
 */
export function aiPlan(plan: Journey, answer: AiAnswer): Journey {
  const { roadmap, citations } = answer;
  const same = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();
  const written = roadmap.phases.flatMap((phase) => phase.steps);
  const steps = plan.steps.map((step) => {
    const w = written.find((x) => same(x.title, step.title));
    const actions = (w?.actions ?? []).filter((line) => line.trim()).slice(0, 6);
    if (!w) return step;
    const links = w.resources.filter((r) => r.label.trim() && isLink(r.url));
    return { ...step, detail: w.detail.trim() || step.detail, actions: actions.length ? actions : step.actions, resources: links.length ? links : step.resources, why: w.why.trim() ? [w.why, ...step.why] : step.why };
  });
  const phases = plan.phases.map((phase) => {
    const more = (roadmap.phases.find((x) => same(x.title, phase.title))?.more ?? []).filter((m) => m.title.trim() && !steps.some((s) => same(s.title, m.title))).slice(0, 4);
    // A recommendation the board also holds keeps its id, so it can be added with one press.
    return more.length ? { ...phase, more: more.map((m) => ({ id: phase.more?.find((own) => same(own.title, m.title))?.id ?? null, title: m.title, why: m.why })) } : phase;
  });
  const name = 'Grok';
  return { ...plan, steps, phases, summary: roadmap.summary.trim() || plan.summary, analysis: { ...plan.analysis, basis: `${name} wrote what to do for each option you chose and what else to add, from your profile.`, sources: citations.filter(isLink) } };
}

/** A short, stable name for a request, to keep its answer under. */
export function requestKey(request: RoadmapRequest): string {
  const text = JSON.stringify(request);
  let a = 5381;
  let b = 52711;
  for (let i = 0; i < text.length; i += 1) {
    const c = text.charCodeAt(i);
    a = (a * 33) ^ c;
    b = (b * 33) ^ c;
  }
  return `${(a >>> 0).toString(36)}${(b >>> 0).toString(36)}`;
}

const slug = (text: string) => text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 48);
const KINDS: StepKind[] = ['learn', 'build', 'join', 'attend', 'apply'];
const SOURCES: StepSource[] = ['people', 'posting', 'gap', 'after'];
const isLink = (url: string) => /^https?:\/\//.test(url);

/**
 * The written roadmap as a Journey. `base` is the rule-built draft for the same goal; it gives
 * the things that are not the writer's to decide (the color, the mode, the linked posting).
 */
export function aiJourney(state: AppState, base: Journey, answer: AiAnswer, skip: string[] = []): Journey {
  const { roadmap, citations } = answer;
  const done = new Set(state.doneSteps);
  const have = new Set(roadmap.fit.met.map((s) => s.toLowerCase()));
  const posting = base.steps.find((s) => s.opportunity)?.opportunity ?? null;
  const prefix = `ai-${slug(base.goal)}`;
  const seen = new Set<string>();

  const groups = roadmap.phases.map((phase, p) => ({
    id: `${prefix}:phase-${p}`,
    title: phase.title,
    window: phase.window,
    steps: phase.steps.flatMap((step): Draft[] => {
      const id = `${prefix}:${slug(step.title)}`;
      if (!step.title.trim() || seen.has(id)) return [];
      seen.add(id);
      const source = SOURCES.includes(step.source) ? step.source : 'people';
      return [
        {
          id,
          kind: KINDS.includes(step.kind) ? step.kind : 'build',
          title: step.title,
          detail: step.detail,
          phaseId: `${prefix}:phase-${p}`,
          due: null,
          done: done.has(id),
          hours: Number.isFinite(step.hours) && step.hours > 0 ? step.hours : 1,
          source,
          strength: source === 'people' ? step.strength : null,
          skills: step.skills.map((label) => ({ label, core: source !== 'people', have: have.has(label.toLowerCase()) || done.has(id) })),
          resources: step.resources.filter((r) => r.label.trim() && isLink(r.url)),
          why: step.why.trim() ? [step.why] : [],
          evidence: null,
          opportunity: base.mode === 'job' && source !== 'people' ? posting : null,
        },
      ];
    }),
  }));

  const labels = [...new Set(groups.flatMap((g) => g.steps.flatMap((s) => s.skills.map((skill) => skill.label))))];
  const stories: Story[] = roadmap.howPeopleGotIn.map((story, i) => ({ id: `${prefix}:story-${i}`, outcome: story.outcome, year: '', timeline: story.timeline }));
  const sources = citations.filter(isLink);
  const name = 'Grok';
  const { score, met, missing } = roadmap.fit;
  // A path the writer names is linked to the app's own when it holds one, so it can be opened.
  const related = (roadmap.relatedPaths ?? []).slice(0, 5).map((r) => {
    const known = careerPaths.find((p) => p.title.toLowerCase() === r.title.trim().toLowerCase());
    return { id: known?.id ?? null, title: known?.title ?? r.title, why: r.why, match: known ? pathMatch(state, known.id) : null };
  });
  const journey = finish(
    base.mode,
    base.goal,
    roadmap.summary,
    groups,
    labels.map((label) => ({ label, core: missing.some((m) => m.toLowerCase() === label.toLowerCase()), have: have.has(label.toLowerCase()) })),
    {
      stages: [
        { label: base.mode === 'job' ? 'Read the posting and your profile' : 'Read your profile', result: `${met.length} shown, ${missing.length} still to come` },
        { label: 'Searched how people got in', result: sources.length ? `${sources.length} ${sources.length === 1 ? 'source' : 'sources'} read` : `${stories.length} ${stories.length === 1 ? 'path' : 'paths'} found` },
        { label: 'Compared them with you', result: `${Math.round(score)}% of what it asks for is on your profile` },
      ],
      fit: { score: Math.round(Math.max(0, Math.min(100, score))), met, missing },
      stories,
      basis: `Written by ${name} from your profile, ${base.mode === 'job' ? 'the posting' : 'your goal'} and what it found about how people got in.`,
      sources,
      process: base.mode === 'job' ? (roadmap.process ?? []).filter((p) => p.stage.trim() && p.detail.trim()).slice(0, 8) : [],
    },
    base.accent,
    skip,
  );
  return { ...(base.open ? asOptions(journey) : journey), related: base.mode === 'career' ? (related.length ? related : base.related) : [] };
}
