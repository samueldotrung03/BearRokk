// The coordinator turns the student's wording into a brief per search worker.
// It asks at most one follow-up, and only where the answer would change the search.
import { z } from 'zod';
import { grokJson } from './grok.ts';
import { Brief, type Format, type OpportunityType, type WorkerBrief } from './types.ts';

export const Scoping = z.object({
  /** Restatement of the request for the student to confirm. */
  summary: z.string(),
  /** Null when nothing is worth asking. */
  followUpQuestion: z.string().nullable(),
  brief: Brief,
});
export type Scoping = z.infer<typeof Scoping>;

export type ScopeInput = { request: string; followUp?: { question: string; answer: string } | null; today: Date };

const SYSTEM = `You coordinate a search for student opportunities. This version covers two types: "club" (a group a student joins) and "event" (something with a date: hackathon, workshop, meetup, competition).

Read the student's request and produce:
- summary: one or two plain sentences restating what they want, addressed to the student.
- brief: one worker entry per opportunity type they asked for. Never add a type they did not ask for.
  - lookingFor: a short search description for that worker.
  - requirements: conditions the student stated as necessary. Keep each one attached to the type it was said about. "an online hackathon" makes online a requirement of the event only.
  - preferences: nice-to-haves that should rank results, such as "beginner-friendly".
  - format: "online", "in_person" or "hybrid" only when the student said so for this type, otherwise null.
  - location: only when the student gave one for this type.
  - interests: topics across the whole request.
  - dateFrom/dateTo: ISO dates when the student gave a time window ("next month" becomes the first and last day of next month), otherwise null. The window applies to events.
  - context: campus, class year or student group, only if volunteered.
- followUpQuestion: ask ONE short question only if the answer would change what a worker searches for, for example a club with no stated format or location when the student said "online" about something else. If the request is clear enough to search, or a follow-up answer is already provided, return null.

Do not invent constraints. Do not ask about things that only affect ranking.`;

export async function scopeWithGrok(input: ScopeInput): Promise<Scoping> {
  const lines = [`Today is ${isoDate(input.today)}.`, `Student request: """${input.request}"""`];
  if (input.followUp) {
    lines.push(
      `You asked: "${input.followUp.question}"`,
      `The student answered: """${input.followUp.answer}"""`,
      'Fold the answer into the brief and return followUpQuestion as null.',
    );
  }
  const { data } = await grokJson({ name: 'scoping', system: SYSTEM, user: lines.join('\n'), schema: Scoping });
  if (input.followUp) data.followUpQuestion = null;
  return data;
}

// ---------------------------------------------------------------------------
// Rule-based scoping. Used for prepared runs, so the demo journey works without Grok.
// ---------------------------------------------------------------------------

const TYPE_WORDS: Record<OpportunityType, RegExp> = {
  club: /\b(clubs?|societ(y|ies)|student (org|organization|group)s?|chapters?)\b/i,
  event: /\b(events?|hackathons?|workshops?|meetups?|conferences?|competitions?|talks?|fairs?)\b/i,
};
const ONLINE = /\b(online|virtual(ly)?|remote(ly)?)\b/i;
const IN_PERSON = /\b(in[- ]person|on[- ]campus|near (me|campus|by)|nearby|local(ly)?)\b/i;
const PREFERENCES: [RegExp, string][] = [
  [/\bbeginner([- ]friendly)?\b|\bno experience\b|\bnew to\b/i, 'beginner-friendly'],
  [/\bfree\b/i, 'free to join or attend'],
  [/\bsmall\b/i, 'small group'],
];
const INTERESTS: [RegExp, string][] = [
  [/\b(cod(e|ing)|programming|software|developer)\b/i, 'coding'],
  [/\b(ai|machine learning|ml)\b/i, 'AI'],
  [/\b(data science|data)\b/i, 'data science'],
  [/\brobot(ics|s)?\b/i, 'robotics'],
  [/\b(design|ux|ui)\b/i, 'design'],
  [/\b(cyber ?security|security|ctf)\b/i, 'security'],
  [/\b(startup|entrepreneur(ship)?|business)\b/i, 'entrepreneurship'],
  [/\b(game dev(elopment)?|games?)\b/i, 'game development'],
  [/\bweb\b/i, 'web development'],
  [/\b(hardware|electronics)\b/i, 'hardware'],
];

function formatOf(text: string): Format | null {
  if (ONLINE.test(text)) return 'online';
  if (IN_PERSON.test(text)) return 'in_person';
  return null;
}

function locationOf(text: string): string | null {
  const m = text.match(/\b(?:in|near|around|at)\s+((?:[A-Z][\w.'-]*)(?:\s+[A-Z][\w.'-]*)*)/);
  return m ? m[1]! : null;
}

