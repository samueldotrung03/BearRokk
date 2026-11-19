// What the desktop shell exposes to the page (electron/preload.cjs). Undefined in a browser.
export type PermissionKind = 'screen' | 'disk' | 'control';
export type PermissionState = 'granted' | 'denied' | 'unknown';

interface DesktopBridge {
  platform: string;
  permissions: () => Promise<Record<PermissionKind, PermissionState>>;
  openPermission: (kind: PermissionKind) => Promise<boolean>;
}

export const desktopBridge: DesktopBridge | undefined = (window as unknown as { bearrokDesktop?: DesktopBridge }).bearrokDesktop;

const KEY = 'bearrok.allowed';

/** Which abilities the student has said agents may use. Separate from what macOS has granted. */
export function loadAllowed(): Record<PermissionKind, boolean> {
  try {
    return { screen: false, disk: false, control: false, ...(JSON.parse(localStorage.getItem(KEY) ?? '{}') as object) };
  } catch {
    return { screen: false, disk: false, control: false };
  }
}

export function saveAllowed(allowed: Record<PermissionKind, boolean>): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(allowed));
  } catch {
    // Not remembered.
  }
}
