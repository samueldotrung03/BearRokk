import { describe, expect, it } from 'vitest';
import { initialState, opportunities } from '../../data/sample.ts';
import { assignSlots, buildBrief, LEAD_BUDGET, MANAGER_SLOTS, memoryFrom, parseInstruction } from './brief.ts';

const profile = initialState.profile;
const memory = memoryFrom(initialState, opportunities);
const kinds = (text: string) => Object.fromEntries(parseInstruction(text).directives.map((d) => [d.key, d.kind]));

describe('parseInstruction', () => {
  it('reads focus and avoid in one sentence', () => {
    expect(kinds('More research roles, fewer finance')).toEqual({ research: 'focus', finance: 'avoid' });
  });

  it('reads "only" for formats and categories', () => {
    expect(kinds('only remote')).toEqual({ remote: 'only' });
    expect(kinds('Internships only please')).toEqual({ internships: 'only' });
  });

  it('carries a verb across a list', () => {
    expect(kinds('no events and clubs')).toEqual({ events: 'avoid', clubs: 'avoid' });
  });

  it('does not read "internal" as internships or "unless" as less', () => {
    expect(kinds('internal tools unless finance')).toEqual({ finance: 'focus' });
  });

  it('reports text it could not understand instead of guessing', () => {
    const parsed = parseInstruction('more research, something with llamas');
    expect(parsed.unknown).toEqual(['something with llamas']);
  });
});

describe('buildBrief and assignSlots', () => {
  it('fills one slot per category by default and spends the whole lead budget', () => {
    const slots = assignSlots(buildBrief(profile, memory, []));
    expect(slots.map((s) => s.category)).toEqual(['internships', 'events', 'clubs', 'programs']);
    expect(slots.reduce((sum, s) => sum + s.budget, 0)).toBe(LEAD_BUDGET);
  });

  it('gives every slot to internships when the student wants only internships, each on its own slice', () => {
    const slots = assignSlots(buildBrief(profile, memory, ['internships only']));
    expect(slots).toHaveLength(MANAGER_SLOTS);
    expect(new Set(slots.map((s) => s.category))).toEqual(new Set(['internships']));
    expect(slots.flatMap((s) => s.slices).sort()).toEqual([0, 1, 2, 3]);
  });

  it('moves an avoided category\'s slot to the others', () => {
    const slots = assignSlots(buildBrief(profile, memory, ['no events']));
    expect(slots.some((s) => s.category === 'events')).toBe(false);
    expect(slots).toHaveLength(MANAGER_SLOTS);
  });

  it('gives a focused category a bigger share of the budget', () => {
    const slots = assignSlots(buildBrief(profile, memory, ['more research']));
    const programs = slots.find((s) => s.category === 'programs')!;
    expect(programs.budget).toBeGreaterThan(Math.max(...slots.filter((s) => s !== programs).map((s) => s.budget)));
  });

  it('lets a later instruction override an earlier one', () => {
    expect(buildBrief(profile, memory, ['no finance', 'more finance']).avoidTags).not.toContain('finance');
    expect(buildBrief(profile, memory, ['more finance', 'no finance']).avoidTags).toContain('finance');
  });

  it('drops a category the student keeps disliking and never saves', () => {
    // The sample data has only two event cards, so the third dislike is set on the counts directly.
    const heavy = { ...memory, dislikes: 3, byCategory: { ...memory.byCategory, events: { saves: 0, likes: 0, dislikes: 3 } } };
    expect(buildBrief(profile, heavy, []).wanted).not.toContain('events');
    expect(buildBrief(profile, heavy, ['more events']).wanted).toContain('events');
  });
});
