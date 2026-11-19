// Keyboard shortcuts the student can change in Settings. A shortcut is stored as text such as
// "mod+k" or "mod+shift+1", where "mod" is Command on a Mac and Ctrl elsewhere. Only the ones
// the student changed are saved; everything else follows the defaults below.
import { useEffect, useState } from 'react';

export interface ShortcutAction {
  id: string;
  label: string;
  group: 'General' | 'Pages';
  /** The shortcut out of the box, or null for none. */
  fallback: string | null;
}

export const shortcutActions: ShortcutAction[] = [
  { id: 'launcher', label: 'Open the launcher', group: 'General', fallback: 'mod+/' },
  { id: 'assistant', label: 'Ask BearRok', group: 'General', fallback: 'mod+k' },
  { id: 'page:/today', label: 'Dashboard', group: 'Pages', fallback: 'mod+1' },
  { id: 'page:/', label: 'Feed', group: 'Pages', fallback: 'mod+2' },
  { id: 'page:/roadmap', label: 'Roadmap', group: 'Pages', fallback: 'mod+3' },
  { id: 'page:/discover', label: 'Career discovery', group: 'Pages', fallback: 'mod+4' },
  { id: 'page:/applications', label: 'Applications', group: 'Pages', fallback: 'mod+5' },
  { id: 'page:/calendar', label: 'Calendar', group: 'Pages', fallback: 'mod+6' },
  { id: 'page:/saved', label: 'Saved', group: 'Pages', fallback: 'mod+7' },
  { id: 'page:/agents', label: 'Agents', group: 'Pages', fallback: 'mod+8' },
  { id: 'page:/settings', label: 'Settings', group: 'Pages', fallback: 'mod+9' },
  { id: 'page:/profile', label: 'Profile', group: 'Pages', fallback: null },
];

const STORAGE_KEY = 'bearrok.shortcuts';
const CHANGED = 'bearrok:shortcuts';

export type Shortcuts = Record<string, string | null>;
type Overrides = Record<string, string | null>;

export const isMac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform);

function readOverrides(): Overrides {
  try {
    const saved: unknown = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}');
    if (!saved || typeof saved !== 'object' || Array.isArray(saved)) return {};
    const known = new Set(shortcutActions.map((action) => action.id));
    return Object.fromEntries(Object.entries(saved).filter(([id, combo]) => known.has(id) && (combo === null || typeof combo === 'string')));
  } catch {
    return {};
  }
}

/** Every action's shortcut: the student's own where they set one, the default otherwise. */
export function resolveShortcuts(overrides: Overrides): Shortcuts {
  return Object.fromEntries(shortcutActions.map((action) => [action.id, action.id in overrides ? overrides[action.id]! : action.fallback]));
}

function writeOverrides(overrides: Overrides) {
  try {
    if (Object.keys(overrides).length === 0) localStorage.removeItem(STORAGE_KEY);
    else localStorage.setItem(STORAGE_KEY, JSON.stringify(overrides));
  } catch {
    // Storage can be full or blocked; the change still applies until the page reloads.
  }
  window.dispatchEvent(new CustomEvent(CHANGED, { detail: overrides }));
}

/**
 * The overrides after giving one action a shortcut (or none). Another action that had the same
 * shortcut loses it, so one key press never does two things. Setting the default back removes
 * the override.
 */
export function withShortcut(overrides: Overrides, id: string, combo: string | null): Overrides {
  const next: Overrides = { ...overrides };
  if (combo !== null) {
    const current = resolveShortcuts(overrides);
    for (const action of shortcutActions) if (action.id !== id && current[action.id] === combo) next[action.id] = null;
  }
  next[id] = combo;
  for (const action of shortcutActions) if (action.id in next && next[action.id] === action.fallback) delete next[action.id];
  return next;
}

/** The action that already uses a shortcut, if any, other than the one being changed. */
export function takenBy(shortcuts: Shortcuts, combo: string, exceptId: string): ShortcutAction | undefined {
  return shortcutActions.find((action) => action.id !== exceptId && shortcuts[action.id] === combo);
}

/** The key a press stands for, read from the physical key so Shift and Option do not change it. */
function keyOf(event: KeyboardEvent): string | null {
  const { code } = event;
  if (/^Key[A-Z]$/.test(code)) return code.slice(3).toLowerCase();
  if (/^Digit\d$/.test(code)) return code.slice(5);
  if (/^F\d{1,2}$/.test(code)) return code.toLowerCase();
  const named: Record<string, string> = {
    Slash: '/',
    Backslash: '\\',
    Comma: ',',
    Period: '.',
    Semicolon: ';',
    Quote: "'",
    BracketLeft: '[',
    BracketRight: ']',
    Minus: '-',
    Equal: '=',
    Backquote: '`',
    Space: 'space',
    Enter: 'enter',
    ArrowUp: 'up',
    ArrowDown: 'down',
    ArrowLeft: 'left',
    ArrowRight: 'right',
  };
  if (named[code]) return named[code];
  // Events made without a physical key (tests, some input methods) only carry the character.
  if (!code && event.key.length === 1) return event.key.toLowerCase();
  return null;
}

/**
 * The shortcut a key press describes, or null when it is not usable as one: a modifier on its
 * own, or a plain letter with no Command, Ctrl or Option, which would fire while typing.
 */
export function comboFromEvent(event: KeyboardEvent): string | null {
  const key = keyOf(event);
  if (!key) return null;
  const mod = event.metaKey || event.ctrlKey;
  if (!mod && !event.altKey && !/^f\d{1,2}$/.test(key)) return null;
  return [mod ? 'mod' : null, event.altKey ? 'alt' : null, event.shiftKey ? 'shift' : null, key].filter(Boolean).join('+');
}

export function matchesShortcut(event: KeyboardEvent, combo: string | null | undefined): boolean {
  return !!combo && comboFromEvent(event) === combo;
}

/** A shortcut as the student reads it: "⌘K" on a Mac, "Ctrl+K" elsewhere. */
export function formatShortcut(combo: string | null, mac = isMac): string {
  if (!combo) return 'None';
  const parts = combo.split('+');
  const key = parts.pop() ?? '';
  const names: Record<string, string> = mac ? { mod: '⌘', alt: '⌥', shift: '⇧' } : { mod: 'Ctrl', alt: 'Alt', shift: 'Shift' };
  const keyNames: Record<string, string> = { space: 'Space', enter: 'Return', up: '↑', down: '↓', left: '←', right: '→' };
  const shown = keyNames[key] ?? key.toUpperCase();
  return mac ? parts.map((part) => names[part]).join('') + shown : [...parts.map((part) => names[part]), shown].join('+');
}

/** The current shortcuts, kept up to date when Settings changes them, plus the ways to change them. */
export function useShortcuts() {
  const [overrides, setOverrides] = useState<Overrides>(readOverrides);
  useEffect(() => {
    const onChange = (event: Event) => setOverrides((event as CustomEvent<Overrides>).detail ?? readOverrides());
    window.addEventListener(CHANGED, onChange);
    return () => window.removeEventListener(CHANGED, onChange);
  }, []);
  return {
    shortcuts: resolveShortcuts(overrides),
    changed: Object.keys(overrides),
    set: (id: string, combo: string | null) => writeOverrides(withShortcut(readOverrides(), id, combo)),
    reset: (id: string) => {
      const action = shortcutActions.find((a) => a.id === id);
      if (action) writeOverrides(withShortcut(readOverrides(), id, action.fallback));
    },
    resetAll: () => writeOverrides({}),
  };
}
