// Live agents: every level is a Grok call with a JSON-schema answer. Scouts, extractors,
// application readers and validators get the web search tool.
// Not yet run against a real key; `npm run grok:check` tests the account first.
import { z } from 'zod';
import { config } from '../config.ts';
import { grokJson, type GrokTool } from '../grok.ts';
import type { Brain, MasterInput } from './brain.ts';
import { CATEGORY_LABEL, type ReviewFocus, type Assignment, type Brief, type Candidate, type FoundDeadline, type MemorySummary, type Opportunity, type ScoutSpec } from './types.ts';

/**
 * Which model each level runs on. The master, managers, validators and presentation manager
 * run on the normal tier. Workers are many and each does one small job, so they get the cheapest.
 * The high tier (XAI_MODEL_HIGH) is configured but not assigned to any level at the moment.
 */
const TIER: { high?: string; normal?: string; low?: string } =
  config.grokTransport === 'claude' ? config.claudeCli.models : config.grokTransport === 'cli' ? config.grokCli.models : config.xaiModels;
export const AGENT_TIERS = {
  master: 'normal',
  searchManager: 'normal',
  worker: 'low',
  validator: 'normal',
  presentationManager: 'normal',
} as const;

const tools = (): GrokTool[] => (config.xSearch ? [{ type: 'web_search' }, { type: 'x_search' }] : [{ type: 'web_search' }]);
const today = () => new Date().toISOString().slice(0, 10);

/** Said to every agent that sees the student's custom notes. */
const NOTES_RULE = `The student's custom notes are the highest priority. They wrote them in their own words and they override everything else: the ticked fields, the restrictions, the reaction history and any other line of the brief. If a note asks for something, look for it first. If a note rules something out, leave it out even if everything else fits.`;

const notesBlock = (notes: string[]) => (notes.length ? `STUDENT'S CUSTOM NOTES (highest priority):\n${notes.map((n, i) => `${i + 1}. ${n}`).join('\n')}` : "STUDENT'S CUSTOM NOTES: none written.");

const Year = z.enum(['Freshman', 'Sophomore', 'Junior', 'Senior']);
const CandidateSchema = z.object({
  type: z.enum(['internship', 'event', 'club', 'hackathon', 'research', 'scholarship']),
  title: z.string(),
  organizer: z.string(),
  sourceUrl: z.string(),
  actionUrl: z.string().nullable(),
  format: z.enum(['online', 'in_person', 'hybrid']).nullable(),
  location: z.string().nullable(),
  field: z.string().nullable(),
  tags: z.array(z.string()),
  eligibility: z.string().nullable(),
  eligibleYears: z.array(Year).nullable(),
  deadline: z.string().nullable(),
  deadlineSource: z.enum(['official', 'listing']).nullable(),
  startTime: z.string().nullable(),
  image: z.string().nullable(),
  evidence: z.array(z.object({ field: z.string(), quote: z.string(), url: z.string() })),
});

const EVIDENCE = `Rules: every fact needs an evidence entry with a short quote copied from the page and that page's URL. If the page does not state something, return null. Never guess a deadline or date. Dates are ISO 8601. sourceUrl is the organizer's own page; actionUrl is where the student applies or registers. field is one lowercase word for the area (software, data, ai, design, security, hardware, bio, finance, product). tags are at most four short labels.`;

/** Said to every agent that reads a posting: how to get the deadline right. */
const DEADLINE_RULE = `Getting the deadline right matters most, because the student plans around it.
- deadline is the last moment to apply, register or sign up. It is not the date the event or program starts (that is startTime), not the date the posting was published, and not a decision date.
- Look for it everywhere on the organizer's own site before giving up: the posting itself, the apply or register page it links to, the application form, an FAQ, a timeline or "important dates" section, and the program's main page. Words to look for: "apply by", "applications close", "due", "deadline", "closes", "register by", "priority deadline", "last day".
- It must be for the current cycle. A date from a past year, or one that has already passed while the page still says applications are open, is last cycle's: do not use it.
- With several dates (priority, regular, final), use the final one the student can still meet.
- "Rolling", "until filled" and "open until further notice" are not dates: return null.
- If the organizer's site states no deadline, search for other public postings of the same opportunity: job boards, internship and scholarship directories, hackathon and event listing sites, university career and department pages, and the organizer's own announcements. Use a deadline from one of them only when it is clearly the same opportunity and the same cycle, and prefer what two listings agree on. If listings disagree and the organizer's site does not settle it, use the earliest date that has not passed.
- Set deadlineSource to "official" when the organizer's own site states the deadline, "listing" when it came from another posting, and null when there is no deadline. The deadline's evidence entry must quote the words giving the date and carry the URL of the page they are on.
- A date without a time means the end of that day. Keep the time and the time zone exactly as the page states them, and write the offset that zone has on that date: Eastern is -05:00 in winter and -04:00 in summer, Central -06:00 and -05:00, Mountain -07:00 and -06:00, Pacific -08:00 and -07:00. With no zone on the page, use the organizer's local time. Check the finished date against the quote before answering.
- If no page states it, return null. Never work a deadline out from a start date or from last year's.`;

