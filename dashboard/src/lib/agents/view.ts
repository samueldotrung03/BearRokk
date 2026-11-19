// What the hierarchy map, the detail panel and the activity list draw. Two sources fill it: the
// local simulated run (fromRun, below) and the backend's real run (fromLive.ts). Keeping the
// components on this shape means the map looks the same whichever source is behind it.
import { edgesFor, type AgentLive, type GraphNode, type Level, type LogEntry, type NodeStatus, type RunState, type Transfer } from './engine.ts';

export interface Edge {
  from: string;
  to: string;
}

/** A small labelled point between two rows where connectors meet, such as the shared job queue. */
export interface Hub {
  id: string;
  label: string;
  y: number;
}

/** What the backend says about one agent, shown in the detail panel instead of simulated fields. */
export interface NodeInfo {
  role: string;
  detail: string;
  /** For a "+N more" node: the agents it stands for. */
  members?: { name: string; status: NodeStatus; detail: string }[];
}

/** A card beside the master. A new key remounts it, and a fresh card glows when it appears. */
export interface SideCard {
  key: string;
  label: string;
  text: string;
  fresh: boolean;
}

export interface MapView {
  source: 'simulated' | 'backend';
  /** Changes on every simulated beat, so one-shot pulses replay. Stable for a backend run. */
  beatKey: string;
  /** Backend pulses stay on while a node runs, so they repeat instead of playing once. */
  loop: boolean;
  status: 'idle' | 'running' | 'paused' | 'done';
  nodes: GraphNode[];
  agents: Record<string, AgentLive>;
  edges: Edge[];
  hubs: Hub[];
  transfers: Transfer[];
  rowLabels: Partial<Record<Level, string>>;
  sideLeft: SideCard | null;
  sideRight: SideCard | null;
  /** Cards this run added to the feed, when the source says so. */
  feedCount: number | null;
  log: LogEntry[];
  info: Record<string, NodeInfo>;
  /** Screen reader description of the whole map. */
  summary: string;
}

/** The local simulation as the map's view. */
export function fromRun(run: RunState, shown: number): MapView {
  const agents = Object.values(run.agents);
  const count = (status: NodeStatus) => agents.filter((a) => a.status === status).length;
  const briefReady = run.status === 'idle' || run.cursor >= 2;
  return {
    source: 'simulated',
    beatKey: `${run.run}-${run.cursor}`,
    loop: false,
    status: run.status,
    nodes: run.nodes,
    agents: run.agents,
    edges: edgesFor(run.nodes),
    hubs: [],
    transfers: run.transfers,
    rowLabels: {},
    sideLeft: { key: `trigger-${run.run}`, label: 'What started it', text: run.trigger, fresh: run.run > 0 },
    sideRight: {
      key: `brief-${run.run}-${briefReady}`,
      label: 'Brief for the managers',
      text: briefReady ? run.brief.summary : 'The master agent is writing it…',
      fresh: run.run > 0 && briefReady,
    },
    feedCount: shown,
    log: run.log,
    info: {},
    summary:
      `${run.nodes.length} agents in five levels: one master agent, ${run.slots.length} search managers ` +
      `(${run.slots.map((s) => `${s.category}, ${s.label}`).join('; ')}), a scout and an extractor under each manager, ` +
      `one validator per lane, and a presentation manager that publishes to your feed. ` +
      `Now ${count('working')} working, ${count('waiting')} waiting, ${count('done')} done, ${count('idle')} idle. ` +
      `Each agent below is a button that opens its details.`,
  };
}
