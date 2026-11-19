// The app's appearance: light, dark, or whatever the system is set to. The choice is kept on
// this device and applied to the <html> element as data-theme, which the stylesheets read.
// index.html applies the saved choice before the page paints, so there is no flash.
import { useEffect, useState } from 'react';

export type ThemeChoice = 'light' | 'dark' | 'system';
export type Theme = 'light' | 'dark';

export const THEME_KEY = 'bearrok.theme';
const CHANGED = 'bearrok:theme';

export const themeChoices: { id: ThemeChoice; label: string }[] = [
  { id: 'light', label: 'Light' },
  { id: 'dark', label: 'Dark' },
  { id: 'system', label: 'Match system' },
];

export function readThemeChoice(): ThemeChoice {
  try {
    const saved = localStorage.getItem(THEME_KEY);
    return saved === 'dark' || saved === 'system' || saved === 'light' ? saved : 'light';
  } catch {
    return 'light';
  }
}

const systemDark = () => typeof matchMedia === 'function' && matchMedia('(prefers-color-scheme: dark)').matches;

/** The theme a choice comes to on this device right now. */
export function resolveTheme(choice: ThemeChoice, prefersDark = systemDark()): Theme {
  return choice === 'system' ? (prefersDark ? 'dark' : 'light') : choice;
}

export function applyTheme(choice: ThemeChoice) {
  const theme = resolveTheme(choice);
  const root = document.documentElement;
  root.dataset.theme = theme;
  root.style.colorScheme = theme;
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', theme === 'dark' ? '#0a0b0f' : '#2f86e0');
}

export function setThemeChoice(choice: ThemeChoice) {
  try {
    localStorage.setItem(THEME_KEY, choice);
  } catch {
    // Storage can be blocked; the choice still applies until the page reloads.
  }
  applyTheme(choice);
  window.dispatchEvent(new CustomEvent(CHANGED));
}

/** The current choice and the theme it comes to, kept in step with Settings and the system. */
export function useTheme() {
  const [choice, setChoice] = useState<ThemeChoice>(readThemeChoice);
  const [theme, setTheme] = useState<Theme>(() => resolveTheme(readThemeChoice()));
  useEffect(() => {
    const sync = () => {
      const next = readThemeChoice();
      applyTheme(next);
      setChoice(next);
      setTheme(resolveTheme(next));
    };
    sync();
    const media = typeof matchMedia === 'function' ? matchMedia('(prefers-color-scheme: dark)') : null;
    window.addEventListener(CHANGED, sync);
    window.addEventListener('storage', sync);
    media?.addEventListener('change', sync);
    return () => {
      window.removeEventListener(CHANGED, sync);
      window.removeEventListener('storage', sync);
      media?.removeEventListener('change', sync);
    };
  }, []);
  return { choice, theme, set: setThemeChoice };
}
