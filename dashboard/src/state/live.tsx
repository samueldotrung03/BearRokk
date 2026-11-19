// The connection between the app and the agent backend. It listens to the backend's live stream
// for this student (their own once signed in, the shared demo student for a guest), turns the
// backend's results into the cards the pages already draw, and sends the student's reactions
// back so the agents learn from them. Only what the agents found is shown: while they have
// nothing yet, or the backend cannot be reached, the pages are empty and say why.
import { createContext, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useAuth } from '../auth/AuthProvider.tsx';
import { API_URL } from '../auth/firebase.ts';
import { applicationInfo, coverFor } from '../data/sample.ts';
import type { AgentEvent, AgentNode, Opportunity, OpportunityType } from '../types.ts';
import { useStore } from './StoreProvider.tsx';

// ---- what the backend sends ------------------------------------------------------------------
interface BackendOpportunity {
  id: string;
  type: OpportunityType;
  title: string;
  organizer: string;
  sourceUrl: string;
  actionUrl: string | null;
  format: Opportunity['format'];
  location: string | null;
  tags: string[];
  deadline: string | null;
  startTime: string | null;
  image: string | null;
  unknowns: Opportunity['unknowns'];
  foundAt: string;
  lastCheckedAt: string;
  baseScore: number;
  application: { prompts: string[]; materials: string[] } | null;
}
interface BackendFeedEntry {
  opportunity: BackendOpportunity;
  reason: string;
  fromNotes: boolean;
}
interface BackendStudent {
  feed: BackendFeedEntry[];
  mode: 'simulated' | 'live';
  provider: 'grok' | 'claude' | 'simulated';
  runCount: number;
  /** Cards the feed should hold; the agents keep searching while it has fewer. */
  feedTarget?: number;
}
interface BackendRun {
  id: string;
  number: number;
  trigger: string;
  status: 'running' | 'complete' | 'failed';
  startedAt: string;
  finishedAt: string | null;
  error: string | null;
  agents: { id: string; level: 'master' | 'manager' | 'presentation'; name: string; role: string; status: 'idle' | 'running' | 'done' | 'failed'; detail: string }[];
  jobs: { id: string; kind: 'scout' | 'extract' | 'application' | 'deadline'; label: string; status: 'queued' | 'running' | 'done' | 'failed' | 'skipped'; result: string | null }[];
  validations: { id: string; title: string; status: 'checking' | 'kept' | 'rejected'; reason: string | null; fit: number | null; reviews?: { reviewer: string; status: 'checking' | 'kept' | 'rejected'; reason: string | null }[] }[];
  log: { seq: number; at: string; agent: string; text: string }[];
  stats: { jobs: number; kept: number; rejected: number; added: number };
}

export interface LiveAgents {
  master: AgentNode | null;
  managers: AgentNode[];
  workers: AgentNode[];
  validators: AgentNode[];
  presenter: AgentNode | null;
  events: AgentEvent[];
  running: boolean;
  summary: string;
}

interface LiveValue {
  /** offline: the backend cannot be reached, so there is nothing new to show. */
  status: 'connecting' | 'connected' | 'offline';
  /** True when the agents have results on screen. */
  usingLive: boolean;
  /** Cards the feed should hold; the agents keep searching on their own while it has fewer. */
  feedTarget: number;
  /** Which model the agents are on. "claude" is a temporary test set-up. */
  provider: 'grok' | 'claude' | 'simulated';
  opportunities: Opportunity[];
  /** The latest agent run, shaped for the Agents page. Null before the first one. */
  agents: LiveAgents | null;
  searching: boolean;
  runNow: () => Promise<void>;
}

/** The feed's target when the backend has not said: at least this many cards by default. */
export const FEED_TARGET = 12;

const LiveContext = createContext<LiveValue | null>(null);

const hash = (text: string) => {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 16777619);
  return (h >>> 0) / 4294967295;
};

/** A backend result as the card the pages draw. */
function toCard(entry: BackendFeedEntry, simulated: boolean): Opportunity {
  const o = entry.opportunity;
  // The agents do not collect pictures yet, so a card without one gets a stock clip for its kind.
  const cover = coverFor(o.type, hash(o.id));
  return {
    id: o.id,
    type: o.type,
    origin: simulated ? 'prepared' : 'live',
    title: o.title,
    organizer: o.organizer,
    sourceUrl: o.sourceUrl,
    actionUrl: o.actionUrl,
    format: o.format,
    location: o.location,
    fitExplanation: entry.reason,
    deadline: o.deadline,
    startTime: o.startTime,
    image: o.image ?? cover.image,
    video: o.image ? null : cover.video,
    imageAspect: 0.8 + 0.5 * hash(o.id),
    tags: o.tags,
    unknowns: o.unknowns,
    foundAt: o.foundAt,
    lastCheckedAt: o.lastCheckedAt,
    // Something the student's own notes asked for starts ahead of the rest.
    baseScore: Math.min(1, o.baseScore + (entry.fromNotes ? 0.15 : 0)),
  };
}

