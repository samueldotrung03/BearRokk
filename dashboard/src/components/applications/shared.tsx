// Pieces the Applications page's parts share: the row model, the "go to" request that lets the
// next-action strip open an application at the right spot, a reveal hook for the helper's
// streaming feel, and the readiness ring.
import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import type { Readiness } from '../../lib/apps/readiness.ts';
import type { Application, ApplicationInfo, Opportunity } from '../../types.ts';

export interface Item {
  opportunity: Opportunity;
  application: Application;
  info: ApplicationInfo | undefined;
  readiness: Readiness;
}

/** What to do once an application is open: focus a prompt and maybe start the helper on it. */
export interface Intent {
  index: number;
  kind: 'focus' | 'outline' | 'review';
  /** Changes on every request, so asking twice for the same thing still runs. */
  nonce: number;
}

export type GoTo = (id: string, target?: { promptIndex?: number; material?: string; helper?: 'outline' | 'review' }) => void;

export const promptDomId = (id: string, index: number) => `ap-prompt-${id}-${index}`;
export const materialDomId = (id: string, name: string) => `ap-material-${id}-${name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;

const reducedQuery = typeof window !== 'undefined' ? window.matchMedia('(prefers-reduced-motion: reduce)') : null;

/** Follows the system "reduce motion" setting live. */
export function useReducedMotion(): boolean {
  return useSyncExternalStore(
    (onChange) => {
      reducedQuery?.addEventListener('change', onChange);
      return () => reducedQuery?.removeEventListener('change', onChange);
    },
    () => reducedQuery?.matches ?? false,
    () => false,
  );
}

/**
 * Reveals `total` items one after another, the way a model's answer streams in. `key` restarts it.
 * With reduced motion everything shows at once.
 */
export function useReveal(total: number, key: unknown, step = 230): number {
  const reduced = useReducedMotion();
  const [shown, setShown] = useState(0);
  // Read through a ref so a live update to the same answer (the draft check follows typing)
  // does not restart the reveal; only a new answer, a new `key`, does.
  const totalRef = useRef(total);
  totalRef.current = total;
  useEffect(() => {
    if (reduced) {
      setShown(Infinity);
      return;
    }
    setShown(0);
    let count = 0;
    const timer = window.setInterval(() => {
      count += 1;
      if (count >= totalRef.current) {
        setShown(Infinity);
        window.clearInterval(timer);
      } else {
        setShown(count);
      }
    }, step);
    return () => window.clearInterval(timer);
  }, [key, reduced, step]);
  return Math.min(shown, total);
}

/** Moves focus to an element and briefly lights it up, once it exists in the page. */
export function focusAndFlash(domId: string, reduced: boolean) {
  let tries = 0;
  const attempt = () => {
    const el = document.getElementById(domId);
    if (!el) {
      if (tries++ < 10) requestAnimationFrame(attempt);
      return;
    }
    el.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', block: 'center' });
    el.focus({ preventScroll: true });
    const flash = el.closest('[data-flash]') ?? el;
    flash.classList.remove('ap-flash');
    // Reading layout restarts the CSS animation when the same spot is flashed twice in a row.
    void (flash as HTMLElement).offsetWidth;
    flash.classList.add('ap-flash');
  };
  requestAnimationFrame(attempt);
}

export function scoreTone(score: number): 'low' | 'mid' | 'high' {
  return score >= 80 ? 'high' : score >= 45 ? 'mid' : 'low';
}

export function ReadinessRing({ score, size = 64, label = true }: { score: number; size?: number; label?: boolean }) {
  const stroke = size >= 56 ? 5 : 4;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  return (
    <div className="ap-ring" data-tone={scoreTone(score)} style={{ width: size, height: size }} role="img" aria-label={`Readiness ${score} out of 100`}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden="true">
        <circle cx={size / 2} cy={size / 2} r={r} className="ap-ring-track" strokeWidth={stroke} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          className="ap-ring-value"
          strokeWidth={stroke}
          strokeDasharray={c}
          strokeDashoffset={c * (1 - score / 100)}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </svg>
      {label && (
        <span className="ap-ring-number font-display" style={{ fontSize: size * 0.4 }} aria-hidden="true">
          {score}
        </span>
      )}
    </div>
  );
}

/** Renders text with its [blanks] marked, so the student sees at a glance what is theirs to fill. */
export function WithBlanks({ text }: { text: string }) {
  const parts = text.split(/(\[[^\]\n]{1,80}\])/g);
  return (
    <>
      {parts.map((part, index) =>
        /^\[.*\]$/.test(part) ? (
          <span key={index} className="ap-blank">
            {part.slice(1, -1)}
          </span>
        ) : (
          <span key={index}>{part}</span>
        ),
      )}
    </>
  );
}
