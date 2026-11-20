// Shared record shapes. The dashboard reads exactly these, for prepared and live results alike.
import { z } from 'zod';

export const OpportunityType = z.enum(['club', 'event']);
export type OpportunityType = z.infer<typeof OpportunityType>;

export const Format = z.enum(['online', 'in_person', 'hybrid']);
export type Format = z.infer<typeof Format>;

/** Where a result set came from. Prepared data is always labeled as such. */
export const Origin = z.enum(['prepared', 'live']);
export type Origin = z.infer<typeof Origin>;

/** Fields a claim of evidence can back. */
export const EvidenceField = z.enum([
  'title',
  'organizer',
  'format',
  'location',
  'meetingSchedule',
  'membershipIntake',
  'acceptingMembers',
  'startTime',
  'endTime',
  'registrationDeadline',
  'registrationOpen',
  'fit',
]);
export type EvidenceField = z.infer<typeof EvidenceField>;

export const Evidence = z.object({
  field: EvidenceField,
  /** Source text copied from the page, short. */
  quote: z.string(),
  /** Page the quote was read from. */
  url: z.string(),
});
export type Evidence = z.infer<typeof Evidence>;

/** What one search worker should look for. Requirements must hold; preferences only rank. */
export const WorkerBrief = z.object({
  type: OpportunityType,
  lookingFor: z.string(),
  requirements: z.array(z.string()),
  preferences: z.array(z.string()),
  format: Format.nullable(),
  location: z.string().nullable(),
});
export type WorkerBrief = z.infer<typeof WorkerBrief>;

export const Brief = z.object({
  interests: z.array(z.string()),
  /** ISO dates (YYYY-MM-DD), inclusive. Null when the student gave no time window. */
  dateFrom: z.string().nullable(),
  dateTo: z.string().nullable(),
  /** Optional context the student volunteered: campus, class year, student group. */
  context: z.array(z.string()),
  workers: z.array(WorkerBrief),
});
export type Brief = z.infer<typeof Brief>;

export const SearchStatus = z.enum([
  'scoping', // coordinator is reading the request
  'needs_follow_up', // waiting for the student to answer followUp.question
  'searching', // workers are looking for candidates
  'validating', // candidates are being checked against organizer pages
  'complete', // at least one validated result
  'empty', // ran fine, nothing passed validation
  'failed', // see error
]);
export type SearchStatus = z.infer<typeof SearchStatus>;

export const WorkerState = z.object({
  type: OpportunityType,
  status: z.enum(['pending', 'running', 'done', 'failed']),
  candidateCount: z.number(),
  error: z.string().nullable(),
});
export type WorkerState = z.infer<typeof WorkerState>;

export const Search = z.object({
  id: z.string(),
  /** The student's original wording, kept for review. */
  request: z.string(),
  status: SearchStatus,
  origin: Origin,
  /** Coordinator's one or two sentence restatement of the request. */
  summary: z.string().nullable(),
  followUp: z.object({ question: z.string(), answer: z.string().nullable() }).nullable(),
  brief: Brief.nullable(),
  workers: z.array(WorkerState),
  resultCount: z.number(),
  error: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
  /** Wall time of the search run in ms, set when it finishes. */
  durationMs: z.number().nullable(),
});
export type Search = z.infer<typeof Search>;

export const ClubDetails = z.object({
  meetingSchedule: z.string().nullable(),
  /** How a student joins: form, application, show up, etc. */
  membershipIntake: z.string().nullable(),
  acceptingMembers: z.boolean().nullable(),
});
export type ClubDetails = z.infer<typeof ClubDetails>;

export const EventDetails = z.object({
  /** ISO 8601. Date-only when the organizer gives no time. */
  startTime: z.string().nullable(),
  endTime: z.string().nullable(),
  /** IANA name or abbreviation as the organizer states it. */
  timeZone: z.string().nullable(),
  registrationDeadline: z.string().nullable(),
  registrationOpen: z.boolean().nullable(),
});
export type EventDetails = z.infer<typeof EventDetails>;

export const Unknown = z.object({ field: z.string(), label: z.string() });
export type Unknown = z.infer<typeof Unknown>;

export const Opportunity = z.object({
  id: z.string(),
  searchId: z.string(),
  type: OpportunityType,
  origin: Origin,
  title: z.string(),
  organizer: z.string().nullable(),
  /** Organizer or official listing page the details were checked against. */
  sourceUrl: z.string(),
  /** Where the student joins or registers, when known. */
  actionUrl: z.string().nullable(),
  format: Format.nullable(),
  location: z.string().nullable(),
  /** Why this matches the student's request. */
  fitExplanation: z.string(),
  lastCheckedAt: z.string(),
  /** Exactly one of these is set, matching `type`. */
  club: ClubDetails.nullable(),
  event: EventDetails.nullable(),
  evidence: z.array(Evidence),
  /** Fields the sources do not answer, with display text such as "Registration deadline unknown". */
  unknowns: z.array(Unknown),
  /** Conflicts or doubts to show the student. */
  uncertainties: z.array(z.string()),
  /** Other pages announcing the same opportunity, merged into this record. */
  alsoSeenAt: z.array(z.string()),
  linkCheck: z.enum(['ok', 'unreachable', 'blocked', 'skipped']),
});
export type Opportunity = z.infer<typeof Opportunity>;

/** Flat shape a search worker or the validator returns. One schema for both types keeps prompts simple. */
export const Candidate = z.object({
  type: OpportunityType,
  title: z.string(),
  organizer: z.string().nullable(),
  sourceUrl: z.string(),
  actionUrl: z.string().nullable(),
  format: Format.nullable(),
  location: z.string().nullable(),
  fitExplanation: z.string(),
  meetingSchedule: z.string().nullable(),
  membershipIntake: z.string().nullable(),
  acceptingMembers: z.boolean().nullable(),
  startTime: z.string().nullable(),
  endTime: z.string().nullable(),
  timeZone: z.string().nullable(),
  registrationDeadline: z.string().nullable(),
  registrationOpen: z.boolean().nullable(),
  evidence: z.array(Evidence),
  uncertainties: z.array(z.string()),
});
export type Candidate = z.infer<typeof Candidate>;
