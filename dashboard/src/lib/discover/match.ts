// Ranks the career paths for one student. This is the local stand-in for the master agent: every
// number here comes from rules over the quiz answers, the profile, what the student did in the
// feed and the agents' sample note on each path. A model call can replace `rankPaths` later as
// long as it returns the same `PathMatch` shape, so the page does not need to change.
import type { CareerPath, MatchLevel, Opportunity, Profile, Roadmap } from '../../types.ts';
import type { PathExtra, QuizQuestion } from '../../data/discover-extra.ts';

export type QuizAnswers = Record<string, string>;

export type SignalSource = 'quiz' | 'interests' | 'skills' | 'feed' | 'agents';

export interface Signal {
  source: SignalSource;
  label: string;
  /** 0 to 1. */
  score: number;
  /** Share of the final match this signal carries, after unknown signals are left out. */
  weight: number;
}

export interface Reason {
  source: SignalSource;
  tone: 'plus' | 'minus';
  text: string;
}

export interface PathMatch {
  pathId: string;
  /** 0 to 100. */
  percent: number;
  level: MatchLevel;
  /** One plain sentence on why, built from the strongest reasons. */
  summary: string;
  reasons: Reason[];
  signals: Signal[];
  /** Things the match could not use, said out loud instead of guessed. */
  unknowns: string[];
}

export interface History {
  saved: string[];
  liked: string[];
  dismissed: string[];
}

export interface MatchInput {
  paths: CareerPath[];
  extras: PathExtra[];
  roadmaps: Roadmap[];
  opportunities: Opportunity[];
  questions: QuizQuestion[];
  answers: QuizAnswers;
  profile: Profile;
  history: History;
  doneSteps: string[];
}

// The quiz is the student telling us directly, so it counts most. The agents' note is the
// weakest signal: it was written before the student said anything here.
const BASE_WEIGHTS: Record<SignalSource, number> = { quiz: 0.45, interests: 0.18, skills: 0.17, feed: 0.12, agents: 0.08 };
const AGENT_PRIOR: Record<MatchLevel, number> = { strong: 0.85, good: 0.65, explore: 0.4 };

export const levelFor = (percent: number): MatchLevel => (percent >= 75 ? 'strong' : percent >= 55 ? 'good' : 'explore');

const same = (a: string, b: string) => a.toLowerCase() === b.toLowerCase();
const clamp = (n: number) => Math.max(0, Math.min(1, n));

/**
 * Lowercases the first letter of a label so it reads inside a sentence, but leaves names such as
 * Python or SQL alone.
 */
export function lowerLabel(label: string): string {
  if (/^(Python|Java|JavaScript|Git|Linux|SQL|C\+\+|React|AI)\b/.test(label)) return label;
  return label.charAt(0).toLowerCase() + label.slice(1);
}

const WORDS = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve'];

/** Small counts as words, so copy such as "seven questions" follows the data instead of a fixed number. */
export const numberWord = (n: number) => WORDS[n] ?? String(n);

export const joinList = (items: string[]) =>
  items.length <= 1 ? (items[0] ?? '') : `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`;

/** Whether the student already has a skill the path expects, from the profile or a finished step. */
export function hasSkill(skill: { profileSkill: string | null; stepId: string | null }, profile: Profile, doneSteps: string[]) {
  return (
    (skill.profileSkill !== null && profile.skills.some((own) => same(own, skill.profileSkill!))) ||
    (skill.stepId !== null && doneSteps.includes(skill.stepId))
  );
}

/** Feed cards that lead toward a path: ones its roadmap uses, or ones tagged with its topics. */
export function relatedOpportunityIds(extra: PathExtra | undefined, roadmap: Roadmap | undefined, opportunities: Opportunity[]): string[] {
  const fromRoadmap = new Set(
    (roadmap?.phases ?? []).flatMap((phase) => phase.steps.map((step) => step.opportunityId)).filter((id): id is string => id !== null),
  );
  return opportunities
    .filter((o) => fromRoadmap.has(o.id) || o.tags.some((tag) => (extra?.feedTags ?? []).some((t) => same(t, tag))))
    .map((o) => o.id);
}

/** How many questions the student has answered with an option that still exists. */
export function answeredCount(questions: QuizQuestion[], answers: QuizAnswers): number {
  return questions.filter((q) => q.options.some((o) => o.id === answers[q.id])).length;
}

