// Search behind the Command-/ launcher: pages, opportunities, roadmap steps and quick actions in
// one ranked list, the way Spotlight mixes apps, files and actions.
import { opportunities } from '../data/sample.ts';
import { rankFeed } from '../state/ranking.ts';
import type { Action, AppState } from '../state/store.ts';
import { planFor } from './roadmap.ts';
import { dueLabel } from './time.ts';

export type SpotlightKind = 'page' | 'opportunity' | 'step' | 'action' | 'ask';

export interface SpotlightItem {
  id: string;
  kind: SpotlightKind;
  title: string;
  subtitle: string;
  /** Exactly one of these says what Return does. */
  to?: string;
  open?: string;
  dispatch?: Action;
  ask?: string;
}

export interface SpotlightGroup {
  title: string;
  items: SpotlightItem[];
}

const PAGES: { to: string; title: string; subtitle: string; words: string }[] = [
  { to: '/', title: 'Feed', subtitle: 'For you and everything your agents found', words: 'feed home for you reel opportunities' },
  { to: '/roadmap', title: 'Roadmap', subtitle: 'Your goal, the steps and your progress', words: 'roadmap plan goal steps progress' },
  { to: '/discover', title: 'Career discovery', subtitle: 'Paths that fit you', words: 'career discovery paths explore' },
  { to: '/applications', title: 'Applications', subtitle: 'Statuses, drafts and reminders', words: 'applications apply status tracker drafts' },
  { to: '/today', title: 'Dashboard', subtitle: 'Everything in one place: today, this week, applications and roadmap', words: 'dashboard today home brief overview track everything' },
  { to: '/calendar', title: 'Calendar', subtitle: 'What you have to do and should do', words: 'calendar deadlines dates schedule week' },
  { to: '/saved', title: 'Saved', subtitle: 'Cards you kept for later', words: 'saved bookmarks later' },
  { to: '/agents', title: 'Agents', subtitle: 'What your agents are doing', words: 'agents grok ai activity usage' },
  { to: '/search', title: 'Search', subtitle: 'Search the web and your postings, ranked for you', words: 'search find look up internship web ai' },
  { to: '/profile', title: 'Profile', subtitle: 'Year, interests, skills and location', words: 'profile settings interests skills account' },
];

const ASKS = ['What should I do this week?', 'What are my deadlines?', 'Am I on track?', 'Find the best matches'];

/** How well a text matches the query: a start-of-word hit beats a hit in the middle. 0 is no match. */
export function score(text: string, query: string): number {
  const hay = text.toLowerCase();
  const terms = query.toLowerCase().split(/\s+/).filter(Boolean);
  if (terms.length === 0) return 0;
  let total = 0;
  for (const term of terms) {
    const at = hay.indexOf(term);
    if (at === -1) return 0;
    total += at === 0 ? 3 : /[^a-z0-9]/.test(hay[at - 1]!) ? 2 : 1;
  }
  return total / terms.length;
}

export function spotlight(query: string, state: AppState, now = Date.now()): SpotlightGroup[] {
  const q = query.trim();
  const visible = rankFeed(opportunities.filter((o) => !state.dismissed.includes(o.id)), state, now);
  const plan = planFor(state);
  const card = (o: (typeof visible)[number]): SpotlightItem => ({
    id: `opp-${o.id}`,
    kind: 'opportunity',
    title: o.title,
    subtitle: [o.organizer, o.deadline ? dueLabel(o.deadline, now) : null].filter(Boolean).join(' · '),
    open: o.id,
  });
  const page = (p: (typeof PAGES)[number]): SpotlightItem => ({ id: `page-${p.to}`, kind: 'page', title: p.title, subtitle: p.subtitle, to: p.to });

  // Nothing typed yet: what the student most likely wants next.
  if (!q) {
    return [
      {
        title: 'Suggested',
        items: [
          ...(plan.next
            ? [{ id: 'next-step', kind: 'step' as const, title: `Mark done: ${plan.next.title}`, subtitle: 'Your next roadmap step', dispatch: { type: 'toggleStep', id: plan.next.id } as Action }]
            : []),
          ...ASKS.slice(0, 2).map((ask) => ({ id: `ask-${ask}`, kind: 'ask' as const, title: ask, subtitle: 'Ask BearRok', ask })),
        ],
      },
      { title: 'Top picks for you', items: visible.slice(0, 3).map(card) },
      { title: 'Go to', items: PAGES.slice(0, 5).map(page) },
    ].filter((group) => group.items.length > 0);
  }

  const best = <T,>(list: T[], text: (item: T) => string, limit: number) =>
    list
      .map((item) => ({ item, points: score(text(item), q) }))
      .filter((entry) => entry.points > 0)
      .sort((a, b) => b.points - a.points)
      .slice(0, limit);

  const cards = best(visible, (o) => `${o.title} ${o.organizer} ${o.type} ${o.tags.join(' ')} ${o.location ?? ''}`, 5);
  const pages = best(PAGES, (p) => `${p.title} ${p.words}`, 3);
  const steps = best(plan.steps.filter((step) => !state.doneSteps.includes(step.id)), (step) => step.title, 3);

  const actions: SpotlightItem[] = [];
  for (const { item: o } of cards.slice(0, 2)) {
    actions.push({
      id: `save-${o.id}`,
      kind: 'action',
      title: `${state.saved.includes(o.id) ? 'Remove from saved' : 'Save'}: ${o.title}`,
      subtitle: o.organizer,
      dispatch: { type: 'toggleSaved', id: o.id },
    });
    if (!state.extraSteps.includes(o.id)) {
      actions.push({ id: `roadmap-${o.id}`, kind: 'action', title: `Start a roadmap: ${o.title}`, subtitle: 'Builds the steps from its posting', dispatch: { type: 'addStep', id: o.id } });
    }
  }

  const groups: SpotlightGroup[] = [
    { title: 'Opportunities', items: cards.map((entry) => card(entry.item)) },
    { title: 'Pages', items: pages.map((entry) => page(entry.item)) },
    {
      title: 'Roadmap steps',
      items: steps.map(({ item: step }) => ({ id: `step-${step.id}`, kind: 'step' as const, title: `Mark done: ${step.title}`, subtitle: step.due ? dueLabel(step.due, now) : 'Roadmap step', dispatch: { type: 'toggleStep', id: step.id } as Action })),
    },
    { title: 'Actions', items: actions },
    { title: 'Ask BearRok', items: [{ id: 'ask-query', kind: 'ask' as const, title: q, subtitle: 'Ask about your feed, roadmap, applications and calendar', ask: q }] },
  ].filter((group) => group.items.length > 0);

  // The single best match goes to the top, as Spotlight's "Top Hit".
  const top = [
    ...cards.map((entry) => ({ item: card(entry.item), points: entry.points })),
    ...pages.map((entry) => ({ item: page(entry.item), points: entry.points + 0.5 })),
  ].sort((a, b) => b.points - a.points)[0];
  if (top) {
    for (const group of groups) group.items = group.items.filter((item) => item.id !== top.item.id);
    return [{ title: 'Top hit', items: [top.item] }, ...groups.filter((group) => group.items.length > 0)];
  }
  return groups;
}
