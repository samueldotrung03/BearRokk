// One agent system, several skills. A skill is the full set of instructions for one kind of request,
// for every agent level that works on it: master, managers, workers, validators and presentation.
// The master looks at each request, picks the skill for it, and the agents working on that request
// read only that skill's instructions, so a career guide never picks up the rules for finding
// postings, and a search for postings never picks up the rules for writing a guide.
import type { SectionId } from '../../careers/schemas.ts';

export type SkillId = 'opportunity-search' | 'career-discovery';

/** What a skill covers, for the master and for anyone reading the code. */
export interface SkillCard {
  id: SkillId;
  name: string;
  handles: string;
  levels: { master: string; managers: string; workers: string; validators: string; presentation: string };
  /** Where each level's instructions are written. */
  instructions: string;
}

export const SKILLS: Record<SkillId, SkillCard> = {
  'opportunity-search': {
    id: 'opportunity-search',
    name: 'Opportunity search',
    handles: "Finding internships, events, clubs, hackathons, research and scholarships for one student's feed.",
    levels: {
      master: "Reads the student's profile, notes, résumé and memory; writes the brief and splits four search manager slots over the kinds of opportunity.",
      managers: 'Each turns its slice into search jobs for scouts.',
      workers: 'Scouts find leads; readers open each posting and read its facts with quotes; application readers and deadline finders fill in the rest.',
      validators: 'A criteria reviewer and a status reviewer check every posting; it is kept only if both keep it.',
      presentation: 'Writes the reason on each card.',
    },
    instructions: 'src/agents/grokBrain.ts (live) and src/agents/simBrain.ts (simulated)',
  },
  'career-discovery': {
    id: 'career-discovery',
    name: 'Career discovery',
    handles: 'Researching a four-part guide to any career a student types, and "Add more" requests on one part of a guide.',
    levels: {
      master: 'Names the career and gives each part an angle; for an "Add more", reads what the student asked and turns it into a focus for that one part, or says the request belongs to another skill.',
      managers: "One per part. Turns the master's angle or focus into the researcher's job: what to look for, what the part already holds, and for how to start, the interview formats it must prepare for.",
      workers: 'One researcher per part, on the shared worker fleet: basics, posts from people in the job, interviews, how to start.',
      validators: "One per part. Takes out or corrects any item that breaks the part's rules before it is saved.",
      presentation: 'Merges new items without repeats, writes the two-sentence summary over every post (for every guide: after the first search, after an "Add more" that adds posts, and for an older guide with none or a long one when it is opened), and links each interview format to the steps that prepare for it.',
    },
    instructions: 'src/agents/skills/careerDiscovery.ts',
  },
};

/** A request the agent system can be asked to work on. */
export type AgentRequest =
  | { kind: 'opportunity-run'; studentId: string; trigger: string }
  | { kind: 'career-guide'; career: string; refresh: boolean }
  | { kind: 'career-guide-part'; slug: string; section: SectionId | string; prompt: string; by: string; student: StudentContext | null };

/** What the career discovery agents may know about the student asking, to tailor an "Add more". */
export interface StudentContext {
  year: string | null;
  major: string | null;
  school: string | null;
  location: string | null;
  interests: string[];
  careerInterests: string[];
  skills: string[];
  /** The student's own notes. They come first, as they do for the opportunity search. */
  notes: string[];
}

/** The master's first decision on every request: which skill does it belong to. */
export function routeRequest(request: AgentRequest): SkillId {
  switch (request.kind) {
    case 'opportunity-run':
      return 'opportunity-search';
    case 'career-guide':
    case 'career-guide-part':
      return 'career-discovery';
  }
}

/** Runs a request with the skill the master picked for it. */
export interface SkillRunner<R> {
  skill: SkillId;
  handle(request: AgentRequest): R;
}

/**
 * The master's front door. Each skill registers the code that runs it; `handle` routes a request
 * to its skill and refuses one no registered skill can take.
 */
export class AgentMaster {
  private runners = new Map<SkillId, SkillRunner<unknown>>();

  register<R>(runner: SkillRunner<R>) {
    this.runners.set(runner.skill, runner as SkillRunner<unknown>);
    return this;
  }

  handle<R>(request: AgentRequest): R {
    const skill = routeRequest(request);
    const runner = this.runners.get(skill);
    if (!runner) throw new Error(`No agents are set up for ${SKILLS[skill].name.toLowerCase()} here.`);
    return runner.handle(request) as R;
  }
}
