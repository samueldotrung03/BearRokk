// Stopping a search part way. A run executes inside withSignal(); every model call, page fetch and
// worker job started inside it can see the run's signal through currentSignal() without it being
// passed down by hand, and gives up as soon as the student stops the search.
import { AsyncLocalStorage } from 'node:async_hooks';

const context = new AsyncLocalStorage<AbortSignal>();

/** Run `fn` with `signal` as the stop signal for everything it starts. */
export const withSignal = <T>(signal: AbortSignal, fn: () => Promise<T>): Promise<T> => context.run(signal, fn);

/** The stop signal of the search this code is running in, if any. */
export const currentSignal = (): AbortSignal | undefined => context.getStore();

export class StoppedError extends Error {
  constructor() {
    super('stopped by the student');
    this.name = 'StoppedError';
  }
}

export const isStopped = () => currentSignal()?.aborted === true;

export function throwIfStopped() {
  if (isStopped()) throw new StoppedError();
}

/** A timeout combined with the search's stop signal, for fetch. */
export function timeoutOrStop(ms: number): AbortSignal {
  const stop = currentSignal();
  return stop ? AbortSignal.any([AbortSignal.timeout(ms), stop]) : AbortSignal.timeout(ms);
}
