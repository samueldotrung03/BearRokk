// Turns one student sentence into independent searches. A constraint stays with the
// opportunity it was said about: "online" on a hackathon does not make the club remote.
import { clauses, dateWindow, formatOf, locationOf } from '../coordinator.ts';
import { CATEGORY_OF, type Format, type OppType, type StoredRequest, type TypeConstraint } from './types.ts';

const TYPES: { type: OppType; re: RegExp }[] = [
  { type: 'hackathon', re: /\bhackathons?\b/i },
  { type: 'internship', re: /\binternships?\b|\bintern\b/i },
  { type: 'scholarship', re: /\bscholarships?\b/i },
  { type: 'research', re: /\bresearch\b/i },
  { type: 'club', re: /\b(clubs?|societ(?:y|ies)|student (?:org|organization|group)s?)\b/i },
  { type: 'event', re: /\b(events?|workshops?|meetups?|conferences?|competitions?|fairs?)\b/i },
];

const PREFERENCES: [RegExp, string][] = [
  [/\bbeginner([- ]friendly)?\b|\bno experience\b|\bnew to\b/i, 'beginner-friendly'],
  [/\bfree\b/i, 'free to join or attend'],
  [/\bpaid\b/i, 'paid'],
  [/\bsmall\b/i, 'small group'],
];

const INTERESTS: [RegExp, string][] = [
  [/\b(cod(?:e|ing)|programming|software)\b/i, 'coding'],
  [/\b(ai|machine learning)\b/i, 'AI'],
  [/\bdata\b/i, 'data'],
  [/\brobot(?:ics|s)?\b/i, 'robotics'],
  [/\b(design|ux)\b/i, 'design'],
  [/\bsecurity\b/i, 'security'],
];

