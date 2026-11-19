import { beforeEach, describe, expect, it, vi } from 'vitest';
import { readThemeChoice, resolveTheme, setThemeChoice, THEME_KEY } from './theme.ts';

// The tests run without a browser, so stand in for the few page objects the theme touches.
const saved = new Map<string, string>();
const root = { dataset: {} as Record<string, string>, style: {} as Record<string, string> };

describe('theme', () => {
  beforeEach(() => {
    saved.clear();
    root.dataset = {};
    vi.stubGlobal('localStorage', { getItem: (k: string) => saved.get(k) ?? null, setItem: (k: string, v: string) => saved.set(k, v) });
    vi.stubGlobal('document', { documentElement: root, querySelector: () => null });
    vi.stubGlobal('window', { dispatchEvent: () => true });
    vi.stubGlobal('CustomEvent', class {});
  });

  it('starts light, and ignores a saved value it does not know', () => {
    expect(readThemeChoice()).toBe('light');
    saved.set(THEME_KEY, 'purple');
    expect(readThemeChoice()).toBe('light');
  });

  it('follows the system only when the student chose to', () => {
    expect(resolveTheme('system', true)).toBe('dark');
    expect(resolveTheme('system', false)).toBe('light');
    expect(resolveTheme('light', true)).toBe('light');
    expect(resolveTheme('dark', false)).toBe('dark');
  });

  it('saves the choice and marks the page so the stylesheets switch', () => {
    setThemeChoice('dark');
    expect(saved.get(THEME_KEY)).toBe('dark');
    expect(root.dataset.theme).toBe('dark');
    expect(root.style.colorScheme).toBe('dark');
    setThemeChoice('light');
    expect(root.dataset.theme).toBe('light');
  });
});
