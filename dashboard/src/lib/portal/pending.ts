// Edits not yet saved to the account, kept on this computer until they are. Typing and then
// reloading, closing the window, or leaving while the account cannot be reached would otherwise
// lose them; the portal and the View all page put them back over what the account has.
import type { PortalTab } from './types.ts';

const key = (id: string) => `bearrok.portal.pending.${id}`;

export function keepPending(id: string, tabs: PortalTab[]): void {
  try {
    localStorage.setItem(key(id), JSON.stringify(tabs));
  } catch {
    // Full or blocked: the account save still runs.
  }
}

export function readPending(id: string): PortalTab[] | null {
  try {
    const raw = localStorage.getItem(key(id));
    const tabs = raw ? (JSON.parse(raw) as unknown) : null;
    return Array.isArray(tabs) ? (tabs as PortalTab[]) : null;
  } catch {
    return null;
  }
}

/** Cleared once the account has exactly what is kept here (a newer edit keeps it). */
export function clearPending(id: string, saved: PortalTab[]): void {
  try {
    if (localStorage.getItem(key(id)) === JSON.stringify(saved)) localStorage.removeItem(key(id));
  } catch {
    // Nothing to clear.
  }
}

export function dropPending(id: string): void {
  try {
    localStorage.removeItem(key(id));
  } catch {
    // Nothing to drop.
  }
}
