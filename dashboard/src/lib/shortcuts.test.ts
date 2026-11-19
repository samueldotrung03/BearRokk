import { describe, expect, it } from 'vitest';
import { comboFromEvent, formatShortcut, matchesShortcut, resolveShortcuts, shortcutActions, takenBy, withShortcut } from './shortcuts.ts';

const press = (init: Partial<KeyboardEvent>) => ({ metaKey: false, ctrlKey: false, altKey: false, shiftKey: false, code: '', key: '', ...init }) as KeyboardEvent;

describe('keyboard shortcuts', () => {
  it('starts with a different default for every action that has one', () => {
    const combos = shortcutActions.map((a) => a.fallback).filter(Boolean);
    expect(new Set(combos).size).toBe(combos.length);
    expect(resolveShortcuts({})['assistant']).toBe('mod+k');
    expect(resolveShortcuts({})['page:/today']).toBe('mod+1');
  });

  it('reads a key press from the physical key, with Command or Ctrl as the same modifier', () => {
    expect(comboFromEvent(press({ metaKey: true, code: 'KeyK', key: 'k' }))).toBe('mod+k');
    expect(comboFromEvent(press({ ctrlKey: true, code: 'KeyK', key: 'k' }))).toBe('mod+k');
    // Shift and Option change the character typed, not the shortcut.
    expect(comboFromEvent(press({ metaKey: true, shiftKey: true, code: 'Digit1', key: '!' }))).toBe('mod+shift+1');
    expect(comboFromEvent(press({ altKey: true, code: 'KeyP', key: 'π' }))).toBe('alt+p');
  });

  it('refuses a plain letter or a modifier on its own, which would fire while typing', () => {
    expect(comboFromEvent(press({ code: 'KeyK', key: 'k' }))).toBeNull();
    expect(comboFromEvent(press({ shiftKey: true, code: 'KeyK', key: 'K' }))).toBeNull();
    expect(comboFromEvent(press({ metaKey: true, code: 'MetaLeft', key: 'Meta' }))).toBeNull();
  });

  it('matches only the exact shortcut, and never when there is none', () => {
    const event = press({ metaKey: true, code: 'KeyK', key: 'k' });
    expect(matchesShortcut(event, 'mod+k')).toBe(true);
    expect(matchesShortcut(event, 'mod+shift+k')).toBe(false);
    expect(matchesShortcut(event, null)).toBe(false);
  });

  it('applies a change, and takes the shortcut away from the action that had it', () => {
    const overrides = withShortcut({}, 'assistant', 'mod+1');
    const now = resolveShortcuts(overrides);
    expect(now['assistant']).toBe('mod+1');
    expect(now['page:/today']).toBeNull();
    expect(takenBy(resolveShortcuts({}), 'mod+1', 'assistant')?.label).toBe('Today');
  });

  it('can switch a shortcut off, and forgets an override that equals the default', () => {
    const off = withShortcut({}, 'launcher', null);
    expect(resolveShortcuts(off)['launcher']).toBeNull();
    expect(withShortcut(off, 'launcher', 'mod+/')).toEqual({});
  });

  it('writes a shortcut the way each system shows it', () => {
    expect(formatShortcut('mod+shift+k', true)).toBe('⌘⇧K');
    expect(formatShortcut('mod+shift+k', false)).toBe('Ctrl+Shift+K');
    expect(formatShortcut(null)).toBe('None');
  });
});
