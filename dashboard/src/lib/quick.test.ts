import { describe, expect, it } from 'vitest';
import { opportunities } from '../data/sample.ts';
import { glance } from './menuBar.ts';
import { askedQuery, dueDay, searchPath } from './quick.ts';

const now = new Date(2026, 10, 19, 12).getTime();
const day = 86_400_000;
const post = (id: string, title: string, deadline: number | null) => ({
  ...opportunities[0]!,
  id,
  title,
  organizer: 'Org',
  fitExplanation: `Why ${title}`,
  deadline: deadline === null ? null : new Date(deadline).toISOString(),
});
const app = (id: string, status: 'to_apply' | 'applying' | 'applied', deadline: number) => ({
  opportunityId: id,
  status,
  deadline: new Date(deadline).toISOString(),
  actionUrl: null,
  prompts: [],
  materials: [],
  reminders: [],
  needsDeadline: false,
  calendar: { state: 'none' as const, eventId: null, htmlLink: null, addUrl: null, error: null },
});

describe('quick panel', () => {
  it('shows the soonest deadline first, with its title, day and the page that opens it', () => {
    const g = glance({
      signedIn: true,
      searching: false,
      ranked: [],
      postings: [post('a', 'Alpha', now + 5 * day), post('s', 'Saved one', now + 2 * day), post('b', 'Beta', now + day)],
      applications: { a: app('a', 'to_apply', now + 5 * day), b: app('b', 'applied', now + day) },
      saved: ['s'],
      now,
    });
    const next = g.deadlines[0]!;
    expect(next).toMatchObject({ title: 'Saved one', path: '/saved', when: 'in 2 days' });
    expect(dueDay(next.at)).toBe('Sat, Nov 21');
    expect(g.deadlines.map((d) => d.title)).toEqual(['Saved one', 'Alpha']);
  });

  it('has no deadline and no top pick when nothing is tracked or in the feed', () => {
    const g = glance({ signedIn: true, searching: false, ranked: [], postings: [], applications: {}, saved: [], now });
    expect(g.deadlines).toEqual([]);
    expect(g.top).toBeNull();
  });

  it('the top pick is the feed\'s first card, with its reason, and opens it in the feed', () => {
    const g = glance({ signedIn: true, searching: true, ranked: [post('x y', 'Top', null), post('z', 'Second', null)], postings: [], applications: {}, saved: [], now });
    expect(g.top?.opportunity.title).toBe('Top');
    expect(g.top?.opportunity.fitExplanation).toBe('Why Top');
    expect(g.top?.path).toBe('/?open=x%20y');
    expect(g.searching).toBe(true);
  });

  it('opens Search with the query in the address, and Search reads it back', () => {
    const path = searchPath('  data science & ML internships ');
    expect(path).toBe('/search?q=data%20science%20%26%20ML%20internships');
    const params = new URL(path, 'http://localhost').searchParams;
    expect(askedQuery(params)).toBe('data science & ML internships');
    expect(askedQuery(new URLSearchParams(''))).toBeNull();
    expect(askedQuery(new URLSearchParams('q=a'))).toBeNull();
  });
});
