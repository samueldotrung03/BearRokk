import { beforeEach, describe, expect, it } from 'vitest';
import { addRecent, answerParts, clearRecent, recentSearches, shortDate } from './search.ts';

describe('search', () => {
  beforeEach(() => {
    const data = new Map<string, string>();
    globalThis.localStorage = {
      getItem: (k: string) => data.get(k) ?? null,
      setItem: (k: string, v: string) => void data.set(k, v),
      removeItem: (k: string) => void data.delete(k),
    } as Storage;
  });

  it('reads the answer into paragraphs, bold runs and citations that point at real results', () => {
    const parts = answerParts('The **Stripe** internship is open [1], and Lyft has one [2] [9].\n\n## Also\nSee [3].', 2);
    expect(parts).toHaveLength(2);
    expect(parts[0]).toEqual([
      { kind: 'text', text: 'The ', bold: false },
      { kind: 'text', text: 'Stripe', bold: true },
      { kind: 'text', text: ' internship is open ', bold: false },
      { kind: 'cite', n: 1 },
      { kind: 'text', text: ', and Lyft has one ', bold: false },
      { kind: 'cite', n: 2 },
      { kind: 'text', text: ' ', bold: false },
      // [9] is past the two results, so it is dropped.
      { kind: 'text', text: '.', bold: false },
    ]);
    // Headings lose their marks, and a citation past the results is dropped.
    expect(parts[1]).toEqual([{ kind: 'text', text: 'Also\nSee ', bold: false }, { kind: 'text', text: '.', bold: false }]);
  });

  it('keeps recent searches newest first, once each, and clears them', () => {
    let list = addRecent([], 'stripe internship', 'internship');
    list = addRecent(list, 'hackathons', 'hackathon');
    list = addRecent(list, 'Stripe Internship', 'all');
    expect(list.map((r) => r.q)).toEqual(['Stripe Internship', 'hackathons']);
    expect(recentSearches()).toEqual(list);
    expect(clearRecent()).toEqual([]);
    expect(recentSearches()).toEqual([]);
  });

  it('writes deadlines short, with the year only when it is not this year', () => {
    const now = new Date('2026-11-19T12:00:00');
    expect(shortDate('2026-11-24', now)).toBe('Nov 24');
    expect(shortDate('2027-02-01', now)).toBe('Feb 1, 2027');
    expect(shortDate(null, now)).toBe('');
    expect(shortDate('soon', now)).toBe('');
  });
});
