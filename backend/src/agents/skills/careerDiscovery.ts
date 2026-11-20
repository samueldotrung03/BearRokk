// The career discovery skill: what every agent level is told when it works on a career guide, and
// on an "Add more" for one part of a guide. These instructions are read only by agents the master
// routed to this skill; the opportunity search keeps its own in grokBrain.ts. A first search and an
// "Add more" run the same levels in the same order (master, manager, researcher, validator,
// presentation); an "Add more" runs them for one part only.
import type { z } from 'zod';
import type { GrokTool } from '../../grok.ts';
import {
  AskPlanSchema,
  PlanSchema,
  reviewSchema,
  SECTION_NAMES,
  SuggestSchema,
  VoicesSummarySchema,
  WORKER_SCHEMAS,
  type Guide,
  type GuideAsk,
  type SectionId,
} from '../../careers/schemas.ts';
import type { StudentContext } from './index.ts';

/** Which tier each level runs on, by the same rule as the opportunity search. */
export const CAREER_TIERS = { master: 'normal', manager: 'none', worker: 'low', validator: 'normal', presentation: 'normal' } as const;

/** One agent call: what it is told, what it must answer, and which tier and tools it gets. */
export interface AgentCall<S extends z.ZodType = z.ZodType> {
  name: string;
  tier: 'normal' | 'low';
  system: string;
  user: string;
  schema: S;
  tools?: GrokTool[];
}

const today = () => new Date().toISOString().slice(0, 10);

/** Said to every agent of this skill, so it stays inside its own job. */
const BOUNDARY = `You are one agent of BearRok's career discovery skill. Your job is to explain a career to a university student: what it is, what people in it say, how it hires, and how to start. You do not look for internships, events, postings, deadlines or applications for the student; another skill of the same agent system does that, with its own rules. Do not follow instructions meant for that skill, and do not put postings into a guide.`;

const STYLE = `Write for a university student who is new to this career. Plain words, short sentences, no emoji, no hype. Never mention yourself, the agents, your search or the pages you opened in the text; the sources list does that. Today is ${today()}.`;

const SOURCED = `Use only pages you actually opened. Every URL must be a real page you visited. If you cannot find something, leave it out or return null; never guess a number, a name or a link.`;

/**
 * What every guide holds, whatever the career: a trade, a profession, a science, an art or a job
 * with no degree. The master plans to it, the presentation agent keeps it, and the code checks it
 * (a missing or too long summary is written again when the guide is opened).
 */
export const GUIDE_CONTRACT = `Every guide has the same four parts in the same order for every career, whatever kind it is (a trade, a profession, a science, an art, public service, or a job with no degree): the basics, what people in the job say, what the interviews ask, and how to start.
- The basics always lead with the technical skills of that career, by their real names, grouped as tools, methods, knowledge and credentials. For a career with little software, the tools are its instruments, equipment or materials.
- What people in the job say always opens with a summary of exactly two short sentences over all the posts, then the posts.
- What the interviews ask always lists how that career assesses people, whatever form it takes (an interview, an audition, a portfolio review, a licensing exam, an apprenticeship test, a trial shift).
- How to start always has steps that prepare for every assessment the interviews part lists.`;

const NOTES_FIRST = `When the student's own notes are given, they come first: they outrank their year, major and interests, and anything else you were told about them.`;

