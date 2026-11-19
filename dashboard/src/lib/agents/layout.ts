// Where each agent sits on the hierarchy map, and the curve of each connector. Pure geometry in
// pixels, so the page can measure its width once and the pulses can follow the exact same paths.
import { edgesFor, FEED_ID, type GraphNode, type Level } from './engine.ts';
import type { Edge, Hub } from './view.ts';

export const GRAPH_HEIGHT = 540;
/** Below this width the map scrolls sideways instead of squeezing eight workers into one row. */
export const GRAPH_MIN_WIDTH = 660;

export interface Placed {
  x: number;
  y: number;
  w: number;
  h: number;
}

export const ROWS: Record<Level, { y: number; h: number; label: string }> = {
  master: { y: 50, h: 76, label: 'Master' },
  manager: { y: 164, h: 72, label: 'Search managers' },
  worker: { y: 280, h: 62, label: 'Worker fleet' },
  validator: { y: 390, h: 60, label: 'Validators' },
  presenter: { y: 492, h: 66, label: 'Presentation' },
};

/** Hub points sit between rows; this is their drawn size. */
const HUB = { w: 92, h: 20 };

export function layoutGraph(nodes: GraphNode[], width: number, edges: Edge[] = edgesFor(nodes), hubs: Hub[] = []) {
  const w = Math.max(width, GRAPH_MIN_WIDTH);
  const lanes = Math.max(1, nodes.filter((n) => n.level === 'manager').length);
  const lane = w / lanes;
  const placed = new Map<string, Placed>();
  for (const node of nodes) {
    const row = ROWS[node.level];
    const i = node.lane ?? 0;
    const center = lane * (i + 0.5);
    if (node.col && (node.level === 'worker' || node.level === 'validator')) {
      // An even row across the whole width, for runs whose workers are not tied to one lane.
      const cell = w / node.col.of;
      const cap = node.level === 'worker' ? 132 : 148;
      placed.set(node.id, { x: cell * (node.col.index + 0.5), y: row.y, w: Math.min(cell - 10, cap), h: row.h });
    } else if (node.level === 'master') placed.set(node.id, { x: w / 2, y: row.y, w: 232, h: row.h });
    else if (node.level === 'manager') placed.set(node.id, { x: center, y: row.y, w: Math.min(lane - 20, 212), h: row.h });
    else if (node.level === 'validator') placed.set(node.id, { x: center, y: row.y, w: Math.min(lane - 44, 156), h: row.h });
    else if (node.level === 'presenter') placed.set(node.id, { x: w / 2, y: row.y, w: 212, h: row.h });
    else {
      // Scout on the left half of the lane, extractor on the right.
      const offset = node.title === 'Scout' ? -lane / 4 : lane / 4;
      placed.set(node.id, { x: center + offset, y: row.y, w: Math.min(Math.max(lane / 2 - 12, 76), 128), h: row.h });
    }
  }
  placed.set(FEED_ID, { x: w / 2 + 196, y: ROWS.presenter.y, w: 118, h: 50 });
  for (const hub of hubs) placed.set(hub.id, { x: w / 2, y: hub.y, ...HUB });

  const paths = new Map<string, string>();
  for (const edge of edges) {
    const a = placed.get(edge.from);
    const b = placed.get(edge.to);
    if (!a || !b) continue;
    paths.set(edgeKey(edge.from, edge.to), edge.to === FEED_ID ? horizontal(a, b) : vertical(a, b));
  }
  return { width: w, height: GRAPH_HEIGHT, placed, paths };
}

export const edgeKey = (from: string, to: string) => `${from}>${to}`;

function vertical(a: Placed, b: Placed) {
  const y1 = a.y + a.h / 2;
  const y2 = b.y - b.h / 2;
  const mid = (y1 + y2) / 2;
  return `M ${r(a.x)} ${r(y1)} C ${r(a.x)} ${r(mid)}, ${r(b.x)} ${r(mid)}, ${r(b.x)} ${r(y2)}`;
}

function horizontal(a: Placed, b: Placed) {
  return `M ${r(a.x + a.w / 2)} ${r(a.y)} L ${r(b.x - b.w / 2)} ${r(b.y)}`;
}

const r = (n: number) => Math.round(n * 10) / 10;

/** The path a transfer travels, and whether it runs against the drawn direction (results going up). */
export function routeOf(paths: Map<string, string>, from: string, to: string): { d: string; reverse: boolean } | null {
  const forward = paths.get(edgeKey(from, to));
  if (forward) return { d: forward, reverse: false };
  const back = paths.get(edgeKey(to, from));
  return back ? { d: back, reverse: true } : null;
}
