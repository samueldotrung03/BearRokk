// The Agents page. When the agent backend has a run, the map, detail panel and activity list show
// that real run (src/lib/agents/fromLive.ts). Without one it plays a simulated run of the agent
// system on sample data: the pure engine in src/lib/agents, with this page owning the clock (how
// fast beats arrive), the student's standing instructions, and which agent is selected.
import { Pause, Play, RotateCcw, Server, SkipForward, Square } from 'lucide-react';
import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react';
import { AgentSettingsButton, autoLine } from '../components/agents/AgentSettings.tsx';
import { AnimatedNumber, clockText, compact } from '../components/agents/AnimatedNumber.tsx';
import { Funnel } from '../components/agents/Funnel.tsx';
import { useBackendStatus, useReducedMotion, type BackendState } from '../components/agents/hooks.ts';
import { TeamAbout, TeamMap } from '../components/agents/TeamMap.tsx';
import type { TeamId } from '../lib/agents/team.ts';
import { BriefCard, TellBar, type StandingInstruction } from '../components/agents/TellAgents.tsx';
import { MemoryCard, UsageCard } from '../components/agents/UsageMemory.tsx';
import { Page, StatusPill } from '../components/Page.tsx';
import { opportunities } from '../data/sample.ts';
import { assignSlots, buildBrief, memoryFrom } from '../lib/agents/brief.ts';
import { funnel, idleRun, runReducer, totals, type RunInput } from '../lib/agents/engine.ts';
import { fromLive, liveStats, sourceLabel, type Provider } from '../lib/agents/fromLive.ts';
import { fromRun } from '../lib/agents/view.ts';
import { useLocal } from '../lib/useLocal.ts';
import { SAMPLE_FEED, useLive, withNextManagers } from '../state/live.tsx';
import { useStore } from '../state/StoreProvider.tsx';
import '@fontsource-variable/geist';
import '@fontsource-variable/geist-mono';
import '../styles/agents.css';

const SPEEDS = [0.5, 1, 2, 4] as const;
/** Real time per beat at 1x. A full run is about 17 beats, so roughly 22 seconds. */
const BEAT_MS = 1300;

/** Says more about a backend run after its label, without ever calling Claude output Grok. */
const sourceNote: Record<Provider, string> = {
  grok: 'The agent backend’s latest run, as it happens.',
  claude: 'The agent backend’s latest run, with Claude standing in for Grok while testing.',
  simulated: 'The agent backend’s latest run. Its agents are simulated and its postings invented.',
};

function BackendChip({ status, showing }: { status: BackendState; showing: boolean }) {
  // The public showcase has no agent server behind it, so it says so instead of checking one.
  if (SAMPLE_FEED && !showing)
    return (
      <span className="ag-chip-dark" title="This public copy has no agent server. The run below is a simulation on sample data.">
        <Server className="size-3.5" aria-hidden="true" />
        <span className="size-1.5 rounded-full bg-white/40" aria-hidden="true" />
        Sample mode: no agent server
      </span>
    );
  const text =
    status.kind === 'checking' ? 'Backend: checking…' : status.kind === 'connected' ? `Backend: connected${status.live ? '' : ' (no Grok key)'}` : 'Backend: not running';
  return (
    <span
      className="ag-chip-dark"
      title={
        showing
          ? "The teammates' agent server on port 8787. This page shows its latest run."
          : "The teammates' agent server on port 8787. Without a run from it, this page plays its own simulation."
      }
      aria-live="polite"
    >
      <Server className="size-3.5" aria-hidden="true" />
      <span className={`size-1.5 rounded-full ${status.kind === 'connected' ? 'bg-[#34c759]' : status.kind === 'offline' ? 'bg-white/40' : 'bg-[#f5c451]'}`} aria-hidden="true" />
      {text}
    </span>
  );
}

