// The application writing helper: "Outline my answer" and "Check my draft". Both are built here
// by rules from two sources only, the posting and the student's profile. The helper never writes
// an experience or an achievement for the student: anything personal is left as a [blank].
//
// The page talks to a `WritingAssistant`, not to these functions, so a real model call (Grok,
// with the same posting and profile) can replace `localAssistant` without touching the UI.
import { outlineTemplates, techTerms, vaguePhrases, type PromptKind } from '../../data/applications-extra.ts';
import type { Opportunity, Profile } from '../../types.ts';
import { countWords, findBlanks, findPhrase, keyStems, mentions, parseLimit, questionParts, type WordLimit } from './text.ts';

export interface WritingRequest {
  prompt: string;
  draft: string;
  opportunity: Opportunity;
  profile: Profile;
}

export interface Fact {
  label: string;
  value: string;
  source: 'profile' | 'posting';
}

export interface OutlineSection {
  heading: string;
  /** Advice to the student. May quote the profile or the posting. */
  guide: string;
  /** Draft text with [blanks]. States only facts from the profile or the posting. */
  starter: string;
  /** Rough share of the word limit, when the prompt states one. */
  words: number | null;
}

export interface Outline {
  kind: PromptKind;
  parts: string[];
  limit: WordLimit;
  sections: OutlineSection[];
  /** What the outline was built from, shown as chips the student can drop into the draft. */
  facts: Fact[];
}

export type Tone = 'good' | 'fix' | 'tip';

export interface Note {
  id: string;
  tone: Tone;
  title: string;
  detail: string;
  /** A span of the draft the note is about, so the page can select it. */
  target?: { start: number; end: number };
}

export interface Review {
  words: number;
  limit: WordLimit;
  /** 0 to 100: how close the draft is to ready, by these rules. */
  score: number;
  notes: Note[];
}

export interface WritingAssistant {
  outline(request: WritingRequest): Promise<Outline>;
  review(request: WritingRequest): Promise<Review>;
}

/** What kind of question a prompt is, which picks the outline's shape. */
export function classifyPrompt(prompt: string): PromptKind {
  const p = prompt.toLowerCase();
  if (/what does .* mean|first in your family|first-generation|background|identity/.test(p)) return 'identity';
  if (/which .*interests? you|most interest|favorite|favourite|you admire|you follow/.test(p)) return 'interest';
  if (/describe your experience|experience with|familiar with|about a time you|a problem you solved/.test(p)) return 'experience';
  if (/with other people|team|collaborat|group/.test(p)) return 'teamwork';
  if (/what did .* teach you|what did you learn|lesson|challenge you (faced|overcame)|changed how you/.test(p)) return 'reflection';
  if (/project|you built|you made|you shipped|you designed/.test(p)) return 'project';
  if (/how (would|will) .*(change|help|affect)|impact on|for other people/.test(p)) return 'impact';
  if (/what do you want to build|would you like to work on|what will you (build|make)|plan to build|you would (work on|report)|how would you (handle|approach)/.test(p)) return 'plan';
  if (/\bwhy\b/.test(p)) return 'motivation';
  return 'general';
}

const list = (items: string[], joiner = 'and') =>
  items.length <= 1 ? (items[0] ?? '') : `${items.slice(0, -1).join(', ')} ${joiner} ${items.at(-1)}`;

/** The goal a profile's "about" states, such as "a software engineering internship for summer 2027". */
export function goalFromAbout(about: string): string | null {
  const match = about.match(/\bwants? (?:to (?:get|land|find|join) )?(an? [^.]+|to [^.]+)/i);
  return match?.[1]?.trim() ?? null;
}

function postingText(o: Opportunity, prompt: string): string {
  return [o.title, o.organizer, o.tags.join(' '), o.fitExplanation, prompt].join(' ');
}

/** Profile skills the posting or the prompt also names. These are the ones worth leading with. */
export function matchedSkills(profile: Profile, o: Opportunity, prompt: string): string[] {
  const text = postingText(o, prompt);
  return profile.skills.filter((skill) => mentions(text, skill));
}

