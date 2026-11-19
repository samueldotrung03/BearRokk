// The app-wide assistant. It answers from everything the app knows about the student (feed,
// roadmap, applications, calendar) and offers one-click actions. The answers are built here by
// rules over that data; `respond` is the one function a real Grok call would replace.
import { careerPaths, opportunities } from '../data/sample.ts';
import { rankFeed } from '../state/ranking.ts';
import type { Action, AppState } from '../state/store.ts';
import type { ApplicationStatus, Opportunity, OpportunityType } from '../types.ts';
import { STATUSES, statusLabel } from './applications.ts';
import { calendarItems, dayKey, kindLabel, type CalendarItem } from './calendar.ts';
import { planFor } from './roadmap.ts';
import { dueLabel, shortDate } from './time.ts';

/** Something the student can do straight from an answer. Nothing happens until they click. */
export interface AssistantAction {
  label: string;
  /** A page to go to. */
  to?: string;
  /** A change to make in the store. */
  dispatch?: Action;
  /** An opportunity whose details to open. */
  open?: string;
}

export interface AssistantReply {
  text: string;
  /** Short lines shown as a list under the text. */
  points?: string[];
  actions?: AssistantAction[];
}

const DAY = 86_400_000;

const typeWords: Record<OpportunityType, string[]> = {
  internship: ['internship', 'internships', 'intern'],
  research: ['research', 'lab'],
  scholarship: ['scholarship', 'scholarships', 'funding', 'money'],
  hackathon: ['hackathon', 'hackathons'],
  event: ['event', 'events', 'fair', 'session', 'networking'],
  club: ['club', 'clubs'],
};

const has = (text: string, ...words: string[]) => words.some((word) => text.includes(word));

/** The opportunity a message names, by the most title and organizer words in common. */
export function findOpportunity(text: string, pool: Opportunity[]): Opportunity | undefined {
  const words = new Set(text.toLowerCase().split(/[^a-z0-9]+/).filter((word) => word.length > 3));
  const filler = new Set(['intern', 'internship', 'summer', 'engineering', 'this', 'that', 'with', 'mark', 'save', 'like', 'track', 'open', 'show', 'about', 'apply', 'applying', 'applied', 'roadmap', 'start']);
  let best: Opportunity | undefined;
  let bestScore = 0;
  for (const o of pool) {
    const own = `${o.title} ${o.organizer}`.toLowerCase().split(/[^a-z0-9]+/);
    const score = own.filter((word) => words.has(word) && !filler.has(word)).length;
    if (score > bestScore) {
      best = o;
      bestScore = score;
    }
  }
  return best;
}

const line = (item: CalendarItem) => `${shortDate(item.date)} · ${kindLabel[item.kind]}: ${item.title}`;