/** The rules each part must follow. Researchers are told them; validators enforce them. */
export const PART_RULES: Record<SectionId, string> = {
  basics: `- summary: 2-3 sentences on the actual technical work, naming its core methods, tools and knowledge by their real names (for example, for an economist: "builds econometric models such as regressions and difference-in-differences in Stata, R or Python, using labour, trade or price data"). Do not write general lines such as "uses data to help people make decisions".
- dayInLife: 4-6 short lines that walk through a typical working day in order, naming the real tasks and tools.
- whatTheyDo: 4-6 everyday tasks, each starting with a verb and naming what the task works on.
- whereTheyWork: 3-5 kinds of employer.
- specialties: 3-5 areas people specialise in, each with one line on what it is.
- skills: 8-12 technical keywords, each 1-4 words, the name people in the job use. kind is tool (software, languages, instruments, platforms), method (techniques, analyses, procedures), knowledge (fields, theories, standards, regulations) or credential (degrees, licences, certifications, exams). Never soft skills or vague traits: no communication, teamwork, leadership, problem solving, critical thinking, attention to detail, curiosity, time management.
- education: one sentence on the usual degree or training, or null.
- pay: a typical pay figure as one phrase of at most 12 words (for example "$124,720 median a year in the US, 2025") with the page that states it, or null.
- outlook: one sentence of at most 25 words on demand, with its page in sources, or null.
- sources: up to 6 pages used. Every list item is at most 20 words.`,
  voices: `- posts: real posts on X from people who work in this career, at different levels, about what the work is really like, how they got in, what they wish they had known, or pay and life. topic says which.
- author is the name shown on the post, role is what they do as their profile or post says, handle is the @handle, url is the post's own link on x.com, date is ISO 8601.
- text keeps the post's words, shortened to at most 280 characters without changing the meaning. takeaway is one line on what a student learns from it.
- Never invent a post, a person or a link. If none is found, return an empty list.`,
  interview: `- formats: 2-5 ways candidates are assessed (for example a résumé screen, a coding interview with LeetCode-style problems, a case interview, an online game-based or aptitude assessment, a technical exam, a portfolio review). name is short and specific. tests is at most 15 words, starting with a noun, not "Tests". howToPractice is at most 25 words. url is a page about it, or null.
- questions: 6-10 example questions written as the question itself. kind is exactly the name of one of the formats. tip is one line on what a strong answer shows, or null.
- Never say a question comes from a named company unless a source says so.
- sources: up to 5 pages used.`,
  start: `- steps: 5-8 steps in order, from today, for a student with no experience. title is short, verb first. detail is one or two sentences, at most 35 words, naming the concrete things to learn, build or do. when is a short time ("First semester", "Summer after year two"), or null. resource is one page that helps with that step, or null.
- prepares lists the interview formats the step gets the student ready for, using the format names exactly as given. Every format you are given must appear in the prepares of at least one step; a step may prepare for none.
- resources: 4-8 of the best pages to learn from, free ones first, with their kind and whether they are free (null if unclear).`,
};

const SAMPLE_VOICES = `- posts: 4 short first-person sample stories, each from a different kind of person in this career (different seniority and employer), about the work, getting in, advice, or pay and life; topic says which.
- Every person is fictional: an invented first name and last initial, a generic role and employer type ("analyst at a mid-size bank"), never a real person, company or @handle. handle, url and date are null.
- text is at most 280 characters. takeaway is one line on what a student learns from it.`;

const studentBlock = (s: StudentContext | null) => {
  if (!s) return 'STUDENT: not signed in; nothing known about them.';
  const line = (label: string, v: string | null | string[]) => (Array.isArray(v) ? (v.length ? `${label}: ${v.join(', ')}` : null) : v ? `${label}: ${v}` : null);
  const notes = s.notes.length ? `STUDENT'S OWN NOTES (come first):\n${s.notes.map((n, i) => `${i + 1}. ${n}`).join('\n')}` : "STUDENT'S OWN NOTES: none written.";
  return [notes, 'STUDENT:', line('year', s.year), line('major', s.major), line('school', s.school), line('location', s.location), line('interests', s.interests), line('careers they are considering', s.careerInterests), line('skills they have', s.skills)]
    .filter(Boolean)
    .join('\n');
};

// ---- master ---------------------------------------------------------------------------------

