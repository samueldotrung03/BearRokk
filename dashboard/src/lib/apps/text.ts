// Small text rules shared by the writing helper and the readiness score: counting words,
// reading the word limit a prompt states, splitting a prompt into the parts it asks, and finding
// the [blanks] an outline leaves for the student.

/** Words as a reader would count them: runs of characters that contain a letter or digit. */
export function countWords(text: string): number {
  return text.split(/\s+/).filter((token) => /[\p{L}\p{N}]/u.test(token)).length;
}

export interface WordLimit {
  /** The most words the prompt allows, or null when it states no limit. */
  max: number | null;
  /** The prompt is marked optional, so it does not count against readiness. */
  optional: boolean;
}

/**
 * Reads the limit the organizer wrote, such as "(200 words)", "up to 300 words" or
 * "150 words max". Only a stated number counts; a prompt without one has no limit.
 */
export function parseLimit(prompt: string): WordLimit {
  const optional = /\(\s*optional\s*\)|\boptional\b/i.test(prompt);
  const match =
    prompt.match(/\(\s*(?:up to|max(?:imum)?|no more than)?\s*(\d{2,4})\s*words?(?:\s*max(?:imum)?)?\s*\)/i) ??
    prompt.match(/\b(?:up to|in|max(?:imum)? of|no more than|under)\s+(\d{2,4})\s*words?\b/i) ??
    prompt.match(/\b(\d{2,4})\s*words?\s*(?:max(?:imum)?|or (?:less|fewer))\b/i);
  return { max: match ? Number(match[1]) : null, optional };
}

/** The prompt without its limit or "(optional)" note, for showing in tight places. */
export function promptText(prompt: string): string {
  return prompt
    .replace(/\(\s*[^)]*\b(?:words?|optional)\b[^)]*\)/gi, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/** A short form of a prompt for chips and buttons. */
export function shortPrompt(prompt: string, max = 48): string {
  const text = promptText(prompt);
  return text.length <= max ? text : `${text.slice(0, max - 1).trimEnd()}…`;
}

/**
 * The separate things a prompt asks. "Tell us about a project. What was your part?" asks two;
 * "Which paper interests you most, and why?" asks two as well. A reviewer checks each one.
 */
export function questionParts(prompt: string): string[] {
  const parts: string[] = [];
  for (const sentence of promptText(prompt).split(/(?<=[?.!])\s+/)) {
    const trimmed = sentence.trim();
    if (!trimmed) continue;
    const why = trimmed.match(/^(.*?),?\s+and why\??$/i);
    if (why?.[1]) {
      parts.push(`${why[1].trim()}?`, 'Why?');
    } else {
      parts.push(trimmed);
    }
  }
  return parts;
}

export interface Blank {
  text: string;
  start: number;
  end: number;
}

/** The [bracketed blanks] an outline leaves for the student to fill. */
export function findBlanks(text: string): Blank[] {
  return [...text.matchAll(/\[[^\]\n]{1,80}\]/g)].map((m) => ({ text: m[0], start: m.index, end: m.index + m[0].length }));
}

const STOP = new Set(
  'about above after again also and any are because been before being both but can could did does doing each few for from had has have having her here him his how into its just like more most much must not now off once only other our out over own same should some such tell than that the their them then there these they this those through too under until very want was were what when where which while who whom why will with would you your yours describe us'.split(
    ' ',
  ),
);

/** The words in a text that carry meaning, cut to a short stem so "build" matches "building". */
export function keyStems(text: string): string[] {
  const words = text.toLowerCase().match(/[a-z][a-z'+-]*/g) ?? [];
  return [...new Set(words.filter((w) => w.length >= 4 && !STOP.has(w)).map((w) => w.slice(0, 5)))];
}

/** Every place a phrase appears as whole words, ignoring case. */
export function findPhrase(text: string, phrase: string): { start: number; end: number }[] {
  const escaped = phrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return [...text.matchAll(new RegExp(`(?<![\\p{L}])${escaped}(?![\\p{L}])`, 'giu'))].map((m) => ({
    start: m.index,
    end: m.index + m[0].length,
  }));
}

/** Whether a text names a term, matching whole words and ignoring case ("C++" included). */
export function mentions(text: string, term: string): boolean {
  return findPhrase(text, term).length > 0;
}
