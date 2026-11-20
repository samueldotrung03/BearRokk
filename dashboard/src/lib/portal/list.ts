// The Applications list's rules, kept apart from the page so they can be tested: turning what the
// account tracks into one row per application, how many parts are done, days left, sorting,
// filtering, and which saved postings an application can be started from.
import type { TrackedApplication } from '../../state/live.tsx';
import type { ApplicationStatus, Opportunity, OpportunityType } from '../../types.ts';
import { daysUntil, shortDate } from '../time.ts';
import type { Portal, PortalApplication } from './types.ts';

/** One record from GET /applications. Only the fields the list reads; older backends may leave some out. */
export interface ApplicationRecord {
  opportunityId: string;
  title?: string;
  organizer?: string;
  status: ApplicationStatus;
  updatedAt?: string;
  deadline: string | null;
  actionUrl: string | null;
  custom?: boolean;
  portal?: Portal | null;
}

/** The kinds the list can be narrowed to: the posting's kind, or one the student made themselves. */
export type ListKind = OpportunityType | 'custom';
export const LIST_KINDS: ListKind[] = ['internship', 'event', 'club', 'hackathon', 'research', 'scholarship', 'custom'];

/** A row on the list: the contract's application, plus the kind of opportunity it is for. */
export interface ListApplication extends PortalApplication {
  /** null when the posting is no longer among the cards the app has, so its kind is not known. */
  kind: ListKind | null;
}

export type ListSort = 'soonest' | 'latest' | 'edited' | 'name' | 'progress';
export const LIST_SORTS: ListSort[] = ['soonest', 'latest', 'edited', 'name', 'progress'];
export const sortLabel: Record<ListSort, string> = {
  soonest: 'Soonest deadline',
  latest: 'Latest deadline',
  edited: 'Recently edited',
  name: 'Name, A to Z',
  progress: 'Least progress',
};

/** active: To apply and Applying together, the ones still to send. */
export type StatusFilter = 'active' | 'to_apply' | 'applying' | 'applied';
export const STATUS_FILTERS: StatusFilter[] = ['active', 'to_apply', 'applying', 'applied'];
export const statusFilterLabel: Record<StatusFilter, string> = {
  active: 'All active',
  to_apply: 'To apply',
  applying: 'Applying',
  applied: 'Applied',
};

export interface ListPrefs {
  sort: ListSort;
  status: StatusFilter;
  kind: ListKind | 'all';
  dueSoon: boolean;
}
export const DEFAULT_PREFS: ListPrefs = { sort: 'soonest', status: 'active', kind: 'all', dueSoon: false };

/** Saved preferences, with anything unknown (an old version, a hand-edited value) put back to the default. */
export function normalizePrefs(raw: unknown): ListPrefs {
  const r = (raw && typeof raw === 'object' ? raw : {}) as Partial<Record<keyof ListPrefs, unknown>>;
  return {
    sort: LIST_SORTS.includes(r.sort as ListSort) ? (r.sort as ListSort) : DEFAULT_PREFS.sort,
    status: STATUS_FILTERS.includes(r.status as StatusFilter) ? (r.status as StatusFilter) : DEFAULT_PREFS.status,
    kind: r.kind === 'all' || LIST_KINDS.includes(r.kind as ListKind) ? (r.kind as ListKind | 'all') : DEFAULT_PREFS.kind,
    dueSoon: r.dueSoon === true,
  };
}

/** Parts ticked done out of all parts. An application with no portal yet has none. */
export function progressOf(portal: Portal | null | undefined): { done: number; total: number } {
  const tabs = portal?.tabs ?? [];
  return { done: tabs.filter((t) => t.done).length, total: tabs.length };
}

/** Whole days until the deadline (0 on the day, negative once passed), or null with no deadline. */
export function daysLeft(deadline: string | null, now = Date.now()): number | null {
  if (!deadline || Number.isNaN(Date.parse(deadline))) return null;
  return daysUntil(deadline, now);
}

/** The deadline as the row shows it, e.g. "Mar 3 · 5 days left". */
export function deadlineLabel(deadline: string | null, now = Date.now()): string {
  const days = daysLeft(deadline, now);
  if (days === null || !deadline) return 'No deadline';
  const date = shortDate(deadline);
  if (days < 0) return `${date} · closed`;
  if (days === 0) return `${date} · due today`;
  if (days === 1) return `${date} · 1 day left`;
  return `${date} · ${days} days left`;
}

/** "3 of 7 parts done", or a plain note when the application has no parts yet. */
export function progressLabel(p: { done: number; total: number }): string {
  if (p.total === 0) return 'No parts yet';
  return `${p.done} of ${p.total} ${p.total === 1 ? 'part' : 'parts'} done`;
}

/**
 * One row per application. The live stream's statuses are the freshest (a change on Saved arrives
 * there first), the GET /applications records carry the title, the custom flag and the portal, and
 * the postings fill in the kind and anything a record leaves out. Interested postings are only
 * saved, not applications, so they are left out.
 */