export function rankPaths(input: MatchInput): PathMatch[] {
  const { paths, extras, roadmaps, opportunities, questions, answers, profile, history, doneSteps } = input;
  const titleOf = new Map(opportunities.map((o) => [o.id, o.title]));
  const anyHistory = history.saved.length + history.liked.length + history.dismissed.length > 0;

  const matches = paths.map((path, order) => {
    const extra = extras.find((e) => e.pathId === path.id);
    const roadmap = roadmaps.find((r) => r.goalId === path.id);
    const raw: { source: SignalSource; label: string; score: number }[] = [];
    const reasons: (Reason & { strength: number })[] = [];
    const unknowns: string[] = [];

    // Quiz: the average fit of the chosen answers. Strong and weak answers become reasons.
    const picked = questions
      .map((q) => q.options.find((o) => o.id === answers[q.id]))
      .filter((o): o is NonNullable<typeof o> => o !== undefined);
    if (picked.length > 0) {
      const fits = picked.map((o) => ({ o, fit: o.fit[path.id] ?? 0 }));
      raw.push({ source: 'quiz', label: 'Your answers', score: fits.reduce((sum, f) => sum + f.fit, 0) / fits.length });
      const strong = fits.filter((f) => f.fit >= 0.8).map((f) => f.o.because);
      const weak = fits.filter((f) => f.fit <= 0.2).map((f) => f.o.because);
      if (strong.length) reasons.push({ source: 'quiz', tone: 'plus', text: `You said you ${joinList(strong.slice(0, 2))}.`, strength: 1 + strong.length / 10 });
      if (weak.length) reasons.push({ source: 'quiz', tone: 'minus', text: `You said you ${weak[0]}, which this work has little of.`, strength: 0.9 });
    } else {
      unknowns.push('You have not taken the quiz yet, so this match leans on your profile alone.');
    }

    // Interests: two matching interests is as strong as this signal gets.
    const pathInterests = extra?.interests ?? [];
    const shared = profile.interests.filter((own) => pathInterests.some((i) => same(i, own)));
    if (pathInterests.length > 0) {
      raw.push({ source: 'interests', label: 'Profile interests', score: clamp(shared.length / Math.min(2, pathInterests.length)) });
      if (shared.length) reasons.push({ source: 'interests', tone: 'plus', text: `You list ${joinList(shared)} as ${shared.length === 1 ? 'an interest' : 'interests'}.`, strength: 0.8 + shared.length / 10 });
    }

    // Skills: core skills count double, because postings filter on them.
    const skills = extra?.skills ?? [];
    if (skills.length > 0) {
      const weightOf = (s: (typeof skills)[number]) => (s.importance === 'core' ? 2 : 1);
      const total = skills.reduce((sum, s) => sum + weightOf(s), 0);
      const have = skills.filter((s) => hasSkill(s, profile, doneSteps));
      const got = have.reduce((sum, s) => sum + weightOf(s), 0);
      raw.push({ source: 'skills', label: 'Skills you have', score: got / total });
      if (have.length) reasons.push({ source: 'skills', tone: 'plus', text: `You already have ${have.length} of the ${skills.length} skills it expects.`, strength: 0.6 + got / total / 2 });
      const missingCore = skills.filter((s) => s.importance === 'core' && !hasSkill(s, profile, doneSteps));
      if (missingCore.length) reasons.push({ source: 'skills', tone: 'minus', text: `Still to build: ${joinList(missingCore.slice(0, 2).map((s) => lowerLabel(s.label)))}.`, strength: 0.5 });
    }

    // Feed: only counts once the student has reacted to something, otherwise it is unknown.
    const related = new Set(relatedOpportunityIds(extra, roadmap, opportunities));
    const positive = [...new Set([...history.saved, ...history.liked])].filter((id) => related.has(id));
    const negative = history.dismissed.filter((id) => related.has(id));
    if (anyHistory) {
      raw.push({ source: 'feed', label: 'What you saved and liked', score: clamp(0.3 + 0.35 * positive.length - 0.3 * negative.length) });
      if (positive.length) {
        const names = positive.slice(0, 2).map((id) => `"${titleOf.get(id) ?? id}"`);
        reasons.push({ source: 'feed', tone: 'plus', text: `You saved or liked ${joinList(names)}${positive.length > 2 ? ` and ${positive.length - 2} more` : ''},${positive.length === 1 ? ' which leads here' : ' which lead here'}.`, strength: 0.7 + positive.length / 10 });
      }
      if (negative.length) reasons.push({ source: 'feed', tone: 'minus', text: `You passed on ${negative.length === 1 ? 'a card' : `${negative.length} cards`} that lead here.`, strength: 0.6 });
    } else {
      unknowns.push('Nothing saved or liked in the feed yet, so your feed history is not part of this.');
    }

    raw.push({ source: 'agents', label: "Agents' first read", score: AGENT_PRIOR[path.match] });

    const totalWeight = raw.reduce((sum, s) => sum + BASE_WEIGHTS[s.source], 0);
    const signals: Signal[] = raw.map((s) => ({ ...s, weight: BASE_WEIGHTS[s.source] / totalWeight }));
    const score = signals.reduce((sum, s) => sum + s.score * s.weight, 0);
    const percent = Math.round(score * 100);

    const ordered = [...reasons].sort((a, b) => b.strength - a.strength).map(({ strength: _strength, ...reason }) => reason);
    return { pathId: path.id, percent, level: levelFor(percent), summary: summarize(path, ordered), reasons: ordered, signals, unknowns, order };
  });

  return matches
    .sort((a, b) => b.percent - a.percent || a.order - b.order)
    .map(({ order: _order, ...match }) => match);
}

function summarize(path: CareerPath, reasons: Reason[]): string {
  const plus = reasons.filter((r) => r.tone === 'plus');
  const minus = reasons.find((r) => r.tone === 'minus');
  if (plus.length === 0) {
    return `Little in your answers or profile points to ${path.title.toLowerCase()} yet.${minus ? ` ${minus.text}` : ''}`;
  }
  // Lowercase the first letter so two reasons read as one sentence.
  const soften = (text: string) => text.charAt(0).toLowerCase() + text.slice(1).replace(/\.$/, '');
  const head = plus.slice(0, 2).map((r) => soften(r.text));
  return `It fits because ${head.join(', and ')}.${minus ? ` ${minus.text}` : ''}`;
}

/** The ranked paths under their fields, in the given field order, best match first in each. */
export function groupByField<T extends { pathId: string }>(ranked: T[], groups: Record<string, string>, groupOrder: string[]) {
  const fieldOf = (m: T) => groups[m.pathId] ?? 'Other';
  const order = [...new Set([...groupOrder, ...ranked.map(fieldOf)])];
  return order.map((field) => ({ field, matches: ranked.filter((m) => fieldOf(m) === field) })).filter((group) => group.matches.length > 0);
}