export function Agents() {
  const { state } = useStore();
  const reduced = useReducedMotion();
  const backend = useBackendStatus();
  const [instructions, setInstructions] = useLocal<StandingInstruction[]>('bearrok.agents.instructions', []);
  const [storedSpeed, setSpeed] = useLocal<number>('bearrok.agents.speed', 1);
  const speed = (SPEEDS as readonly number[]).includes(storedSpeed) ? storedSpeed : 1;
  const [selected, setSelected] = useState('master');
  const live = useLive();
  // The backend's run, when there is one, replaces the simulation on the map and in the panels.
  // Between searches, the managers the next search will have (they follow the kinds chosen in Agent settings).
  // The agent picked in the team picture.
  const [teamSelected, setTeamSelected] = useState<TeamId>('manager');
  const real = useMemo(() => (live.agents ? withNextManagers(live.agents, live.nextManagers) : null), [live.agents, live.nextManagers]);

  const memory = useMemo(() => memoryFrom(state, opportunities), [state]);
  const texts = useMemo(() => instructions.map((i) => i.text), [instructions]);
  const inputFor = useCallback(
    (list: string[], trigger: string): RunInput => ({ profile: state.profile, memory, instructions: list, dismissed: state.dismissed, trigger }),
    [state.profile, state.dismissed, memory],
  );

  const [run, dispatch] = useReducer(runReducer, undefined, () => idleRun(inputFor(texts, 'Scheduled run.')));

  // Open the page on a run already moving, the way a scheduled run would be. The ref keeps
  // React's development double-mount from starting two runs.
  const started = useRef(false);
  useEffect(() => {
    if (started.current) return;
    started.current = true;
    dispatch({ type: 'start', input: inputFor(texts, 'Scheduled run. The demo starts one when you open this page.') });
  }, [inputFor, texts]);

  // The clock: one beat per tick while running. Cleared on pause, on every beat and on unmount.
  const beatMs = BEAT_MS / speed;
  useEffect(() => {
    if (real || run.status !== 'running') return;
    const timer = window.setTimeout(() => dispatch({ type: 'tick' }), beatMs);
    return () => window.clearTimeout(timer);
  }, [real, run.status, run.cursor, beatMs]);

  const start = (list: string[], trigger: string) => dispatch({ type: 'start', input: inputFor(list, trigger) });

  const send = (text: string) => {
    const next = [...instructions.filter((i) => i.text.toLowerCase() !== text.toLowerCase()), { id: `${Date.now()}`, text }];
    setInstructions(next);
    setSelected('master');
    // Per the design a student request is a trigger. Restarting at once lets the student watch
    // their instruction become the brief and flow down the tree.
    start(
      next.map((i) => i.text),
      `You said: "${text}"`,
    );
  };

  const nextBrief = useMemo(() => buildBrief(state.profile, memory, texts), [state.profile, memory, texts]);
  const nextSlots = useMemo(() => assignSlots(nextBrief), [nextBrief]);
  const stale = run.status !== 'idle' && (nextBrief.summary !== run.brief.summary || JSON.stringify(nextSlots) !== JSON.stringify(run.slots));

  const t = totals(run);
  const { counts } = funnel(run.candidates);
  const shown = counts[4] ?? 0;
  const view = useMemo(() => (real ? fromLive(real) : fromRun(run, shown)), [real, run, shown]);
  const node = view.nodes.find((n) => n.id === selected) ?? view.nodes[0];
  const simStats: [string, number, ((n: number) => string) | undefined][] = [
    ['agents working', t.working, undefined],
    ['Grok calls', t.calls, undefined],
    ['tokens', t.tokens, compact],
    ['pages read', run.pages, undefined],
    ['found', counts[0] ?? 0, undefined],
    ['in your feed', shown, undefined],
  ];

  const stats = real ? liveStats(real).map(([label, value]): [string, number, undefined] => [label, value, undefined]) : simStats;

  const runLabel = real ? (real.running ? 'Running' : 'Done') : run.status === 'idle' ? 'Ready' : run.status === 'paused' ? 'Paused' : run.status === 'done' ? 'Done' : 'Running';
  const chipStatus = real
    ? real.running
      ? 'working'
      : 'done'
    : run.status === 'running'
      ? 'working'
      : run.status === 'paused'
        ? 'waiting'
        : run.status === 'done'
          ? 'done'
          : 'idle';

  return (
    // .ag-xai gives this page xAI's type and buttons (styles at the end of agents.css).
    <div className="ag-xai">
    <Page
      title="Your agents"
      subtitle={
        real
          ? 'Watch your agents search for you: the master briefs the managers, workers read the web, and validators decide what reaches you.'
          : 'A demonstration on sample data until your agents run their first search: the master briefs the managers, workers read the web, and validators decide what reaches you.'
      }
      aside={
        <StatusPill>
          {real
            ? real.summary
            : run.status === 'running'
              ? `Run ${run.run} · ${t.working} of ${t.agents} agents working`
              : run.status === 'done'
                ? `Run ${run.run} done · ${shown} new in your feed`
                : `${runLabel} · ${t.agents} agents`}
        </StatusPill>
      }
    >
      <section className="ag-hero" aria-labelledby="ag-run-title">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-3">
            <h2 id="ag-run-title" className="font-display text-3xl leading-none">
              {real ? 'Latest run' : SAMPLE_FEED ? 'Sample run' : 'Live run'}
              {!real && run.run > 0 && <span className="text-white/55"> #{run.run}</span>}
            </h2>
            <span className="ag-chip-dark">
              <span className="ag-dot" data-status={chipStatus} aria-hidden="true" />
              {real ? (
                runLabel
              ) : (
                <>
                  {runLabel} · <span className="tabular-nums">{clockText(run.clock)}</span> simulated
                </>
              )}
            </span>
            <BackendChip status={backend} showing={real !== null} />
          </div>
          <div className="flex flex-wrap items-center gap-2" role="toolbar" aria-label="Run controls">
            {real ? (
              real.running ? (
                // Stops the real search. Postings already checked stay in the feed.
                <button type="button" className="ag-btn" data-primary="true" onClick={() => void live.stopRun()}>
                  <Square className="size-4" fill="currentColor" aria-hidden="true" />
                  Stop search
                </button>
              ) : (
                <button type="button" className="ag-btn" data-primary="true" onClick={() => void live.runNow()}>
                  <Play className="size-4" aria-hidden="true" />
                  Run now
                </button>
              )
            ) : null}
            {real && <AgentSettingsButton />}
            {real && autoLine(live.auto) && <span className="ag-auto-note">{autoLine(live.auto)}</span>}
            {real ? null : (
              <>
                <button type="button" className="ag-btn" data-primary="true" onClick={() => start(texts, 'Started by hand with Run now.')}>
                  <Play className="size-4" aria-hidden="true" />
                  Run now
                </button>
                <button
                  type="button"
                  className="ag-btn"
                  disabled={run.status !== 'running' && run.status !== 'paused'}
                  onClick={() => dispatch({ type: run.status === 'paused' ? 'resume' : 'pause' })}
                >
                  {run.status === 'paused' ? <Play className="size-4" aria-hidden="true" /> : <Pause className="size-4" aria-hidden="true" />}
                  {run.status === 'paused' ? 'Resume' : 'Pause'}
                </button>
                <AgentSettingsButton />
                <div className="ag-seg" role="group" aria-label="Speed">
                  {SPEEDS.map((s) => (
                    <button key={s} type="button" aria-pressed={speed === s} onClick={() => setSpeed(s)}>
                      {s === 0.5 ? '½' : s}×
                    </button>
                  ))}
                </div>
                <button
                  type="button"
                  className="ag-btn"
                  disabled={run.status !== 'running' && run.status !== 'paused'}
                  onClick={() => dispatch({ type: 'finish' })}
                  aria-label="Skip to the end of the run"
                  title="Skip to the end"
                >
                  <SkipForward className="size-4" aria-hidden="true" />
                </button>
                <button
                  type="button"
                  className="ag-btn"
                  onClick={() => dispatch({ type: 'reset', input: inputFor(texts, 'Nothing yet. Press Run now.') })}
                  aria-label="Reset the run"
                  title="Reset"
                >
                  <RotateCcw className="size-4" aria-hidden="true" />
                </button>
              </>
            )}
          </div>
        </div>
        {real ? (
          <p className="ag-honest mt-2">
            <strong className="font-semibold text-white">{sourceLabel(live.provider)}.</strong> {sourceNote[live.provider]}
          </p>
        ) : (
          <p className="ag-honest mt-2">{sourceLabel(null)}</p>
        )}

        {/* Standing instructions feed the local simulation only; they cannot reach the backend's agents. */}
        {!real && (
          <div className="mt-4">
            <TellBar onSend={send} standing={instructions.length} />
          </div>
        )}

        <dl className={`mt-5 grid grid-cols-3 gap-4 border-y border-white/10 py-4 ${real ? 'sm:grid-cols-5' : 'sm:grid-cols-6'}`}>
          {stats.map(([label, value, format]) => (
            <div key={label}>
              <dd className="ag-stat-num">
                <AnimatedNumber value={value} format={format} reduced={reduced} />
              </dd>
              <dt className="ag-stat-label">{label}</dt>
            </div>
          ))}
        </dl>

        <div className="mt-5 grid gap-4 xl:grid-cols-[minmax(0,1fr)_310px]">
          {/* A simplified picture of the team: one manager and four workers toward one goal. */}
          <TeamMap view={view} selected={teamSelected} onSelect={setTeamSelected} />
          <div className="h-[420px] min-h-0 xl:h-[540px]">
            <TeamAbout selected={teamSelected} onSelect={setTeamSelected} />
          </div>
        </div>
      </section>

      {real ? (
        <p className="mt-6 text-sm text-ink-3">
          The validation funnel, the brief, usage and memory cards belong to the simulated run on sample data, so they are hidden while the backend&rsquo;s run is shown.
        </p>
      ) : (
        <>
          <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)]">
            <Funnel run={run} reduced={reduced} />
            <BriefCard
              instructions={instructions}
              onRemove={(id) => setInstructions((list) => list.filter((i) => i.id !== id))}
              onClear={() => setInstructions([])}
              brief={nextBrief}
              slots={nextSlots}
              stale={stale}
              onApply={() => start(texts, 'Started with your updated instructions.')}
            />
          </div>

          <div className="mt-6 grid gap-6 lg:grid-cols-2">
            <UsageCard run={run} reduced={reduced} />
            <MemoryCard profile={state.profile} memory={memory} instructions={instructions.length} />
          </div>
        </>
      )}
    </Page>
    </div>
  );
}
