// Autosave for the portal: the whole tab list is sent a moment after typing stops, at once after a
// reorder, add or delete, and again on its own when a save fails. Edits made while a save is on its
// way are kept and sent after it; a failed save never throws away what the student wrote.

export type SaveState = 'saved' | 'pending' | 'saving' | 'retrying';

export interface Timers {
  set: (fn: () => void, ms: number) => unknown;
  clear: (handle: unknown) => void;
}

export interface Saver<T> {
  /** A new value to save: after the typing pause, or straight away when `immediate`. */
  change: (value: T, immediate?: boolean) => void;
  /** Send whatever is unsaved now (leaving the page, closing the window). */
  flush: () => void;
  /** Send what is unsaved one last time and stop retrying. */
  dispose: () => void;
  state: () => SaveState;
}

export const SAVE_DELAY_MS = 800;
/** Waits between retries after a failed save: 2 s, then 4, 8, 16, and 30 s from then on. */
export const retryDelay = (attempt: number) => Math.min(30_000, 2000 * 2 ** Math.max(0, attempt - 1));

const realTimers: Timers = {
  set: (fn, ms) => setTimeout(fn, ms),
  clear: (handle) => clearTimeout(handle as ReturnType<typeof setTimeout>),
};

export function createSaver<T>(options: {
  save: (value: T) => Promise<void>;
  onState?: (state: SaveState) => void;
  delay?: number;
  timers?: Timers;
}): Saver<T> {
  const { save, onState, delay = SAVE_DELAY_MS, timers = realTimers } = options;
  let pending: { value: T } | null = null;
  let inFlight = false;
  let timer: unknown = null;
  let failures = 0;
  let disposed = false;
  let current: SaveState = 'saved';

  const setState = (next: SaveState) => {
    if (next === current) return;
    current = next;
    onState?.(next);
  };
  const clearTimer = () => {
    if (timer !== null) timers.clear(timer);
    timer = null;
  };

  const run = () => {
    clearTimer();
    // One save at a time: a save on its way picks up newer edits when it finishes.
    if (inFlight || !pending) return;
    const { value } = pending;
    pending = null;
    inFlight = true;
    setState('saving');
    save(value).then(
      () => {
        inFlight = false;
        failures = 0;
        if (pending && timer === null) run();
        else if (!pending) setState('saved');
        else setState('pending');
      },
      () => {
        inFlight = false;
        failures += 1;
        // Newer edits hold the whole list, so they replace the failed one; otherwise keep it.
        if (!pending) pending = { value };
        setState('retrying');
        if (disposed) return;
        clearTimer();
        timer = timers.set(run, retryDelay(failures));
      },
    );
  };

  return {
    change(value, immediate = false) {
      pending = { value };
      clearTimer();
      if (immediate) run();
      else timer = timers.set(run, delay);
      if (!inFlight && current !== 'retrying') setState('pending');
    },
    flush() {
      if (pending) run();
    },
    dispose() {
      if (pending) run();
      disposed = true;
      clearTimer();
    },
    state: () => current,
  };
}
