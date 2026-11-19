// The live hierarchy map: agents as buttons over an SVG of connectors, with pulses that travel
// along a connector whenever work is handed down or a result comes back up.
import { useId, useMemo, useRef, type CSSProperties } from 'react';
import { Link } from 'react-router';
import { edgeKey, GRAPH_HEIGHT, GRAPH_MIN_WIDTH, layoutGraph, routeOf, ROWS } from '../../lib/agents/layout.ts';
import { FEED_ID, type AgentLive, type GraphNode, type NodeStatus, type RunState } from '../../lib/agents/engine.ts';
import { useWidth } from './hooks.ts';

export const statusWord: Record<NodeStatus, string> = { idle: 'Idle', working: 'Working', waiting: 'Waiting', done: 'Done' };

function countFor(node: GraphNode, agent: AgentLive): string | null {
  if (node.level === 'validator') return agent.kept + agent.rejected ? `${agent.kept}✓ ${agent.rejected}✗` : null;
  if (node.level === 'worker' || node.level === 'presenter') return agent.found || agent.kept ? String(node.level === 'presenter' ? agent.kept : agent.found) : null;
  return null;
}

export function RunGraph({
  run,
  selected,
  onSelect,
  reduced,
  pulseMs,
  shown,
}: {
  run: RunState;
  selected: string;
  onSelect: (id: string) => void;
  reduced: boolean;
  pulseMs: number;
  shown: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const width = useWidth(ref);
  const descId = useId();
  const layout = useMemo(() => layoutGraph(run.nodes, width), [run.nodes, width]);

  const active = new Map<string, string>();
  for (const t of run.transfers) {
    const key = layout.paths.has(edgeKey(t.from, t.to)) ? edgeKey(t.from, t.to) : edgeKey(t.to, t.from);
    active.set(key, t.kind);
  }

  const agents = Object.values(run.agents);
  const count = (status: NodeStatus) => agents.filter((a) => a.status === status).length;
  const summary =
    `${run.nodes.length} agents in five levels: one master agent, ${run.slots.length} search managers ` +
    `(${run.slots.map((s) => `${s.category}, ${s.label}`).join('; ')}), a scout and an extractor under each manager, ` +
    `one validator per lane, and a presentation manager that publishes to your feed. ` +
    `Now ${count('working')} working, ${count('waiting')} waiting, ${count('done')} done, ${count('idle')} idle. ` +
    `Each agent below is a button that opens its details.`;

  const feedFlash = run.transfers.some((t) => t.to === FEED_ID);
  const briefReady = run.status === 'idle' || run.cursor >= 2;

  return (
    <div className="ag-graph-scroll">
      <div
        ref={ref}
        className="ag-graph"
        style={{ height: GRAPH_HEIGHT, minWidth: GRAPH_MIN_WIDTH }}
        role="group"
        aria-label="Agent hierarchy map"
        aria-describedby={descId}
      >
        <p id={descId} className="sr-only">
          {summary}
        </p>
        <svg width={layout.width} height={layout.height} aria-hidden="true">
          {[...layout.paths].map(([key, d]) => (
            <path key={key} d={d} className="ag-edge" data-active={active.get(key)} />
          ))}
        </svg>

        {(['manager', 'worker', 'validator', 'presenter'] as const).map((level) => (
          <span key={level} className="ag-row-label" style={{ top: ROWS[level].y - ROWS[level].h / 2 - 19 }} aria-hidden="true">
            {ROWS[level].label}
          </span>
        ))}

        {/* What started the run, and the brief the master wrote from it. */}
        <div className="ag-side-card" style={{ left: 14 }} key={`trigger-${run.run}`} data-fresh={run.run > 0}>
          <p className="ag-side-label">What started it</p>
          <p className="mt-1 line-clamp-3 text-white/85">{run.trigger}</p>
        </div>
        <div className="ag-side-card" style={{ right: 14 }} key={`brief-${run.run}-${briefReady}`} data-fresh={run.run > 0 && briefReady}>
          <p className="ag-side-label">Brief for the managers</p>
          <p className="mt-1 line-clamp-3 text-white/85">{briefReady ? run.brief.summary : 'The master agent is writing it…'}</p>
        </div>

        {run.nodes.map((node) => {
          const box = layout.placed.get(node.id);
          const agent = run.agents[node.id];
          if (!box || !agent) return null;
          const tally = countFor(node, agent);
          const sub = agent.status === 'idle' || (node.level === 'manager' && agent.status !== 'working') ? node.sub : agent.now;
          return (
            <button
              key={node.id}
              type="button"
              className="ag-node"
              data-level={node.level}
              data-status={agent.status}
              aria-pressed={selected === node.id}
              aria-label={`${node.name}, ${node.sub}. ${statusWord[agent.status]}. ${agent.now}`}
              onClick={() => onSelect(node.id)}
              style={{ left: box.x, top: box.y, width: box.w, height: box.h }}
            >
              <span className="ag-node-title">
                <span className="ag-dot" data-status={agent.status} aria-hidden="true" />
                <span className="truncate">{node.title}</span>
                {tally && <span className="ag-node-count">{tally}</span>}
              </span>
              <span className="ag-node-sub">{sub}</span>
            </button>
          );
        })}

        {(() => {
          const box = layout.placed.get(FEED_ID);
          if (!box) return null;
          return (
            <Link
              to="/"
              className="ag-feed-node"
              data-flash={feedFlash}
              key={feedFlash ? `flash-${run.cursor}` : 'feed'}
              style={{ left: box.x, top: box.y, width: box.w, height: box.h }}
              aria-label={`Your feed: ${shown} cards from this run. Open the feed.`}
            >
              <span className="text-center leading-tight">
                Your feed
                <span className="block font-display text-xl font-normal text-brand">+{shown}</span>
              </span>
            </Link>
          );
        })()}

        {!reduced &&
          run.transfers.map((t, i) => {
            const route = routeOf(layout.paths, t.from, t.to);
            if (!route) return null;
            const pill = t.kind === 'brief' || t.kind === 'feed';
            return (
              <span
                key={`${run.run}-${run.cursor}-${i}`}
                className="ag-pulse"
                data-kind={t.kind}
                data-reverse={route.reverse}
                style={{ offsetPath: `path("${route.d}")`, '--ag-ms': `${pulseMs}ms` } as CSSProperties}
                aria-hidden="true"
              >
                {pill ? (
                  <span className="ag-pulse-pill">
                    <span>{t.label}</span>
                  </span>
                ) : (
                  <span className="ag-pulse-dot" />
                )}
              </span>
            );
          })}
      </div>
    </div>
  );
}
