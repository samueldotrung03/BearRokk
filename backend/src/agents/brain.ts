// What every agent level has to be able to do. Two implementations: SimBrain (sample data, no
// network) and GrokBrain (live calls to Grok).
import type { MemorySummary, Assignment, Brief, Candidate, ApplicationInfo, Lead, Profile, ReviewFocus, ScoutSpec, Verdict, Opportunity } from './types.ts';

export interface MasterInput {
  profile: Profile;
  memory: MemorySummary;
  /** Text read from the student's résumé, when they uploaded one that could be read. */
  resumeText: string | null;
  /** Slots already split over categories; the master fills in lens and focus. */
  assignments: Assignment[];
}

export interface Brain {
  mode: 'simulated' | 'live';
  /** Master agent: read the student, write the brief, and give each search manager its slice. */
  master(input: MasterInput): Promise<{ brief: Brief; assignments: Assignment[] }>;
  /** Search manager: turn its assignment into search jobs for scouts. */
  planJobs(assignment: Assignment, brief: Brief): Promise<ScoutSpec[]>;
  /** Scout worker: search and return leads. */
  scout(spec: ScoutSpec, assignment: Assignment, brief: Brief, known: Set<string>): Promise<Lead[]>;
  /** Extractor worker: open one lead and read the details off the official page. */
  extract(lead: Lead, assignment: Assignment): Promise<Candidate | null>;
  /** Application reader worker: pull the prompts and required materials. */
  readApplication(candidate: Candidate): Promise<ApplicationInfo>;
  /**
   * Validation agent: one review of one posting. `focus` says which review this is: "criteria"
   * (does it meet the student's rules and is it what they want?) or "status" (is it real and still open?).
   */
  validate(candidate: Candidate, brief: Brief, memory: MemorySummary, focus: ReviewFocus): Promise<Verdict>;
  /** Presentation manager: write the reason shown on each card. */
  present(kept: Opportunity[], brief: Brief, memory: MemorySummary): Promise<Map<string, string>>;
}