const nodeStatus = (s: string): AgentNode['status'] => (s === 'running' || s === 'checking' ? 'running' : s === 'queued' || s === 'idle' ? 'idle' : 'done');

function toAgents(run: BackendRun): LiveAgents {
  const node = (a: BackendRun['agents'][number]): AgentNode => ({ id: a.id, name: a.name, role: a.role, status: nodeStatus(a.status), detail: a.status === 'failed' ? `Failed. ${a.detail}` : a.detail });
  const kind = { scout: 'Scout: searches for leads', extract: 'Reader: opens a posting and reads its details', application: 'Application reader: collects prompts and materials', deadline: 'Deadline finder: checks other listings for a deadline' };
  const master = run.agents.find((a) => a.level === 'master');
  const presenter = run.agents.find((a) => a.level === 'presentation');
  const jobs = run.jobs.filter((j) => j.status !== 'skipped');
  return {
    master: master ? node(master) : null,
    managers: run.agents.filter((a) => a.level === 'manager').map(node),
    workers: jobs.map((j) => ({ id: j.id, name: j.label, role: kind[j.kind], status: nodeStatus(j.status), detail: j.status === 'failed' ? `Failed. ${j.result ?? ''}` : (j.result ?? (j.status === 'running' ? 'Working…' : 'Waiting for a free worker')) })),
    validators: run.validations.map((v) => ({
      id: `v-${v.id}`,
      name: v.title,
      // Every posting is reviewed by each validation agent; it is kept only if all of them keep it.
      role:
        v.status === 'kept'
          ? `Kept by ${v.reviews?.length === 2 ? 'both reviewers' : 'every reviewer'}, fit ${v.fit}`
          : v.status === 'rejected'
            ? `Rejected by the ${(v.reviews ?? []).filter((r) => r.status === 'rejected').map((r) => r.reviewer.toLowerCase()).join(' and ') || 'reviewers'}`
            : `Under review: ${(v.reviews ?? []).filter((r) => r.status !== 'checking').length} of ${v.reviews?.length ?? 1} reviews in`,
      status: nodeStatus(v.status),
      detail: (v.reviews ?? []).length ? v.reviews!.map((r) => `${r.reviewer}: ${r.status === 'checking' ? 'reviewing…' : (r.reason ?? r.status)}`).join(' ') : (v.reason ?? 'Opening the official page…'),
    })),
    presenter: presenter ? node(presenter) : null,
    // Newest first, as an activity list reads.
    events: [...run.log].reverse().map((l) => ({ id: String(l.seq), at: l.at, agent: l.agent, text: l.text })),
    running: run.status === 'running',
    summary:
      run.status === 'running'
        ? `Run ${run.number} in progress`
        : run.status === 'failed'
          ? `Run ${run.number} failed: ${run.error ?? 'unknown error'}`
          : `Run ${run.number} finished: ${run.stats.jobs} worker jobs, ${run.stats.kept} kept, ${run.stats.rejected} rejected`,
  };
}

