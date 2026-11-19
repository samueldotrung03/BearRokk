// Answers a student's question about one opportunity from what is already on its card. This is
// a stand-in: in the product the question goes to Grok together with the posting, and an answer
// carries the quote it rests on. Here every answer is assembled from the sample data, and when
// the posting does not say something the answer says so instead of guessing.
import type { ApplicationInfo, Opportunity, Profile, RoadmapStep } from '../types.ts';
import { dueLabel, relativeTime, shortDate } from './time.ts';

export interface AskContext {
  info: ApplicationInfo | undefined;
  step: RoadmapStep | undefined;
  profile: Profile;
}

export const suggestedQuestions = ['When is it due?', 'What do I need to apply?', 'Why does this fit me?', 'How do I apply?'];

const formatWords = { online: 'online', in_person: 'in person', hybrid: 'hybrid' } as const;

const list = (items: string[]) =>
  items.length <= 1 ? (items[0] ?? '') : `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`;

const has = (question: string, ...words: string[]) => words.some((word) => question.includes(word));

export function answerQuestion(o: Opportunity, question: string, { info, step, profile }: AskContext): string {
  const q = question.toLowerCase();

  if (has(q, 'deadline', 'due', 'when', 'date', 'close', 'late', 'time left', 'start')) {
    const parts: string[] = [];
    if (o.deadline) parts.push(`The deadline is ${shortDate(o.deadline)} (${dueLabel(o.deadline).toLowerCase()}).`);
    if (o.startTime) parts.push(`It starts ${shortDate(o.startTime)}.`);
    if (parts.length === 0) parts.push('The posting does not give a deadline or a start date. Check the official page before planning around it.');
    return parts.join(' ');
  }

  if (has(q, 'question', 'prompt', 'essay', 'write')) {
    if (info?.requiresLogin) return "The questions are behind a sign-in on the organizer's site, so they could not be read. Sign in there to see them.";
    if (!info || info.prompts.length === 0) return 'There are no written questions for this one.';
    return `It asks ${info.prompts.length === 1 ? 'one question' : `${info.prompts.length} questions`}: ${info.prompts.join(' ')}`;
  }

  if (has(q, 'need', 'require', 'material', 'document', 'submit', 'resume', 'transcript', 'prepare', 'eligib')) {
    if (!info) return 'The posting does not list what to bring or send.';
    const questions = info.requiresLogin
      ? ' The written questions are behind a sign-in on the organizer\'s site.'
      : info.prompts.length > 0
        ? ` It also has ${info.prompts.length === 1 ? 'one written question' : `${info.prompts.length} written questions`}.`
        : '';
    return `You need ${list(info.materials.map((name) => name.toLowerCase()))}.${questions}`;
  }

  if (has(q, 'where', 'location', 'remote', 'online', 'in person', 'in-person', 'place', 'far')) {
    if (!o.format && !o.location) return 'The posting does not say where it takes place.';
    return `It is ${o.format ? formatWords[o.format] : 'held'}${o.location ? `, ${o.location}` : ''}.`;
  }

  if (has(q, 'pay', 'paid', 'salary', 'stipend', 'cost', 'free', 'fee', 'money', 'wage')) {
    return 'The posting does not state pay or cost, so there is nothing reliable to tell you. The official page is the place to confirm it.';
  }

  if (has(q, 'fit', 'why', 'match', 'right for', 'good for', 'qualif', 'chance', 'should i')) {
    const shared = o.tags.filter((tag) => [...profile.skills, ...profile.interests].some((own) => own.toLowerCase() === tag.toLowerCase()));
    const overlap = shared.length > 0 ? ` It lines up with ${list(shared)} on your profile.` : '';
    return `${o.fitExplanation}${overlap} The agents scored the fit at ${Math.round(o.baseScore * 100)} out of 100.`;
  }

  if (has(q, 'roadmap', 'step', 'plan', 'goal')) {
    return step
      ? `It is on your roadmap as the step "${step.title}". ${step.detail}`
      : 'It is not a step on your roadmap yet. Save or like it and you can add it from the Roadmap page.';
  }

  if (has(q, 'apply', 'how', 'sign up', 'register', 'join', 'rsvp')) {
    const first = info && info.materials.length > 0 ? `Gather ${list(info.materials.map((name) => name.toLowerCase()))}, then ` : '';
    const when = o.deadline ? ` before ${shortDate(o.deadline)}` : '';
    return `${first}${first ? 'open' : 'Open'} the official page with the Official posting button and submit there${when}. Set the status to "To apply" here and the reminders and the Applications page keep track of it.`;
  }

  if (has(q, 'who', 'organizer', 'company', 'host', 'run')) {
    return `It is from ${o.organizer}. The card was last checked against the official page ${relativeTime(o.lastCheckedAt)}.`;
  }

  if (has(q, 'unknown', 'missing', 'not sure', 'unclear')) {
    return o.unknowns.length > 0
      ? `The agents could not confirm: ${list(o.unknowns.map((unknown) => unknown.label.toLowerCase()))}.`
      : 'Nothing on this card is marked as unconfirmed.';
  }

  return `This is a ${o.type} from ${o.organizer}. ${o.fitExplanation} You can ask about the deadline, what you need, where it is, how to apply or why it fits you.`;
}
