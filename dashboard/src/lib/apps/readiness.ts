// How ready one application is, and the single thing to do next. The score weighs what is
// written, what is gathered and how much time is left for the rest. The deadline is only ever the
// posting's own: when the posting states none, the next action is to confirm it, never to assume one.
import { statusLabel } from '../applications.ts';
import type { Application, ApplicationInfo, ApplicationStatus, Opportunity } from '../../types.ts';
import { countWords, findBlanks, parseLimit, shortPrompt } from './text.ts';

const DAY = 86_400_000;

export type DraftState = 'empty' | 'started' | 'ready';

/** A draft is ready when it has no blanks left and sits inside the limit the prompt states. */
export function draftState(prompt: string, draft: string | undefined): DraftState {
  const text = (draft ?? '').trim();
  if (!text) return 'empty';
  const words = countWords(text);
  const { max } = parseLimit(prompt);
  if (findBlanks(text).length > 0) return 'started';
  if (max !== null && (words > max || words < max * 0.5)) return 'started';
  if (max === null && words < 25) return 'started';
  return 'ready';
}

export type ActionKind =
  | 'decide'
  | 'confirm_deadline'
  | 'read_questions'
  | 'draft'
  | 'finish_draft'
  | 'gather'
  | 'submit'
  | 'follow_up'
  | 'closed';

export interface NextAction {
  kind: ActionKind;
  label: string;
  detail: string;
  /** Which prompt or material the action is about, so the page can jump straight to it. */
  promptIndex?: number;
  material?: string;
  /** A status the action moves the application to in one click. */
  moveTo?: ApplicationStatus;
}

export interface Readiness {
  /** 0 to 100. */
  score: number;
  drafts: { ready: number; started: number; total: number };
  materials: { done: number; total: number };
  /** Whole days until the posting's deadline, or null when it states none. */
  daysLeft: number | null;
  next: NextAction;
  /** Higher means it should be done sooner. Used to rank the "what to do next" strip. */
  urgency: number;
}

/** Whole days until a deadline, counting the rest of today as part of day 0. */
export function daysLeftUntil(deadline: string | null, now = Date.now()): number | null {
  if (!deadline) return null;
  return Math.ceil((new Date(deadline).getTime() - now) / DAY);
}

function why(daysLeft: number | null, remaining: number): string {
  if (daysLeft === null) return 'The posting states no deadline.';
  if (daysLeft <= 0) return 'Due today.';
  const days = `${daysLeft} ${daysLeft === 1 ? 'day' : 'days'} left`;
  return remaining > 0 ? `${days}, ${remaining} ${remaining === 1 ? 'thing' : 'things'} to finish.` : `${days}.`;
}

export function readinessOf(
  o: Opportunity,
  application: Application,
  info: ApplicationInfo | undefined,
  now = Date.now(),
): Readiness {
  const prompts = info?.prompts ?? [];
  const materials = info?.materials ?? [];
  // Optional prompts are shown and helped with, but they do not hold an application back.
  const required = prompts.map((prompt, index) => ({ prompt, index })).filter(({ prompt }) => !parseLimit(prompt).optional);
  const states = required.map(({ prompt, index }) => ({ index, prompt, state: draftState(prompt, application.drafts[index]) }));
  const drafts = {
    ready: states.filter((s) => s.state === 'ready').length,
    started: states.filter((s) => s.state === 'started').length,
    total: states.length,
  };
  const done = materials.filter((m) => application.materialsDone.includes(m)).length;
  const daysLeft = daysLeftUntil(o.deadline, now);
  const remaining = drafts.total - drafts.ready + (materials.length - done);

  // A started draft counts for half: it exists, but it still needs work before it can be sent.
  const draftRatio = drafts.total ? (drafts.ready + drafts.started * 0.5) / drafts.total : 1;
  const materialRatio = materials.length ? done / materials.length : 1;
  // Time is good when there is plenty of it for what is left. An unknown deadline is neither.
  const timeRatio = remaining === 0 ? 1 : daysLeft === null ? 0.5 : daysLeft < 0 ? 0 : Math.min(1, daysLeft / (remaining * 3));
  let score = Math.round(100 * (0.45 * draftRatio + 0.4 * materialRatio + 0.15 * timeRatio));
  if (application.status === 'applied') score = 100;

  const next = nextActionFor(o, application, info, states, materials, daysLeft);
  const statusWeight: Record<ApplicationStatus, number> = { interested: 0.5, to_apply: 1, applying: 1.2, applied: 0.05 };
  // Work left divided by time left: little time and a lot to do floats to the top.
  const timeLeft = daysLeft === null ? 21 : Math.max(daysLeft, 0) + 1;
  let urgency = (statusWeight[application.status] * (1 + remaining)) / timeLeft;
  if (next.kind === 'closed') urgency = 0;
  if (next.kind === 'confirm_deadline') urgency = Math.max(urgency, 0.3);

  return { score, drafts, materials: { done, total: materials.length }, daysLeft, next, urgency };
}

