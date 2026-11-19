// The live hierarchy map: agents as buttons over an SVG of connectors, with pulses that travel
// along a connector whenever work is handed down or a result comes back up.
import { useId, useMemo, useRef, type CSSProperties } from 'react';
import { Link } from 'react-router';
import { edgeKey, GRAPH_HEIGHT, GRAPH_MIN_WIDTH, layoutGraph, routeOf, ROWS } from '../../lib/agents/layout.ts';
import { FEED_ID, type AgentLive, type GraphNode, type NodeStatus } from '../../lib/agents/engine.ts';
import type { MapView } from '../../lib/agents/view.ts';
import { useWidth } from './hooks.ts';

export const statusWord: Record<NodeStatus, string> = { idle: 'Idle', working: 'Working', waiting: 'Waiting', done: 'Done' };

function countFor(node: GraphNode, agent: AgentLive): string | null {
  if (node.level === 'validator') return agent.kept + agent.rejected ? `${agent.kept}✓ ${agent.rejected}✗` : null;
  if (node.level === 'worker' || node.level === 'presenter') return agent.found || agent.kept ? String(node.level === 'presenter' ? agent.kept : agent.found) : null;
  return null;
}

export function RunGraph({ view, selected, onSelect, reduced, pulseMs }: { view: MapView; selected: string; onSelect: (id: string) => void; reduced: boolean; pulseMs: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const width = useWidth(ref);
  const descId = useId();
  const layout = useMemo(() => layoutGraph(view.nodes, width, view.edges, view.hubs), [view.nodes, view.edges, view.hubs, width]);

  const active = new Map<string, string>();
  for (const t of view.transfers) {
    const key = layout.paths.has(edgeKey(t.from, t.to)) ? edgeKey(t.from, t.to) : edgeKey(t.to, t.from);
    active.set(key, t.kind);
  }

  const feedFlash = view.transfers.some((t) => t.to === FEED_ID);
  const sideCards = [
    { card: view.sideLeft, style: { left: 14 } },
    { card: view.sideRight, style: { right: 14 } },
  ];

  return (
    <div className="ag-graph-scroll">
      <div ref={ref} className="ag-graph" style={{ height: GRAPH_HEIGHT, minWidth: GRAPH_MIN_WIDTH }} role="group" aria-label="Agent hierarchy map" aria-describedby={descId}>
        <p id={descId} className="sr-only">
          {view.summary}
        </p>
        <svg width={layout.width} height={layout.height} aria-hidden="true">
          {[...layout.paths].map(([key, d]) => (
            <path key={key} d={d} className="ag-edge" data-active={active.get(key)} />
          ))}
        </svg>

        {(['manager', 'worker', 'validator', 'presenter'] as const).map((level) => (
          <span key={level} className="ag-row-label" style={{ top: ROWS[level].y - ROWS[level].h / 2 - 19 }} aria-hidden="true">
            {view.rowLabels[level] ?? ROWS[level].label}
          </span>
        ))}

        {/* What started the run, and the brief the master wrote from it (or the backend's own lines). */}
        {sideCards.map(({ card, style }) =>
          card ? (
            <div className="ag-side-card" style={style} key={card.key} data-fresh={card.fresh}>
              <p className="ag-side-label">{card.label}</p>
              <p className="mt-1 line-clamp-3 text-white/85">{card.text}</p>
            </div>
          ) : null,
        )}

        {view.hubs.map((hub) => {
          const box = layout.placed.get(hub.id);
          if (!box) return null;
          return (
            <span key={hub.id} className="ag-hub" style={{ left: box.x, top: box.y, width: box.w, height: box.h }} aria-hidden="true">
              {hub.label}
            </span>
          );
        })}

        {view.nodes.map((node) => {
          const box = layout.placed.get(node.id);
          const agent = view.agents[node.id];
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
              key={feedFlash ? `flash-${view.beatKey}` : 'feed'}
              style={{ left: box.x, top: box.y, width: box.w, height: box.h }}
              aria-label={view.feedCount === null ? 'Your feed. Open the feed.' : `Your feed: ${view.feedCount} cards from this run. Open the feed.`}
            >
              <span className="text-center leading-tight">
                Your feed
                {view.feedCount !== null && <span className="block font-display text-xl font-normal text-brand">+{view.feedCount}</span>}
              </span>
            </Link>
          );
        })()}

        {!reduced &&
          view.transfers.map((t, i) => {
            const route = routeOf(layout.paths, t.from, t.to);
            if (!route) return null;
            const pill = t.kind === 'brief' || t.kind === 'feed';
            return (
              <span
                // A backend pulse keeps its key while its node runs, so its repeating animation is not restarted.
                key={view.loop ? edgeKey(t.from, t.to) : `${view.beatKey}-${i}`}
                className="ag-pulse"
                data-kind={t.kind}
                data-loop={view.loop}
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
