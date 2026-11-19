// Shapes shared by the agent system, its API and the visualization.
// Opportunity fields follow dashboard/src/types.ts so the dashboard can read them directly.

export type Category = 'internship' | 'event' | 'club' | 'program';
export type OppType = 'internship' | 'event' | 'club' | 'hackathon' | 'research' | 'scholarship';
export type Format = 'online' | 'in_person' | 'hybrid';
export type ClassYear = 'Freshman' | 'Sophomore' | 'Junior' | 'Senior';
export type Origin = 'prepared' | 'live';

/** "freshmen", "sophomores", ... */
export const yearPlural = (y: ClassYear) => (y === 'Freshman' ? 'freshmen' : `${y.toLowerCase()}s`);

export const CATEGORIES: Category[] = ['internship', 'event', 'club', 'program'];

export const CATEGORY_OF: Record<OppType, Category> = {
  internship: 'internship',
  event: 'event',
  club: 'club',
  hackathon: 'program',
  research: 'program',
  scholarship: 'program',
};

export const CATEGORY_LABEL: Record<Category, string> = {
  internship: 'Internships',
  event: 'Events and networking',
  club: 'Clubs and communities',
  program: 'Programs',
};

export interface Profile {
  name: string;
  school: string;
  year: ClassYear;
  major: string;
  location: string;
  remoteOk: boolean;
  interests: string[];
  skills: string[];
  /** Kinds of opportunity the student wants searched. */
  categories: Category[];
  /** Career paths the student is considering, in their words. */
  careerInterests: string[];
  /** Kinds of event the student wants found, such as career fairs or hackathons. */
  eventTypes: string[];
  /** The profile page's three tabs: career interests, restrictions, and notes. */
  preferences: StudentPreferences | null;
}

export interface StudentPreferences {
  /** Fields the student ticked, including ones they added. */
  fields: string[];
  /** The one field that matters most to them. */
  topField: string | null;
  /** Typed answers by question id, such as rolesWanted, cities, minPay, lookingFor. */
  answers: Record<string, string>;
  /** Answers with several entries by question id, such as dreamCompanies, cities, skipIndustries. Non-empty entries in order. */
  lists: Record<string, string[]>;
  /** Ticked boxes by id, such as remote, paidOnly, onlyMyYear. */
  checks: Record<string, boolean>;
  /** Custom notes the student wrote. Read first; they override everything else. */
  notes: { title: string; body: string }[];
  /** What the student has done so far, from the Experience tab. */
  experience: StudentExperience;
}

export interface ExperienceEntry {
  /** Internship, Research, Project, and so on. Every part is optional and may be empty. */
  kind: string;
  role: string;
  organization: string;
  location: string;
  /** YYYY-MM, or empty. */
  start: string;
  end: string;
  current: boolean;
  summary: string;
  skills: string[];
  link: string;
}

export interface StudentExperience {
  linkedin: string;
  links: string[];
  entries: ExperienceEntry[];
}

export type Action = 'save' | 'like' | 'dislike' | 'open' | 'apply';

export interface Interaction {
  opportunityId: string;
  action: Action;
  at: string;
}

export interface Evidence {
  field: string;
  quote: string;
  url: string;
}

/** What an extractor returns for one posting. */
export interface Candidate {
  type: OppType;
  title: string;
  organizer: string;
  sourceUrl: string;
  actionUrl: string | null;
  format: Format | null;
  location: string | null;
  field: string | null;
  tags: string[];
  eligibility: string | null;
  eligibleYears: ClassYear[] | null;
  deadline: string | null;
  startTime: string | null;
  image: string | null;
  evidence: Evidence[];
}

export interface ApplicationInfo {
  prompts: string[];
  materials: string[];
}

export interface Unknown {
  field: string;
  label: string;
}

/** A validated record, as stored and as shown on a card. */
export interface Opportunity extends Candidate {
  id: string;
  origin: Origin;
  fitExplanation: string;
  unknowns: Unknown[];
  foundAt: string;
  lastCheckedAt: string;
  /** Validator's fit score before the student's history is applied, 0 to 1. */
  baseScore: number;
  /** Search manager whose workers found it. */
  foundBy: string;
  alsoSeenAt: string[];
  application: ApplicationInfo | null;
}

export interface Brief {
  goal: string;
  hardCriteria: string[];
  preferences: string[];
  avoid: string[];
  interests: string[];
  year: ClassYear;
  location: string;
  remoteOk: boolean;
  /**
   * The student's custom notes, word for word. Highest priority: every agent that sees the brief
   * follows a note over any other line in it.
   */
  notes: string[];
}

