import { beforeEach, describe, expect, it } from 'vitest';
import { clearPending, keepPending, readPending } from './pending.ts';
import type { PortalTab } from './types.ts';

const store = new Map<string, string>();
Object.assign(globalThis, {
  localStorage: { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => void store.set(k, v), removeItem: (k: string) => void store.delete(k) },
});
const tab = (body: string): PortalTab => ({ id: 't1', kind: 'note', title: 'Note', prompt: '', wordLimit: null, body, files: [], source: 'student', done: false, updatedAt: '' });

describe('portal edits kept until saved', () => {
  beforeEach(() => store.clear());
  it('keeps unsaved edits, and clears them only when the account has the same ones', () => {
    keepPending('a', [tab('first draft')]);
    keepPending('a', [tab('first draft, more')]);
    clearPending('a', [tab('first draft')]);
    expect(readPending('a')?.[0]?.body).toBe('first draft, more');
    clearPending('a', [tab('first draft, more')]);
    expect(readPending('a')).toBeNull();
  });
});
