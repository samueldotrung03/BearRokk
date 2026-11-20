// Arrow-key movement shared by the month and week grids, so both behave the same way.
import type { KeyboardEvent } from 'react';
import { addDays, dayDate, startOfWeek } from '../../lib/cal/days.ts';
import { dayKey } from '../../lib/calendar.ts';

/** The day a key moves to from `day`, or null when the key is not a movement key. */
export function moveByKey(event: KeyboardEvent, day: string): string | null {
  switch (event.key) {
    case 'ArrowLeft':
      return addDays(day, -1);
    case 'ArrowRight':
      return addDays(day, 1);
    case 'ArrowUp':
      return addDays(day, -7);
    case 'ArrowDown':
      return addDays(day, 7);
    case 'Home':
      return startOfWeek(day);
    case 'End':
      return addDays(startOfWeek(day), 6);
    case 'PageUp':
    case 'PageDown': {
      const d = dayDate(day);
      const by = event.key === 'PageUp' ? -1 : 1;
      // Same date in the next month, or its last day when that month is shorter.
      const last = new Date(d.getFullYear(), d.getMonth() + by + 1, 0).getDate();
      return dayKey(new Date(d.getFullYear(), d.getMonth() + by, Math.min(d.getDate(), last), 12));
    }
    default:
      return null;
  }
}
