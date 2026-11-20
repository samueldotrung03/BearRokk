// Discovery and validation calls to Grok. Each returns flat Candidate records with the source text behind every claim.
import { z } from 'zod';
import { config } from './config.ts';
import { isoDate } from './coordinator.ts';
import { grokJson, type GrokTool } from './grok.ts';
import { Candidate, type Brief, type WorkerBrief } from './types.ts';

const searchTools = (): GrokTool[] =>
  config.xSearch ? [{ type: 'web_search' }, { type: 'x_search' }] : [{ type: 'web_search' }];

const EVIDENCE_RULES = `Evidence rules:
- Every factual field you fill in needs an evidence entry: the field name, a short quote copied from the page, and the URL of that page.
- If a page does not state something, return null for that field. Never guess a date, deadline, schedule or link.
- An event's start time and its registration deadline are different facts. Do not copy one into the other.
- Write dates as ISO 8601 (2026-12-05 or 2026-12-05T18:00:00). Put the time zone the organizer states in timeZone.
- sourceUrl is the organizer's page or official listing. actionUrl is where the student joins or registers; null if you did not find one.
- uncertainties: one sentence each for anything conflicting or doubtful between sources.`;

const Discovery = z.object({ candidates: z.array(Candidate) });

function describe(worker: WorkerBrief, brief: Brief): string {
  return [
    `Type: ${worker.type}`,
    `Looking for: ${worker.lookingFor}`,
    `Requirements (must hold): ${worker.requirements.join('; ') || 'none stated'}`,
    `Preferences (rank by these): ${worker.preferences.join('; ') || 'none stated'}`,
    `Interests: ${brief.interests.join(', ') || 'not specified'}`,
    worker.type === 'event' && brief.dateFrom ? `Date window: ${brief.dateFrom} to ${brief.dateTo}` : null,
    worker.location ? `Location: ${worker.location}` : null,
    brief.context.length ? `Student context: ${brief.context.join('; ')}` : null,
  ]
    .filter(Boolean)
    .join('\n');
}

/** One search worker: find candidate clubs or events for its brief. */
export async function discover(worker: WorkerBrief, brief: Brief, today: Date): Promise<Candidate[]> {
  const where =
    worker.type === 'club'
      ? 'public school and club pages, student organization directories, club sites, Discord or community pages, and Reddit threads that point to them'
      : 'Luma, Devpost, MLH, organizer sites, school event pages, and Reddit or X posts that point to them';
  const system = `You are a search worker finding ${worker.type}s for a student. Search the web: ${where}.

Return up to ${config.maxResultsPerType + 2} candidates that satisfy every requirement. Prefer ones where you reached the organizer's own page. Skip anything that has already happened, has closed, or that you could not open.
Set type to "${worker.type}" on every candidate. For a ${worker.type === 'club' ? 'club, fill meetingSchedule, membershipIntake (how to join) and acceptingMembers; leave the event fields null' : 'event, fill startTime, endTime, timeZone, registrationDeadline and registrationOpen; leave the club fields null'}.
fitExplanation: one sentence on why this matches the student's request, mentioning the requirement or preference it meets.

${EVIDENCE_RULES}`;
  const { data } = await grokJson({
    name: 'discovery',
    system,
    user: `Today is ${isoDate(today)}.\n\n${describe(worker, brief)}`,
    schema: Discovery,
    tools: searchTools(),
  });
  return data.candidates.map((c) => ({ ...c, type: worker.type }));
}

const Verdict = z.object({
  /** False when the opportunity is closed, past, not real, or fails a requirement. */
  keep: z.boolean(),
  reason: z.string(),
  record: Candidate,
});

/** Follow a lead to the organizer page and re-check every displayed detail there. */
export async function verify(
  candidate: Candidate,
  worker: WorkerBrief,
  brief: Brief,
  today: Date,
): Promise<{ keep: boolean; reason: string; record: Candidate }> {
  const system = `You validate one ${candidate.type} lead before it is shown to a student. Open the organizer's page or official listing (start from the URLs given, follow links to the organizer if the lead is a repost) and check each detail against it.

- Confirm it is real and that ${candidate.type === 'club' ? 'the club is active and accepting members' : 'the event is upcoming and registration is open'}.
- Correct any field the organizer page contradicts. If sources disagree and you cannot settle it, keep the organizer's value and describe the conflict in uncertainties.
- Set keep to false if it is closed, already past, cannot be found, or breaks one of the student's requirements. Say why in reason.
- Return the corrected record with sourceUrl pointing at the organizer or official page.

${EVIDENCE_RULES}`;
  const { data } = await grokJson({
    name: 'verdict',
    system,
    user: `Today is ${isoDate(today)}.\n\nStudent brief:\n${describe(worker, brief)}\n\nLead to validate:\n${JSON.stringify(candidate, null, 2)}`,
    schema: Verdict,
    tools: searchTools(),
  });
  return { ...data, record: { ...data.record, type: candidate.type } };
}
