// What every agent level has to be able to do. Two implementations: SimBrain (sample data, no
// network) and GrokBrain (live calls to Grok).
import type { CalendarEventInput, EventAsk, EventVerdict } from './eventSorter.ts';
import type { AgentGroup } from './types.ts';
import type { MemorySummary, Assignment, Brief, Candidate, ApplicationInfo, FoundDeadline, Lead, OppType, Profile, ReviewFocus, ScoutSpec, Verdict, Opportunity } from './types.ts';

export interface MasterInput {
  profile: Profile;
  memory: MemorySummary;
  /** Text read from the student's résumé, when they uploaded one that could be read. */
  resumeText: string | null;
  /** Slots already split over categories; the master fills in lens and focus. */
  assignments: Assignment[];
  /** Searches already run for this student, newest last, so new ones go somewhere else. */
  pastSearches?: string[];
}

/** What the application drafter is told about one application. */
export interface DraftInput {
  title: string;
  organizer: string;
  type: OppType | null;
  /** The organizer's page for the posting, null for an application the student made without one. */
  sourceUrl: string | null;
  /** Where the student applies. */
  actionUrl: string | null;
  /** What the posting says about itself (who can apply, field, tags), null when nothing is known. */
  summary: string | null;
  /** What the application reader already read off the application page, if it ran. */
  known: ApplicationInfo | null;
}

/** The application's real questions and uploads, as the organizer asks for them. */
export interface DraftedApplication {
  questions: { title: string; prompt: string; wordLimit: number | null }[];
  uploads: { title: string; prompt: string }[];
  /** False when the questions could not be found; nothing is made up in their place. */
  found: boolean;
  /** One or two plain sentences for the student on what was found, or why nothing was. */
  note: string;
}

export interface Brain {
  mode: 'simulated' | 'live';
  /** The student's model for each agent group. Live Grok agents use it; others ignore it. */
  setModels?(models: Partial<Record<AgentGroup, string>>): void;
  /** Master agent: read the student, write the brief, and give each search manager its slice. */
  master(input: MasterInput): Promise<{ brief: Brief; assignments: Assignment[] }>;
  /** Search manager: turn its assignment into search jobs for scouts. */
  /** `pastSearches` are queries already run for this student in this category; a new job should not repeat one. */
  planJobs(assignment: Assignment, brief: Brief, pastSearches?: string[]): Promise<ScoutSpec[]>;
  /** Scout worker: search and return leads. */
  scout(spec: ScoutSpec, assignment: Assignment, brief: Brief, known: Set<string>): Promise<Lead[]>;
  /** Extractor worker: open one lead and read the details off the official page. */
  extract(lead: Lead, assignment: Assignment): Promise<Candidate | null>;
  /** Application reader worker: pull the prompts and required materials. */
  readApplication(candidate: Candidate): Promise<ApplicationInfo>;
  /**
   * Deadline finder worker: for a posting whose own pages give no deadline, look for it on other
   * public postings of the same opportunity. Null when none states one for the current cycle.
   */
  findDeadline(candidate: Candidate): Promise<FoundDeadline | null>;
  /**
   * Draws an SVG illustration for a posting no real or stock picture could be found for.
   * Null when the agents cannot draw (the simulated agents never do).
   */
  illustrate(candidate: Candidate): Promise<string | null>;
  /** Sort the student's own calendar events into career-related and personal. */
  sortEvents(events: CalendarEventInput[]): Promise<EventVerdict[]>;
  /** Turn a sentence such as "interview with Stripe Friday at 2" into an event, or ask for what is missing. */
  draftEvent(text: string, today: string, timeZone: string): Promise<EventAsk>;
  /**
   * Validation agent: one review of one posting. `focus` says which review this is: "criteria"
   * (does it meet the student's rules and is it what they want?) or "status" (is it real and still open?).
   */
  validate(candidate: Candidate, brief: Brief, memory: MemorySummary, focus: ReviewFocus): Promise<Verdict>;
  /** Presentation manager: write the reason shown on each card. */
  present(kept: Opportunity[], brief: Brief, memory: MemorySummary): Promise<Map<string, string>>;
  /**
   * Application drafter: find the organizer's real application questions and required uploads,
   * for the student's application portal. Asked only when the student asks for it.
   */
  draftApplication?(input: DraftInput): Promise<DraftedApplication>;
}
