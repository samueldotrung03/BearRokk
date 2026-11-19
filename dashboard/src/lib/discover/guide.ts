// Career guides from the backend (backend/src/careers): the types, the calls, a hook that keeps a
// guide current while the agents research it, and the one line that says what they are doing.
import { useCallback, useEffect, useRef, useState } from 'react';
import { API_URL } from '../../auth/firebase.ts';

export const SECTION_IDS = ['basics', 'voices', 'start', 'interview'] as const;
export type SectionId = (typeof SECTION_IDS)[number];

type Source = { title: string; url: string };

// Fields marked optional were added later; guides researched before them do not have them.
export type Basics = {
  summary: string;
  dayInLife?: string[];
  whatTheyDo: string[];
  whereTheyWork: string[];
  specialties?: { name: string; what: string }[];
  skills: string[];
  education?: string | null;
  pay: { figure: string; url: string } | null;
  outlook: string | null;
  sources: Source[];
};
export type PostTopic = 'the work' | 'getting in' | 'advice' | 'pay and life';
export type Voices = { posts: { author: string; role: string; handle: string | null; text: string; takeaway: string; topic?: PostTopic; url: string | null; date: string | null }[] };
export type Start = {
  steps: { title: string; detail: string; when?: string | null; resource: Source | null }[];
  resources: { title: string; url: string; kind: 'course' | 'book' | 'site' | 'community' | 'video' | 'practice'; free: boolean | null }[];
};
export type Interview = {
  formats: { name: string; tests: string; howToPractice: string; url: string | null }[];
  questions: { kind: string; question: string; tip?: string | null }[];
  sources: Source[];
};

export type SectionState<T> = {
  status: 'waiting' | 'working' | 'done' | 'failed';
  data: T | null;
  sample: boolean;
  error: string | null;
  /** How many items the last "Add more" added, and when. */
  added?: { count: number; at: string } | null;
};

export type Guide = {
  slug: string;
  query: string;
  title: string;
  oneLine: string | null;
  field: string | null;
  status: 'planning' | 'researching' | 'ready' | 'failed';
  provider: 'grok' | 'claude' | 'simulated';
  startedAt: string;
  updatedAt: string;
  error: string | null;
  sections: { basics: SectionState<Basics>; voices: SectionState<Voices>; start: SectionState<Start>; interview: SectionState<Interview> };
};

export type GuideSummary = Pick<Guide, 'slug' | 'title' | 'oneLine' | 'updatedAt' | 'status'>;

export const SECTION_TITLES: Record<SectionId, string> = {
  basics: 'The basics',
  voices: 'What people in the job say',
  start: 'How to start',
  interview: 'What the interviews ask',
};

export function slugFor(query: string): string {
  return query
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
}

export const isResearching = (guide: Guide | null) => guide?.status === 'planning' || guide?.status === 'researching';

/** Anything still running for this guide: its research, or "Add more" on one of its parts. */
export const isBusy = (guide: Guide | null) => isResearching(guide) || SECTION_IDS.some((id) => guide?.sections[id].status === 'working');

/** What the agents are doing right now, in one line, or null when they are not working. */
export function stepLine(guide: Guide): string | null {
  if (guide.status === 'planning') return `Working out what ${guide.query} involves`;
  if (guide.status !== 'researching') {
    // Ready, but one part is out looking for more.
    const more: Record<SectionId, string> = {
      basics: 'Finding more on the basics',
      voices: guide.sections.voices.sample ? 'Writing more sample stories' : 'Finding more posts on X',
      start: 'Finding more ways to start',
      interview: 'Finding more interview questions',
    };
    const now = SECTION_IDS.find((id) => guide.sections[id].status === 'working');
    return now ? more[now] : null;
  }
  const working: Record<SectionId, string> = {
    basics: 'Reading the basics',
    voices: guide.sections.voices.sample ? 'Writing sample stories' : 'Reading what people in the job share on X',
    start: 'Mapping how to start',
    interview: 'Collecting interview questions',
  };
  const done = SECTION_IDS.filter((id) => guide.sections[id].status === 'done' || guide.sections[id].status === 'failed').length;
  const now = SECTION_IDS.find((id) => guide.sections[id].status === 'working');
  return `${now ? working[now] : 'Putting the guide together'} · ${done} of ${SECTION_IDS.length} ready`;
}

