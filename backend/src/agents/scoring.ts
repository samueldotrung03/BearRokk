// Feed ranking and memory. The design follows X's open-source For You algorithm at small scale:
// estimate how likely the student is to take each action on a card, then combine the estimates
// with weights, positive for wanted actions and negative for unwanted ones.
// The estimates here are computed from the student's history, not produced by a trained model.
import {
  CATEGORIES,
  CATEGORY_OF,
  type Action,
  type Category,
  type FeedEntry,
  type Interaction,
  type MemorySummary,
  type Opportunity,
  type ScoreParts,
} from './types.ts';

/**
 * What the student's custom notes ask for and rule out, as plain words. Notes outrank every
 * other signal: a posting a note rules out never reaches the feed, and one a note asks for is
 * lifted above anything the reaction history would do.
 */
export interface NoteSignals {
  want: string[];
  avoid: string[];
  /** Names ruled out as a whole, such as a company already applied to. Lowercase. */
  avoidNames: string[];
}

const NOTE_STOP = new Set(
  'a an and are as at be been but by can could did do does for from had has have how i if im in into is it its ive me my of on or our out so than that the their them then there these they this to too up us was we were what when where which who why will with would you your also any all some more most much many very just only really want wants wanted looking look find like love care cares need needs prefer something anything thing things one get got make show shows shown please agents agent opportunity opportunities role roles job jobs company companies work working about over under until while because even still again already where fine okay good great nice don dont doesn doesnt isn isnt cant won wont too them it its'.split(' '),
);
const NEGATION = /(?:\bno\b|\bnot\b|\bnever\b|\bavoid\b|\bskip\b|\bexcept\b|\bwithout\b|\bhate\b|don'?t (?:show|want|recommend|send|include|like)|do not (?:show|want|recommend|send|include|like)|already applied to|stop showing)\s+([^.;!?\n]+)/gi;
/** Lowercase, drop punctuation and a plural s, so "Startups" and "startup" match. */
const stem = (word: string) => word.toLowerCase().replace(/[^a-z0-9+#]/g, '').replace(/(?<=[a-z]{3})s$/, '');
const words = (text: string) => text.split(/[\s,/()"':\-]+/).map(stem).filter((w) => w.length > 2 && !NOTE_STOP.has(w));

export function noteSignals(notes: { title: string; body: string }[]): NoteSignals {
  const avoid = new Set<string>();
  const avoidNames = new Set<string>();
  const want = new Set<string>();
  for (const note of notes) {
    const text = `${note.title}. ${note.body}`;
    let rest = text;
    for (const match of text.matchAll(NEGATION)) {
      // What is ruled out ends at "but", "unless", or a comma that starts a new thought:
      // "no banks, but trading is fine", "already applied to Acme, don't show it again".
      let phrase = match[1]!.split(/\b(?:but|unless|although|though|however)\b|,\s*(?=(?:i|so|and i|don'?t|do not|please|they|it|we)\b)/i)[0]!;
      // A capitalised name ("Harbor Data Co") is ruled out as a name, not word by word, so a
      // company called "Harbor Data" does not rule out data work.
      for (const name of phrase.match(/\b[A-Z][\w&.'-]*(?:\s+[A-Z][\w&.'-]*)+/g) ?? []) {
        avoidNames.add(name.toLowerCase());
        phrase = phrase.replace(name, ' ');
      }
      for (const w of words(phrase)) avoid.add(w);
      rest = rest.replace(match[0].slice(0, match[0].length - match[1]!.length + phrase.length), ' ');
    }
    for (const w of words(rest)) if (!avoid.has(w)) want.add(w);
  }
  return { want: [...want].slice(0, 60), avoid: [...avoid].slice(0, 60), avoidNames: [...avoidNames].slice(0, 30) };
}

const noteText = (o: Pick<Opportunity, 'title' | 'organizer' | 'field' | 'tags' | 'type' | 'location' | 'format'>) =>
  new Set(words(`${o.title} ${o.organizer} ${o.field ?? ''} ${o.tags.join(' ')} ${o.type} ${o.location ?? ''} ${o.format === 'online' ? 'remote online' : o.format === 'in_person' ? 'in-person onsite' : (o.format ?? '')}`));

/** Which of the notes' words this posting matches. */
export function noteMatch(o: Parameters<typeof noteText>[0], signals: NoteSignals): { wanted: string[]; avoided: string[] } {
  const text = noteText(o);
  const named = `${o.organizer} ${o.title}`.toLowerCase();
  return { wanted: signals.want.filter((w) => text.has(w)), avoided: [...signals.avoid.filter((w) => text.has(w)), ...signals.avoidNames.filter((n) => named.includes(n))] };
}

/** Added to a card's score when the notes ask for it. Larger than any swing from reaction history. */
export const NOTE_BOOST = 1.2;

/** How far one action moves the affinity of each feature of that card. */
export const ACTION_DELTA: Record<Action, number> = { apply: 1.5, like: 1, save: 0.8, open: 0.2, dislike: -1.5 };

/** Weight of each predicted action in the final score. */
export const ACTION_WEIGHT: ScoreParts = { apply: 1.0, save: 0.6, like: 0.4, open: 0.1, dislike: -1.0 };

const FEATURE_WEIGHT: Record<string, number> = { type: 1, field: 0.8, tag: 0.4, format: 0.3, org: 0.5 };

export function features(o: Pick<Opportunity, 'type' | 'field' | 'format' | 'organizer' | 'tags'>): string[] {
  const out = [`type:${o.type}`, `org:${o.organizer}`];
  if (o.field) out.push(`field:${o.field}`);
  if (o.format) out.push(`format:${o.format}`);
  for (const tag of o.tags.slice(0, 4)) out.push(`tag:${tag}`);
  return out;
}

export interface Memory {
  affinities: Map<string, number>;
  reaction: Map<string, 'like' | 'dislike'>;
  saved: Set<string>;
  counts: Record<Action, number>;
}

/** Rebuilt from the raw interactions every time, so the scoring can change without losing history. */
export function buildMemory(interactions: Interaction[], byId: Map<string, Opportunity>): Memory {
  const reaction = new Map<string, 'like' | 'dislike'>();
  const saved = new Set<string>();
  const opened = new Set<string>();
  const applied = new Set<string>();
  const counts: Record<Action, number> = { save: 0, like: 0, dislike: 0, open: 0, apply: 0 };

  for (const i of interactions) {
    counts[i.action]++;
    if (i.action === 'like' || i.action === 'dislike') {
      // Repeating the same reaction takes it back; the other one replaces it.
      if (reaction.get(i.opportunityId) === i.action) reaction.delete(i.opportunityId);
      else reaction.set(i.opportunityId, i.action);
    } else if (i.action === 'save') {
      if (saved.has(i.opportunityId)) saved.delete(i.opportunityId);
      else saved.add(i.opportunityId);
    } else if (i.action === 'open') opened.add(i.opportunityId);
    else applied.add(i.opportunityId);
  }

  const affinities = new Map<string, number>();
  const bump = (id: string, action: Action) => {
    const opp = byId.get(id);
    if (!opp) return;
    for (const f of features(opp)) affinities.set(f, (affinities.get(f) ?? 0) + ACTION_DELTA[action]);
  };
  for (const [id, r] of reaction) bump(id, r);
  for (const id of saved) bump(id, 'save');
  for (const id of opened) bump(id, 'open');
  for (const id of applied) bump(id, 'apply');
  return { affinities, reaction, saved, counts };
}

/** Pull of the student's history on one card, squashed to -1..1. */
export function affinityOf(o: Opportunity, memory: Memory): number {
  let sum = 0;
  for (const f of features(o)) {
    const kind = f.slice(0, f.indexOf(':'));
    sum += (memory.affinities.get(f) ?? 0) * (FEATURE_WEIGHT[kind] ?? 0.3);
  }
  return Math.tanh(sum / 2.5);
}

const sigmoid = (x: number) => 1 / (1 + Math.exp(-x));

export function predict(fit: number, affinity: number): ScoreParts {
  return {
    apply: sigmoid(3 * (fit - 0.75) + 1.5 * affinity),
    save: sigmoid(2.5 * (fit - 0.6) + 2 * affinity),
    like: sigmoid(2.5 * (fit - 0.5) + 2 * affinity),
    open: sigmoid(2 * (fit - 0.3) + affinity),
    dislike: sigmoid(-2.5 * (fit - 0.4) - 2.5 * affinity),
  };
}

export function combine(parts: ScoreParts): number {
  return (Object.keys(ACTION_WEIGHT) as (keyof ScoreParts)[]).reduce((s, k) => s + ACTION_WEIGHT[k] * parts[k], 0);
}

const DAY = 86_400_000;

export function rankFeed(
  opportunities: Opportunity[],
  memory: Memory,
  opts: { now: Date; reasons?: Map<string, string>; newIds?: Set<string>; notes?: NoteSignals },
): FeedEntry[] {
  const notes = opts.notes ?? { want: [], avoid: [], avoidNames: [] };
  const scored = opportunities
    .filter((o) => memory.reaction.get(o.id) !== 'dislike')
    // A note that rules something out is final, even for results found before the note was written.
    .filter((o) => noteMatch(o, notes).avoided.length === 0)
    .map((o) => {
      const affinity = affinityOf(o, memory);
      const parts = predict(o.baseScore, affinity);
      let score = combine(parts);
      const due = o.deadline ? Date.parse(o.deadline) - opts.now.getTime() : null;
      if (due !== null && due > 0 && due < 14 * DAY) score += 0.05;
      // Notes come first: one matching word lifts a card most of the way, two or more all the way.
      const asked = noteMatch(o, notes).wanted;
      if (asked.length) score += NOTE_BOOST * Math.min(1, 0.6 + 0.4 * (asked.length - 1));
      return { o, affinity, parts, score, asked };
    })
    .sort((a, b) => b.score - a.score);

  // As X does for authors: each repeat of an organizer or type costs a little, so the feed stays varied.
  const picked: typeof scored = [];
  const orgSeen = new Map<string, number>();
  const typeSeen = new Map<string, number>();
  const pool = [...scored];
  while (pool.length) {
    let best = 0;
    let bestValue = -Infinity;
    pool.forEach((c, i) => {
      const value = c.score - 0.25 * (orgSeen.get(c.o.organizer) ?? 0) - 0.03 * (typeSeen.get(c.o.type) ?? 0);
      if (value > bestValue) [best, bestValue] = [i, value];
    });
    const [c] = pool.splice(best, 1);
    picked.push(c!);
    orgSeen.set(c!.o.organizer, (orgSeen.get(c!.o.organizer) ?? 0) + 1);
    typeSeen.set(c!.o.type, (typeSeen.get(c!.o.type) ?? 0) + 1);
  }

  return picked.map((c) => ({
    opportunity: c.o,
    score: Number(c.score.toFixed(3)),
    parts: c.parts,
    affinity: Number(c.affinity.toFixed(3)),
    reason: ((r: string) => (c.asked.length && !r.startsWith('Your notes ask') ? `Your notes ask for this (${c.asked.slice(0, 3).join(', ')}). ${r}` : r))(opts.reasons?.get(c.o.id) ?? c.o.fitExplanation),
    fromNotes: c.asked.length > 0,
    reaction: memory.reaction.get(c.o.id) ?? null,
    saved: memory.saved.has(c.o.id),
    isNew: opts.newIds?.has(c.o.id) ?? false,
  }));
}

/** Engagement per category. A category the student keeps disliking falls to 0 and loses its managers. */
export function categoryWeights(memory: Memory): Record<Category, number> {
  const out: Record<Category, number> = { internship: 1, event: 1, club: 1, program: 1 };
  for (const [feature, value] of memory.affinities) {
    if (!feature.startsWith('type:')) continue;
    const category = CATEGORY_OF[feature.slice(5) as keyof typeof CATEGORY_OF];
    if (category) out[category] += value * 0.5;
  }
  for (const c of CATEGORIES) out[c] = out[c] <= -0.4 ? 0 : Math.max(0.2, out[c]);
  return out;
}

/**
 * Split the run's search manager slots over the categories the student wants.
 * All slots are always used: a student who wants one category gets every manager on it.
 */
export function allocateSlots(wanted: Category[], weights: Record<Category, number>, slots: number): Record<Category, number> {
  const out: Record<Category, number> = { internship: 0, event: 0, club: 0, program: 0 };
  let active = wanted.filter((c) => weights[c] > 0);
  if (active.length === 0) active = wanted.length ? [...wanted] : [...CATEGORIES];
  // More categories than slots: keep the most engaged ones.
  active = [...active].sort((a, b) => weights[b] - weights[a] || CATEGORIES.indexOf(a) - CATEGORIES.indexOf(b)).slice(0, slots);

  for (const c of active) out[c] = 1;
  let left = slots - active.length;
  const total = active.reduce((s, c) => s + Math.max(weights[c], 0.01), 0);
  const share = active.map((c) => ({ c, exact: (Math.max(weights[c], 0.01) / total) * (slots - active.length) }));
  for (const s of share) {
    const whole = Math.floor(s.exact);
    out[s.c] += whole;
    left -= whole;
  }
  share.sort((a, b) => (b.exact % 1) - (a.exact % 1) || CATEGORIES.indexOf(a.c) - CATEGORIES.indexOf(b.c));
  for (let i = 0; left > 0; i++, left--) out[share[i % share.length]!.c]++;
  return out;
}

export function summarize(memory: Memory): MemorySummary {
  const label = (f: string) => f.slice(f.indexOf(':') + 1);
  const entries = [...memory.affinities]
    .filter(([f]) => !f.startsWith('org:') && !f.startsWith('format:'))
    .map(([feature, weight]) => ({ feature: label(feature), kind: feature.slice(0, feature.indexOf(':')), weight: Number(weight.toFixed(2)) }));
  const merged = new Map<string, number>();
  for (const e of entries) merged.set(e.feature, (merged.get(e.feature) ?? 0) + e.weight);
  const list = [...merged].map(([feature, weight]) => ({ feature, weight: Number(weight.toFixed(2)) }));
  return {
    likes: list.filter((e) => e.weight > 0.3).sort((a, b) => b.weight - a.weight).slice(0, 6),
    dislikes: list.filter((e) => e.weight < -0.3).sort((a, b) => a.weight - b.weight).slice(0, 6),
    // Three or more dislikes of a field with nothing liked in it.
    avoidFields: [...memory.affinities].filter(([f, w]) => f.startsWith('field:') && w <= -4).map(([f]) => f.slice(6)),
    counts: memory.counts,
    categoryWeights: categoryWeights(memory),
  };
}
