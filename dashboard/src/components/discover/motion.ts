// Small motion helpers for the discovery page. Every one of them turns itself off when the
// system asks for reduced motion, so text and numbers simply appear in full.
import { useEffect, useRef, useState } from 'react';

const query = '(prefers-reduced-motion: reduce)';

export function prefersReducedMotion(): boolean {
  return typeof window !== 'undefined' && typeof window.matchMedia === 'function' && window.matchMedia(query).matches;
}

export function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(prefersReducedMotion);
  useEffect(() => {
    if (typeof window.matchMedia !== 'function') return;
    const list = window.matchMedia(query);
    const onChange = () => setReduced(list.matches);
    list.addEventListener('change', onChange);
    return () => list.removeEventListener('change', onChange);
  }, []);
  return reduced;
}

/**
 * Reveals text a few words at a time, the way a model's answer streams in. Returns the visible
 * part and whether it is finished. With `active` false the full text shows at once.
 */
export function useStreamedText(text: string, active: boolean): { shown: string; done: boolean } {
  const reduced = useReducedMotion();
  const animate = active && !reduced;
  const [count, setCount] = useState(animate ? 0 : Number.MAX_SAFE_INTEGER);
  const words = text.split(/(\s+)/);

  useEffect(() => {
    if (!animate) {
      setCount(Number.MAX_SAFE_INTEGER);
      return;
    }
    setCount(0);
    // About 45 words a second: quick enough to feel instant, slow enough to read as streaming.
    const id = window.setInterval(() => {
      setCount((current) => {
        if (current >= words.length) {
          window.clearInterval(id);
          return current;
        }
        return current + 2;
      });
    }, 22);
    return () => window.clearInterval(id);
    // Restart only when the text itself changes; `words` is derived from it.
  }, [text, animate]);

  const done = count >= words.length;
  return { shown: done ? text : words.slice(0, count).join(''), done };
}

/** Counts a number up (or down) to its new value, so a changing match is easy to notice. */
export function useCountUp(value: number, duration = 650): number {
  const reduced = useReducedMotion();
  const [shown, setShown] = useState(value);
  const from = useRef(value);

  useEffect(() => {
    if (reduced) {
      setShown(value);
      from.current = value;
      return;
    }
    const start = performance.now();
    const origin = from.current;
    let frame = 0;
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - (1 - t) ** 3;
      const next = Math.round(origin + (value - origin) * eased);
      setShown(next);
      from.current = next;
      if (t < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [value, duration, reduced]);

  return shown;
}
