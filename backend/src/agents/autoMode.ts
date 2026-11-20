// Automode: searches that run on their own at set times every day. Times are the student's local
// clock times ("09:00") in their time zone. A time that passes while BearRok is closed (or the
// laptop is off or asleep) is not lost: it waits and runs once the app is open again. Waiting runs
// go one after another with a 10-minute pause. Times more than a day old are dropped, so opening
// the app after a week away does not start a pile of searches.

export const AUTO_GAP_MS = 10 * 60_000;
export const AUTO_MAX_RUNS = 6;
/** How far back a missed time still runs. */
export const AUTO_CATCH_UP_MS = 24 * 3_600_000;

/** Times spread over the waking day for a number of runs. */
export function defaultTimes(runs: number): string[] {
  const n = Math.max(1, Math.min(AUTO_MAX_RUNS, Math.floor(runs)));
  const preset: Record<number, string[]> = {
    1: ['09:00'],
    2: ['09:00', '18:00'],
    3: ['09:00', '13:00', '18:00'],
    4: ['08:00', '12:00', '16:00', '20:00'],
    5: ['08:00', '11:00', '14:00', '17:00', '20:00'],
    6: ['08:00', '10:30', '13:00', '15:30', '18:00', '20:30'],
  };
  return preset[n]!;
}

const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/;

/** Valid, unique, sorted clock times, at most AUTO_MAX_RUNS. */
export function cleanTimes(times: unknown): string[] {
  if (!Array.isArray(times)) return [];
  return [...new Set(times.filter((t): t is string => typeof t === 'string' && HHMM.test(t)))].sort().slice(0, AUTO_MAX_RUNS);
}

export function validTimeZone(tz: unknown): string | null {
  if (typeof tz !== 'string' || !tz) return null;
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: tz });
    return tz;
  } catch {
    return null;
  }
}

/** Minutes the zone is ahead of UTC at an instant. */
function offsetMinutes(at: Date, tz: string): number {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-US', { timeZone: tz, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' })
      .formatToParts(at)
      .map((p) => [p.type, p.value]),
  );
  const asUtc = Date.UTC(+parts.year!, +parts.month! - 1, +parts.day!, +parts.hour!, +parts.minute!, +parts.second!);
  return Math.round((asUtc - at.getTime()) / 60_000);
}

/** The local calendar day of an instant, YYYY-MM-DD. */
export function localDay(at: Date, tz: string): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' }).format(at);
}

/** The instant a local clock time happens on a local day. */
export function zonedInstant(day: string, hhmm: string, tz: string): Date {
  const [y, m, d] = day.split('-').map(Number) as [number, number, number];
  const [h, mi] = hhmm.split(':').map(Number) as [number, number];
  const guess = Date.UTC(y, m - 1, d, h, mi);
  let at = guess - offsetMinutes(new Date(guess), tz) * 60_000;
  // Once more, for a day the clocks change.
  at = guess - offsetMinutes(new Date(at), tz) * 60_000;
  return new Date(at);
}

/**
 * Scheduled times that have come and have not run yet, oldest first: every time from the last
 * day (yesterday's and today's), after Automode was turned on, not in `done`.
 */
export function dueSlots(now: Date, times: string[], tz: string, since: string | null, done: string[]): string[] {
  const doneSet = new Set(done);
  const floor = Math.max(now.getTime() - AUTO_CATCH_UP_MS, since ? Date.parse(since) : 0);
  const days = [localDay(new Date(now.getTime() - 86_400_000), tz), localDay(now, tz)];
  const out: string[] = [];
  for (const day of [...new Set(days)]) {
    for (const t of times) {
      const at = zonedInstant(day, t, tz);
      if (at.getTime() > floor && at.getTime() <= now.getTime() && !doneSet.has(at.toISOString())) out.push(at.toISOString());
    }
  }
  return out.sort();
}

/** The next scheduled time after now. */
export function nextSlot(now: Date, times: string[], tz: string): string | null {
  if (!times.length) return null;
  for (let i = 0; i < 3; i++) {
    const day = localDay(new Date(now.getTime() + i * 86_400_000), tz);
    for (const t of times) {
      const at = zonedInstant(day, t, tz);
      if (at.getTime() > now.getTime()) return at.toISOString();
    }
  }
  return null;
}
