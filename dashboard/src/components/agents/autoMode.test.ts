import { describe, expect, it } from 'vitest';
import { autoLine, defaultTimes, whenLabel } from './AgentSettings.tsx';

describe('agent settings: automode', () => {
  const now = new Date(2026, 10, 19, 14, 30).getTime();
  it('spreads times over the day for the number of searches chosen', () => {
    expect(defaultTimes(1)).toEqual(['09:00']);
    expect(defaultTimes(3)).toEqual(['09:00', '13:00', '18:00']);
    expect(defaultTimes(9)).toHaveLength(6);
  });

  it('says when the next search is, or how many are waiting and when the next starts', () => {
    expect(autoLine({ on: false, nextAt: null, waiting: 0, startsAt: null }, now)).toBeNull();
    expect(autoLine({ on: true, nextAt: new Date(2026, 10, 19, 18, 0).toISOString(), waiting: 0, startsAt: null }, now)).toBe('Automode: next search today at 6:00 PM');
    expect(autoLine({ on: true, nextAt: null, waiting: 2, startsAt: new Date(now + 7 * 60_000).toISOString() }, now)).toBe('Automode: 2 searches waiting, the next starts in 7 minutes');
    expect(whenLabel(new Date(2026, 10, 20, 9, 0).toISOString(), now)).toBe('Tomorrow at 9:00 AM');
  });
});
