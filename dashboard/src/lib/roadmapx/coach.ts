// The roadmap coach: answers a student's question about their plan from the plan's own data.
// This is the local stand-in for Grok. `askCoach` has the shape a model call will have (a
// question and the context in, a structured answer out), so swapping it is one function. Every
// sentence here is built from a field of CoachContext; when the data does not cover a question,
// the answer says so instead of guessing.
import { stepResources } from '../../data/roadmap-extra.ts';
import { shortDate } from '../time.ts';
import { daysLeft, dueWords, formatHours, list, whyStep, type CoachContext, type CoachStep } from './context.ts';
import { pace, readiness } from './readiness.ts';
import { planWeek } from './week.ts';

export type CoachAction =
  | { type: 'tick'; stepId: string; label: string }
  | { type: 'show'; stepId: string; label: string }
  | { type: 'planWeek'; hours: number; label: string }
  | { type: 'view'; view: 'timeline' | 'phases'; label: string };

export type CoachIntent =
  | 'hello'
  | 'pace'
  | 'week'
  | 'why'
  | 'stepDue'
  | 'stepHours'
  | 'stepDone'
  | 'stepResources'
  | 'step'
  | 'missing'
  | 'next'
  | 'remaining'
  | 'upcoming'
  | 'readiness'
  | 'unknown';

export interface CoachAnswer {
  intent: CoachIntent;
  text: string;
  bullets: string[];
  /** One-click follow-ups the page can run, such as ticking the step the answer is about. */
  actions: CoachAction[];
  /** The data the answer rests on, shown under it. */
  basis: string;
}

const has = (q: string, ...words: string[]) => words.some((word) => q.includes(word));

const STOP = new Set(
  `what why when how should this that the and for with step steps does about mark done long take will are can need have your you did get
  finish learn work enough well one into turn send apply ready week today roadmap plan time hours hour due deadline missing track next first
  where much left there them they its it's tell explain reason point doing from more most people still been kind good best want would which
  really make start started`.split(/\s+/),
);