export class GrokBrain implements Brain {
  mode = 'live' as const;

  async master(input: MasterInput) {
    const notes = (input.profile.preferences?.notes ?? []).map((n) => (n.title ? `${n.title}: ${n.body}` : n.body));
    const Out = z.object({
      brief: z.object({
        goal: z.string(),
        hardCriteria: z.array(z.string()),
        preferences: z.array(z.string()),
        avoid: z.array(z.string()),
        interests: z.array(z.string()),
      }),
      managers: z.array(z.object({ managerId: z.string(), lens: z.enum(['all', 'field', 'employer', 'location', 'source']), focus: z.array(z.string()) })),
    });
    const { data } = await grokJson({
      name: 'master',
      model: TIER.normal,
      schema: Out,
      system: `You are the master agent of a system that finds opportunities for one student. You do not search. Read the student's profile and memory and write:
- brief: goal (one line), hardCriteria (conditions a result must meet: class year, location or remote, still open), preferences (rank by these), avoid (kinds of thing the student keeps disliking), interests (lowercase fields).
- managers: for each search manager slot you are given, choose a lens and 2 to 3 focus values. Managers that share a category must take different lenses (field, employer, location, source) so they do not repeat each other. A manager alone on its category uses the field lens.
Base everything on the notes, profile and memory. Do not invent constraints.

${NOTES_RULE}
Read the notes before the rest of the profile. Put what they ask for at the top of preferences, turn anything they rule out into avoid or hardCriteria, and give the managers lenses and focus values that go after what the notes describe.`,
      user: `Today is ${today()}.\n${notesBlock(notes)}\n${input.resumeText ? `Résumé text (background, not a wish list):\n"""${input.resumeText.slice(0, 6000)}"""\n` : ''}Profile (preferences.experience is what they have done so far; preferences.fields are ticked fields; preferences.checks, preferences.answers and preferences.lists hold the restrictions and the other answers, lists being entries with several values such as cities or companies to skip): ${JSON.stringify(input.profile)}\nMemory: ${JSON.stringify(input.memory)}\nSearches already run for this student (send the managers somewhere new, do not repeat these): ${input.pastSearches?.length ? input.pastSearches.slice(-30).join(' | ') : 'none yet'}\nManager slots: ${JSON.stringify(input.assignments.map((a) => ({ managerId: a.managerId, category: a.category })))}`,
    });
    // The notes travel in the brief word for word, so no later agent works from a summary of them.
    const brief: Brief = { ...data.brief, year: input.profile.year, location: input.profile.location, remoteOk: input.profile.remoteOk, notes };
    const assignments = input.assignments.map((a) => {
      const m = data.managers.find((x) => x.managerId === a.managerId);
      return { ...a, lens: m?.lens ?? 'field', focus: m?.focus.length ? m.focus : brief.interests.slice(0, 3) };
    });
    for (const a of assignments) {
      a.others = assignments.filter((x) => x.category === a.category && x.managerId !== a.managerId).map((x) => `${x.name}: ${x.lens} (${x.focus.join(', ')})`);
    }
    return { brief, assignments };
  }

