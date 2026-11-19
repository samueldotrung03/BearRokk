// Live agents: every level is a Grok call with a JSON-schema answer. Scouts, extractors,
// application readers and validators get the web search tool.
// Not yet run against a real key; `npm run grok:check` tests the account first.
import { z } from 'zod';
import { config } from '../config.ts';
import { grokJson, type GrokTool } from '../grok.ts';
import type { Brain, MasterInput } from './brain.ts';
import { CATEGORY_LABEL, type Assignment, type Brief, type Candidate, type MemorySummary, type Opportunity, type ScoutSpec } from './types.ts';

/**
 * Which model each level runs on. The master, managers, validators and presentation manager
 * run on the normal tier. Workers are many and each does one small job, so they get the cheapest.
 * The high tier (XAI_MODEL_HIGH) is configured but not assigned to any level at the moment.
 */
const TIER: { high?: string; normal?: string; low?: string } = config.grokTransport === 'cli' ? config.grokCli.models : config.xaiModels;
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
  startTime: z.string().nullable(),
  image: z.string().nullable(),
  evidence: z.array(z.object({ field: z.string(), quote: z.string(), url: z.string() })),
});

const EVIDENCE = `Rules: every fact needs an evidence entry with a short quote copied from the page and that page's URL. If the page does not state something, return null. Never guess a deadline or date. Dates are ISO 8601. sourceUrl is the organizer's own page; actionUrl is where the student applies or registers. field is one lowercase word for the area (software, data, ai, design, security, hardware, bio, finance, product). tags are at most four short labels.`;

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
      user: `Today is ${today()}.\n${notesBlock(notes)}\nProfile (preferences.fields are ticked fields; preferences.checks, preferences.answers and preferences.lists hold the restrictions and the other answers, lists being entries with several values such as cities or companies to skip): ${JSON.stringify(input.profile)}\nMemory: ${JSON.stringify(input.memory)}\nManager slots: ${JSON.stringify(input.assignments.map((a) => ({ managerId: a.managerId, category: a.category })))}`,
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

  async planJobs(assignment: Assignment, brief: Brief): Promise<ScoutSpec[]> {
    const Out = z.object({ jobs: z.array(z.object({ label: z.string(), query: z.string(), lensValue: z.string() })) });
    const { data } = await grokJson({
      name: 'search_manager',
      model: TIER.normal,
      schema: Out,
      system: `You are a search manager for ${CATEGORY_LABEL[assignment.category].toLowerCase()}. Turn your assignment into at most 3 search jobs for scout workers. Each job has a short label, a web search query a scout should run, and the focus value it covers. Favor employer and organizer pages and public listings; avoid sites that need a login. Do not cover what the other managers cover.\n\n${NOTES_RULE}`,
      user: `Today is ${today()}.\n${notesBlock(brief.notes)}\nStudent brief: ${JSON.stringify(brief)}\nYour assignment: lens ${assignment.lens}, focus ${assignment.focus.join(', ')}\nOther managers: ${assignment.others.join('; ') || 'none'}`,
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
      system: `You are an extractor worker. Open the lead. If it is a repost, follow it to the organizer's own page. Read the details off that page. Set found to false if the page cannot be opened or is not a real posting.\n${EVIDENCE}`,
      user: `Today is ${today()}.\nCategory: ${assignment.category}\nLead: ${lead.title}\nURL: ${lead.url}`,
    });
    return data.found ? data.record : null;
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

  async validate(candidate: Candidate, brief: Brief, memory: MemorySummary) {
    const Out = z.object({ keep: z.boolean(), reason: z.string(), fit: z.number(), record: CandidateSchema });
    const { data } = await grokJson({
      name: 'validator',
      model: TIER.normal,
      schema: Out,
      tools: tools(),
      system: `You are a validation agent. Check one posting before a student sees it. Open the organizer's page and confirm: (1) every hard criterion holds, (2) it is the kind of thing this student is looking for and not just a keyword match, (3) it is real and still open. Correct any field the page contradicts. Set keep to false if any check fails and give the reason in one sentence. fit is 0 to 1: how well it matches the student's interests and preferences.\n\n${NOTES_RULE}\nCheck the notes before the other criteria. Reject anything a note rules out, and give a high fit to something a note asks for.\n${EVIDENCE}`,
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
