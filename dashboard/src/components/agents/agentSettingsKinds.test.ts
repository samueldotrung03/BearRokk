import { describe, expect, it } from 'vitest';
import { searchedKinds, toggleKinds } from './AgentSettings.tsx';

const auto = { on: false, times: ['09:00'] };
const base = { auto, models: {}, minimums: {}, kinds: [] as never[] };

describe('agent settings: search for and find at least', () => {
  it('lists each program kind on its own, and All ticks or clears every kind', () => {
    const all = toggleKinds(base, 'all');
    expect(all.kinds).toEqual(['internship', 'event', 'club', 'hackathon', 'research', 'scholarship']);
    expect(toggleKinds(all, 'all').kinds).toEqual([]);
  });

  it('offers a number only for the kinds being searched for', () => {
    expect(searchedKinds(['internship'], ['event', 'scholarship'])).toEqual(['internship']);
    // Nothing ticked: the profile's kinds.
    expect(searchedKinds([], ['scholarship', 'event'])).toEqual(['event', 'scholarship']);
  });

  it('unticking a kind clears its number', () => {
    const s = { auto, models: {}, minimums: { internship: 10, scholarship: 3 }, kinds: ['internship', 'scholarship'] as ('internship' | 'scholarship')[] };
    expect(toggleKinds(s, 'scholarship')).toMatchObject({ kinds: ['internship'], minimums: { internship: 10 } });
  });

  it('keeps the total across kinds when kinds are ticked or unticked', () => {
    const s = { auto, models: {}, minimums: { any: 20, scholarship: 3 }, kinds: ['internship', 'scholarship'] as ('internship' | 'scholarship')[] };
    expect(toggleKinds(s, 'scholarship').minimums).toEqual({ any: 20 });
  });
});
