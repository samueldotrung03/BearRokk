import { describe, expect, it } from 'vitest';
import { KINDS, TIMES } from '../lib/search.ts';
import { COMPANIES, logoUrl, matchStrength, ROLES, suggest, SUGGESTED } from './searchSuggestions.ts';

const labels = (typed: string, recent: { q: string; kind: 'all' }[] = []) => suggest(typed, recent).map((s) => `${s.type}: ${s.label}`);

describe('search suggestions', () => {
  it('suggests a company from the first letters, a nickname or a common misspelling', () => {
    expect(labels('nv')[0]).toBe('company: Nvidia');
    expect(labels('invidia')[0]).toBe('company: Nvidia');
    expect(labels('jpm')[0]).toBe('company: JPMorgan Chase');
    expect(labels('facebook')[0]).toBe('company: Meta');
    expect(labels('goldm')[0]).toBe('company: Goldman Sachs');
    expect(labels('bank of')[0]).toBe('company: Bank of America');
  });

  it('completes a company with roles, led by what was typed after its name', () => {
    expect(labels('nvidia')).toEqual(expect.arrayContaining(['keyword: Nvidia software engineering internship', 'keyword: Nvidia machine learning internship']));
    expect(labels('nvidia data').find((l) => l.startsWith('keyword'))).toBe('keyword: Nvidia data science internship');
    const pick = suggest('nv', [])[0]!;
    expect(pick.query).toBe('Internships at Nvidia for college students');
    expect(pick.patch).toEqual({ kind: 'internship', time: 'any' });
  });

  it('suggests roles and searches by keyword, and recent searches that match', () => {
    expect(labels('swe')).toContain('role: Software engineering internships');
    expect(labels('scholar')).toContain('search: Scholarships closing this month');
    expect(labels('hack', [{ q: 'hackathons in sf', kind: 'all' }])[0]).toBe('recent: hackathons in sf');
    expect(labels('zzqx')).toEqual([]);
    // Each suggestion once, ten at most.
    const many = labels('in');
    expect(new Set(many).size).toBe(many.length);
    expect(many.length).toBeLessThanOrEqual(10);
  });

  it('shows recent then suggested searches when the box is empty', () => {
    const empty = suggest('', [{ q: 'stripe', kind: 'all' }]);
    expect(empty[0]).toMatchObject({ type: 'recent', label: 'stripe' });
    expect(empty.slice(1).every((s) => s.type === 'search')).toBe(true);
  });

  it('matches whole names first, then word starts, then letters inside a word', () => {
    expect(matchStrength('nv', ['Nvidia'])).toBe(3);
    expect(matchStrength('chase', ['JPMorgan Chase'])).toBe(2);
    expect(matchStrength('morgan', ['JPMorgan Chase'])).toBe(1);
    expect(matchStrength('x', ['Nvidia'])).toBe(0);
  });

  it('keeps its lists sound: unique companies with logos, filters the page offers', () => {
    expect(new Set(COMPANIES.map((c) => c.domain)).size).toBe(COMPANIES.length);
    for (const c of COMPANIES) {
      expect(c.domain).toMatch(/^[a-z0-9-]+(\.[a-z0-9-]+)+$/);
      expect(c.color).toMatch(/^#[0-9a-f]{6}$/);
    }
    // Only the company's domain goes to the logo service.
    expect(logoUrl('jnj.com')).toBe('https://www.google.com/s2/favicons?domain=jnj.com&sz=128');
    expect(new Set(ROLES.map((r) => r.label)).size).toBe(ROLES.length);
    const kinds = KINDS.map(([k]) => k);
    const times = TIMES.map(([t]) => t);
    for (const s of SUGGESTED) {
      expect(kinds).toContain(s.kind);
      expect(times).toContain(s.time);
    }
  });
});
