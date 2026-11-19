import { Brain, Code, Compass, Database, type LucideIcon } from 'lucide-react';
import type { CSSProperties } from 'react';
import { matchMeta } from '../meta.ts';
import type { PathMatch } from '../../lib/discover/match.ts';
import { useCountUp } from './motion.ts';

const icons: Record<string, LucideIcon> = {
  'path-swe': Code,
  'path-ml': Brain,
  'path-data': Database,
  'path-pm': Compass,
};

/** A small tile in the path's own colour, so the four paths are easy to tell apart everywhere. */
export function PathMark({ pathId, hue, size = 'md' }: { pathId: string; hue: string; size?: 'sm' | 'md' | 'lg' }) {
  const Icon = icons[pathId] ?? Compass;
  return (
    <span className={`dc-mark dc-mark-${size}`} style={{ '--dc-hue': hue } as CSSProperties} aria-hidden="true">
      <Icon strokeWidth={2} />
    </span>
  );
}

/** The match percentage in the display serif, counting to its new value when it changes. */
export function Percent({ value, className = '' }: { value: number; className?: string }) {
  const shown = useCountUp(value);
  return (
    <span className={`dc-percent ${className}`}>
      {shown}
      <span className="dc-percent-sign">%</span>
    </span>
  );
}

export function LevelPill({ match }: { match: PathMatch }) {
  const meta = matchMeta[match.level];
  return <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-medium ${meta.tint}`}>{meta.label}</span>;
}
