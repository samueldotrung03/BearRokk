import { describe, expect, it } from 'vitest';
import type { TrackedApplication } from '../../state/live.tsx';
import type { Opportunity } from '../../types.ts';
import {
  dateInputToIso,
  daysLeft,
  deadlineLabel,
  filterApplications,
  filterExceptStatus,
  mergeApplications,
  normalizePrefs,
  progressLabel,
  progressOf,
  sortApplications,
  startablePostings,
  statusCounts,
  type ApplicationRecord,
  type ListApplication,
} from './list.ts';
import type { Portal, PortalTab } from './types.ts';

const NOW = Date.parse('2026-11-19T12:00:00Z');
const inDays = (n: number) => new Date(NOW + n * 86_400_000).toISOString();

const tab = (done: boolean): PortalTab => ({ id: Math.random().toString(36), kind: 'question', title: 'Q', prompt: '', wordLimit: null, body: '', files: [], source: 'posting', done, updatedAt: '' });
const portal = (done: number, total: number): Portal => ({ tabs: Array.from({ length: total }, (_, i) => tab(i < done)), drafted: null });

const tracked = (id: string, status: TrackedApplication['status'], deadline: string | null = null): TrackedApplication => ({
  opportunityId: id,
  status,
  deadline,
  actionUrl: null,
  prompts: [],
  materials: [],
  reminders: [],
  needsDeadline: false,
  calendar: { state: 'none', eventId: null, htmlLink: null, addUrl: null, error: null },
});

const posting = (id: string, over: Partial<Opportunity> = {}): Opportunity => ({
  id,
  type: 'internship',
  origin: 'live',
  title: `Posting ${id}`,
  organizer: `Org ${id}`,
  sourceUrl: 'https://example.org',
  actionUrl: null,
  format: null,
  location: null,
  fitExplanation: '',
  deadline: null,
  startTime: null,
  image: null,
  video: null,
  imageAspect: 1,
  tags: [],
  unknowns: [],
  foundAt: '',
  lastCheckedAt: '',
  baseScore: 0.5,
  ...over,
});

const row = (id: string, over: Partial<ListApplication> = {}): ListApplication => ({
  opportunityId: id,
  title: id,
  organizer: '',
  status: 'to_apply',
  deadline: null,
  actionUrl: null,
  custom: false,
  updatedAt: '',
  progress: { done: 0, total: 0 },
  kind: 'internship',
  ...over,
});

describe('progress and days left', () => {
  it('counts tabs ticked done out of all tabs, and none without a portal', () => {
    expect(progressOf(portal(3, 7))).toEqual({ done: 3, total: 7 });
    expect(progressOf(null)).toEqual({ done: 0, total: 0 });
    expect(progressLabel({ done: 3, total: 7 })).toBe('3 of 7 parts done');
    expect(progressLabel({ done: 0, total: 0 })).toBe('No parts yet');
  });

  it('gives whole days to the deadline and null without one', () => {
    expect(daysLeft(inDays(5), NOW)).toBe(5);
    expect(daysLeft(inDays(-2), NOW)).toBe(-2);
    expect(daysLeft(null, NOW)).toBeNull();
    expect(daysLeft('not a date', NOW)).toBeNull();
    expect(deadlineLabel(null, NOW)).toBe('No deadline');
    expect(deadlineLabel(inDays(5), NOW)).toMatch(/5 days left$/);
    expect(deadlineLabel(inDays(-1), NOW)).toMatch(/closed$/);
  });
});

describe('mergeApplications', () => {
  it('takes the stream status, the record title and progress, and the posting kind', () => {
    const live = { a: tracked('a', 'applying', inDays(3)) };
    const records: ApplicationRecord[] = [{ opportunityId: 'a', title: 'Record title', organizer: 'Record org', status: 'to_apply', deadline: null, actionUrl: null, custom: false, updatedAt: inDays(-1), portal: portal(2, 4) }];
    const [a] = mergeApplications(live, records, [posting('a', { type: 'research' })]);
    expect(a).toMatchObject({ opportunityId: 'a', title: 'Record title', organizer: 'Record org', status: 'applying', deadline: inDays(3), progress: { done: 2, total: 4 }, kind: 'research', custom: false });
  });

  it('lists custom applications that have no posting, and leaves Interested postings out', () => {
    const live = { b: tracked('b', 'interested'), c: tracked('c', 'to_apply') };
    const records: ApplicationRecord[] = [{ opportunityId: 'custom-1', title: 'My own', status: 'to_apply', deadline: null, actionUrl: null, custom: true }];
    const rows = mergeApplications(live, records, [posting('b'), posting('c')]);
    expect(rows.map((r) => r.opportunityId).sort()).toEqual(['c', 'custom-1']);
    expect(rows.find((r) => r.opportunityId === 'custom-1')).toMatchObject({ custom: true, kind: 'custom', title: 'My own' });
    // Before the records arrive, a tracked posting still shows with the posting's own title.
    expect(rows.find((r) => r.opportunityId === 'c')?.title).toBe('Posting c');
  });

  it('works before GET /applications has answered', () => {
    expect(mergeApplications({ c: tracked('c', 'applied') }, null, [])).toHaveLength(1);
  });
});