/** The angle a search manager covers its category from. */
export type Lens = 'all' | 'field' | 'employer' | 'location' | 'source';

export interface Assignment {
  managerId: string;
  name: string;
  category: Category;
  lens: Lens;
  focus: string[];
  /** Worker jobs this manager may use. */
  budget: number;
  /** What the other managers on the same category cover. */
  others: string[];
}

export type NodeStatus = 'idle' | 'running' | 'done' | 'failed';

export interface AgentNode {
  id: string;
  level: 'master' | 'manager' | 'presentation';
  name: string;
  role: string;
  status: NodeStatus;
  detail: string;
}

export type JobKind = 'scout' | 'extract' | 'application';

export interface Job {
  id: string;
  kind: JobKind;
  managerId: string;
  label: string;
  status: 'queued' | 'running' | 'done' | 'failed' | 'skipped';
  result: string | null;
  attempts: number;
}

export interface Validation {
  id: string;
  title: string;
  managerId: string;
  status: 'checking' | 'kept' | 'rejected';
  reason: string | null;
  fit: number | null;
}

export interface LogEvent {
  seq: number;
  at: string;
  agent: string;
  text: string;
  tone: 'info' | 'good' | 'bad';
}

export type Trigger = 'manual' | 'profile' | 'feedback' | 'schedule' | 'first';

export interface RunSnapshot {
  id: string;
  number: number;
  trigger: Trigger;
  mode: 'simulated' | 'live';
  status: 'running' | 'complete' | 'failed';
  startedAt: string;
  finishedAt: string | null;
  brief: Brief | null;
  agents: AgentNode[];
  assignments: Assignment[];
  jobs: Job[];
  validations: Validation[];
  log: LogEvent[];
  stats: { jobs: number; skipped: number; candidates: number; merged: number; kept: number; rejected: number; added: number };
  error: string | null;
}

export interface ScoreParts {
  apply: number;
  save: number;
  like: number;
  open: number;
  dislike: number;
}

export interface FeedEntry {
  opportunity: Opportunity;
  score: number;
  parts: ScoreParts;
  /** How much the student's history pulls this card up (positive) or down (negative), -1 to 1. */
  affinity: number;
  reason: string;
  /** True when the student's custom notes asked for this. */
  fromNotes: boolean;
  reaction: 'like' | 'dislike' | null;
  saved: boolean;
  isNew: boolean;
}

export interface MemorySummary {
  likes: { feature: string; weight: number }[];
  dislikes: { feature: string; weight: number }[];
  /** Fields the student has disliked often enough that the agents should stop searching for them. */
  avoidFields: string[];
  counts: Record<Action, number>;
  /** Share of search manager slots each category earned from engagement. */
  categoryWeights: Record<Category, number>;
}

export type ApplicationStatus = 'interested' | 'to_apply' | 'applying' | 'applied';
export const APPLICATION_STATUSES: ApplicationStatus[] = ['interested', 'to_apply', 'applying', 'applied'];

export interface Reminder {
  /** ISO time the student should be reminded. */
  at: string;
  label: string;
}

/** One opportunity the student is tracking, with everything needed to apply. */
export interface Application {
  opportunityId: string;
  title: string;
  organizer: string;
  status: ApplicationStatus;
  updatedAt: string;
  deadline: string | null;
  /** Where the student submits. */
  actionUrl: string | null;
  prompts: string[];
  materials: string[];
  /** The student's draft answers, by prompt text. */
  drafts: Record<string, string>;
  /** Set automatically while the status is to_apply or applying. Empty otherwise. */
  reminders: Reminder[];
  /** True when reminders are wanted but the posting gives no deadline to hang them on. */
  needsDeadline: boolean;
  calendar: {
    /** synced: the deadline is on the student's Google Calendar. link: only the add-to-calendar link is available. */
    state: 'none' | 'link' | 'synced';
    eventId: string | null;
    htmlLink: string | null;
    addUrl: string | null;
    error: string | null;
  };
}

/** Search job a manager hands to a scout. */
export interface ScoutSpec {
  label: string;
  query: string;
  lensValue: string;
}

export interface Lead {
  title: string;
  url: string;
}

export interface Verdict {
  keep: boolean;
  reason: string;
  fit: number;
  record: Candidate;
}
