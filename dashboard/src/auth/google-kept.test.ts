import { describe, expect, it, vi } from 'vitest';

const store = new Map<string, string>();
Object.assign(globalThis, {
  localStorage: { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => void store.set(k, v), removeItem: (k: string) => void store.delete(k), clear: () => store.clear(), key: () => null, length: 0 },
});

describe('Google access across reloads', () => {
  it('is kept for the account until it expires, so a reload does not ask to connect again', async () => {
    const { keepGoogle, readKeptGoogle } = await import('./AuthProvider.tsx');
    keepGoogle('u1', { account: null, calendar: 'cal-token', sheets: 'cal-token' });
    expect(readKeptGoogle('u1')).toEqual({ calendar: 'cal-token', sheets: 'cal-token' });
    expect(readKeptGoogle('someone-else')).toEqual({});

    vi.useFakeTimers();
    vi.setSystemTime(Date.now() + 56 * 60_000);
    expect(readKeptGoogle('u1')).toEqual({}, );
    vi.useRealTimers();

    keepGoogle('u1', { account: null, calendar: null, sheets: null });
    expect(store.has('bearrok.google.u1')).toBe(false);
  });
});