describe('sortApplications', () => {
  const list = [
    row('none', { title: 'No deadline' }),
    row('late', { title: 'Late', deadline: inDays(20), updatedAt: inDays(-5), progress: { done: 1, total: 2 } }),
    row('soon', { title: 'Soon', deadline: inDays(2), updatedAt: inDays(-1), progress: { done: 3, total: 3 } }),
    row('mid', { title: 'Alpha', deadline: inDays(9), updatedAt: inDays(-3), progress: { done: 0, total: 4 } }),
  ];
  const ids = (l: ListApplication[]) => l.map((a) => a.opportunityId);

  it('puts the soonest deadline first and no deadline last', () => {
    expect(ids(sortApplications(list, 'soonest'))).toEqual(['soon', 'mid', 'late', 'none']);
  });
  it('puts the latest deadline first and still no deadline last', () => {
    expect(ids(sortApplications(list, 'latest'))).toEqual(['late', 'mid', 'soon', 'none']);
  });
  it('sorts by last edited, by name, and by least progress', () => {
    expect(ids(sortApplications(list, 'edited'))).toEqual(['soon', 'mid', 'late', 'none']);
    expect(ids(sortApplications(list, 'name'))).toEqual(['mid', 'late', 'none', 'soon']);
    // 0 of 4 and 0 of 0 tie at nothing done; the one with a deadline comes first.
    expect(ids(sortApplications(list, 'progress'))).toEqual(['mid', 'none', 'late', 'soon']);
  });
  it('does not change the list it was given', () => {
    const before = ids(list);
    sortApplications(list, 'name');
    expect(ids(list)).toEqual(before);
  });
});

describe('filterApplications', () => {
  const list = [
    row('a', { status: 'to_apply', title: 'Data internship', organizer: 'Acme', deadline: inDays(3) }),
    row('b', { status: 'applying', title: 'Robotics club', kind: 'club', deadline: inDays(30) }),
    row('c', { status: 'applied', title: 'Hack night', kind: 'hackathon', deadline: inDays(1) }),
    row('d', { status: 'to_apply', title: 'Own scholarship', kind: 'custom', custom: true, deadline: inDays(-2) }),
  ];
  const base = { status: 'active' as const, kind: 'all' as const, query: '', dueSoon: false };
  const ids = (l: ListApplication[]) => l.map((a) => a.opportunityId);

  it('All active means To apply and Applying; Applied is its own filter', () => {
    expect(ids(filterApplications(list, base, NOW))).toEqual(['a', 'b', 'd']);
    expect(ids(filterApplications(list, { ...base, status: 'applied' }, NOW))).toEqual(['c']);
    expect(ids(filterApplications(list, { ...base, status: 'applying' }, NOW))).toEqual(['b']);
  });
  it('narrows by kind, including the student’s own', () => {
    expect(ids(filterApplications(list, { ...base, kind: 'custom' }, NOW))).toEqual(['d']);
    expect(ids(filterApplications(list, { ...base, kind: 'club' }, NOW))).toEqual(['b']);
  });
  it('searches title and organizer, every word', () => {
    expect(ids(filterApplications(list, { ...base, query: 'acme data' }, NOW))).toEqual(['a']);
    expect(ids(filterApplications(list, { ...base, query: 'acme club' }, NOW))).toEqual([]);
  });
  it('due within 7 days leaves out later and closed ones', () => {
    expect(ids(filterApplications(list, { ...base, dueSoon: true }, NOW))).toEqual(['a']);
  });
  it('counts each status chip over the other filters', () => {
    expect(statusCounts(filterExceptStatus(list, { kind: 'all', query: '', dueSoon: false }, NOW))).toEqual({ active: 3, to_apply: 2, applying: 1, applied: 1 });
    expect(statusCounts(filterExceptStatus(list, { kind: 'all', query: '', dueSoon: true }, NOW))).toEqual({ active: 1, to_apply: 1, applying: 0, applied: 1 });
  });
});

describe('remembered preferences', () => {
  it('keeps known values and resets unknown ones', () => {
    expect(normalizePrefs({ sort: 'name', status: 'applied', kind: 'custom', dueSoon: true })).toEqual({ sort: 'name', status: 'applied', kind: 'custom', dueSoon: true });
    expect(normalizePrefs({ sort: 'deadline', status: 'all', kind: 'nope' })).toEqual({ sort: 'soonest', status: 'active', kind: 'all', dueSoon: false });
    expect(normalizePrefs(null)).toEqual({ sort: 'soonest', status: 'active', kind: 'all', dueSoon: false });
  });
});

describe('startablePostings', () => {
  it('offers saved or tracked postings once each, not Applied ones, soonest first', () => {
    const cards = [posting('x', { deadline: inDays(10) }), posting('y', { deadline: inDays(2) }), posting('z'), posting('w'), posting('x', { deadline: inDays(10) })];
    const live = { y: tracked('y', 'to_apply'), w: tracked('w', 'applied') };
    expect(startablePostings(cards, ['x', 'w'], live).map((o) => o.id)).toEqual(['y', 'x']);
  });
});

describe('dateInputToIso', () => {
  it('turns a date field into the end of that day, and rejects anything else', () => {
    const iso = dateInputToIso('2026-12-01');
    expect(iso && new Date(iso).getDate()).toBe(1);
    expect(dateInputToIso('')).toBeNull();
    expect(dateInputToIso('tomorrow')).toBeNull();
  });
});
