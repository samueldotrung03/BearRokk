// Shapes the dashboard renders. Fields shared with backend/src/types.ts keep the same names
// (sourceUrl, actionUrl, format, fitExplanation, lastCheckedAt, unknowns, origin) so a live
// adapter is a mapping, not a redesign. The wider type list follows the project README.

export type OpportunityType =
  | 'internship'
  | 'event'
  | 'club'
  | 'hackathon'
  | 'research'
  | 'scholarship';

export type Format = 'online' | 'in_person' | 'hybrid';
export type Origin = 'prepared' | 'live';

export interface Unknown {
  field: string;
  label: string;
}

export interface Opportunity {
  id: string;
  type: OpportunityType;
  origin: Origin;
  title: string;
  organizer: string;
  sourceUrl: string;
  actionUrl: string | null;
  format: Format | null;
  location: string | null;
  /** Why the agents recommended this to the student. */
  fitExplanation: string;
  /** ISO time. What it means depends on type: application deadline, or registration deadline. */
  deadline: string | null;
  /** ISO time an event, hackathon or first meeting starts. */
  startTime: string | null;
  /** Cover photo. In the live product this is the posting's own preview image. */
  image: string | null;
  /** Short looping clip the For you reel plays. The photo is its poster and its fallback. */
  video: string | null;
  /** Width divided by height the cover is shown at, so the grid has varied tile heights. */
  imageAspect: number;
  tags: string[];
  unknowns: Unknown[];
  foundAt: string;
  lastCheckedAt: string;
  /** Agent's fit score before the student's history is applied, 0 to 1. */
  baseScore: number;
}

export type StepKind = 'learn' | 'build' | 'join' | 'attend' | 'apply';

export interface RoadmapStep {
  id: string;
  kind: StepKind;
  title: string;
  detail: string;
  /** A feed opportunity this step can be acted on with today. */
  opportunityId: string | null;
  due: string | null;
}

/** One thing the goal asks for. It is met by a skill on the profile or by finishing a step. */
export interface Requirement {
  id: string;
  label: string;
  skill: string | null;
  stepId: string | null;
}

export interface RoadmapPhase {
  id: string;
  title: string;
  window: string;
  steps: RoadmapStep[];
}

export interface Roadmap {
  goalId: string;
  goal: string;
  summary: string;
  requirements: Requirement[];
  phases: RoadmapPhase[];
}

/**
 * What one person who reached the goal did on the way, as read from their public profile. No
 * name is kept: the roadmap needs the pattern across many people, not who any one of them is.
 */
export interface PathProfile {
  id: string;
  goalId: string;
  /** Where they ended up, in general terms. */
  outcome: string;
  /** Their class year when they got it. */
  year: ClassYear;
  /** The few things on the profile that came before the outcome, oldest first. */
  timeline: string[];
  /** Roadmap steps this person's history matches. */
  did: string[];
}

export type ApplicationStatus = 'interested' | 'to_apply' | 'applying' | 'applied';

/** What the agents read off an application page. Mirrors `ApplicationInfo` in the backend. */
export interface ApplicationInfo {
  prompts: string[];
  materials: string[];
  /** The questions sit behind a sign-in on the organizer's site, so the agents could not read them. */
  requiresLogin: boolean;
}

/** The student's own record for one opportunity they are pursuing. */
export interface Application {
  status: ApplicationStatus;
  /** Draft answers, keyed by the prompt's position. */
  drafts: Record<string, string>;
  materialsDone: string[];
}

export type MatchLevel = 'strong' | 'good' | 'explore';

export interface CareerPath {
  id: string;
  title: string;
  oneLine: string;
  match: MatchLevel;
  whyItFits: string;
  expects: string[];
  firstSteps: string[];
}

export type AgentStatus = 'running' | 'done' | 'idle';

export interface AgentNode {
  id: string;
  name: string;
  role: string;
  status: AgentStatus;
  detail: string;
}

export interface AgentEvent {
  id: string;
  at: string;
  agent: string;
  text: string;
}

export type ClassYear = 'Freshman' | 'Sophomore' | 'Junior' | 'Senior';

export interface Profile {
  /** First name, used in greetings. */
  name: string;
  fullName: string;
  major: string;
  about: string;
  school: string;
  year: ClassYear;
  location: string;
  interests: string[];
  skills: string[];
}
