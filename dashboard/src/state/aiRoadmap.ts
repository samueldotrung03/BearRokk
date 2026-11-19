// Asks the backend's writer for a roadmap and keeps the answer, so the page can show the
// rule-built draft at once and swap in Grok's roadmap when it arrives.
import { useEffect, useState } from 'react';
import { API_URL } from '../auth/firebase.ts';
import { useAuth } from '../auth/AuthProvider.tsx';
import { requestKey, type AiAnswer, type RoadmapRequest } from '../lib/roadmapx/ai.ts';

export type AiStatus =
  | 'writing' // asked, no answer yet
  | 'ready'
  | 'off' // the backend has no model connected, or cannot be reached
  | 'failed'; // a model is connected but this roadmap could not be written

const KEPT = 'bearrok.roadmap.written';
const LIMIT = 16;

function kept(): Record<string, AiAnswer> {
  try {
    return JSON.parse(localStorage.getItem(KEPT) ?? '{}') as Record<string, AiAnswer>;
  } catch {
    return {};
  }
}
function keep(key: string, answer: AiAnswer) {
  try {
    const all = Object.entries({ ...kept(), [key]: answer }).slice(-LIMIT);
    localStorage.setItem(KEPT, JSON.stringify(Object.fromEntries(all)));
  } catch {
    // Storage is full or blocked; the roadmap is simply written again next time.
  }
}

/** Requests in flight, so two views of one roadmap share one call. */
const asking = new Map<string, Promise<AiAnswer | 'off' | 'failed'>>();

/** Asks for the written roadmap. With `on` false it asks for nothing and reports no writer. */
export function useAiRoadmap(request: RoadmapRequest, on = true): { status: AiStatus; answer: AiAnswer | null; rewrite: () => void } {
  const auth = useAuth();
  const key = requestKey(request);
  const who = auth.status === 'signedIn' ? 'me' : 'demo';
  const [found, setFound] = useState<{ key: string; status: AiStatus; answer: AiAnswer | null }>({ key: '', status: 'writing', answer: null });
  const [again, setAgain] = useState(0);

  useEffect(() => {
    if (auth.status === 'loading' || !on) return;
    let current = true;
    const saved = again === 0 ? kept()[key] : undefined;
    if (saved) {
      setFound({ key, status: 'ready', answer: saved });
      return;
    }
    setFound({ key, status: 'writing', answer: null });
    let call = asking.get(key);
    if (!call) {
      call = (async () => {
        try {
          const token = await auth.getToken().catch(() => null);
          const res = await fetch(`${API_URL}/api/students/${who}/roadmap`, {
            method: 'POST',
            headers: { 'content-type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
            body: JSON.stringify(request),
          });
          if (!res.ok) return res.status === 502 ? 'failed' : 'off';
          const answer = (await res.json()) as AiAnswer;
          if (!answer.roadmap?.phases?.some((phase) => phase.steps.length > 0)) return 'failed';
          keep(key, answer);
          return answer;
        } catch {
          return 'off';
        } finally {
          asking.delete(key);
        }
      })();
      asking.set(key, call);
    }
    void call.then((result) => {
      if (!current) return;
      setFound(typeof result === 'string' ? { key, status: result, answer: null } : { key, status: 'ready', answer: result });
    });
    return () => {
      current = false;
    };
    // The key stands for the whole request.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, who, auth.status, again, on]);

  // An answer for another roadmap is never shown while this one is being fetched.
  const mine = found.key === key;
  if (!on) return { status: 'off', answer: null, rewrite: () => {} };
  return { status: mine ? found.status : 'writing', answer: mine ? found.answer : null, rewrite: () => setAgain((n) => n + 1) };
}
