// Answers a student's question about one career path from the page's own data: the generic
// description in discover-extra.ts, the match, and the facts in `PathInsight`. In the product the
// question goes to Grok with the same context; `CareerAdvisor` is the seam where that call goes,
// and it already returns a promise so the page will not change when it does. When the data does
// not hold an answer (pay, company names, odds), the answer says so instead of guessing.
import type { Profile } from '../../types.ts';
import type { PathInsight } from './insight.ts';
import { sameYearCount } from './insight.ts';
import { joinList, lowerLabel, type PathMatch } from './match.ts';

/** One-click follow-ups an answer can offer. The page decides what each one does. */
export type AnswerAction =
  | { kind: 'setGoal'; pathId: string; label: string }
  | { kind: 'openRoadmap'; label: string }
  | { kind: 'viewPath'; pathId: string; label: string }
  | { kind: 'compare'; pathIds: string[]; label: string }
  | { kind: 'openOpportunity'; opportunityId: string; label: string }
  | { kind: 'startQuiz'; label: string };

export interface CareerAnswer {
  text: string;
  actions: AnswerAction[];
  /** False when the data does not hold an answer and the reply says so. */
  known: boolean;
  /** What the answer was built from, shown under it. */
  basis: string;
}

export interface AskCareerContext {
  insight: PathInsight;
  match: PathMatch | undefined;
  /** Every path, ranked, so the answer can point to a better fit or a neighbour. */
  ranked: PathMatch[];
  titles: Record<string, string>;
  /** Short pace word per path, for comparisons. */
  paces: Record<string, string>;
  profile: Profile;
  goalId: string;
  quizTaken: boolean;
}

export interface CareerAdvisor {
  answer(question: string, context: AskCareerContext): Promise<CareerAnswer>;
}

const has = (q: string, ...words: string[]) => words.some((word) => q.includes(word));
const shareWords = { most: 'most of the week', some: 'a fair part of it', little: 'a smaller slice' } as const;

/** Suggestions change with the student's situation, so the first chip is usually the useful one. */
export function suggestedCareerQuestions(context: AskCareerContext): string[] {
  const { insight, goalId } = context;
  const missing = insight.skills.some((s) => s.state !== 'have');
  const list = [
    'Why does this fit me?',
    missing ? 'What am I missing?' : 'What should I do first?',
    'What does a typical week look like?',
    'How did people get in?',
    insight.opportunities.length > 0 ? 'What in my feed leads here?' : 'What should I do first?',
    'How does it compare to my other options?',
    'What does it pay?',
  ];
  if (goalId !== insight.path.id) list.splice(1, 0, 'Should I make this my goal?');
  return [...new Set(list)];
}