  async planJobs(assignment: Assignment, brief: Brief, pastSearches: string[] = []): Promise<ScoutSpec[]> {
    const Out = z.object({ jobs: z.array(z.object({ label: z.string(), query: z.string(), lensValue: z.string() })) });
    const { data } = await grokJson({
      name: 'search_manager',
      model: TIER.normal,
      schema: Out,
      system: `You are a search manager for ${CATEGORY_LABEL[assignment.category].toLowerCase()}. Turn your assignment into at most 3 search jobs for scout workers. Each job has a short label, a web search query a scout should run, and the focus value it covers. Favor employer and organizer pages and public listings; avoid sites that need a login. Do not cover what the other managers cover.\n\n${NOTES_RULE}`,
      user: `Today is ${today()}.\n${notesBlock(brief.notes)}\nStudent brief: ${JSON.stringify(brief)}\nYour assignment: lens ${assignment.lens}, focus ${assignment.focus.join(', ')}\nOther managers: ${assignment.others.join('; ') || 'none'}\nSearches already run for this student in this category (write queries that differ from every one of these, with new organizations, wording or sources): ${pastSearches.length ? pastSearches.slice(-25).join(' | ') : 'none yet'}`,
    });
    return data.jobs.slice(0, 3);
  }

  async scout(spec: ScoutSpec, assignment: Assignment, brief: Brief, known: Set<string>) {
    const Out = z.object({ leads: z.array(z.object({ title: z.string(), url: z.string() })) });
    const { data } = await grokJson({
      name: 'scout',
      model: TIER.low,
      schema: Out,
      tools: tools(),
      system: `You are a scout worker. Search the web and return up to 4 leads: real, currently open ${CATEGORY_LABEL[assignment.category].toLowerCase()} that could meet the student's hard criteria. Return only a title and the URL of the posting. Prefer postings the student has not been shown.`,
      user: `Today is ${today()}.\nSearch: ${spec.query}\nHard criteria: ${brief.hardCriteria.join('; ')}\nAlready shown: ${[...known].slice(0, 30).join(', ') || 'nothing yet'}`,
    });
    return data.leads.slice(0, 4);
  }

  async extract(lead: { title: string; url: string }, assignment: Assignment): Promise<Candidate | null> {
    const Out = z.object({ found: z.boolean(), record: CandidateSchema });
    const { data } = await grokJson({
      name: 'extractor',
      model: TIER.low,
      schema: Out,
      tools: tools(),
      system: `You are an extractor worker. Open the lead. If it is a repost, follow it to the organizer's own page. Read the details off that page. Set found to false if the page cannot be opened or is not a real posting.\n${EVIDENCE}\n${DEADLINE_RULE}`,
      user: `Today is ${today()}.\nCategory: ${assignment.category}\nLead: ${lead.title}\nURL: ${lead.url}`,
    });
    return data.found ? data.record : null;
  }

  async findDeadline(candidate: Candidate): Promise<FoundDeadline | null> {
    const Out = z.object({ found: z.boolean(), deadline: z.string().nullable(), url: z.string().nullable(), quote: z.string().nullable() });
    const { data } = await grokJson({
      name: 'deadline_finder',
      model: TIER.low,
      schema: Out,
      tools: tools(),
      system: `You are a deadline finder. The organizer's own pages gave no application or registration deadline for this posting. Search the web for other public postings of the same opportunity and read the deadline off one of them: job boards, internship and scholarship directories, hackathon and event listing sites, university career and department pages, and the organizer's announcements or social posts. Run several searches with different wording (the title with "deadline", "apply by", the year) and open the pages; do not answer from search snippets alone. Check the organizer's apply page and FAQ once more as well.\nSet found to true only when a page states the deadline for this same opportunity in its current cycle. Then return the date in ISO 8601, the URL of the page that states it, and the words giving the date, copied from that page.\n${DEADLINE_RULE}`,
      user: `Today is ${today()}.\nPosting: ${candidate.title}\nOrganizer: ${candidate.organizer}\nType: ${candidate.type}\nOrganizer's page: ${candidate.sourceUrl}\nApply at: ${candidate.actionUrl ?? 'not known'}\nStarts: ${candidate.startTime ?? 'not known'}\nLocation: ${candidate.location ?? 'not known'}`,
    });
    if (!data.found || !data.deadline || !data.url || !data.quote) return null;
    return { deadline: data.deadline, url: data.url, quote: data.quote };
  }