export function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function dateWindow(text: string, today: Date): { from: string; to: string } | null {
  const y = today.getUTCFullYear();
  const m = today.getUTCMonth();
  const range = (from: Date, to: Date) => ({ from: isoDate(from), to: isoDate(to) });
  if (/\bnext month\b/i.test(text)) return range(new Date(Date.UTC(y, m + 1, 1)), new Date(Date.UTC(y, m + 2, 0)));
  if (/\bthis month\b/i.test(text)) return range(today, new Date(Date.UTC(y, m + 1, 0)));
  if (/\bnext week\b/i.test(text)) {
    const start = new Date(today.getTime() + (8 - (today.getUTCDay() || 7)) * 86_400_000);
    return range(start, new Date(start.getTime() + 6 * 86_400_000));
  }
  if (/\bthis (week|weekend)\b/i.test(text)) return range(today, new Date(today.getTime() + 7 * 86_400_000));
  return null;
}

function matches(text: string, table: [RegExp, string][]): string[] {
  return table.filter(([re]) => re.test(text)).map(([, label]) => label);
}

/** Splits "a coding club and an online hackathon" so each constraint stays with its own type. */
function clauses(request: string): string[] {
  return request
    .split(/\s*(?:,|;|\band\b|\bplus\b|\balso\b)\s*/i)
    .map((s) => s.trim())
    .filter(Boolean);
}

export function scopeWithRules(input: ScopeInput): Scoping {
  const { request, today } = input;
  const perType = new Map<OpportunityType, string[]>();
  for (const clause of clauses(request)) {
    for (const type of ['club', 'event'] as const) {
      if (TYPE_WORDS[type].test(clause)) perType.set(type, [...(perType.get(type) ?? []), clause]);
    }
  }
  // Nothing recognisable: search both types with the whole request.
  if (perType.size === 0) {
    perType.set('club', [request]);
    perType.set('event', [request]);
  }

  const window = dateWindow(request, today);
  const interests = matches(request, INTERESTS);

  const workers: WorkerBrief[] = [...perType].map(([type, parts]) => {
    const text = parts.join(' ');
    const format = formatOf(text);
    const location = locationOf(text);
    const requirements: string[] = [];
    if (format === 'online') requirements.push('takes place online');
    if (format === 'in_person') requirements.push('meets in person');
    if (location) requirements.push(`located in or near ${location}`);
    if (type === 'event' && window) requirements.push(`happens between ${window.from} and ${window.to}`);
    if (type === 'club') requirements.push('currently accepting new members');
    if (type === 'event') requirements.push('registration is open');
    return { type, lookingFor: text, requirements, preferences: matches(text, PREFERENCES), format, location };
  });

  let followUpQuestion: string | null = null;
  if (input.followUp) {
    applyAnswer(workers, input.followUp.answer);
  } else {
    followUpQuestion = pickFollowUp(workers);
  }

  return {
    summary: summarize(workers, window),
    followUpQuestion,
    brief: { interests, dateFrom: window?.from ?? null, dateTo: window?.to ?? null, context: [], workers },
  };
}

/** Ask only when one type has a format and the other has neither format nor location. */
function pickFollowUp(workers: WorkerBrief[]): string | null {
  const open = workers.find((w) => !w.format && !w.location);
  const settled = workers.find((w) => w.format === 'online');
  if (!open || !settled || open === settled) return null;
  return `Should the ${open.type} also ${open.type === 'club' ? 'meet' : 'be'} online, or do you want one near you?`;
}

function applyAnswer(workers: WorkerBrief[], answer: string) {
  const open = workers.find((w) => !w.format && !w.location);
  if (!open) return;
  const location = locationOf(answer);
  const format = formatOf(answer);
  if (/\b(either|any|both|no preference|don'?t (mind|care))\b/i.test(answer)) return;
  if (location) {
    open.location = location;
    open.format = format ?? 'in_person';
    open.requirements.push(`located in or near ${location}`);
  } else if (format) {
    open.format = format;
    open.requirements.push(format === 'online' ? 'takes place online' : 'meets in person');
  }
}

function summarize(workers: WorkerBrief[], window: { from: string; to: string } | null): string {
  const parts = workers.map((w) => {
    const bits = [w.format === 'online' ? 'an online' : w.format === 'in_person' ? 'an in-person' : 'a', w.type];
    if (w.preferences.length) bits.push(`that is ${w.preferences.join(' and ')}`);
    if (w.location) bits.push(`near ${w.location}`);
    if (w.type === 'event' && window) bits.push(`between ${window.from} and ${window.to}`);
    return bits.join(' ');
  });
  return `You are looking for ${parts.join(', and ')}.`;
}