function nextActionFor(
  o: Opportunity,
  application: Application,
  info: ApplicationInfo | undefined,
  states: { index: number; prompt: string; state: DraftState }[],
  materials: string[],
  daysLeft: number | null,
): NextAction {
  const { status } = application;
  const missing = materials.filter((m) => !application.materialsDone.includes(m));
  const remaining = states.filter((s) => s.state !== 'ready').length + missing.length;

  if (status === 'applied') {
    return { kind: 'follow_up', label: `Follow up with ${o.organizer}`, detail: 'Sent. Keep the confirmation and get ready for a reply.' };
  }
  if (daysLeft !== null && daysLeft < 0) {
    return { kind: 'closed', label: 'The deadline has passed', detail: 'Check the posting in case it was extended, or stop tracking it.' };
  }
  if (status === 'interested') {
    return {
      kind: 'decide',
      label: 'Decide whether to apply',
      detail: daysLeft === null ? 'Move it to To apply to start reminders once a deadline is confirmed.' : `${why(daysLeft, remaining)} Move it to To apply to start reminders.`,
      moveTo: 'to_apply',
    };
  }
  if (daysLeft === null) {
    return { kind: 'confirm_deadline', label: 'Confirm the deadline', detail: 'The posting states no deadline, so there is nothing to remind you on yet. Check the organizer’s page.' };
  }
  if (info?.requiresLogin && (info.prompts.length === 0)) {
    return { kind: 'read_questions', label: 'Sign in to read the questions', detail: `The questions sit behind a sign-in on ${o.organizer}’s site. ${why(daysLeft, remaining)}` };
  }
  const empty = states.find((s) => s.state === 'empty');
  if (empty) {
    return { kind: 'draft', label: `Draft “${shortPrompt(empty.prompt, 40)}”`, detail: why(daysLeft, remaining), promptIndex: empty.index };
  }
  const started = states.find((s) => s.state === 'started');
  if (started) {
    return { kind: 'finish_draft', label: `Finish “${shortPrompt(started.prompt, 40)}”`, detail: `${finishReason(started.prompt, application.drafts[started.index] ?? '')} ${why(daysLeft, remaining)}`, promptIndex: started.index };
  }
  const material = missing[0];
  if (material) {
    return { kind: 'gather', label: `Gather: ${material}`, detail: why(daysLeft, remaining), material };
  }
  return {
    kind: 'submit',
    label: 'Submit it',
    detail: `Everything is ready. Send it on ${o.organizer}’s page, then mark it ${statusLabel.applied}.`,
  };
}

function finishReason(prompt: string, draft: string): string {
  const blanks = findBlanks(draft).length;
  if (blanks) return `${blanks} ${blanks === 1 ? 'blank' : 'blanks'} left to fill.`;
  const { max } = parseLimit(prompt);
  const words = countWords(draft);
  if (max !== null && words > max) return `${words - max} words over the limit.`;
  if (max !== null) return `${words} of ${max} words so far.`;
  return 'Still short.';
}

export interface RankedAction {
  id: string;
  action: NextAction;
  urgency: number;
}

/** Every tracked application's next action, most urgent first. Applied and closed ones go last. */
export function rankActions(items: { id: string; readiness: Readiness }[]): RankedAction[] {
  return items
    .map(({ id, readiness }) => ({ id, action: readiness.next, urgency: readiness.urgency }))
    .sort((a, b) => b.urgency - a.urgency);
}