/** Who researched the guide, as the page says it. Claude is a test set-up and is never shown as Grok. */
export function providerLabel(provider: Guide['provider']): string {
  return provider === 'grok' ? 'Grok' : provider === 'claude' ? 'Claude (test mode)' : 'simulated agents';
}

type Load = { guide: Guide | null; error: string | null; busy: boolean };

async function readError(res: Response): Promise<string> {
  const body = await res.json().catch(() => ({}));
  return typeof body.error === 'string' ? body.error : `The agents answered ${res.status}.`;
}

const OFFLINE = 'Your agents cannot be reached right now. Try again in a moment.';

/**
 * The guide for one career. Asking for a career the backend already knows shows the kept guide;
 * a new one starts the research. While the agents work, the guide is fetched again every two seconds.
 */
export function useCareerGuide(query: string | null) {
  const [state, setState] = useState<Load>({ guide: null, error: null, busy: false });
  const timer = useRef<number | null>(null);
  const active = useRef<string | null>(null);

  const stopPolling = () => {
    if (timer.current !== null) window.clearTimeout(timer.current);
    timer.current = null;
  };

  const poll = useCallback((slug: string) => {
    stopPolling();
    timer.current = window.setTimeout(async () => {
      if (active.current !== slug) return;
      try {
        const res = await fetch(`${API_URL}/api/careers/guides/${slug}`);
        if (!res.ok) throw new Error(await readError(res));
        const { guide } = (await res.json()) as { guide: Guide };
        if (active.current !== slug) return;
        setState({ guide, error: null, busy: false });
        if (isBusy(guide)) poll(slug);
      } catch {
        if (active.current === slug) poll(slug);
      }
    }, 2000);
  }, []);

  const request = useCallback(
    async (career: string, refresh = false) => {
      const slug = slugFor(career);
      active.current = slug;
      stopPolling();
      setState((s) => ({ guide: s.guide?.slug === slug ? s.guide : null, error: null, busy: true }));
      try {
        const res = await fetch(`${API_URL}/api/careers/guides`, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ career, refresh }),
        });
        if (!res.ok) throw new Error(await readError(res));
        const { guide } = (await res.json()) as { guide: Guide };
        if (active.current !== slug) return;
        setState({ guide, error: null, busy: false });
        if (isBusy(guide)) poll(guide.slug);
      } catch (e) {
        if (active.current !== slug) return;
        const message = e instanceof TypeError ? OFFLINE : e instanceof Error ? e.message : OFFLINE;
        setState({ guide: null, error: message, busy: false });
      }
    },
    [poll],
  );

  useEffect(() => {
    if (query) void request(query);
    else {
      active.current = null;
      setState({ guide: null, error: null, busy: false });
    }
    return stopPolling;
  }, [query, request]);

  /** "Add more" on one part. A refusal (still researching, agents offline) is shown on that part. */
  const addMore = useCallback(
    async (section: SectionId) => {
      const slug = state.guide?.slug;
      if (!slug) return;
      try {
        const res = await fetch(`${API_URL}/api/careers/guides/${slug}/sections/${section}/more`, { method: 'POST' });
        if (!res.ok) throw new Error(await readError(res));
        const { guide } = (await res.json()) as { guide: Guide };
        if (active.current !== slug) return;
        setState({ guide, error: null, busy: false });
        poll(slug);
      } catch (e) {
        const message = e instanceof TypeError ? OFFLINE : e instanceof Error ? e.message : OFFLINE;
        setState((s) =>
          s.guide?.slug === slug ? { ...s, guide: { ...s.guide, sections: { ...s.guide.sections, [section]: { ...s.guide.sections[section], error: message } } } } : s,
        );
      }
    },
    [state.guide?.slug, poll],
  );

  return { ...state, searchAgain: () => query && request(query, true), retry: () => query && request(query), addMore };
}

/** Guides the agents have already researched, for quick picks. Empty when the backend is away. */
export function useGuideList(refreshKey: unknown): GuideSummary[] {
  const [list, setList] = useState<GuideSummary[]>([]);
  useEffect(() => {
    let live = true;
    fetch(`${API_URL}/api/careers/guides`)
      .then((r) => (r.ok ? r.json() : { guides: [] }))
      .then((body: { guides?: GuideSummary[] }) => live && setList(body.guides ?? []))
      .catch(() => live && setList([]));
    return () => {
      live = false;
    };
  }, [refreshKey]);
  return list;
}
