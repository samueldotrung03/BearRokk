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

export function menuBarData(input: {
  signedIn: boolean;
  searching: boolean;
  /** The feed in the order the feed ranks it, best first. */
  ranked: Opportunity[];
  applications: Record<string, TrackedApplication & { title?: string }>;
  /** Postings the account holds (feed and saved), for titles and saved deadlines. */
  postings: Opportunity[];
  saved: string[];
  now?: number;
}): MenuBarData {
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
    .map((d) => ({ label: `${d.title} · ${inDays(d.at, now)}`, path: d.path }));
  const best = input.ranked[0];
  return {
    signedIn: input.signedIn,
    searching: input.searching,
    deadlines,
    top: best ? { label: `${best.title} · ${best.organizer}`, path: `/?open=${encodeURIComponent(best.id)}` } : null,
  };
}
