import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createSaver, retryDelay, type SaveState } from './autosave.ts';

/** A save call the test settles by hand. */
function controlledSave() {
  const calls: { value: string; resolve: () => void; reject: () => void }[] = [];
  const save = (value: string) =>
    new Promise<void>((resolve, reject) => {
      calls.push({ value, resolve, reject });
    });
  return { calls, save };
}
const settle = () => vi.advanceTimersByTimeAsync(0);

describe('autosave', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('waits for typing to stop, then saves only the latest list once', async () => {
    const { calls, save } = controlledSave();
    const states: SaveState[] = [];
    const saver = createSaver({ save, onState: (s) => states.push(s), delay: 800 });
    saver.change('a');
    await vi.advanceTimersByTimeAsync(500);
    saver.change('ab');
    await vi.advanceTimersByTimeAsync(500);
    expect(calls).toHaveLength(0);
    await vi.advanceTimersByTimeAsync(300);
    expect(calls.map((c) => c.value)).toEqual(['ab']);
    calls[0]!.resolve();
    await settle();
    expect(saver.state()).toBe('saved');
    expect(states).toEqual(['pending', 'saving', 'saved']);
  });

  it('saves at once for a reorder, add or delete', async () => {
    const { calls, save } = controlledSave();
    const saver = createSaver({ save });
    saver.change('moved', true);
    expect(calls.map((c) => c.value)).toEqual(['moved']);
  });

  it('keeps edits made during a save and sends them after it', async () => {
    const { calls, save } = controlledSave();
    const saver = createSaver({ save, delay: 800 });
    saver.change('one', true);
    saver.change('two', true);
    expect(calls).toHaveLength(1);
    calls[0]!.resolve();
    await settle();
    expect(calls.map((c) => c.value)).toEqual(['one', 'two']);
    calls[1]!.resolve();
    await settle();
    expect(saver.state()).toBe('saved');
  });

  it('keeps unsaved work when a save fails and retries it', async () => {
    const { calls, save } = controlledSave();
    const saver = createSaver({ save });
    saver.change('draft', true);
    calls[0]!.reject();
    await settle();
    expect(saver.state()).toBe('retrying');
    await vi.advanceTimersByTimeAsync(retryDelay(1));
    expect(calls.map((c) => c.value)).toEqual(['draft', 'draft']);
    // Newer typing while it waits replaces the old list rather than being lost to it.
    calls[1]!.reject();
    await settle();
    saver.change('draft plus more');
    await vi.advanceTimersByTimeAsync(800);
    expect(calls.at(-1)!.value).toBe('draft plus more');
    calls.at(-1)!.resolve();
    await settle();
    expect(saver.state()).toBe('saved');
  });

  it('sends what is unsaved when the page is left', async () => {
    const { calls, save } = controlledSave();
    const saver = createSaver({ save, delay: 800 });
    saver.change('typed');
    saver.dispose();
    expect(calls.map((c) => c.value)).toEqual(['typed']);
    calls[0]!.reject();
    await vi.advanceTimersByTimeAsync(60_000);
    // Once the page is gone it does not keep retrying in the background.
    expect(calls).toHaveLength(1);
  });

  it('backs off between retries up to 30 seconds', () => {
    expect([1, 2, 3, 4, 5, 9].map(retryDelay)).toEqual([2000, 4000, 8000, 16_000, 30_000, 30_000]);
  });
});