const stem = (word: string) => (word.length > 4 && word.endsWith('s') ? word.slice(0, -1) : word);
const tokens = (text: string) =>
  (text.toLowerCase().match(/[a-z0-9+#]+/g) ?? []).filter((w) => w.length >= 3 && !STOP.has(w)).map(stem);

/** The step a question is about, by the words it shares with the step's title. */
export function matchStep(question: string, steps: CoachStep[]): CoachStep | undefined {
  const asked = new Set(tokens(question));
  if (asked.size === 0) return undefined;
  let best: CoachStep | undefined;
  let bestScore = 0;
  for (const step of steps) {
    const words = new Set([...tokens(step.title), ...tokens(step.opportunity?.title ?? '')]);
    const score = [...words].filter((w) => asked.has(w)).length;
    // On a tie the open step wins: that is usually the one the student means.
    if (score > bestScore || (score === bestScore && score > 0 && best?.done && !step.done)) {
      best = step;
      bestScore = score;
    }
  }
  return bestScore > 0 ? best : undefined;
}

const quote = (step: CoachStep) => `"${step.title}"`;
const shortTitle = (step: CoachStep) => (step.title.length > 34 ? `${step.title.slice(0, 32).trimEnd()}...` : step.title);
const tick = (step: CoachStep): CoachAction => ({
  type: 'tick',
  stepId: step.id,
  label: step.done ? `Undo "${shortTitle(step)}"` : `Mark "${shortTitle(step)}" done`,
});
const show = (step: CoachStep): CoachAction => ({ type: 'show', stepId: step.id, label: 'Show me the step' });
const evidenceBasis = (ctx: CoachContext) => (ctx.profiles > 0 ? `, ${ctx.profiles} sample profiles` : '');

/** Starter questions, with one about the student's actual next step when there is one. */
export function suggestionsFor(ctx: CoachContext): string[] {
  const next = ctx.steps.find((s) => s.isNext);
  return [
    'What should I do this week?',
    'Am I on track?',
    'What am I missing?',
    next ? `Why "${shortTitle(next)}"?` : 'Why this step?',
    'How long will the rest take?',
    'What is due soon?',
  ];
}

export function answerRoadmap(question: string, ctx: CoachContext): CoachAnswer {
  const q = question.toLowerCase().trim();
  const open = ctx.steps.filter((s) => !s.done);
  const next = ctx.steps.find((s) => s.isNext);
  const answer = (intent: CoachIntent, text: string, bullets: string[], actions: CoachAction[], basis: string): CoachAnswer => ({
    intent,
    text,
    bullets,
    actions,
    basis,
  });

  if (/^(hi|hey|hello|thanks|thank you|yo)\b/.test(q) && q.length < 24) {
    return answer(
      'hello',
      `Hi ${ctx.profile.name}. I read your roadmap for ${ctx.goal.toLowerCase()}: ${ctx.steps.length} steps, ${open.length} still open. Ask me what to do this week, whether you are on track, or why any step is there.`,
      [],
      [],
      'Your roadmap',
    );
  }

  // Topics the roadmap holds no data on. Answering them would mean guessing, so say so.
  const offTopic = [
    ['gpa', 'GPA'],
    ['grade', 'grades'],
    ['salary', 'pay'],
    ['stipend', 'pay'],
    [' pay', 'pay'],
    ['paid', 'pay'],
    ['visa', 'visas or sponsorship'],
    ['sponsor', 'visas or sponsorship'],
    ['citizen', 'citizenship rules'],
    ['interview question', 'interview questions'],
    ['acceptance rate', 'acceptance rates'],
  ].find(([word]) => q.includes(word!));
  if (offTopic) {
    return answer(
      'unknown',
      `Your roadmap has nothing on ${offTopic[1]}, so I will not guess. The official posting for each opportunity is the place to check.`,
      [],
      [],
      'Your roadmap',
    );
  }

  if (has(q, 'on track', 'behind', 'pace', 'late', 'schedule', 'keep up', 'overdue', 'falling')) {
    const p = pace(ctx);
    const all = [
      ...p.overdue.map((s) => `${s.title}: ${dueWords(s.due!, ctx.now)}`),
      ...p.dueThisWeek.map((s) => `${s.title}: ${dueWords(s.due!, ctx.now)}, about ${formatHours(s.hours)}`),
    ];
    const bullets = all.length > 5 ? [...all.slice(0, 4), `and ${all.length - 4} more`] : all;
    const actions: CoachAction[] = [];
    if (p.overdue[0]) actions.push(show(p.overdue[0]), tick(p.overdue[0]));
    if (p.status !== 'on_track') actions.push({ type: 'planWeek', hours: ctx.hoursPerWeek, label: `Plan my ${formatHours(ctx.hoursPerWeek)} week` });
    else actions.push({ type: 'view', view: 'timeline', label: 'See it on the timeline' });
    return answer('pace', `${p.label}. ${p.detail}`, bullets, actions, `Due dates on ${ctx.steps.filter((s) => s.due).length} steps, your ${formatHours(ctx.hoursPerWeek)} a week`);
  }

  const hoursAsked = q.match(/(\d+(?:\.\d+)?)\s*(?:h\b|hrs?\b|hours?\b)/);
  if (
    has(q, 'this week', 'my week', 'today', 'tonight', 'weekend', 'should i do', 'focus', 'work on', 'plan my', 'prioriti') ||
    (hoursAsked && has(q, 'have', 'got', 'free', 'spare', 'only'))
  ) {
    const hours = hoursAsked ? Math.min(40, Math.max(0.5, Number(hoursAsked[1]))) : ctx.hoursPerWeek;
    const plan = planWeek(ctx, hours);
    const bullets = plan.picks.map(
      (p) => `${p.partial ? 'Start: ' : ''}${p.step.title} · ${formatHours(p.hours)} · ${p.reasons.join(', ')}`,
    );
    const missed = plan.leftOut.map((l) => `${quote(l.step)} (${formatHours(l.step.hours)}, ${dueWords(l.step.due!, ctx.now)})`);
    const tail =
      missed.length === 0
        ? ''
        : ` Did not fit: ${list(missed.length > 2 ? [...missed.slice(0, 2), `${missed.length - 2} more`] : missed)}.`;
    const first = plan.picks[0];
    const actions: CoachAction[] = [{ type: 'planWeek', hours, label: 'Open this plan' }];
    if (first && !first.partial) actions.unshift(tick(first.step));
    return answer(
      'week',
      `With ${formatHours(hours)}, here is what I would do, most pressing first. ${plan.summary}${tail}`,
      bullets,
      actions,
      `${open.length} open steps, their dates, hour estimates${evidenceBasis(ctx)}`,
    );
  }

  const step = matchStep(q, ctx.steps);

  if (has(q, 'why', 'explain', 'reason', 'point of', 'matter', 'worth')) {
    const target = step ?? next;
    if (!target) return answer('why', 'Every step is done, so there is nothing left to explain.', [], [], 'Your roadmap');
    return answer(
      'why',
      `Why ${quote(target)}${target.isNext ? ', your next step' : ''}:`,
      whyStep(target, ctx),
      target.done ? [show(target)] : [tick(target), show(target)],
      target.evidence ? `${target.evidence.total} sample profiles of people who got this role` : 'The step and its posting',
    );
  }

  if (step) {
    if (has(q, 'when', 'due', 'deadline', 'date', 'by ')) {
      const text = step.due
        ? `${quote(step)} is ${dueWords(step.due, ctx.now)} (${shortDate(step.due)}).`
        : `${quote(step)} has no date in your roadmap. Pick one yourself, or let it fit around the dated steps.`;
      return answer('stepDue', text, [], [show(step)], 'The step\'s due date');
    }
    if (has(q, 'how long', 'hours', 'how much time', 'take')) {
      return answer(
        'stepHours',
        `About ${formatHours(step.hours)} for ${quote(step)}. That is a rough planning estimate, not a measurement.`,
        [],
        [show(step), { type: 'planWeek', hours: ctx.hoursPerWeek, label: 'Fit it into my week' }],
        'Hour estimates set for this demo',
      );
    }
    if (has(q, 'resource', 'where can', 'how do i', 'how to', 'tutorial', 'course', 'help with', 'study')) {
      const resources = stepResources[step.id] ?? [];
      const bullets = resources.map((r) => `${r.label} (${r.url.replace(/^https?:\/\/(www\.)?/, '').replace(/\/$/, '')})`);
      if (step.opportunity) bullets.push(`The linked opportunity: ${step.opportunity.title}, ${step.opportunity.organizer}`);
      return answer(
        'stepResources',
        bullets.length > 0 ? `Places to start on ${quote(step)}:` : `Your roadmap has no suggested resources for ${quote(step)}.`,
        bullets,
        [show(step)],
        'Suggested resources and the linked opportunity',
      );
    }
    if (has(q, 'done', 'finished', 'complete', 'mark', 'tick', 'check off')) {
      return answer(
        'stepDone',
        step.done ? `${quote(step)} is already marked done.` : `${quote(step)} is still open. Mark it done here when you have finished it.`,
        [],
        [tick(step), show(step)],
        'Your done marks',
      );
    }
  }

  if (has(q, 'missing', 'gap', 'lack', 'need', 'require', 'weak', 'short of', 'what else')) {
    const unmet = ctx.requirements.filter((r) => !r.met);
    const bullets = unmet.map((r) => {
      const covering = ctx.steps.find((s) => s.id === r.stepId);
      if (covering) return `${r.label}: step ${quote(covering)}${covering.due ? `, ${dueWords(covering.due, ctx.now)}` : ''}`;
      if (r.skill) return `${r.label}: add ${r.skill} to your profile once you have it`;
      return `${r.label}: no step covers this yet`;
    });
    const common = open.filter((s) => s.evidence && s.evidence.share >= 0.6 && !(s.requirement && !s.requirement.met));
    const commonLine = common.length > 0 ? ` Most people who got this role also did ${list(common.slice(0, 3).map(quote))}, which you have not done yet.` : '';
    const firstStep = unmet.map((r) => ctx.steps.find((s) => s.id === r.stepId)).find((s): s is CoachStep => Boolean(s));
    const text =
      unmet.length === 0
        ? `You meet all ${ctx.requirements.length} things this goal asks for. What is left is the plan itself: ${open.length} open steps.${commonLine}`
        : `You meet ${ctx.requirements.length - unmet.length} of the ${ctx.requirements.length} things this goal asks for. Still missing:`;
    return answer(
      'missing',
      text,
      unmet.length === 0 ? [] : [...bullets, ...(commonLine ? [commonLine.trim()] : [])],
      firstStep ? [show(firstStep)] : [],
      `${ctx.requirements.length} goal requirements, your ${ctx.profile.skills.length} profile skills${evidenceBasis(ctx)}`,
    );
  }

  if (has(q, 'next', 'first', 'start', 'begin')) {
    if (!next) return answer('next', 'Every step on your roadmap is done.', [], [], 'Your done marks');
    return answer(
      'next',
      `Your next step is ${quote(next)}, about ${formatHours(next.hours)}.`,
      whyStep(next, ctx).slice(0, 2),
      [tick(next), show(next)],
      `Step order${evidenceBasis(ctx)}`,
    );
  }

  if (has(q, 'how long', 'hours', 'time left', 'remaining', 'the rest', 'when will i', 'finish')) {
    const remaining = open.reduce((sum, s) => sum + s.hours, 0);
    const weeks = ctx.hoursPerWeek > 0 ? Math.ceil(remaining / ctx.hoursPerWeek) : null;
    const phases = new Map<string, number>();
    open.forEach((s) => phases.set(s.phase, (phases.get(s.phase) ?? 0) + s.hours));
    const lastDue = open.filter((s) => s.due).sort((a, b) => daysLeft(b.due!, ctx.now) - daysLeft(a.due!, ctx.now))[0];
    let fit = '';
    if (weeks !== null && lastDue) {
      const daysToLast = daysLeft(lastDue.due!, ctx.now);
      fit =
        weeks * 7 <= daysToLast
          ? ` At ${formatHours(ctx.hoursPerWeek)} a week that is about ${weeks} weeks, before your last dated step (${shortDate(lastDue.due!)}).`
          : ` At ${formatHours(ctx.hoursPerWeek)} a week that is about ${weeks} weeks, past your last dated step (${shortDate(lastDue.due!)}), so you would need more hours a week.`;
    }
    return answer(
      'remaining',
      open.length === 0 ? 'Nothing is left: every step is done.' : `About ${formatHours(remaining)} of work is left across ${open.length} steps.${fit} These are rough estimates.`,
      [...phases.entries()].map(([phase, hours]) => `${phase}: ${formatHours(hours)}`),
      [{ type: 'view', view: 'timeline', label: 'See it on the timeline' }],
      'Hour estimates on your open steps',
    );
  }

  if (has(q, 'soon', 'coming up', 'upcoming', 'deadline', 'due', 'when')) {
    const dated = open.filter((s) => s.due).sort((a, b) => daysLeft(a.due!, ctx.now) - daysLeft(b.due!, ctx.now));
    if (dated.length === 0) return answer('upcoming', 'None of your open steps has a date.', [], [], 'Due dates on your steps');
    return answer(
      'upcoming',
      `Your next ${Math.min(4, dated.length) === 1 ? 'date' : `${Math.min(4, dated.length)} dates`}:`,
      dated.slice(0, 4).map((s) => `${s.title}: ${dueWords(s.due!, ctx.now)} (${shortDate(s.due!)})`),
      [show(dated[0]!), { type: 'view', view: 'timeline', label: 'See it on the timeline' }],
      'Due dates on your steps',
    );
  }

  if (has(q, 'ready', 'readiness', 'score', 'progress', 'how far', 'chance', 'how am i', 'how close', 'doing')) {
    const r = readiness(ctx);
    const p = pace(ctx);
    return answer(
      'readiness',
      `Readiness ${r.score} out of 100, and ${p.label.toLowerCase()}. It measures how much of this plan you have covered, not your odds of an offer, which your data cannot tell.`,
      r.parts.map((part) => `${part.label}: ${part.detail} (counts ${Math.round(part.weight * 100)}%)`),
      next ? [tick(next), show(next)] : [],
      `Requirements, done marks${evidenceBasis(ctx)}`,
    );
  }

  if (step) {
    const parts = [
      step.done ? 'done' : 'open',
      step.due ? dueWords(step.due, ctx.now) : 'no date',
      `about ${formatHours(step.hours)}`,
      step.evidence ? `${step.evidence.count} of ${step.evidence.total} people did it` : null,
    ].filter(Boolean);
    return answer('step', `${quote(step)}, in "${step.phase}": ${parts.join(', ')}.`, [step.detail], [step.done ? show(step) : tick(step), show(step)], 'The step');
  }

  return answer(
    'unknown',
    'I can only answer from your roadmap: its steps, dates, done marks, hour estimates, the goal\'s requirements and what people who got this role did. I did not find what you asked in it, so I will not guess.',
    ['What should I do this week?', 'Am I on track?', 'What am I missing?', 'Why is a step on my plan?'],
    [],
    'Your roadmap',
  );
}

/**
 * The one call the page makes. Today it answers locally; with the agents connected, this sends
 * the question and the context to Grok and asks for the same CoachAnswer shape back.
 */
export async function askCoach(question: string, ctx: CoachContext): Promise<CoachAnswer> {
  return answerRoadmap(question, ctx);
}