const SKIP = /\b(either|any|both|no preference|don'?t (mind|care)|whatever)\b/i;

function typesIn(text: string): OppType[] {
  return TYPES.filter((entry) => entry.re.test(text)).map((entry) => entry.type);
}

function labels(table: [RegExp, string][], text: string): string[] {
  return table.filter(([re]) => re.test(text)).map(([, label]) => label);
}

function constraintFor(type: OppType, text: string, today: Date): TypeConstraint {
  const format = formatOf(text);
  const location = locationOf(text);
  const window = type === 'club' ? null : dateWindow(text, today);
  const requirements: string[] = [];
  if (format === 'online') requirements.push('takes place online');
  if (format === 'in_person') requirements.push('meets in person');
  if (location) requirements.push(`located in or near ${location}`);
  if (window) requirements.push(`happens between ${window.from} and ${window.to}`);
  return {
    types: [type],
    format,
    location,
    requirements,
    preferences: [...labels(PREFERENCES, text), ...labels(INTERESTS, text)],
    dateFrom: window?.from ?? null,
    dateTo: window?.to ?? null,
  };
}

function openConstraint(constraints: TypeConstraint[]): TypeConstraint | undefined {
  return constraints.find((c) => !c.format && !c.location);
}

/** Ask only when one part named online or a place and another part named neither. */
function followUpFor(constraints: TypeConstraint[]): string | null {
  const open = openConstraint(constraints);
  const settled = constraints.find((c) => c.format === 'online' || c.location);
  if (!open || !settled || open === settled) return null;
  const kind = open.types[0] === 'club' ? 'club meet' : open.types[0] === 'hackathon' ? 'hackathon be' : `${open.types[0]} be`;
  return `Should the ${kind} online too, or do you want one near you?`;
}

function applyAnswer(constraints: TypeConstraint[], answer: string) {
  const open = openConstraint(constraints);
  if (!open || SKIP.test(answer)) return;
  const location = locationOf(answer);
  const format = formatOf(answer);
  if (location) {
    open.location = location;
    open.format = format ?? 'in_person';
    open.requirements.push(`located in or near ${location}`);
    if (open.format === 'in_person') open.requirements.push('meets in person');
  } else if (format) {
    open.format = format;
    open.requirements.push(format === 'online' ? 'takes place online' : 'meets in person');
  }
}

function summaryOf(constraints: TypeConstraint[]): string {
  const parts = constraints.map((c) => {
    const kind = c.types[0];
    const bits = [c.format === 'online' ? 'an online' : c.format === 'in_person' ? 'an in-person' : 'a', kind];
    if (c.preferences.length) bits.push(`(${c.preferences.join(', ')})`);
    if (c.location) bits.push(`near ${c.location}`);
    if (c.dateFrom && c.dateTo) bits.push(`between ${c.dateFrom} and ${c.dateTo}`);
    return bits.join(' ');
  });
  return `You are looking for ${parts.join(', and ')}.`;
}

/**
 * Split a request into one constraint per opportunity type. `answer` is the reply to a follow-up;
 * an empty answer means the student skipped the question and the search should go ahead.
 */
export function scopeStudentRequest(text: string, today: Date, answer?: string | null): StoredRequest {
  const perType = new Map<OppType, string[]>();
  for (const clause of clauses(text)) {
    for (const type of typesIn(clause)) {
      perType.set(type, [...(perType.get(type) ?? []), clause]);
    }
  }
  const constraints = [...perType].map(([type, parts]) => constraintFor(type, parts.join(' '), today));
  let followUp: string | null = null;
  if (constraints.length === 0) {
    followUp = 'What should I look for: a club, an event, a hackathon, or something else?';
  } else if (answer === undefined || answer === null) {
    followUp = followUpFor(constraints);
  } else if (answer.trim()) {
    applyAnswer(constraints, answer);
  }
  const categories = [...new Set(constraints.map((c) => CATEGORY_OF[c.types[0]!]))];
  return {
    text,
    summary: constraints.length ? summaryOf(constraints) : 'The request does not name an opportunity type yet.',
    followUp,
    constraints,
    categories,
  };
}

const BEGINNER = /beginner|first-year|no experience/i;

/** One or two sentences that name the preference and the listing fact behind it. */
export function explainFit(
  opportunity: { type: string; format: Format | null; location: string | null; tags: string[]; field: string | null },
  constraints: TypeConstraint[] | undefined,
): string | null {
  const rule = constraints?.find((c) => c.types.includes(opportunity.type as OppType));
  if (!rule) return null;
  const lines: string[] = [];
  if (rule.format === 'online' && (opportunity.format === 'online' || opportunity.format === 'hybrid')) {
    const where = opportunity.format === 'hybrid' ? 'as hybrid' : 'as fully online';
    lines.push(`You asked for remote ${opportunity.type}s, and the organizer lists this ${opportunity.type} ${where}`);
  }
  if (rule.location && opportunity.location?.toLowerCase().includes(rule.location.toLowerCase())) {
    lines.push(`You asked for a ${opportunity.type} near ${rule.location}, and the organizer lists it in ${opportunity.location}`);
  }
  if (rule.preferences.includes('beginner-friendly')) {
    const tag = opportunity.tags.find((t) => BEGINNER.test(t));
    if (tag) lines.push(`You asked for beginner-friendly, and the listing includes "${tag}"`);
  }
  if (rule.preferences.includes('coding') && opportunity.field === 'software') {
    lines.push('You asked for coding, and the listing is in software');
  }
  if (lines.length === 0) return null;
  return `${lines.join('. ')}.`;
}

/** Why a listing fails a constraint that applies to its type. Null when it passes or none applies. */
export function constraintRejection(
  opportunity: { type: string; format: Format | null; location: string | null; startTime: string | null },
  constraints: TypeConstraint[] | undefined,
): string | null {
  const rule = constraints?.find((c) => c.types.includes(opportunity.type as OppType));
  if (!rule) return null;
  if (rule.format === 'online' && opportunity.format === 'in_person') {
    return `In person${opportunity.location ? ` in ${opportunity.location}` : ''}, and this search asked for an online ${opportunity.type}`;
  }
  if (rule.format === 'in_person' && opportunity.format === 'online') {
    return `Online only, and this search asked for an in-person ${opportunity.type}`;
  }
  if (rule.location && opportunity.format === 'online' && rule.format !== 'online') {
    return `Online only, and this search asked for a ${opportunity.type} near ${rule.location}`;
  }
  if (rule.location && opportunity.location && !opportunity.location.toLowerCase().includes(rule.location.toLowerCase())) {
    return `Listed in ${opportunity.location}, and this search asked for near ${rule.location}`;
  }
  if (rule.location && !opportunity.location && opportunity.format !== 'online') {
    return `The listing does not say where it is, so it cannot be confirmed near ${rule.location}`;
  }
  if (rule.dateFrom && rule.dateTo && opportunity.startTime) {
    const day = opportunity.startTime.slice(0, 10);
    if (day < rule.dateFrom || day > rule.dateTo) return `Starts ${day}, outside ${rule.dateFrom} to ${rule.dateTo}`;
  }
  return null;
}