export function mergeApplications(live: Record<string, TrackedApplication>, records: ApplicationRecord[] | null, postings: Opportunity[]): ListApplication[] {
  const byRecord = new Map((records ?? []).map((r) => [r.opportunityId, r]));
  const byPosting = new Map(postings.map((o) => [o.id, o]));
  const ids = [...new Set([...Object.keys(live), ...byRecord.keys()])];
  const rows: ListApplication[] = [];
  for (const id of ids) {
    const tracked = live[id];
    const record = byRecord.get(id);
    const posting = byPosting.get(id);
    const status = tracked?.status ?? record?.status;
    if (!status || status === 'interested') continue;
    const custom = record?.custom ?? id.startsWith('custom-');
    rows.push({
      opportunityId: id,
      title: record?.title || posting?.title || 'Untitled application',
      organizer: record?.organizer || posting?.organizer || '',
      status,
      deadline: tracked?.deadline ?? record?.deadline ?? posting?.deadline ?? null,
      actionUrl: tracked?.actionUrl ?? record?.actionUrl ?? posting?.actionUrl ?? null,
      custom,
      updatedAt: record?.updatedAt ?? '',
      progress: progressOf(record?.portal),
      kind: custom ? 'custom' : (posting?.type ?? null),
    });
  }
  return rows;
}

const time = (iso: string | null) => (iso && !Number.isNaN(Date.parse(iso)) ? Date.parse(iso) : null);
const fraction = (p: { done: number; total: number }) => (p.total === 0 ? 0 : p.done / p.total);
const byName = (a: ListApplication, b: ListApplication) => a.title.localeCompare(b.title, undefined, { sensitivity: 'base' });

/** Deadline order that puts applications without a deadline last whichever way it runs. */
function byDeadline(a: ListApplication, b: ListApplication, direction: 1 | -1): number {
  const ta = time(a.deadline);
  const tb = time(b.deadline);
  if (ta === null && tb === null) return byName(a, b);
  if (ta === null) return 1;
  if (tb === null) return -1;
  return (ta - tb) * direction || byName(a, b);
}

export function sortApplications(list: ListApplication[], sort: ListSort): ListApplication[] {
  const copy = [...list];
  switch (sort) {
    case 'soonest':
      return copy.sort((a, b) => byDeadline(a, b, 1));
    case 'latest':
      return copy.sort((a, b) => byDeadline(a, b, -1));
    case 'edited':
      return copy.sort((a, b) => (time(b.updatedAt) ?? 0) - (time(a.updatedAt) ?? 0) || byName(a, b));
    case 'name':
      return copy.sort(byName);
    case 'progress':
      // Least done first; among equals, the one due soonest is the one to work on.
      return copy.sort((a, b) => fraction(a.progress) - fraction(b.progress) || byDeadline(a, b, 1));
  }
}

export function matchesStatus(a: ListApplication, status: StatusFilter): boolean {
  return status === 'active' ? a.status === 'to_apply' || a.status === 'applying' : a.status === status;
}

/** Every word of the search has to appear in the title or the organizer. */
export function matchesQuery(a: ListApplication, query: string): boolean {
  const words = query.toLowerCase().split(/\s+/).filter(Boolean);
  const text = `${a.title} ${a.organizer}`.toLowerCase();
  return words.every((w) => text.includes(w));
}

/** Due in the next 7 days and not yet closed. */
export function dueWithinWeek(a: ListApplication, now = Date.now()): boolean {
  const days = daysLeft(a.deadline, now);
  return days !== null && days >= 0 && days <= 7;
}

export interface ListFilters {
  status: StatusFilter;
  kind: ListKind | 'all';
  query: string;
  dueSoon: boolean;
}

/** Everything but the status, so the status chips can count what each would show. */
export function filterExceptStatus(list: ListApplication[], f: Omit<ListFilters, 'status'>, now = Date.now()): ListApplication[] {
  return list.filter((a) => (f.kind === 'all' || a.kind === f.kind) && matchesQuery(a, f.query) && (!f.dueSoon || dueWithinWeek(a, now)));
}

export function filterApplications(list: ListApplication[], f: ListFilters, now = Date.now()): ListApplication[] {
  return filterExceptStatus(list, f, now).filter((a) => matchesStatus(a, f.status));
}

export function statusCounts(list: ListApplication[]): Record<StatusFilter, number> {
  return Object.fromEntries(STATUS_FILTERS.map((s) => [s, list.filter((a) => matchesStatus(a, s)).length])) as Record<StatusFilter, number>;
}

/**
 * Postings an application can be started from in the New application window: saved or tracked,
 * not yet Applied, each once. Soonest deadline first, since those are the ones to start on.
 */
export function startablePostings(cards: Opportunity[], savedIds: string[], live: Record<string, TrackedApplication>): Opportunity[] {
  const byId = new Map<string, Opportunity>();
  for (const o of cards) {
    if (byId.has(o.id)) continue;
    const status = live[o.id]?.status;
    if (status === 'applied') continue;
    if (savedIds.includes(o.id) || status) byId.set(o.id, o);
  }
  return [...byId.values()].sort((a, b) => (time(a.deadline) ?? Infinity) - (time(b.deadline) ?? Infinity) || a.title.localeCompare(b.title));
}

/** The saved postings a search in the New application window matches. */
export function matchesPosting(o: Opportunity, query: string): boolean {
  const words = query.toLowerCase().split(/\s+/).filter(Boolean);
  const text = `${o.title} ${o.organizer}`.toLowerCase();
  return words.every((w) => text.includes(w));
}

/** A date from a date field ("2026-12-01") as the end of that day in the student's time, the way Saved sends deadlines. */
export function dateInputToIso(value: string): string | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const d = new Date(`${value}T23:59:00`);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}
