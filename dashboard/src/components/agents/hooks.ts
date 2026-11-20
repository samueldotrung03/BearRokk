// Small browser hooks for the Agents page. The run logic itself is pure and lives in src/lib/agents.
import { useEffect, useLayoutEffect, useState, type RefObject } from 'react';

export function useReducedMotion(): boolean {
  const query = '(prefers-reduced-motion: reduce)';
  const [reduced, setReduced] = useState(() => typeof window !== 'undefined' && window.matchMedia(query).matches);
  useEffect(() => {
    const media = window.matchMedia(query);
    const onChange = () => setReduced(media.matches);
    media.addEventListener('change', onChange);
    return () => media.removeEventListener('change', onChange);
  }, []);
  return reduced;
}

/** Width of an element, kept current as the window resizes. */
export function useWidth(ref: RefObject<HTMLElement | null>): number {
  const [width, setWidth] = useState(0);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    setWidth(el.clientWidth);
    const observer = new ResizeObserver(() => setWidth(el.clientWidth));
    observer.observe(el);
    return () => observer.disconnect();
  }, [ref]);
  return width;
}

export type BackendState = { kind: 'checking' } | { kind: 'connected'; live: boolean } | { kind: 'offline' };

/**
 * Asks the teammates' agent server (backend/src/app.ts, GET /api/health) whether it is running.
 * A short timeout and a silent fallback: the page never depends on the answer.
 */
export function useBackendStatus(url = 'http://localhost:8787/api/health', timeoutMs = 1500): BackendState {
  const [state, setState] = useState<BackendState>({ kind: 'checking' });
  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    fetch(url, { signal: controller.signal })
      .then((response) => (response.ok ? (response.json() as Promise<unknown>) : Promise.reject(new Error(String(response.status)))))
      .then((body) => {
        const live = typeof body === 'object' && body !== null && (body as { live?: unknown }).live === true;
        if (!cancelled) setState({ kind: 'connected', live });
      })
      .catch(() => {
        if (!cancelled) setState({ kind: 'offline' });
      })
      .finally(() => clearTimeout(timer));
    return () => {
      cancelled = true;
      clearTimeout(timer);
      controller.abort();
    };
  }, [url, timeoutMs]);
  return state;
}
