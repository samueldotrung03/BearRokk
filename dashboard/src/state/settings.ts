// App settings, saved in this browser. Read with useSettings(); change with updateSettings().
import { useSyncExternalStore } from 'react';

export interface AppSettings {
  /** How often the agents search on their own. */
  schedule: 'off' | 'hourly' | 'sixHours' | 'daily';
  /** Days before a deadline to be reminded. Empty turns reminders off. */
  reminderDays: number[];
}

export const SCHEDULE_SECONDS: Record<AppSettings['schedule'], number> = { off: 0, hourly: 3600, sixHours: 6 * 3600, daily: 24 * 3600 };

const KEY = 'bearrok.settings';
const defaults: AppSettings = { schedule: 'off', reminderDays: [7, 2, 0] };

function read(): AppSettings {
  try {
    const stored = JSON.parse(localStorage.getItem(KEY) ?? '{}') as Partial<AppSettings>;
    // Only the settings that still exist are kept.
    return { schedule: stored.schedule ?? defaults.schedule, reminderDays: Array.isArray(stored.reminderDays) ? stored.reminderDays : defaults.reminderDays };
  } catch {
    return defaults;
  }
}

let current = read();
const listeners = new Set<() => void>();

export function getSettings(): AppSettings {
  return current;
}

export function updateSettings(patch: Partial<AppSettings>): void {
  current = { ...current, ...patch };
  try {
    localStorage.setItem(KEY, JSON.stringify(current));
  } catch {
    // Not remembered beyond this visit.
  }
  for (const l of listeners) l();
}

export function useSettings(): AppSettings {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    () => current,
  );
}