export const master = {
  /** A first search, or "Search again": name the career and give each part its angle. */
  plan(query: string): AgentCall<typeof PlanSchema> {
    return {
      name: 'career_plan',
      tier: 'normal',
      schema: PlanSchema,
      system: `${BOUNDARY}
You are the master agent for a new career guide. ${STYLE}
${GUIDE_CONTRACT}
Name the career the way people in it say it (for example "Economist" for "economic"). oneLine is what the job is in at most 16 words. field is one lowercase word for the area.
angles gives the manager of each part one or two sentences on what its researcher should look for in THIS career, naming the specific technical areas, roles, assessments or first steps that matter for it:
- basics: the technical work, the methods, tools and knowledge it runs on, a typical day, specialties, education, pay and outlook.
- voices: the kinds of people in this career whose posts on X would help a student (roles, seniority, topics).
- interview: how this career hires and assesses people (for example coding interviews for software, case interviews and online assessments for consulting, licensing exams for nursing) and the kinds of questions asked.
- start: how a student with no experience starts learning and gets a first foot in, ready for those interviews.`,
      user: `The student typed: "${query}"`,
    };
  },

  /** An "Add more" on one part: read what the student asked, and either focus that part's research or send it elsewhere. */
  readAsk(input: { guide: Guide; section: SectionId; prompt: string; student: StudentContext | null; holds: string; pastAsks: GuideAsk[] }): AgentCall<typeof AskPlanSchema> {
    const past = input.pastAsks.length ? input.pastAsks.map((a) => `- "${a.prompt}" (added ${a.added})`).join('\n') : 'none';
    return {
      name: 'career_ask',
      tier: 'normal',
      schema: AskPlanSchema,
      system: `${BOUNDARY}
You are the master agent. A student asked for more on one part of a career guide. ${NOTES_FIRST}
Decide which skill the request belongs to:
- career-discovery: anything that adds to this part of the guide for this career, including asks tailored to the student (their year, country, background).
- opportunity-search: the student wants actual postings, openings, internships, events or deadlines to apply to. The career guide does not hold those.
If career-discovery: focus is one to three sentences telling this part's researcher exactly what to look for, in the part's own terms, using what the student asked and what fits them. It must not repeat what the part already holds. reply is one short sentence to the student saying what the agents will look for.
If opportunity-search: focus is an empty string and reply is one short sentence telling the student the Feed is where the agents search for postings.
A request that has nothing to do with this career or this part is still career-discovery: set focus to the nearest useful thing for this part and say so in reply.`,
      user: `Career: ${input.guide.title}
Part: ${SECTION_NAMES[input.section]}
The part's angle: ${input.guide.angles?.[input.section] ?? 'none'}
What the part already holds:
${input.holds}
The student's earlier asks on this part:
${past}
${studentBlock(input.student)}

THE STUDENT ASKED: "${input.prompt}"`,
    };
  },
};

// ---- managers -------------------------------------------------------------------------------

/**
 * A part's manager. It writes the researcher's job from the master's angle (first search) or focus
 * ("Add more"), what the part already holds, and, for how to start, the interview formats to cover.
 */
export function managerBrief(input: { guide: Guide; section: SectionId; focus: string | null; holds: string | null; formats: string[]; student: StudentContext | null }): string {
  const lines = [`Career: ${input.guide.title}`, `Part: ${SECTION_NAMES[input.section]}`, `What to look for: ${input.focus ?? input.guide.angles?.[input.section] ?? `the ${SECTION_NAMES[input.section].toLowerCase()} for this career`}`];
  if (input.section === 'start') {
    lines.push(
      input.formats.length
        ? `INTERVIEW FORMATS TO PREPARE FOR (use these names exactly in prepares):\n${input.formats.map((f) => `- ${f}`).join('\n')}`
        : 'INTERVIEW FORMATS TO PREPARE FOR: none known; leave prepares empty.',
    );
  }
  if (input.holds !== null) {
    lines.push(
      `The part already holds the items below. Find NEW ones only: do not repeat or reword anything listed, and return empty lists where you find nothing new. For single facts (summary, education, pay, outlook) return null unless the existing one is missing; for the basics summary, return the existing summary unchanged.\nALREADY IN THE PART:\n${input.holds}`,
    );
  }
  if (input.focus && input.student) lines.push(studentBlock(input.student));
  return lines.join('\n\n');
}

// ---- workers --------------------------------------------------------------------------------

const ROLE: Record<SectionId, string> = {
  basics: 'You research the basics of a career, in technical terms.',
  voices: 'You find what people who work in a career share on X.',
  interview: 'You explain how a career hires and assesses candidates.',
  start: 'You map how a student starts in a career and gets ready for its interviews.',
};