/** The topic a "Why do you want to work on X?" question is about. */
function topicOf(prompt: string, o: Opportunity): string | null {
  const match =
    prompt.match(/why (?:do|would) you want to (?:work on|work in|work with|join|study|do|be part of)\s+([^?.(]+)/i) ??
    prompt.match(/why are you (?:interested in|drawn to|excited about)\s+([^?.(]+)/i);
  return match?.[1]?.trim() ?? (o.tags[0] ? midSentence(o.tags[0]) : null);
}

/** Lowercases a label for use mid-sentence, but keeps acronyms such as "AI" or "SQL" intact. */
const midSentence = (label: string) => (/^[A-Z0-9+]{2,}\b/.test(label) ? label : label.charAt(0).toLowerCase() + label.slice(1));

// Course topics such as data structures are skills, but not something you "used" on a project.
const isTool = (skill: string) => !/structures|algorithms|theory/i.test(skill);

function tokensFor(request: WritingRequest): Record<string, string | null> {
  const { prompt, opportunity: o, profile } = request;
  const matched = matchedSkills(profile, o, prompt);
  const asked = techTerms.filter((term) => mentions(prompt, term));
  const askedHave = asked.filter((term) => profile.skills.some((s) => s.toLowerCase() === term.toLowerCase()));
  const askedMissing = asked.filter((term) => !askedHave.includes(term));
  const text = postingText(o, prompt).toLowerCase();
  // The interest sharing the most words with the posting, so "AI and machine learning" wins for an ML lab.
  const hits = (interest: string) => keyStems(interest).filter((stem) => text.includes(stem)).length;
  const interestMatch = [...profile.interests].sort((a, b) => hits(b) - hits(a))[0] ?? null;
  const goal = goalFromAbout(profile.about);
  const firstGen = /first[- ]generation/i.test(profile.about);

  return {
    organizer: o.organizer,
    title: o.title,
    // "Software Engineering Intern, Summer 2027" reads as a role without the term after the comma.
    role: o.title.split(',')[0]!.trim(),
    year: profile.year ? profile.year.toLowerCase() : null,
    major: profile.major || null,
    school: profile.school || null,
    about: profile.about || null,
    goal,
    skills: profile.skills.length ? list(profile.skills) : null,
    skillHint: (matched.filter(isTool).length ? matched : profile.skills).filter(isTool).slice(0, 2).join(' or ') || null,
    interests: profile.interests.length ? list(profile.interests) : null,
    interestMatch: interestMatch ? midSentence(interestMatch) : null,
    tags: o.tags.length ? list(o.tags) : null,
    firstTag: o.tags[0] ? midSentence(o.tags[0]) : null,
    topic: topicOf(prompt, o),
    asked: asked.length ? list(asked, 'and') : 'specific tools',
    askedHave: askedHave.length ? list(askedHave) : 'none of them yet, which is fine to say',
    askedHaveText: askedHave.length ? list(askedHave) : null,
    gapGuide: askedMissing.length
      ? `The question also asks about ${list(askedMissing, 'and')}, which your profile does not list. Say honestly what you have tried or are learning.`
      : 'If the question names something you have not used, say what you are doing to learn it. Honest beats inflated.',
    identityGuide: firstGen ? 'Your profile says you are a first-generation student.' : 'Start from your own words.',
  };
}

/** Fills {tokens}. A token with no value becomes a [blank] so nothing is guessed. */
function fill(template: string, tokens: Record<string, string | null>): string {
  return template.replace(/\{(\w+)\}/g, (_, key: string) => tokens[key] ?? `[${key.replace(/[A-Z]/g, (c) => ` ${c.toLowerCase()}`)}]`);
}

export function buildOutline(request: WritingRequest): Outline {
  const { prompt, opportunity: o, profile } = request;
  const kind = classifyPrompt(prompt);
  const limit = parseLimit(prompt);
  const tokens = tokensFor(request);
  const templates = outlineTemplates[kind];
  const totalWeight = templates.reduce((sum, t) => sum + t.weight, 0);
  // Aim a little under the limit so the finished answer has room to breathe.
  const target = limit.max ? Math.round(limit.max * 0.9) : null;
  const sections = templates.map((t) => ({
    heading: fill(t.heading, tokens),
    guide: fill(t.guide, tokens),
    starter: fill(t.starter, tokens),
    words: target ? Math.max(10, Math.round(((target * t.weight) / totalWeight) / 5) * 5) : null,
  }));

  const matched = matchedSkills(profile, o, prompt);
  const facts: Fact[] = [
    ...matched.map((skill) => ({ label: 'Skill on your profile and the posting', value: skill, source: 'profile' as const })),
    { label: 'Organizer', value: o.organizer, source: 'posting' as const },
    ...o.tags.slice(0, 3).map((tag) => ({ label: 'From the posting', value: tag, source: 'posting' as const })),
    ...(profile.major && profile.school
      ? [{ label: 'From your profile', value: `${profile.year.toLowerCase()} studying ${profile.major} at ${profile.school}`, source: 'profile' as const }]
      : []),
    ...(tokens.goal ? [{ label: 'Your goal', value: tokens.goal, source: 'profile' as const }] : []),
  ];

  return { kind, parts: questionParts(prompt), limit, sections, facts };
}

/** The outline as draft text, ready to drop into the answer box. */
export function outlineToDraft(outline: Outline): string {
  return outline.sections.map((s) => s.starter).join('\n\n');
}

const WHY_SIGNALS = /\b(because|so that|which is why|that is why|that's why|the reason|this matters|matters to me|drew me|draws me|excites me)\b/i;
const OWN_PART = /\b(my (part|role|job)|i (was responsible|owned|led|built|wrote|designed|made|set up|fixed|handled|took|implemented|created))\b/i;

/** Whether a draft answers one part of a prompt, judged by what that part asks for. */
export function answersPart(part: string, draft: string): boolean {
  if (/^why\??$/i.test(part.trim()) || /^why\b/i.test(part)) {
    if (WHY_SIGNALS.test(draft)) return true;
    if (/^why\??$/i.test(part.trim())) return false;
  }
  if (/your (part|role)/i.test(part)) return OWN_PART.test(draft);
  const stems = keyStems(part);
  if (stems.length === 0) return countWords(draft) > 0;
  const text = draft.toLowerCase();
  const hits = stems.filter((stem) => text.includes(stem)).length;
  return hits >= Math.min(2, stems.length) || hits / stems.length >= 0.4;
}

export function reviewDraft(request: WritingRequest): Review {
  const { prompt, draft, opportunity: o, profile } = request;
  const limit = parseLimit(prompt);
  const words = countWords(draft);
  const notes: Note[] = [];

  if (words === 0) {
    return {
      words,
      limit,
      score: 0,
      notes: [{ id: 'empty', tone: 'tip', title: 'Nothing to check yet', detail: 'Write a few lines, or start from an outline, and check again.' }],
    };
  }

  const blanks = findBlanks(draft);
  if (blanks.length > 0) {
    notes.push({
      id: 'blanks',
      tone: 'fix',
      title: `${blanks.length} ${blanks.length === 1 ? 'blank' : 'blanks'} still to fill`,
      detail: `Replace ${blanks
        .slice(0, 2)
        .map((b) => b.text)
        .join(' and ')}${blanks.length > 2 ? ' and the rest' : ''} with your own details.`,
      target: { start: blanks[0]!.start, end: blanks[0]!.end },
    });
  }

  if (limit.max) {
    if (words > limit.max) {
      notes.push({ id: 'length', tone: 'fix', title: `${words - limit.max} words over the limit`, detail: `The prompt allows ${limit.max}. Cut the sentence that repeats the question or restates a point.` });
    } else if (words < limit.max * 0.5) {
      notes.push({ id: 'length', tone: 'tip', title: `Room for about ${limit.max - words} more words`, detail: `You are at ${words} of ${limit.max}. Use the space for one specific example.` });
    } else {
      notes.push({ id: 'length', tone: 'good', title: `${words} of ${limit.max} words`, detail: 'A good length for this prompt.' });
    }
  } else if (words < 40 && !limit.optional) {
    notes.push({ id: 'length', tone: 'tip', title: 'Short for an open question', detail: `${words} words. Two or three sentences with one example usually reads better.` });
  }

  const parts = questionParts(prompt);
  const missed = parts.filter((part) => !answersPart(part, draft));
  if (parts.length > 0 && missed.length === 0) {
    notes.push({ id: 'parts', tone: 'good', title: parts.length > 1 ? `Answers all ${parts.length} parts of the question` : 'Answers the question', detail: parts.map((p) => `“${p}”`).join(' ') });
  }
  missed.forEach((part, index) =>
    notes.push({
      id: `part-${index}`,
      tone: 'fix',
      title: 'Not answered yet',
      detail: /your (part|role)/i.test(part)
        ? `“${part}” Say what you did yourself, with "I": "My part was…", "I built…".`
        : /^why\??$/i.test(part.trim())
          ? 'The question also asks why. Give your reason with "because…".'
          : `“${part}”`,
    }),
  );

  const kind = classifyPrompt(prompt);
  const iCount = (draft.match(/\bI\b/g) ?? []).length;
  const weCount = (draft.match(/\bwe\b/gi) ?? []).length;
  if (kind === 'teamwork' && weCount > 2 && weCount > iCount * 2) {
    notes.push({ id: 'we', tone: 'tip', title: `"We" ${weCount} times, "I" ${iCount}`, detail: 'Readers want your part. Turn a few "we" sentences into what you did.' });
  }

  const vague = vaguePhrases.flatMap(({ phrase, hint }) => findPhrase(draft, phrase).map((hit) => ({ phrase, hint, hit })));
  // "learned a lot" also contains "a lot"; keep the longer, more useful match.
  const kept = vague.filter((v) => !vague.some((w) => w !== v && w.hit.start <= v.hit.start && w.hit.end >= v.hit.end && w.phrase.length > v.phrase.length));
  kept
    .sort((a, b) => a.hit.start - b.hit.start)
    .slice(0, 3)
    .forEach((v, index) =>
      notes.push({ id: `vague-${index}`, tone: 'tip', title: `Vague: “${draft.slice(v.hit.start, v.hit.end)}”`, detail: v.hint, target: v.hit }),
    );
  if (kept.length > 3) {
    notes.push({ id: 'vague-more', tone: 'tip', title: `${kept.length - 3} more vague phrases`, detail: 'Fix the ones above first, then check again.' });
  }

  const draftWithoutBlanks = draft.replace(/\[[^\]\n]*\]/g, ' ');
  if (!/\d|\b(one|two|three|four|five|six|seven|eight|nine|ten|dozen|hundred|thousand)\b/i.test(draftWithoutBlanks) && kind !== 'identity' && kind !== 'reflection') {
    notes.push({ id: 'number', tone: 'tip', title: 'No numbers yet', detail: 'One number makes a claim concrete: team size, users, hours saved, a grade, a deadline met.' });
  }

  const tools = [...new Set([...profile.skills, ...o.tags, ...techTerms])];
  if ((kind === 'teamwork' || kind === 'project' || kind === 'experience' || kind === 'plan') && !tools.some((t) => mentions(draftWithoutBlanks, t))) {
    const hint = matchedSkills(profile, o, prompt)[0] ?? profile.skills[0];
    notes.push({ id: 'tool', tone: 'tip', title: 'Name a tool', detail: hint ? `Say what you used. ${hint} is on your profile and fits this posting, if you used it.` : 'Say what you used to build it.' });
  }

  if ((kind === 'motivation' || kind === 'general') && !mentions(draft, o.organizer) && !mentions(draft, o.organizer.split(' ')[0] ?? o.organizer)) {
    notes.push({ id: 'organizer', tone: 'tip', title: `Say why ${o.organizer}`, detail: `The answer could go to any company right now. Name one thing about ${o.organizer} or the posting.` });
  }

  const longest = draft
    .split(/(?<=[.!?])\s+/)
    .map((sentence) => countWords(sentence))
    .reduce((a, b) => Math.max(a, b), 0);
  if (longest > 40) {
    notes.push({ id: 'long-sentence', tone: 'tip', title: 'One very long sentence', detail: `${longest} words in one sentence. Split it so each idea lands.` });
  }

  const fixes = notes.filter((n) => n.tone === 'fix').length;
  const tips = notes.filter((n) => n.tone === 'tip').length;
  const lengthOk = !limit.max || (words <= limit.max && words >= limit.max * 0.5);
  const score = Math.max(5, Math.min(100, 100 - fixes * 22 - tips * 7 - (lengthOk ? 0 : 6)));

  // Fixes first: they decide whether the draft is ready; tips and praise follow.
  const order: Record<Tone, number> = { fix: 0, tip: 1, good: 2 };
  notes.sort((a, b) => order[a.tone] - order[b.tone]);
  return { words, limit, score, notes };
}

/** The rule-based helper the page uses until the agents are connected. */
export const localAssistant: WritingAssistant = {
  outline: async (request) => buildOutline(request),
  review: async (request) => reviewDraft(request),
};