export function LiveProvider({ children }: { children: ReactNode }) {
  const auth = useAuth();
  const { state } = useStore();
  const [status, setStatus] = useState<LiveValue['status']>('connecting');
  const [student, setStudent] = useState<BackendStudent | null>(null);
  const [run, setRun] = useState<BackendRun | null>(null);
  const who = auth.status === 'signedIn' ? 'me' : 'demo';
  const uid = auth.user?.uid ?? null;

  // One live stream per student; it reconnects when the account changes.
  useEffect(() => {
    if (auth.status === 'loading' || auth.status === 'signedOut') return;
    let closed = false;
    let source: EventSource | null = null;
    let retry: number | undefined;
    const connect = async () => {
      const token = await auth.getToken().catch(() => null);
      if (closed) return;
      source = new EventSource(`${API_URL}/api/students/${who}/stream${token ? `?token=${encodeURIComponent(token)}` : ''}`);
      source.addEventListener('student', (e) => {
        setStudent(JSON.parse((e as MessageEvent).data));
        setStatus('connected');
      });
      source.addEventListener('run', (e) => setRun(JSON.parse((e as MessageEvent).data)));
      source.onerror = () => {
        // A sign-in token lasts an hour, so a dropped stream is reopened with a fresh one.
        source?.close();
        if (closed) return;
        setStatus('offline');
        retry = window.setTimeout(() => void connect(), 5000);
      };
    };
    setStudent(null);
    setRun(null);
    setStatus('connecting');
    void connect();
    return () => {
      closed = true;
      source?.close();
      clearTimeout(retry);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [who, uid, auth.status]);

  // The backend saves the student's memory with their sign-in, which lasts an hour. While the app
  // is open it is handed a fresh one regularly, so searches that finish later can still be saved.
  useEffect(() => {
    if (auth.status !== 'signedIn') return;
    const renew = async () => {
      const token = await auth.getToken().catch(() => null);
      if (token) await fetch(`${API_URL}/api/auth/me`, { headers: { Authorization: `Bearer ${token}` } }).catch(() => {});
    };
    const timer = window.setInterval(() => void renew(), 20 * 60_000);
    return () => clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [auth.status, uid]);

  const simulated = student?.mode !== 'live';
  const liveCards = useMemo(() => (student?.feed ?? []).map((entry) => toCard(entry, simulated)), [student, simulated]);
  const usingLive = status === 'connected' && liveCards.length > 0;

  // What the application readers collected goes where the pages already look for it.
  useEffect(() => {
    for (const entry of student?.feed ?? []) {
      const app = entry.opportunity.application;
      applicationInfo[entry.opportunity.id] = { prompts: app?.prompts ?? [], materials: app?.materials ?? [], requiresLogin: false };
    }
  }, [student]);

  // Reactions made in the app are sent to the backend, so the next run searches differently.
  const previous = useRef<{ saved: string[]; liked: string[]; dismissed: string[]; opened: string[] } | null>(null);
  useEffect(() => {
    const now = { saved: state.saved, liked: state.liked, dismissed: state.dismissed, opened: state.opened };
    const before = previous.current;
    previous.current = now;
    if (!before || !usingLive) return;
    const known = new Set(liveCards.map((o) => o.id));
    const changed = (a: string[], b: string[]) => [...a.filter((id) => !b.includes(id)), ...b.filter((id) => !a.includes(id))].filter((id) => known.has(id));
    const send: { id: string; action: string }[] = [
      // Saving, liking and disliking each undo themselves when sent a second time, as they do in the app.
      ...changed(before.saved, now.saved).map((id) => ({ id, action: 'save' })),
      ...changed(before.liked, now.liked).map((id) => ({ id, action: 'like' })),
      ...changed(before.dismissed, now.dismissed).map((id) => ({ id, action: 'dislike' })),
      ...now.opened.filter((id) => !before.opened.includes(id) && known.has(id)).map((id) => ({ id, action: 'open' })),
    ];
    if (send.length === 0) return;
    void (async () => {
      const token = await auth.getToken().catch(() => null);
      for (const { id, action } of send) {
        await fetch(`${API_URL}/api/students/${who}/interactions`, {
          method: 'POST',
          headers: { 'content-type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
          body: JSON.stringify({ opportunityId: id, action }),
        }).catch(() => {});
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.saved, state.liked, state.dismissed, state.opened]);

  const value = useMemo<LiveValue>(
    () => ({
      status,
      usingLive,
      provider: student?.provider ?? 'simulated',
      feedTarget: student?.feedTarget ?? FEED_TARGET,
      // Only what the agents found. The sample set is not mixed in: pages show real results or say why they are empty.
      opportunities: liveCards,
      agents: status === 'connected' && run ? toAgents(run) : null,
      searching: status === 'connected' && run?.status === 'running',
      runNow: async () => {
        const token = await auth.getToken().catch(() => null);
        await fetch(`${API_URL}/api/students/${who}/runs`, { method: 'POST', headers: token ? { Authorization: `Bearer ${token}` } : {} }).catch(() => {});
      },
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [status, usingLive, student, liveCards, run, who],
  );
  return <LiveContext value={value}>{children}</LiveContext>;
}

export function useLive(): LiveValue {
  const value = useContext(LiveContext);
  if (!value) throw new Error('useLive must be used inside LiveProvider');
  return value;
}

/** The cards to show: what the agents found, and nothing else. */
export const useOpportunities = () => useLive().opportunities;

/** The small label in the page header saying where the cards come from. */
export function DataBadge() {
  const live = useLive();
  const [long, short] = live.searching
    ? ['Agents searching…', 'Searching']
    : live.status === 'offline'
      ? ['Agents offline', 'Offline']
      : live.status === 'connecting'
        ? ['Connecting…', 'Connecting']
        : !live.usingLive
          ? ['No results yet', 'Empty']
      : live.provider === 'claude'
        ? ['Live · Claude test', 'Live']
        : live.provider === 'grok'
          ? ['Live · Grok', 'Live']
          : ['Simulated agents', 'Simulated'];
  return (
    <span className="flex items-center gap-1.5 rounded-full bg-white/20 px-3 py-1 text-xs font-medium text-white backdrop-blur" title={live.status === 'offline' ? 'The agent backend is not reachable.' : undefined}>
      {live.searching && <span className="live-dot size-1.5 rounded-full bg-white" aria-hidden="true" />}
      <span className="sm:hidden">{short}</span>
      <span className="hidden sm:inline">{long}</span>
    </span>
  );
}
