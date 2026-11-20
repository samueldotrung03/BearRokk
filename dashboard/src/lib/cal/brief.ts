// "Today's brief": a few sentences on what matters today and this week, and why. Built by rules
// from the calendar's own items and the week plan, so every name and date in it is one the
// student can find on the calendar. A model could return the same Brief shape later.
import { addDays, dayLabel, dayPhrase, daysBetween, hoursLabel } from './days.ts';
import type { Conflict, CxItem } from './items.ts';
import type { WeekPlan } from './planner.ts';

export type BriefTone = 'must' | 'should' | 'warn' | 'plan' | 'good';

export interface BriefLine {
  tone: BriefTone;
  text: string;
  /** A day the line is about, so the page can jump there. */
  day: string | null;
}

export interface Brief {
  headline: string;
  lines: BriefLine[];
}

export interface BriefInput {
  today: string;
  name: string;
  items: CxItem[];
  conflicts: Conflict[];
  plan: WeekPlan | null;
}

const list = (titles: string[]) =>
  titles.length <= 1 ? (titles[0] ?? '') : `${titles.slice(0, -1).join(', ')} and ${titles[titles.length - 1]}`;
const quote = (title: string) => `"${title}"`;
const firstSentence = (text: string) => (text.match(/^.*?[.!?](\s|$)/)?.[0] ?? text).trim();

export function buildBrief({ today, name, items, conflicts, plan }: BriefInput): Brief {
  const weekEnd = addDays(today, 6);
  const open = items.filter((item) => !item.done);
  const todays = open.filter((item) => item.day === today);
  const todayMust = todays.filter((item) => item.priority === 'must');
  const todayShould = todays.filter((item) => item.priority === 'should');
  const week = open.filter((item) => item.day > today && item.day <= weekEnd);
  const nextMust = open.find((item) => item.day >= today && item.priority === 'must' && item.kind !== 'reminder');
  const overdue = open.filter((item) => item.day < today && item.kind !== 'reminder');

  const dueText = (item: CxItem) => {
    const gap = daysBetween(today, item.day);
    return `${item.kind === 'deadline' ? 'closes' : 'is due'} ${dayPhrase(item.day, today, false)}${gap > 1 ? `, in ${gap} days` : ''}`;
  };
  // The next must within two weeks leads the brief when today is free; it is then not repeated below.
  const leadWithNext = todayMust.length === 0 && nextMust !== undefined && daysBetween(today, nextMust.day) < 14;

  let headline: string;
  if (todayMust.length > 0) {
    headline = `${name}, today has ${todayMust.length === 1 ? 'one thing' : `${todayMust.length} things`} you have to do.`;
  } else if (leadWithNext) {
    headline = `Nothing is due today, ${name}. ${quote(nextMust!.title)} ${dueText(nextMust!)}.`;
  } else if (week.length > 0) {
    headline = `A light week, ${name}: nothing you have to do, ${week.length} ${week.length === 1 ? 'thing' : 'things'} you should.`;
  } else {
    headline = `Your week is clear, ${name}.`;
  }

  const lines: BriefLine[] = [];
  if (todays.length > 0) {
    const parts = [];
    if (todayMust.length > 0) parts.push(`have to: ${list(todayMust.map((item) => quote(item.title)))}`);
    if (todayShould.length > 0) parts.push(`should: ${list(todayShould.map((item) => quote(item.title)))}`);
    lines.push({ tone: todayMust.length > 0 ? 'must' : 'should', text: `Today you ${parts.join('; you ')}.`, day: today });
  }

  if (nextMust && nextMust.day !== today) {
    const reminders = open.filter((item) => item.kind === 'reminder' && item.opportunityId === nextMust.opportunityId && item.day >= today && item.day < nextMust.day);
    const nudge = reminders[0] ? ` A reminder comes ${dayPhrase(reminders[0].day, today)}.` : '';
    lines.push({
      tone: 'must',
      text: leadWithNext
        ? `Why it matters: ${firstSentence(nextMust.why)}${nudge}`
        : `${quote(nextMust.title)} ${dueText(nextMust)}. ${firstSentence(nextMust.why)}${nudge}`,
      day: nextMust.day,
    });
  }

  const soonConflict = conflicts.find((c) => c.day >= today && daysBetween(today, c.day) < 14);
  if (soonConflict) {
    lines.push({
      tone: 'warn',
      text: `${dayLabel(soonConflict.day, today)} holds ${soonConflict.items.length} things you committed to: ${list(soonConflict.items.map((item) => quote(item.title)))}. Get one done earlier.`,
      day: soonConflict.day,
    });
  }

  if (overdue.length > 0) {
    lines.push({
      tone: 'warn',
      text: `${overdue.length === 1 ? `${quote(overdue[0]!.title)} is` : `${overdue.length} items are`} past ${overdue.length === 1 ? 'its' : 'their'} date. Tick ${overdue.length === 1 ? 'it' : 'them'} off if done, or decide to let ${overdue.length === 1 ? 'it' : 'them'} go.`,
      day: overdue[0]!.day,
    });
  }

  if (plan) {
    const todayBlocks = plan.blocks.filter((block) => block.day === today);
    if (plan.overloaded) {
      lines.push({
        tone: 'warn',
        text: `This week asks for ${hoursLabel(plan.needed)} of work and you have ${hoursLabel(plan.available)} open. Plan my week shows what does not fit.`,
        day: null,
      });
    } else if (todayBlocks.length > 0) {
      lines.push({
        tone: 'plan',
        text: `Suggested for today: ${list(todayBlocks.map((block) => `${hoursLabel(block.hours)} on ${quote(block.title)}`))}.`,
        day: today,
      });
    } else if (plan.needed > 0) {
      lines.push({ tone: 'plan', text: `About ${hoursLabel(plan.needed)} of work this week fits in your ${hoursLabel(plan.available)} of open time.`, day: null });
    }
  }

  const doneThisWeek = items.filter((item) => item.done && item.kind !== 'deadline' && item.day >= today && item.day <= weekEnd).length;
  if (doneThisWeek > 0) {
    lines.push({ tone: 'good', text: `${doneThisWeek} ${doneThisWeek === 1 ? 'item' : 'items'} due this week ${doneThisWeek === 1 ? 'is' : 'are'} already done.`, day: null });
  }

  if (lines.length === 0) {
    lines.push({ tone: 'good', text: 'Nothing with a date is coming up. Save or mark an opportunity and it appears here.', day: null });
  }
  return { headline, lines: lines.slice(0, 5) };
}

/** What to do about a day where commitments clash, using the plan when it already helps. */
export function conflictAdvice(conflict: Conflict, plan: WeekPlan | null, today: string): string {
  const names = list(conflict.items.map((item) => quote(item.title)));
  const started = conflict.items
    .map((item) => ({ item, first: plan?.blocks.find((block) => block.targetId === item.id && block.day < conflict.day) }))
    .filter((entry) => entry.first !== undefined);
  if (started.length > 0) {
    const when = list(started.map(({ item, first }) => `${quote(item.title)} ${dayPhrase(first!.day, today)}`));
    return `${names}. Your plan already starts ${when}, so the day itself stays lighter.`;
  }
  return `${names}. Get one of them done a day or two earlier so this day is not a scramble.`;
}
