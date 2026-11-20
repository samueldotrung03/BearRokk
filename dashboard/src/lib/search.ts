// The Search page's client: the backend's two search routes, the filters, the student's recent
// searches (kept only in this browser) and reading the answer's [1] citations.
// Backend: backend/src/search.ts.
import { API_URL } from '../auth/firebase.ts';

export type SearchKind = 'all' | 'internship' | 'research' | 'event' | 'club' | 'hackathon' | 'scholarship';
export type SearchTime = 'any' | 'open' | 'week' | 'month';
export type Origin = 'web' | 'feed' | 'saved' | 'application';

export const KINDS: [SearchKind, string][] = [
  ['all', 'All'],
  ['internship', 'Internships'],
  ['research', 'Research'],
  ['event', 'Events'],
  ['club', 'Clubs'],
  ['hackathon', 'Hackathons'],
  ['scholarship', 'Scholarships'],
];
export const TIMES: [SearchTime, string][] = [
  ['any', 'Any time'],
  ['open', 'Still open'],
  ['week', 'Closing this week'],
  ['month', 'Closing this month'],
];
export const ORIGIN_LABEL: Record<Origin, string> = { web: 'Web', feed: 'Your feed', saved: 'Saved', application: 'Applications' };
export interface SearchFilters {
  kind: SearchKind;
  time: SearchTime;
  place: string;
  personal: boolean;
  web: boolean;
}
export const DEFAULT_FILTERS: SearchFilters = { kind: 'all', time: 'any', place: '', personal: true, web: true };

export interface SearchResult {
  id: string;
  origin: Origin;
  opportunityId: string | null;
  title: string;
  organizer: string;
  type: string;
  url: string;
  source: string;
  snippet: string;
  deadline: string | null;
  location: string | null;
  status: string | null;
  why: string;
  score: number;
}
export interface LocalAnswer {
  results: SearchResult[];
  contextParts: string[];
  /** Whether the backend has a model that can search the web. */
  ai: boolean;
  writer: string;
}
export interface SearchAnswer {
  intent: string;
  answer: string;
  results: SearchResult[];
  related: string[];
  contextUsed: string[];
  /** Which model searched: 'claude' is the temporary test set-up, standing in for Grok. */
  writer: string;
}

/** A request the backend turned down or could not finish, with its reason in plain words. */
export class SearchError extends Error {
  readonly status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

async function post<T>(path: string, who: 'me' | 'demo', token: string | null, body: unknown, signal?: AbortSignal): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${API_URL}/api/students/${who}/${path}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: JSON.stringify(body),
      signal,
    });
  } catch (error) {
    if (signal?.aborted) throw error;
    throw new SearchError('The app cannot reach your agents right now, so nothing could be searched.', 0);
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const reason = typeof data?.error === 'string' ? data.error : 'unknown error';
    throw new SearchError(`${reason.charAt(0).toUpperCase()}${reason.slice(1)}.`, res.status);
  }
  return data as T;
}

export const searchOwn = (who: 'me' | 'demo', token: string | null, query: string, f: SearchFilters, signal?: AbortSignal) =>
  post<LocalAnswer>('search/local', who, token, { query, ...f }, signal);
export const searchWeb = (who: 'me' | 'demo', token: string | null, query: string, f: SearchFilters, signal?: AbortSignal) =>
  post<SearchAnswer>('search', who, token, { query, ...f }, signal);

// ----- recent searches ------------------------------------------------------------------------

const RECENT = 'bearrok.search.recent';
export interface Recent {
  q: string;
  kind: SearchKind;
}
export function recentSearches(): Recent[] {
  try {
    const list = JSON.parse(localStorage.getItem(RECENT) ?? '[]');
    return Array.isArray(list) ? list.filter((r): r is Recent => typeof r?.q === 'string').slice(0, 12) : [];
  } catch {
    return [];
  }
}
/** Puts a search at the top of the recent list, once. */
export function addRecent(list: Recent[], q: string, kind: SearchKind): Recent[] {
  const next = [{ q, kind }, ...list.filter((r) => r.q.toLowerCase() !== q.toLowerCase())].slice(0, 12);
  try {
    localStorage.setItem(RECENT, JSON.stringify(next));
  } catch {
    // Storage blocked: the list lasts only this visit.
  }
  return next;
}
export function clearRecent(): Recent[] {
  try {
    localStorage.removeItem(RECENT);
  } catch {
    // Nothing kept.
  }
  return [];
}

// ----- the answer -----------------------------------------------------------------------------

export type AnswerPart = { kind: 'text'; text: string; bold: boolean } | { kind: 'cite'; n: number };

/**
 * The answer as paragraphs of plain text, bold runs and citation numbers. Citations past the
 * number of results are dropped, so a number always points at a result on the page.
 */
export function answerParts(answer: string, results: number): AnswerPart[][] {
  return answer
    .split(/\n\s*\n/)
    .map((para) => para.replace(/^#+\s*/gm, '').trim())
    .filter(Boolean)
    .map((para) => {
      const parts: AnswerPart[] = [];
      for (const [i, chunk] of para.split(/\[(\d{1,2})\]/).entries()) {
        if (i % 2 === 1) {
          const n = Number(chunk);
          if (n >= 1 && n <= results) parts.push({ kind: 'cite', n });
          continue;
        }
        for (const [j, run] of chunk.split('**').entries()) if (run) parts.push({ kind: 'text', text: run, bold: j % 2 === 1 });
      }
      return parts;
    });
}

/** "Nov 24" this year, "Feb 1, 2027" otherwise. */
export function shortDate(iso: string | null, now = new Date()): string {
  if (!iso || !/^\d{4}-\d{2}-\d{2}/.test(iso)) return '';
  const d = new Date(`${iso.slice(0, 10)}T12:00:00`);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', ...(d.getFullYear() === now.getFullYear() ? {} : { year: 'numeric' }) });
}
