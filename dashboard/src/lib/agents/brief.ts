// How the master agent reads a typed instruction and turns the profile, memory and instructions
// into the brief the managers work from. In the product Grok does this; here it is rule-based so
// the page works without a key and the same instruction always gives the same brief.
import { categoryLabels, categorySlices, type Category, type Tag } from '../../data/agents-extra.ts';
import type { ClassYear, Opportunity, OpportunityType, Profile } from '../../types.ts';

export const CATEGORIES: Category[] = ['internships', 'events', 'clubs', 'programs'];
export const MANAGER_SLOTS = 4;
/** Leads the managers may hand to extractors in one run. With 4 scout jobs this keeps a demo run at the 20-job cap. */
export const LEAD_BUDGET = 16;
export const WORKER_JOB_CAP = 20;

export type DirectiveKind = 'focus' | 'avoid' | 'only';
export type TermKey = Category | Tag | 'remote' | 'in_person';

interface Term {
  key: TermKey;
  label: string;
  pattern: RegExp;
  category?: Category;
}

// Order matters only for display. A tag that belongs to a category (research is a program)
// also gives that category more weight when the student asks for more of it.
const TERMS: Term[] = [
  { key: 'internships', label: 'internships', pattern: /\bintern(ship)?s?\b|\bjobs?\b/, category: 'internships' },
  { key: 'events', label: 'events', pattern: /\bevents?\b|\bnetworking\b|\b(career )?fairs?\b|\binfo sessions?\b|\btalks?\b|\bmeetups?\b/, category: 'events' },
  { key: 'clubs', label: 'clubs', pattern: /\bclubs?\b|\bcommunit(y|ies)\b|\borgs?\b/, category: 'clubs' },
  { key: 'programs', label: 'programs', pattern: /\bprograms?\b/, category: 'programs' },
  { key: 'research', label: 'research', pattern: /\bresearch\b|\blabs?\b/, category: 'programs' },
  { key: 'hackathon', label: 'hackathons', pattern: /\bhackathons?\b/, category: 'programs' },
  { key: 'scholarship', label: 'scholarships', pattern: /\bscholarships?\b|\bfunding\b|\bgrants?\b/, category: 'programs' },
  { key: 'finance', label: 'finance', pattern: /\bfinanc\w*|\bfintech\b|\bbank\w*|\bquant\w*|\btrading\b/ },
  { key: 'ml', label: 'AI and ML', pattern: /\bml\b|\bai\b|machine learning|\bdeep learning\b/ },
  { key: 'backend', label: 'backend', pattern: /\bback-?end\b|\bsystems?\b|\binfra\w*|\bcloud\b|\bdistributed\b/ },
  { key: 'data', label: 'data', pattern: /\bdata\b|\banalytics\b/ },
  { key: 'web', label: 'web', pattern: /\bfront-?end\b|\bweb\b/ },
  { key: 'security', label: 'security', pattern: /\bsecurity\b|\bcyber\w*/ },
  { key: 'robotics', label: 'robotics', pattern: /\brobot\w*/ },
  { key: 'startup', label: 'startups', pattern: /\bstart-?ups?\b/ },
  { key: 'remote', label: 'remote', pattern: /\bremote\b|\bonline\b|\bvirtual\b/ },
  { key: 'in_person', label: 'in person', pattern: /\bin[- ]person\b|\bon campus\b|\blocal\b|\bnear (me|campus|berkeley)\b/ },
];

const ONLY = /\bnothing but\b|\bonly\b|\bjust\b|\bexclusively\b/;
const AVOID = /\bno\b|\bnot\b|\bfewer\b|\bless\b|\bavoid\b|\bwithout\b|\bskip\b|\bstop\b|\bexclude\b|\bnever\b|\bhide\b|\bdrop\b|\bdon'?t\b|\bnothing\b/;
const FOCUS = /\bmore\b|\bprefer\w*|\bfocus\w*|\bwant\b|\bshow\b|\blooking\b|\binterested\b|\badd\b|\bextra\b|\blots\b/;

export interface Directive {
  kind: DirectiveKind;
  key: TermKey;
  label: string;
}

export interface ParsedInstruction {
  text: string;
  directives: Directive[];
  /** Parts of the text no rule understood. They are shown, not guessed at. */
  unknown: string[];
}

function kindOf(clause: string): DirectiveKind | null {
  if (ONLY.test(clause)) return 'only';
  if (AVOID.test(clause)) return 'avoid';
  if (FOCUS.test(clause)) return 'focus';
  return null;
}

