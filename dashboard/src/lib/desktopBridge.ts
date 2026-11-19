// What the desktop shell exposes to the page (electron/preload.cjs). Undefined in a browser.
export type PermissionKind = 'screen' | 'disk' | 'control';
export type PermissionState = 'granted' | 'denied' | 'unknown';

/** How this copy of the app reaches Grok. `managed` is false when the app did not start the backend itself. */
export interface GrokConnection {
  managed: boolean;
  /** claude: a temporary test set-up, see backend/SWAP_TO_GROK.md. */
  mode: 'cli' | 'api' | 'claude' | null;
  /** The Grok app for the command line is installed on this computer. */
  cliFound: boolean;
  /** The Claude app for the command line is installed on this computer (test set-up only). */
  claudeFound?: boolean;
  canStoreKey: boolean;
  error?: string;
}

interface DesktopBridge {
  platform: string;
  /** Absent in a desktop shell older than the page. */
  grok?: {
    status: () => Promise<GrokConnection>;
    connect: (choice: { mode: 'cli' } | { mode: 'api'; key: string } | { mode: 'claude' }) => Promise<GrokConnection>;
    disconnect: () => Promise<GrokConnection>;
  };
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