export function respond(input: string, state: AppState, now = Date.now()): AssistantReply {
  const text = input.toLowerCase().trim();
  const visible = opportunities.filter((o) => !state.dismissed.includes(o.id));
  const ranked = rankFeed(visible, state, now);
  const plan = planFor(state);
  const items = calendarItems(state, now).filter((item) => !item.done);
  const today = dayKey(now);
  const named = findOpportunity(text, visible);

  if (!text) return help();

  // Doing something to one opportunity. The reply offers the action; the click performs it.
  if (named) {
    const status = STATUSES.find((value) => text.includes(statusLabel[value].toLowerCase()) || text.includes(value.replace('_', ' ')));
    if (status && has(text, 'mark', 'set', 'track', 'status', 'move')) {
      return {
        text: `I can mark ${named.title} as "${statusLabel[status]}".${status === 'to_apply' || status === 'applying' ? ' Reminders are then set 7 days before, 2 days before and on the day.' : ''}`,
        actions: [
          { label: `Mark as ${statusLabel[status]}`, dispatch: { type: 'setApplication', id: named.id, status: status as ApplicationStatus } },
          { label: 'Open details', open: named.id },
        ],
      };
    }
    if (has(text, 'save', 'bookmark')) {
      return { text: `Save ${named.title}?`, actions: [{ label: state.saved.includes(named.id) ? 'Remove from saved' : 'Save it', dispatch: { type: 'toggleSaved', id: named.id } }] };
    }
    if (has(text, 'roadmap', 'plan for')) {
      return {
        text: `I can build a step-by-step roadmap for ${named.title} from its posting: what to get ready and by when.`,
        actions: [{ label: 'Start the roadmap', dispatch: { type: 'addStep', id: named.id } }, { label: 'Open details', open: named.id }],
      };
    }
    return {
      text: `${named.title}, ${named.organizer}. ${named.fitExplanation}`,
      points: [
        named.deadline ? `Deadline: ${shortDate(named.deadline)}` : 'The posting does not state a deadline.',
        `Fit: ${Math.round(named.baseScore * 100)} of 100`,
        ...named.unknowns.map((unknown) => unknown.label),
      ],
      actions: [{ label: 'Open details', open: named.id }, { label: 'Save it', dispatch: { type: 'toggleSaved', id: named.id } }],
    };
  }

  if (has(text, 'today', 'this week', 'what should i do', 'what do i do', 'next', 'focus', 'priorit')) {
    const end = dayKey(now + 6 * DAY);
    const week = items.filter((item) => item.day >= today && item.day <= end);
    const musts = week.filter((item) => item.priority === 'must');
    const shoulds = week.filter((item) => item.priority === 'should');
    const overdue = items.filter((item) => item.day < today && item.kind !== 'reminder');
    if (week.length === 0 && overdue.length === 0) {
      return {
        text: plan.next ? `Nothing is due this week. A good use of the time is your next roadmap step: ${plan.next.title}.` : 'Nothing is due this week and every roadmap step is done.',
        actions: [{ label: 'Open roadmap', to: '/roadmap' }],
      };
    }
    return {
      text: `This week you have ${musts.length} thing${musts.length === 1 ? '' : 's'} you have to do and ${shoulds.length} you should do.${overdue.length ? ` ${overdue.length} overdue.` : ''} Start with the first line.`,
      points: [...overdue.map((item) => `Overdue · ${line(item)}`), ...musts.map(line), ...shoulds.map(line)].slice(0, 6),
      actions: [{ label: 'Open calendar', to: '/calendar' }, ...(plan.next ? [{ label: `Tick off: ${plan.next.title}`, dispatch: { type: 'toggleStep', id: plan.next.id } as Action }] : [])],
    };
  }

  if (has(text, 'deadline', 'due', 'closing', 'when')) {
    const deadlines = items.filter((item) => item.kind === 'deadline' && item.day >= today).slice(0, 5);
    if (deadlines.length === 0) {
      const soon = ranked.filter((o) => o.deadline).sort((a, b) => a.deadline!.localeCompare(b.deadline!)).slice(0, 3);
      return {
        text: 'You are not tracking anything with a deadline yet. These in your feed close soonest:',
        points: soon.map((o) => `${shortDate(o.deadline!)} · ${o.title}`),
        actions: soon.map((o) => ({ label: `Open ${o.organizer}`, open: o.id })),
      };
    }
    return {
      text: `Your next deadline is ${deadlines[0]!.title}, ${dueLabel(deadlines[0]!.date, now).toLowerCase()}.`,
      points: deadlines.map((item) => `${shortDate(item.date)} · ${item.title} (${item.priority === 'must' ? 'have to do' : 'should do'})`),
      actions: [{ label: 'Open calendar', to: '/calendar' }, { label: 'Open applications', to: '/applications' }],
    };
  }

  if (has(text, 'roadmap', 'progress', 'on track', 'goal', 'step')) {
    return {
      text: `Your goal is "${plan.roadmap.goal}". You have done ${plan.doneCount} of ${plan.steps.length} steps (${plan.percent}%).${plan.next ? ` Next: ${plan.next.title}${plan.next.due ? `, ${dueLabel(plan.next.due, now).toLowerCase()}` : ''}.` : ''}`,
      points: plan.steps.filter((step) => !state.doneSteps.includes(step.id)).slice(1, 4).map((step) => `Then: ${step.title}`),
      actions: [
        { label: 'Open roadmap', to: '/roadmap' },
        ...(plan.next ? [{ label: 'Mark next step done', dispatch: { type: 'toggleStep', id: plan.next.id } as Action }] : []),
      ],
    };
  }

  if (has(text, 'application', 'applying', 'applied', 'status', 'tracking')) {
    const entries = Object.entries(state.applications);
    if (entries.length === 0) {
      return { text: 'You are not tracking any applications yet. Open a card and set "Applying?" to start.', actions: [{ label: 'Open feed', to: '/' }] };
    }
    return {
      text: `You are tracking ${entries.length} application${entries.length === 1 ? '' : 's'}.`,
      points: entries.map(([id, application]) => {
        const o = opportunities.find((candidate) => candidate.id === id);
        return `${statusLabel[application.status]} · ${o?.title ?? id}${o?.deadline ? ` · ${dueLabel(o.deadline, now).toLowerCase()}` : ''}`;
      }),
      actions: [{ label: 'Open applications', to: '/applications' }],
    };
  }

  if (has(text, 'career', 'path', 'what should i be', 'major')) {
    const current = careerPaths.find((path) => path.id === state.goalId);
    const strong = careerPaths.filter((path) => path.match === 'strong');
    return {
      text: current ? `You are aiming at ${current.title}. ${current.whyItFits}` : 'You have not picked a path yet.',
      points: strong.filter((path) => path.id !== state.goalId).map((path) => `Also a strong match: ${path.title}. ${path.oneLine}`),
      actions: [{ label: 'Explore career paths', to: '/discover' }],
    };
  }

  if (has(text, 'agent', 'searching', 'working')) {
    return { text: 'Your agents search, check and rank in the background. The Agents page shows what each one is doing right now.', actions: [{ label: 'Open agents', to: '/agents' }] };
  }

  // Finding opportunities: by type, by a word in the card, or simply the best matches.
  const types = (Object.keys(typeWords) as OpportunityType[]).filter((type) => typeWords[type].some((word) => text.includes(word)));
  const wanted = text.split(/[^a-z0-9+#]+/).filter((word) => word.length > 2 && !['find', 'show', 'any', 'some', 'the', 'for', 'best', 'match', 'matches', 'recommend', 'me', 'what', 'are', 'there', 'with', 'good'].includes(word));
  const asksToFind = has(text, 'find', 'show', 'recommend', 'best', 'match', 'any ', 'looking', 'remote', 'online') || types.length > 0;
  if (asksToFind) {
    const format = has(text, 'remote', 'online') ? 'online' : has(text, 'in person', 'in-person') ? 'in_person' : null;
    let found = ranked.filter((o) => (types.length === 0 || types.includes(o.type)) && (!format || o.format === format));
    const byWord = found.filter((o) => wanted.some((word) => `${o.title} ${o.organizer} ${o.tags.join(' ')} ${o.location ?? ''}`.toLowerCase().includes(word)));
    if (types.length === 0 && byWord.length > 0) found = byWord;
    found = found.slice(0, 3);
    if (found.length === 0) {
      return { text: 'Nothing in your feed matches that right now. Your agents keep searching, and you can tell them what to look for on the Agents page.', actions: [{ label: 'Open agents', to: '/agents' }] };
    }
    return {
      text: `Here ${found.length === 1 ? 'is the best match' : `are the top ${found.length}`} from your feed, in the order your ranking puts them.`,
      points: found.map((o) => `${o.title} · ${o.organizer} · fit ${Math.round(o.baseScore * 100)}${o.deadline ? ` · ${dueLabel(o.deadline, now).toLowerCase()}` : ''}`),
      actions: found.map((o) => ({ label: `Open: ${o.organizer}`, open: o.id })),
    };
  }

  return help();
}

function help(): AssistantReply {
  return {
    text: 'I can answer from your feed, roadmap, applications and calendar. Try one of these:',
    points: ['What should I do this week?', 'Find remote internships', 'What are my deadlines?', 'Am I on track with my roadmap?', 'Mark Northwind as applying'],
  };
}

/** Starter questions that fit the page the student is on. */
export function suggestionsFor(pathname: string): string[] {
  if (pathname.startsWith('/roadmap')) return ['Am I on track?', 'What should I do this week?', 'What is my next step?'];
  if (pathname.startsWith('/applications')) return ['What are my deadlines?', 'Status of my applications', 'What should I do today?'];
  if (pathname.startsWith('/calendar')) return ['What should I do this week?', 'What are my deadlines?', 'What is my next step?'];
  if (pathname.startsWith('/discover')) return ['Which career path fits me?', 'Am I on track?', 'Find research openings'];
  if (pathname.startsWith('/agents')) return ['What are my agents doing?', 'Find the best matches', 'What should I do this week?'];
  return ['Find the best matches', 'What should I do this week?', 'What are my deadlines?'];
}
