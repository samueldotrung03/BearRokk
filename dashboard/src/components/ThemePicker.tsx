// The light / dark / match-system choice, shown on the sign-in pages and in Settings.
import { Desktop, Moon, Sun } from '@phosphor-icons/react';
import { themeChoices, useTheme, type ThemeChoice } from '../lib/theme.ts';

const icons: Record<ThemeChoice, typeof Sun> = { light: Sun, dark: Moon, system: Desktop };

export function ThemePicker({ compact = false }: { compact?: boolean }) {
  const { choice, set } = useTheme();
  return (
    <div role="radiogroup" aria-label="Appearance" className={`theme-picker ${compact ? 'theme-picker-compact' : ''}`}>
      {themeChoices.map(({ id, label }) => {
        const Icon = icons[id];
        return (
          <button key={id} type="button" role="radio" aria-checked={choice === id} aria-label={compact ? label : undefined} title={compact ? label : undefined} onClick={() => set(id)}>
            <Icon aria-hidden="true" weight={choice === id ? 'fill' : 'regular'} />
            {!compact && <span>{label}</span>}
          </button>
        );
      })}
    </div>
  );
}