/**
 * Splits an instruction into clauses and reads each one as focus, avoid or only. A clause with no
 * verb of its own ("no events and clubs") carries the previous clause's meaning, the way people
 * write lists.
 */
export function parseInstruction(text: string): ParsedInstruction {
  const directives: Directive[] = [];
  const unknown: string[] = [];
  let carried: DirectiveKind | null = null;
  for (const raw of text.split(/[,;.!?]|\bbut\b|\band\b|\bplus\b|&|\bor\b/i)) {
    const clause = raw.trim().toLowerCase();
    if (!clause) continue;
    const own = kindOf(clause);
    const kind = own ?? carried ?? 'focus';
    const terms = TERMS.filter((term) => term.pattern.test(clause));
    if (terms.length === 0) unknown.push(raw.trim());
    for (const term of terms) {
      if (!directives.some((d) => d.key === term.key)) directives.push({ kind, key: term.key, label: term.label });
    }
    carried = own ?? carried;
  }
  return { text: text.trim(), directives, unknown };
}

export interface CategoryMemory {
  saves: number;
  likes: number;
  dislikes: number;
}

/** What the master agent knows about the student from what they did in the app. */
export interface Memory {
  saves: number;
  likes: number;
  dislikes: number;
  opens: number;
  applications: number;
  byCategory: Record<Category, CategoryMemory>;
}

export function categoryOfType(type: OpportunityType): Category {
  if (type === 'internship') return 'internships';
  if (type === 'event') return 'events';
  if (type === 'club') return 'clubs';
  return 'programs';
}

/** Counts the store's history per category, the way the backend's memory summary does. */
export function memoryFrom(
  state: { saved: string[]; liked: string[]; dismissed: string[]; opened: string[]; applications: Record<string, unknown> },
  opportunities: Opportunity[],
): Memory {
  const byCategory = Object.fromEntries(CATEGORIES.map((c) => [c, { saves: 0, likes: 0, dislikes: 0 }])) as Record<Category, CategoryMemory>;
  const typeOf = new Map(opportunities.map((o) => [o.id, o.type]));
  const count = (ids: string[], field: keyof CategoryMemory) => {
    for (const id of ids) {
      const type = typeOf.get(id);
      if (type) byCategory[categoryOfType(type)][field] += 1;
    }
  };
  count(state.saved, 'saves');
  count(state.liked, 'likes');
  count(state.dismissed, 'dislikes');
  return {
    saves: state.saved.length,
    likes: state.liked.length,
    dislikes: state.dismissed.length,
    opens: state.opened.length,
    applications: Object.keys(state.applications).length,
    byCategory,
  };
}

const INTEREST_TAGS: Record<string, Tag> = {
  'Backend systems': 'backend',
  'AI and machine learning': 'ml',
  'Cloud infrastructure': 'backend',
  'Web development': 'web',
  Data: 'data',
  Robotics: 'robotics',
  Security: 'security',
  Finance: 'finance',
  Research: 'research',
};

export type FormatRule = 'any' | 'remote' | 'in_person';

export interface BriefLine {
  label: string;
  value: string;
  from: 'profile' | 'memory' | 'you';
}

export interface Brief {
  year: ClassYear;
  location: string;
  wanted: Category[];
  focusCategories: Category[];
  focusTags: Tag[];
  avoidTags: Tag[];
  /** A hard rule on format, from "only remote" and the like. */
  format: FormatRule;
  /** A soft preference: these come first but others still count. */
  preferFormat: FormatRule;
  interestTags: Tag[];
  weights: Record<Category, number>;
  lines: BriefLine[];
  /** One line for the log and the master's "returned" field. */
  summary: string;
}

const isCategory = (key: TermKey): key is Category => (CATEGORIES as string[]).includes(key);
const isTag = (key: TermKey): key is Tag => !isCategory(key) && key !== 'remote' && key !== 'in_person';
const termOf = (key: TermKey) => TERMS.find((t) => t.key === key);
const list = (items: string[]) => (items.length <= 1 ? (items[0] ?? '') : `${items.slice(0, -1).join(', ')} and ${items.at(-1)}`);

/**
 * Merges the profile, memory and standing instructions into one brief. Instructions apply in the
 * order they were given, so "more finance" after "no finance" wins.
 */
