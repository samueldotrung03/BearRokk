import { useEffect, useRef, useState } from 'react';

const plain = (n: number) => Math.round(n).toLocaleString('en-US');

/** A number that counts up to its new value, so the counters visibly tick during a run. */
export function AnimatedNumber({ value, format = plain, reduced = false }: { value: number; format?: (n: number) => string; reduced?: boolean }) {
  const [shown, setShown] = useState(value);
  const current = useRef(value);
  useEffect(() => {
    if (reduced) {
      current.current = value;
      setShown(value);
      return;
    }
    const from = current.current;
    const start = performance.now();
    let frame = 0;
    const step = (now: number) => {
      const p = Math.min(1, (now - start) / 500);
      const next = from + (value - from) * (1 - (1 - p) ** 3);
      current.current = next;
      setShown(next);
      if (p < 1) frame = requestAnimationFrame(step);
    };
    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
  }, [value, reduced]);
  return <>{format(shown)}</>;
}

export const compact = (n: number) => (n >= 10_000 ? `${(n / 1000).toFixed(1)}k` : Math.round(n).toLocaleString('en-US'));

/** Simulated milliseconds as m:ss. */
export const clockText = (ms: number) => {
  const s = Math.floor(ms / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
};
