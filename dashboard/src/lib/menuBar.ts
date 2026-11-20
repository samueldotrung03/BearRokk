// What the menu bar icon's menu shows: the key deadlines (applications set to To apply or
// Applying first, then saved postings), and the feed's top recommendation, as ranked for the feed.
import type { MenuBarData } from './desktopBridge.ts';
import type { TrackedApplication } from '../state/live.tsx';
import type { Opportunity } from '../types.ts';

const DAY = 86_400_000;

/** "today", "tomorrow", "in 4 days". */
function inDays(deadline: number, now: number): string {
  const days = Math.floor((new Date(deadline).setHours(0, 0, 0, 0) - new Date(now).setHours(0, 0, 0, 0)) / DAY);
  return days <= 0 ? 'today' : days === 1 ? 'tomorrow' : `in ${days} days`;
}

/** One upcoming deadline: what it is for, when (ms), the page that opens it, and "in 4 days". */
export interface DueItem {
  title: string;
  at: number;
  path: string;
  when: string;
}

/**
 * The facts behind the menu bar menu and the quick panel, before they are turned into labels:
 * up to five deadlines soonest first, and the feed's first card.
 */
export interface Glance {
  signedIn: boolean;
  searching: boolean;
  deadlines: DueItem[];
  top: { opportunity: Opportunity; path: string } | null;
}

export interface GlanceInput {
  signedIn: boolean;
  searching: boolean;
  /** The feed in the order the feed ranks it, best first. */
  ranked: Opportunity[];
  applications: Record<string, TrackedApplication & { title?: string }>;
  /** Postings the account holds (feed and saved), for titles and saved deadlines. */
  postings: Opportunity[];
  saved: string[];
  now?: number;
}

export function glance(input: GlanceInput): Glance {
  const now = input.now ?? Date.now();
  const byId = new Map(input.postings.map((o) => [o.id, o]));
  type Due = { at: number; title: string; path: string; tracked: boolean };
  const due: Due[] = [];
  for (const a of Object.values(input.applications)) {
    if (a.status !== 'to_apply' && a.status !== 'applying') continue;
    const at = a.deadline ? Date.parse(a.deadline) : NaN;
    if (!Number.isFinite(at) || at < now) continue;
    due.push({ at, title: a.title ?? byId.get(a.opportunityId)?.title ?? 'Application', path: `/applications/${encodeURIComponent(a.opportunityId)}`, tracked: true });
  }
  for (const id of input.saved) {
    const o = byId.get(id);
    if (!o?.deadline || input.applications[id]) continue;
    const at = Date.parse(o.deadline);
    if (!Number.isFinite(at) || at < now) continue;
    due.push({ at, title: o.title, path: "/saved", tracked: false });
  }
  // What the student is applying to comes first, soonest first; saved postings fill up to five.
  due.sort((a, b) => Number(b.tracked) - Number(a.tracked) || a.at - b.at);
  const deadlines = due
    .slice(0, 5)
    .sort((a, b) => a.at - b.at)
    .map((d) => ({ title: d.title, at: d.at, path: d.path, when: inDays(d.at, now) }));
  const best = input.ranked[0];
  return {
    signedIn: input.signedIn,
    searching: input.searching,
    deadlines,
    top: best ? { opportunity: best, path: `/?open=${encodeURIComponent(best.id)}` } : null,
  };
}

/** The menu's labels: "Title · in 4 days" and "Title · Organizer". */
export function menuBarLabels(g: Glance): MenuBarData {
  return {
    signedIn: g.signedIn,
    searching: g.searching,
    deadlines: g.deadlines.map((d) => ({ label: `${d.title} · ${d.when}`, path: d.path })),
    top: g.top ? { label: `${g.top.opportunity.title} · ${g.top.opportunity.organizer}`, path: g.top.path } : null,
  };
}

export function menuBarData(input: GlanceInput): MenuBarData {
  return menuBarLabels(glance(input));
}