export function buildBrief(profile: Profile, memory: Memory, instructions: string[]): Brief {
  const last = new Map<TermKey, DirectiveKind>();
  for (const text of instructions) {
    for (const d of parseInstruction(text).directives) {
      last.delete(d.key);
      last.set(d.key, d.kind);
    }
  }
  const keysWith = (kind: DirectiveKind) => [...last].filter(([, k]) => k === kind).map(([key]) => key);

  const onlyCats = keysWith('only').filter(isCategory);
  // "only research" means only programs, the category research lives in.
  for (const key of keysWith('only')) {
    const category = termOf(key)?.category;
    if (isTag(key) && category && !onlyCats.includes(category)) onlyCats.push(category);
  }
  const avoidCats = keysWith('avoid').filter(isCategory);
  // A category the student keeps disliking and never saves loses its slots, unless they asked for it.
  const asked = new Set<TermKey>([...keysWith('focus'), ...keysWith('only')]);
  const droppedByMemory = CATEGORIES.filter((c) => {
    const m = memory.byCategory[c];
    return m.dislikes >= 3 && m.dislikes > m.saves + m.likes && !asked.has(c);
  });
  let wanted = (onlyCats.length ? onlyCats : CATEGORIES).filter((c) => !avoidCats.includes(c) && !droppedByMemory.includes(c));
  if (wanted.length === 0) wanted = [...CATEGORIES];
  wanted = CATEGORIES.filter((c) => wanted.includes(c));

  const focusTags = [...keysWith('focus'), ...keysWith('only')].filter(isTag);
  const avoidTags = keysWith('avoid').filter(isTag);
  const focusCategories = CATEGORIES.filter(
    (c) => keysWith('focus').includes(c) || focusTags.some((tag) => termOf(tag)?.category === c),
  );

  const remote = last.get('remote');
  const inPerson = last.get('in_person');
  const format: FormatRule = remote === 'only' || inPerson === 'avoid' ? 'remote' : inPerson === 'only' || remote === 'avoid' ? 'in_person' : 'any';
  const preferFormat: FormatRule = format !== 'any' ? format : remote === 'focus' ? 'remote' : inPerson === 'focus' ? 'in_person' : 'any';

  const interestTags = [...new Set(profile.interests.map((i) => INTEREST_TAGS[i]).filter((t): t is Tag => t !== undefined))];

  const weights = Object.fromEntries(
    CATEGORIES.map((c) => {
      const m = memory.byCategory[c];
      const w = 1 + (focusCategories.includes(c) ? 1.5 : 0) + 0.3 * (m.saves + m.likes) - 0.3 * m.dislikes;
      return [c, Math.max(0.4, Math.round(w * 100) / 100)];
    }),
  ) as Record<Category, number>;

  const lines: BriefLine[] = [
    { label: 'Who', value: `${profile.year}, ${profile.major}, ${profile.school}`, from: 'profile' },
    {
      label: 'Where',
      value: format === 'remote' ? 'Remote only' : format === 'in_person' ? `In person near ${profile.location}` : `Near ${profile.location}, or remote`,
      from: format === 'any' ? 'profile' : 'you',
    },
    { label: 'Search', value: list(wanted.map((c) => categoryLabels[c].toLowerCase())), from: wanted.length === 4 ? 'profile' : onlyCats.length || avoidCats.length ? 'you' : 'memory' },
  ];
  if (focusTags.length || focusCategories.length) {
    lines.push({ label: 'More of', value: list([...new Set([...focusTags.map((t) => termOf(t)?.label ?? t), ...keysWith('focus').filter(isCategory)])]), from: 'you' });
  }
  if (avoidTags.length || avoidCats.length) {
    lines.push({ label: 'Less of', value: list([...avoidTags.map((t) => termOf(t)?.label ?? t), ...avoidCats]), from: 'you' });
  }
  if (interestTags.length) {
    lines.push({ label: 'Interests', value: list(interestTags.map((t) => termOf(t)?.label ?? t)), from: 'profile' });
  }
  const liked = CATEGORIES.filter((c) => memory.byCategory[c].saves + memory.byCategory[c].likes > 0);
  const disliked = CATEGORIES.filter((c) => memory.byCategory[c].dislikes > 0);
  if (liked.length || disliked.length) {
    lines.push({
      label: 'Memory',
      value: [
        liked.length ? `engages with ${list(liked.map((c) => categoryLabels[c].toLowerCase()))}` : '',
        disliked.length ? `dislikes some ${list(disliked.map((c) => categoryLabels[c].toLowerCase()))}` : '',
      ]
        .filter(Boolean)
        .join('; '),
      from: 'memory',
    });
  }

  const summary = [
    profile.year.toLowerCase(),
    format === 'remote' ? 'remote only' : format === 'in_person' ? 'in person only' : `near ${profile.location.split(',')[0]} or remote`,
    wanted.length < 4 ? `${list(wanted)} only` : '',
    focusTags.length ? `more ${list(focusTags.map((t) => termOf(t)?.label ?? t))}` : '',
    avoidTags.length ? `less ${list(avoidTags.map((t) => termOf(t)?.label ?? t))}` : '',
  ]
    .filter(Boolean)
    .join(', ');

  return { year: profile.year, location: profile.location, wanted, focusCategories, focusTags, avoidTags, format, preferFormat, interestTags, weights, lines, summary };
}

