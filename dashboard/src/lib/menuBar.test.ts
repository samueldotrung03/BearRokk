import { describe, expect, it } from 'vitest';
import { opportunities } from '../data/sample.ts';
import { menuBarData } from './menuBar.ts';

const now = new Date(2026, 10, 19, 12).getTime();
const day = 86_400_000;
const post = (id: string, title: string, deadline: number | null) => ({ ...opportunities[0]!, id, title, organizer: 'Org', deadline: deadline === null ? null : new Date(deadline).toISOString() });
const app = (id: string, status: 'interested' | 'to_apply' | 'applying' | 'applied', deadline: number | null, title?: string) => ({
  opportunityId: id,
  status,
  deadline: deadline === null ? null : new Date(deadline).toISOString(),
  actionUrl: null,
  prompts: [],
  materials: [],
  reminders: [],
  needsDeadline: false,
  calendar: { state: 'none' as const, eventId: null, htmlLink: null, addUrl: null, error: null },
  ...(title ? { title } : {}),
});

describe('menu bar menu', () => {
  it('lists To apply and Applying deadlines soonest first, then saved ones, and leaves out passed and applied ones', () => {
    const data = menuBarData({
      signedIn: true,
      searching: false,
      ranked: [],
      postings: [post('a', 'Alpha', now + 5 * day), post('b', 'Beta', now + 1 * day), post('s', 'Saved one', now + 2 * day), post('old', 'Old', now - day)],
      applications: { a: app('a', 'to_apply', now + 5 * day), b: app('b', 'applying', now + 1 * day), c: app('custom-1', 'to_apply', now + 3 * day, 'My own'), old: app('old', 'applying', now - day), done: app('done', 'applied', now + day) },
      saved: ['s', 'a'],
      now,
    });
    expect(data.deadlines).toEqual([
      { label: 'Beta · tomorrow', path: '/applications/b' },
      { label: 'Saved one · in 2 days', path: '/saved' },
      { label: 'My own · in 3 days', path: '/applications/custom-1' },
      { label: 'Alpha · in 5 days', path: '/applications/a' },
    ]);
  });

  it('the top recommendation is the first card the feed ranks, and opens it in the feed', () => {
    const data = menuBarData({ signedIn: true, searching: true, ranked: [post('x y', 'Top pick', null), post('z', 'Second', null)], applications: {}, postings: [], saved: [], now });
    expect(data.top).toEqual({ label: 'Top pick · Org', path: '/?open=x%20y' });
    expect(data.searching).toBe(true);
    expect(menuBarData({ signedIn: true, searching: false, ranked: [], applications: {}, postings: [], saved: [], now }).top).toBeNull();
  });
});
