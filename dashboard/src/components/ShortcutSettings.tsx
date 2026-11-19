// The Settings block for keyboard shortcuts: every shortcut the app has, with a way to record a
// different one, switch one off, or go back to the defaults.
import { Keyboard } from '@phosphor-icons/react';
import { useEffect, useState } from 'react';
import { comboFromEvent, formatShortcut, shortcutActions, takenBy, useShortcuts } from '../lib/shortcuts.ts';
import { Card } from './Page.tsx';
import { ActionButton } from './settingsParts.tsx';

export function ShortcutSettings() {
  const { shortcuts, changed, set, reset, resetAll } = useShortcuts();
  /** The action whose next key press becomes its shortcut. */
  const [recording, setRecording] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);

  // While recording, the next key press belongs to this block and must not also run a shortcut.
  useEffect(() => {
    if (!recording) return;
    const onKey = (event: KeyboardEvent) => {
      event.preventDefault();
      event.stopImmediatePropagation();
      if (event.key === 'Escape') return setRecording(null);
      const label = shortcutActions.find((action) => action.id === recording)?.label ?? '';
      if (event.key === 'Backspace' || event.key === 'Delete') {
        set(recording, null);
        setNote(`${label} has no shortcut now.`);
        return setRecording(null);
      }
      if (['Meta', 'Control', 'Alt', 'Shift'].includes(event.key)) return;
      const combo = comboFromEvent(event);
      if (!combo) return setNote('Use Command, Ctrl or Option with another key, so it does not fire while you type.');
      const other = takenBy(shortcuts, combo, recording);
      set(recording, combo);
      setNote(other ? `${formatShortcut(combo)} now belongs to ${label}. ${other.label} has no shortcut.` : `${label} is now ${formatShortcut(combo)}.`);
      setRecording(null);
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [recording, set, shortcuts]);

  return (
    <Card className="p-7">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold tracking-tight">Keyboard shortcuts</h2>
          <p className="mt-1 text-sm text-ink-2">Keep the defaults, or press Change and then the keys you want.</p>
        </div>
        <ActionButton
          disabled={changed.length === 0}
          onClick={() => {
            resetAll();
            setRecording(null);
            setNote('All shortcuts are back to the defaults.');
          }}
        >
          Use the defaults
        </ActionButton>
      </div>

      <p className="mt-3 min-h-5 text-sm text-ink-2" role="status">
        {recording ? 'Press the new shortcut. Escape cancels, Delete removes it.' : note}
      </p>

      {(['General', 'Pages'] as const).map((group) => (
        <section key={group} className="mt-4">
          <h3 className="flex items-center gap-2 text-xs font-semibold tracking-wide text-ink-3 uppercase">
            {group === 'General' && <Keyboard aria-hidden="true" className="size-4" />}
            {group}
          </h3>
          <ul className="mt-1 divide-y divide-line">
            {shortcutActions
              .filter((action) => action.group === group)
              .map((action) => {
                const combo = shortcuts[action.id] ?? null;
                const isRecording = recording === action.id;
                return (
                  <li key={action.id} className="flex flex-wrap items-center gap-x-3 gap-y-2 py-2.5">
                    <span className="min-w-0 flex-1 text-sm font-medium text-ink">{action.label}</span>
                    <kbd
                      className={`min-w-16 rounded-lg px-2.5 py-1 text-center font-sans text-sm font-medium ${
                        isRecording ? 'bg-brand text-white' : combo ? 'bg-slate-100 text-ink' : 'bg-slate-50 text-ink-3'
                      }`}
                    >
                      {isRecording ? 'Press keys' : formatShortcut(combo)}
                    </kbd>
                    <ActionButton
                      aria-label={isRecording ? `Cancel changing the shortcut for ${action.label}` : `Change the shortcut for ${action.label}`}
                      onClick={() => {
                        setNote(null);
                        setRecording(isRecording ? null : action.id);
                      }}
                    >
                      {isRecording ? 'Cancel' : 'Change'}
                    </ActionButton>
                    <ActionButton
                      aria-label={`Use the default shortcut for ${action.label}`}
                      disabled={!changed.includes(action.id)}
                      onClick={() => {
                        reset(action.id);
                        setRecording(null);
                        setNote(`${action.label} is back to ${formatShortcut(action.fallback)}.`);
                      }}
                    >
                      Default
                    </ActionButton>
                  </li>
                );
              })}
          </ul>
        </section>
      ))}
      <p className="mt-3 text-xs text-ink-3">
        In a web browser, some combinations such as Command with a number belong to the browser itself. They work in the desktop app, and Ctrl works in both.
      </p>
    </Card>
  );
}