export interface Slot {
  index: number;
  category: Category;
  /** Which slices of the category this manager covers. */
  slices: number[];
  label: string;
  sources: string[];
  budget: number;
}

/**
 * Fills the four manager slots from the brief, as section 2 of AGENT_SYSTEM.md describes: every
 * wanted category gets one slot, and the spare slots go to the categories with the most weight,
 * each extra manager taking a different slice. The lead budget is then split by weight.
 */
export function assignSlots(brief: Brief): Slot[] {
  const order = [...brief.wanted].sort((a, b) => brief.weights[b] - brief.weights[a] || CATEGORIES.indexOf(a) - CATEGORIES.indexOf(b));
  const counts = new Map<Category, number>(order.map((c) => [c, 1]));
  for (let spare = MANAGER_SLOTS - order.length, i = 0; spare > 0; spare--, i++) {
    const category = order[i % order.length]!;
    counts.set(category, (counts.get(category) ?? 0) + 1);
  }

  const slots: Omit<Slot, 'budget'>[] = [];
  for (const category of CATEGORIES) {
    const k = counts.get(category) ?? 0;
    for (let j = 0; j < k; j++) {
      const slices = [0, 1, 2, 3].filter((s) => s % k === j);
      const parts = slices.map((s) => categorySlices[category][s]!);
      slots.push({
        index: slots.length,
        category,
        slices,
        label: k === 1 ? 'every slice' : parts.map((p) => p.label).join(' + '),
        sources: [...new Set(parts.flatMap((p) => p.sources))].slice(0, 3),
      });
    }
  }

  // Largest-remainder split, with a floor of two leads so no manager is sent out empty-handed.
  const weightOf = (slot: Omit<Slot, 'budget'>) => brief.weights[slot.category] / (counts.get(slot.category) ?? 1);
  const total = slots.reduce((sum, slot) => sum + weightOf(slot), 0);
  const floorBudget = 2;
  const spareBudget = LEAD_BUDGET - floorBudget * slots.length;
  const raw = slots.map((slot) => (spareBudget * weightOf(slot)) / total);
  const budgets = raw.map((r) => floorBudget + Math.floor(r));
  let left = LEAD_BUDGET - budgets.reduce((a, b) => a + b, 0);
  const byRemainder = raw.map((r, i) => ({ i, rem: r - Math.floor(r) })).sort((a, b) => b.rem - a.rem || a.i - b.i);
  for (const { i } of byRemainder) {
    if (left <= 0) break;
    budgets[i]! += 1;
    left -= 1;
  }
  return slots.map((slot, i) => ({ ...slot, budget: budgets[i]! }));
}

/** The manager's brief, in the words its detail panel shows under "What it was told". */
export function slotBrief(slot: Slot, brief: Brief): string {
  const parts = [
    `${categoryLabels[slot.category]}, ${slot.label}. Up to ${slot.budget} leads.`,
    `Hard rules: open to ${brief.year.toLowerCase()}s, ${brief.format === 'remote' ? 'remote only' : brief.format === 'in_person' ? `in person near ${brief.location}` : `near ${brief.location} or remote`}, still open.`,
  ];
  if (brief.focusTags.length) parts.push(`Put ${list(brief.focusTags.map((t) => termOf(t)?.label ?? t))} first.`);
  if (brief.avoidTags.length) parts.push(`The student wants less ${list(brief.avoidTags.map((t) => termOf(t)?.label ?? t))}.`);
  return parts.join(' ');
}

export const termLabel = (key: TermKey) => termOf(key)?.label ?? key;