export function answerCareerQuestion(question: string, context: AskCareerContext): CareerAnswer {
  const q = question.toLowerCase();
  const { insight, match, ranked, titles, paces, profile, goalId, quizTaken } = context;
  const { path, extra } = insight;
  const name = path.title.toLowerCase();
  const isGoal = goalId === path.id;
  const goalAction: AnswerAction = isGoal
    ? { kind: 'openRoadmap', label: 'Open my roadmap' }
    : { kind: 'setGoal', pathId: path.id, label: 'Make this my goal' };
  const others = ranked.filter((m) => m.pathId !== path.id);
  const best = ranked[0];

  // Pay, companies and odds are not in the data. Say that first, so the keyword "get" in "what
  // would I get paid" does not fall through to the "how did people get in" answer.
  if (has(q, 'pay', 'salary', 'money', 'earning', 'wage', 'stipend', 'compensation', 'paid')) {
    return {
      text: `Pay is not in the data I have for ${name}, so I will not guess a number. It varies by company, city and role; the posting or the company's careers page is where to confirm it.`,
      actions: insight.opportunities[0] ? [{ kind: 'openOpportunity', opportunityId: insight.opportunities[0].opportunity.id, label: 'Open a matching posting' }] : [],
      known: false,
      basis: 'No pay data on this page',
    };
  }
  if (has(q, 'which compan', 'what compan', 'who hires', 'employer', 'chance', 'odds', 'likely', 'acceptance')) {
    return {
      text: `That is not something this data can tell you: there are no company lists or acceptance odds here. What it does show is how ${insight.people.total} people in the sample got in, and which cards in your feed lead toward it.`,
      actions: [{ kind: 'viewPath', pathId: path.id, label: 'See how people got in' }],
      known: false,
      basis: 'No company or odds data on this page',
    };
  }

  if (has(q, 'compare', ' vs', 'versus', 'other option', 'instead', 'better than', 'differ')) {
    const named = others.find((m) => q.includes((titles[m.pathId] ?? '').toLowerCase().split(' ')[0] || '\u0000'));
    const other = named ?? others[0];
    if (!other || !match) {
      return { text: 'There is no other path to compare with yet.', actions: [], known: false, basis: 'Your ranked matches' };
    }
    const lead = match.percent - other.percent;
    const verdict =
      lead > 4
        ? `${path.title} fits you better right now, ${match.percent}% to ${other.percent}%.`
        : lead < -4
          ? `${titles[other.pathId]} fits you a little better right now, ${other.percent}% to ${match.percent}%.`
          : `They are close for you: ${match.percent}% and ${other.percent}%.`;
    return {
      text: `${verdict}${paces[path.id] && paces[other.pathId] ? ` The pace differs: ${name} is "${paces[path.id]!.toLowerCase()}", ${titles[other.pathId]!.toLowerCase()} is "${paces[other.pathId]!.toLowerCase()}".` : ''} Put them side by side to see skills, roadmap size and openings in your feed.`,
      actions: [
        { kind: 'compare', pathIds: [path.id, other.pathId], label: `Compare with ${titles[other.pathId]}` },
        { kind: 'viewPath', pathId: other.pathId, label: `Look at ${titles[other.pathId]}` },
      ],
      known: true,
      basis: 'Your ranked matches',
    };
  }

  if (has(q, 'missing', 'gap', 'lack', 'need to learn', 'what skills', 'skill', 'ready', 'qualif', 'prepared')) {
    const missing = insight.skills.filter((s) => s.state !== 'have');
    if (insight.skills.length === 0) {
      return { text: `There is no skill list for ${name} on this page yet.`, actions: [], known: false, basis: 'No skill list' };
    }
    if (missing.length === 0) {
      return {
        text: `You already cover every skill on the list for ${name}. What is left is proof: the roadmap's build and apply steps.`,
        actions: [goalAction],
        known: true,
        basis: 'Your profile skills and finished steps',
      };
    }
    const notPlanned = missing.filter((s) => s.state === 'missing').map((s) => lowerLabel(s.skill.label));
    const roadmapNote =
      notPlanned.length === 0
        ? ' The roadmap for this path has a step for each of them.'
        : notPlanned.length === missing.length
          ? ' None of them has a roadmap step yet, so add them to your profile once you have them.'
          : ` The roadmap covers all but ${joinList(notPlanned)}.`;
    return {
      text: `You have ${insight.skillsHave} of the ${insight.skills.length} skills it expects. Still to build: ${joinList(missing.map((s) => lowerLabel(s.skill.label)))}.${roadmapNote}`,
      actions: [goalAction],
      known: true,
      basis: 'Your profile skills and finished steps',
    };
  }

  if (has(q, 'week', 'day to day', 'day-to-day', 'daily', 'what do they do', 'what is the work', 'what does it involve', 'what is it', 'involve', 'job like', 'work like')) {
    if (!extra) return { text: `There is no description of the work for ${name} here yet.`, actions: [], known: false, basis: 'No description' };
    const week = extra.week.map((w) => `${w.activity.toLowerCase()} (${shareWords[w.share]})`);
    return {
      text: `${extra.work} A typical week: ${joinList(week)}. ${extra.pace} This is a general picture of the role, not a schedule from one team.`,
      actions: [{ kind: 'viewPath', pathId: path.id, label: 'See the full picture' }],
      known: true,
      basis: 'General description of the role',
    };
  }

  if (has(q, 'people', 'get in', 'got in', 'others', 'background', 'how did', 'how do people', 'year', 'sophomore', 'freshman', 'junior', 'too early', 'too late')) {
    const { total, common, timelines } = insight.people;
    if (total === 0) {
      return { text: `There are no sample histories for ${name} yet, so I cannot say how people got in.`, actions: [], known: false, basis: 'No histories' };
    }
    const same = sameYearCount(insight, profile.year);
    const top = common.slice(0, 2).map((c) => `${lowerLabel(c.step.title)} (${c.count} of ${total})`);
    const example = timelines[0] ? ` One path: ${timelines[0].timeline.map(lowerLabel).join(', then ')}.` : '';
    return {
      text: `Of ${total} people in the sample who reached ${name}, ${same} ${same === 1 ? 'was a' : 'were'} ${profile.year.toLowerCase()}${same === 1 ? '' : 's'} like you. ${top.length ? `The most common steps: ${joinList(top)}.` : 'No single step stands out across them.'}${example} These histories are sample data with no names kept.`,
      actions: [goalAction],
      known: true,
      basis: `${total} sample histories`,
    };
  }

  if (has(q, 'feed', 'opportunit', 'posting', 'apply to', 'openings', 'cards', 'leads here')) {
    const leads = insight.opportunities;
    if (leads.length === 0) {
      return { text: `Nothing in your feed right now leads toward ${name}. The agents look again on the next sweep.`, actions: [], known: true, basis: 'Your feed' };
    }
    const names = leads.slice(0, 3).map((l) => `"${l.opportunity.title}"${l.saved || l.liked ? ' (you saved or liked it)' : ''}`);
    return {
      text: `${leads.length} ${leads.length === 1 ? 'card' : 'cards'} in your feed lead here: ${joinList(names)}${leads.length > 3 ? `, and ${leads.length - 3} more` : ''}.`,
      actions: leads.slice(0, 2).map((l) => ({ kind: 'openOpportunity' as const, opportunityId: l.opportunity.id, label: `Open ${l.opportunity.organizer}` })),
      known: true,
      basis: 'Your feed',
    };
  }

  if (has(q, 'first', 'start', 'begin', 'next', 'roadmap', 'plan', 'long', 'steps', 'how do i')) {
    const { plan } = insight;
    if (plan.steps === 0) return { text: `There is no roadmap for ${name} yet.`, actions: [], known: false, basis: 'No roadmap' };
    const phases = plan.phases.map((p) => `${lowerLabel(p.title)} (${lowerLabel(p.window)})`);
    return {
      text: `The roadmap has ${plan.phases.length} phases and ${plan.steps} steps: ${joinList(phases)}.${plan.done ? ` You have finished ${plan.done} already.` : ''}${plan.next ? ` Start with "${plan.next.title}". ${plan.next.detail}` : ' Every step is done.'}`,
      actions: [goalAction],
      known: true,
      basis: 'The roadmap for this path',
    };
  }

  if (has(q, 'goal', 'should i', 'pick', 'choose', 'commit', 'worth it')) {
    if (!match) return { text: 'There is no match for this path yet.', actions: [], known: false, basis: 'Your match' };
    const isBest = best?.pathId === path.id;
    const advice = isBest
      ? `It is your top match at ${match.percent}%, so it is a sensible goal.`
      : `It is at ${match.percent}%. Your top match is ${titles[best?.pathId ?? ''] ?? 'another path'} at ${best?.percent ?? 0}%, so weigh that one too.`;
    const switching = isGoal ? ' It is already your goal.' : ' Setting it as your goal swaps the roadmap; your finished steps stay marked.';
    return {
      text: `${advice}${switching}${quizTaken ? '' : ' Taking the quiz first would make this more reliable.'}`,
      actions: [goalAction, ...(isBest || !best ? [] : [{ kind: 'viewPath' as const, pathId: best.pathId, label: `Look at ${titles[best.pathId]}` }]), ...(quizTaken ? [] : [{ kind: 'startQuiz' as const, label: 'Take the quiz' }])],
      known: true,
      basis: 'Your ranked matches',
    };
  }

  if (has(q, 'fit', 'why', 'match', 'suit', 'right for', 'good for me')) {
    if (!match) return { text: 'There is no match for this path yet.', actions: [], known: false, basis: 'Your match' };
    const plus = match.reasons.filter((r) => r.tone === 'plus').map((r) => r.text);
    const minus = match.reasons.filter((r) => r.tone === 'minus').map((r) => r.text);
    return {
      text: `${match.percent}% match. ${plus.join(' ') || 'Not much points here yet.'}${minus.length ? ` On the other side: ${minus.join(' ')}` : ''}${match.unknowns.length ? ` ${match.unknowns[0]}` : ''}`,
      actions: [goalAction, ...(quizTaken ? [] : [{ kind: 'startQuiz' as const, label: 'Take the quiz' }])],
      known: true,
      basis: 'Your answers, profile and feed',
    };
  }

  return {
    text: `I can answer from what this page knows about ${name}: why it fits you, what you are missing, what a week looks like, how people got in, what in your feed leads here, and what the roadmap asks. I do not have pay, company names or odds.`,
    actions: [],
    known: false,
    basis: 'What this page knows',
  };
}

/** The local advisor. Swap in one that calls Grok with the same context once the agents are connected. */
export const localAdvisor: CareerAdvisor = {
  answer: (question, context) => Promise.resolve(answerCareerQuestion(question, context)),
};