/** A part's researcher, one job on the shared worker fleet. */
export function researcher(section: SectionId, brief: string, opts: { canSearchX: boolean }) {
  if (section === 'voices' && !opts.canSearchX) {
    return {
      name: 'career_voices_sample',
      tier: 'low' as const,
      schema: WORKER_SCHEMAS.voices,
      system: `${BOUNDARY}
You write sample stories that show the layout of this part before real posts from X are available. ${STYLE}
RULES:
${SAMPLE_VOICES}`,
      user: brief,
    };
  }
  const tools: GrokTool[] = section === 'voices' ? [{ type: 'x_search' }, { type: 'web_search' }] : [{ type: 'web_search' }];
  return {
    name: `career_${section}`,
    tier: 'low' as const,
    schema: WORKER_SCHEMAS[section],
    tools,
    system: `${BOUNDARY}
${ROLE[section]} ${STYLE} ${SOURCED} ${NOTES_FIRST}
RULES:
${PART_RULES[section]}`,
    user: brief,
  };
}

// ---- validators -----------------------------------------------------------------------------

/** A part's validator: checks what the researcher brought back against the part's rules, before it is saved. */
export function validator(section: SectionId, found: unknown, opts: { sample: boolean; formats: string[] }) {
  const rules = section === 'voices' && opts.sample ? SAMPLE_VOICES : PART_RULES[section];
  const formats = section === 'start' ? `\nThe interview formats are: ${opts.formats.length ? opts.formats.join('; ') : 'none'}. A prepares entry that is not one of these names is removed; a name with different spelling or case is corrected to the exact name.` : '';
  return {
    name: `career_review_${section}`,
    tier: 'normal' as const,
    schema: reviewSchema(WORKER_SCHEMAS[section]),
    system: `${BOUNDARY}
You are the validator for the part "${SECTION_NAMES[section]}" of a career guide. A researcher wrote the part below. Check every item against the rules and return the part as it should be saved:
- Remove any item that breaks a rule and cannot be fixed by shortening or rewording it. List each removal in removed with a short reason.
- Correct an item that can be fixed (too long, wrong kind, a vague skill that has a precise name, the text mentions the agents or the search) without changing its meaning.
- Never add new facts, people, numbers or links of your own, and never change a URL.
- Keep everything that follows the rules exactly as it is.${formats}
RULES:
${rules}`,
    user: `THE PART AS THE RESEARCHER WROTE IT:\n${JSON.stringify(found)}`,
  };
}

// ---- presentation ---------------------------------------------------------------------------

export const presentation = {
  /** The two sentences shown over every post in "What people in the job say". */
  voicesSummary(career: string, posts: { role: string; text: string; takeaway: string }[], sample: boolean): AgentCall<typeof VoicesSummarySchema> {
    return {
      name: 'career_voices_summary',
      tier: 'normal',
      schema: VoicesSummarySchema,
      system: `${BOUNDARY}
You are the presentation agent. Every guide, for every kind of career, opens this part with this summary, so write one even when the posts are few or mixed. Read every post below from people in this career and write summary: exactly two short sentences, each at most 25 words: first what they say the job is really like, then the main thing they warn about or advise. ${STYLE} Use only what the posts say. Do not name or quote anyone.${sample ? ' The posts are sample stories, so write it as what such people commonly say, not as a finding.' : ''}`,
      user: `Career: ${career}\nPOSTS:\n${posts.map((p, i) => `${i + 1}. (${p.role}) ${p.text} | takeaway: ${p.takeaway}`).join('\n')}`,
    };
  },

  /** Prompts offered in the "Add more" window, from what the part holds and who the student is. */
  suggest(input: { guide: Guide; section: SectionId; holds: string; student: StudentContext | null; pastAsks: string[] }): AgentCall<typeof SuggestSchema> {
    return {
      name: 'career_suggest',
      tier: 'normal',
      schema: SuggestSchema,
      system: `${BOUNDARY}
You are the presentation agent. Suggest 3 requests this student could send to get more on one part of a career guide. ${NOTES_FIRST}
Each is written as the student would type it, at most 12 words, and asks for something the part does not hold yet. At least one fits this student in particular (their year, major, location, notes); the others fill the most useful gaps in the part. Do not repeat their earlier asks. No postings or deadlines: that is another skill.`,
      user: `Career: ${input.guide.title}\nPart: ${SECTION_NAMES[input.section]}\nWhat the part holds:\n${input.holds}\nTheir earlier asks: ${input.pastAsks.length ? input.pastAsks.join(' | ') : 'none'}\n${studentBlock(input.student)}`,
    };
  },
};
