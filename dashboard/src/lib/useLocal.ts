// A piece of page state that survives a reload, kept in its own localStorage key. Pages use this
// for state that belongs to one page only (notes, a chosen view), so the shared store stays small.
import { useCallback, useEffect, useState } from 'react';

export function useLocal<T>(key: string, initial: T): [T, (next: T | ((current: T) => T)) => void] {
  const [value, setValue] = useState<T>(() => {
    try {
      const raw = localStorage.getItem(key);
      return raw === null ? initial : (JSON.parse(raw) as T);
    } catch {
      return initial;
    }
  });
  useEffect(() => {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch {
      // Storage can be full or blocked; the page still works for this session.
    }
  }, [key, value]);
  const set = useCallback((next: T | ((current: T) => T)) => setValue(next), []);
  return [value, set];
}