  async illustrate(candidate: Candidate): Promise<string | null> {
    const Out = z.object({ svg: z.string() });
    const { data } = await grokJson({
      name: 'illustrator',
      model: TIER.low,
      schema: Out,
      system: `You draw a simple, attractive cover illustration as SVG for an opportunity card, used only when no photo of it exists. Rules: one <svg> element with viewBox="0 0 800 500" and no width or height; flat shapes, gradients and paths only; no text, letters, logos, people's faces, or brand marks; no <image>, <use>, <style>, <script>, links, external references or data URLs; under 7000 characters. Show the subject in an abstract way (for example a laptop and circuit lines for a coding hackathon, flasks for a lab, a stage for a conference) in a calm palette.`,
      user: `Type: ${candidate.type}\nField: ${candidate.field ?? 'not stated'}\nTitle: ${candidate.title}\nTags: ${candidate.tags.join(', ') || 'none'}`,
    });
    return data.svg;
  }

  async readApplication(candidate: Candidate) {
    const Out = z.object({ prompts: z.array(z.string()), materials: z.array(z.string()) });
    const { data } = await grokJson({
      name: 'application_reader',
      model: TIER.low,
      schema: Out,
      tools: tools(),
      system: 'You are an application reader. Open the application page and list the questions or essay prompts it asks, and the materials it requires (résumé, transcript, references). Copy prompts as written. Return empty lists if the page needs a login or shows none.',
      user: `Posting: ${candidate.title} at ${candidate.organizer}\nApply at: ${candidate.actionUrl ?? candidate.sourceUrl}`,
    });
    return data;
  }

  async validate(candidate: Candidate, brief: Brief, memory: MemorySummary, focus: ReviewFocus) {
    const Out = z.object({ keep: z.boolean(), reason: z.string(), fit: z.number(), record: CandidateSchema });
    // Two different agents review every posting. Each has one job, so neither can wave a posting through on the other's ground.
    const job =
      focus === 'status'
        ? `You are the STATUS reviewer. Another agent checks the student's criteria; your only question is whether this is real and open right now. Open the organizer's own page and confirm: the posting exists there, applications or registration are open today, and every date and deadline in the record is what the page says. Correct any field the page contradicts. Check the deadline yourself against the page it was read from; if the record has none, look for it as the deadline rules below describe and fill it in. Set keep to false if it is closed, past, cannot be found on an official page, or if you cannot tell whether it is still open; say which in one sentence.`
        : `You are the CRITERIA reviewer. Another agent checks whether the posting is real and open; your only question is whether it is right for this student. Check, in this order: the student's custom notes, then every hard criterion in the brief, then whether it is the kind of thing this student is looking for and not just a keyword match. Set keep to false if a note rules it out, if any hard criterion fails, or if the page does not let you confirm a hard criterion such as who may apply; say which in one sentence.`;
    const { data } = await grokJson({
      name: focus === 'status' ? 'status_reviewer' : 'criteria_reviewer',
      model: TIER.normal,
      schema: Out,
      tools: tools(),
      system: `${job}\nfit is 0 to 1: how well it matches the student's interests and preferences.\n\n${NOTES_RULE}\n${EVIDENCE}${focus === 'status' ? `\n${DEADLINE_RULE}` : '\nLeave deadline and deadlineSource as they are in the record; the other reviewer checks them.'}`,
      user: `Today is ${today()}.\n${notesBlock(brief.notes)}\nStudent brief: ${JSON.stringify(brief)}\nThe student keeps disliking: ${memory.avoidFields.join(', ') || 'nothing yet'}\nPosting: ${JSON.stringify(candidate)}`,
    });
    return { ...data, fit: Math.max(0, Math.min(1, data.fit)) };
  }

  async present(kept: Opportunity[], brief: Brief, memory: MemorySummary) {
    const out = new Map<string, string>();
    if (kept.length === 0) return out;
    const Out = z.object({ cards: z.array(z.object({ id: z.string(), reason: z.string() })) });
    const { data } = await grokJson({
      name: 'presentation_manager',
      model: TIER.normal,
      schema: Out,
      system: 'You are the presentation manager. For each opportunity write one sentence, addressed to the student, saying why it is in their feed. Refer to their interests, what they have liked, and who it is open to. Only state what the record supports. When an opportunity is something their custom notes asked for, say so first.',
      user: `${notesBlock(brief.notes)}\nBrief: ${JSON.stringify(brief)}\nLiked: ${memory.likes.map((l) => l.feature).join(', ') || 'nothing yet'}\nOpportunities: ${JSON.stringify(kept.map((o) => ({ id: o.id, title: o.title, organizer: o.organizer, field: o.field, tags: o.tags, eligibility: o.eligibility, format: o.format, location: o.location })))}`,
    });
    for (const c of data.cards) out.set(c.id, c.reason);
    return out;
  }
}
