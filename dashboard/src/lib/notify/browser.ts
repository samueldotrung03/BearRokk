// The browser side of notifications: settings and sent keys in localStorage, the permission
// state, and showing one notification. Every function is safe where the Notification API is
// missing (some browsers, tests) and never asks for permission by itself.
import type { PlannedNotification } from './plan.ts';

export const ENABLED_KEY = 'bearrok.notify.enabled';
export const SENT_KEY = 'bearrok.notify.sent';
/** Fired on window when the switch or the permission changes, so the notifier checks again. */
export const NOTIFY_CHANGED = 'bearrok-notify-changed';
/** Old keys are dropped past this many; deadlines that far back can no longer be announced. */
const MAX_SENT = 300;

export type NotifyPermission = NotificationPermission | 'unsupported';

export function notifySupported(): boolean {
  return typeof window !== 'undefined' && 'Notification' in window;
}

export function notifyPermission(): NotifyPermission {
  return notifySupported() ? Notification.permission : 'unsupported';
}

/** Must be called from a click: browsers ignore permission requests made without one. */
export async function requestNotifyPermission(): Promise<NotifyPermission> {
  if (!notifySupported()) return 'unsupported';
  try {
    return await Notification.requestPermission();
  } catch {
    return Notification.permission;
  }
}

export function notifyEnabled(): boolean {
  try {
    return JSON.parse(localStorage.getItem(ENABLED_KEY) ?? 'false') === true;
  } catch {
    return false;
  }
}

export function loadSent(): string[] {
  try {
    const raw: unknown = JSON.parse(localStorage.getItem(SENT_KEY) ?? '[]');
    return Array.isArray(raw) ? raw.filter((key): key is string => typeof key === 'string') : [];
  } catch {
    return [];
  }
}

export function saveSent(keys: string[]): void {
  try {
    localStorage.setItem(SENT_KEY, JSON.stringify([...new Set(keys)].slice(-MAX_SENT)));
  } catch {
    // Not remembered; at worst a notification repeats after a reload.
  }
}

/** Brings the app window to the front: the page's own focus, plus the desktop shell's when present. */
export function focusApp(): void {
  window.focus();
  (window as unknown as { bearrokDesktop?: { focusWindow?: () => void } }).bearrokDesktop?.focusWindow?.();
}

/** Shows one notification. Returns false when it could not be shown (no API, no permission). */
export function showNotification(planned: PlannedNotification, onClick: () => void): boolean {
  if (notifyPermission() !== 'granted') return false;
  try {
    const notification = new Notification(planned.title, { body: planned.body, tag: planned.key });
    notification.onclick = (event) => {
      event.preventDefault();
      focusApp();
      onClick();
      notification.close();
    };
    return true;
  } catch {
    // Some browsers (Chrome on Android) only allow notifications from a service worker.
    return false;
  }
}
