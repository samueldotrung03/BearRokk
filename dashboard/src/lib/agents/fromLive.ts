// The backend's latest agent run as the map's view, so the Agents page can draw the real run with
// the same look as the simulation. The backend sends a variable number of workers and validators
// and does not say which manager a worker belongs to, so those rows are drawn evenly under a
// shared job queue, capped at MAX_ROW with a "+N more" node for the rest.
import type { AgentNode, AgentStatus } from '../../types.ts';
import type { LiveAgents } from '../../state/live.tsx';
import { FEED_ID, type AgentLive, type GraphNode, type LogEntry, type NodeStatus, type Tone, type Transfer } from './engine.ts';
import type { Edge, Hub, MapView, NodeInfo } from './view.ts';

export type Provider = 'grok' | 'simulated';

/** Most nodes drawn in the worker row or the validator row, counting the "+N more" node. */
export const MAX_ROW = 8;
export const QUEUE_ID = 'hub-queue';
export const CHECK_ID = 'hub-check';
const HUBS: Hub[] = [
  { id: QUEUE_ID, label: 'Job queue', y: 224 },
  { id: CHECK_ID, label: 'Validation', y: 336 },
];

/** The line under the run's title that says where the run comes from. */
export function sourceLabel(provider: Provider | null): string {
  if (provider === null) return 'Simulated run on sample data. With a Grok key the same view shows the real agents.';
  if (provider === 'grok') return 'Live run on Grok';
  return 'Backend run, simulated agents';
}

const statusOf = (s: AgentStatus): NodeStatus => (s === 'running' ? 'working' : s);

const agentOf = (status: NodeStatus, now: string): AgentLive => ({
  status,
  now,
  told: '',
  returned: '',
  sources: [],
  found: 0,
  kept: 0,
  rejected: 0,
  ms: 0,
  tokens: 0,
  calls: 0,
});

/**
 * Which nodes of a long row to draw: everything if it fits, otherwise the running ones first and
 * then the rest in order, keeping one place for the "+N more" node. Drawn nodes keep their order.
 */
export function pickRow<T extends { status: AgentStatus }>(list: T[], max = MAX_ROW): { shown: T[]; hidden: T[] } {
  if (list.length <= max) return { shown: list, hidden: [] };
  const room = max - 1;
  const order = list.map((item, i) => ({ item, i }));
  const chosen = new Set([...order.filter((o) => o.item.status === 'running'), ...order.filter((o) => o.item.status !== 'running')].slice(0, room).map((o) => o.i));
  return { shown: list.filter((_, i) => chosen.has(i)), hidden: list.filter((_, i) => !chosen.has(i)) };
}

const isKept = (v: AgentNode) => v.role.startsWith('Kept');
const isRejected = (v: AgentNode) => v.role.startsWith('Rejected');

/** The numbers row for a backend run. Only counts the backend's own data supports. */
export function liveStats(live: LiveAgents): [string, number][] {
  const all = [live.master, ...live.managers, ...live.workers, ...live.validators, live.presenter].filter((n): n is AgentNode => n !== null);
  return [
    ['agents working', all.filter((n) => n.status === 'running').length],
    ['worker jobs', live.workers.length],
    ['postings checked', live.validators.length],
    ['kept', live.validators.filter(isKept).length],
    ['rejected', live.validators.filter(isRejected).length],
  ];
}

function moreNode(level: 'worker' | 'validator', hidden: AgentNode[], col: GraphNode['col']): { node: GraphNode; agent: AgentLive; info: NodeInfo } {
  const running = hidden.filter((n) => n.status === 'running').length;
  const done = hidden.filter((n) => n.status === 'done').length;
  const waiting = hidden.length - running - done;
  const parts = [running && `${running} running`, done && `${done} done`, waiting && `${waiting} waiting`].filter(Boolean).join(', ');
  const status: NodeStatus = running ? 'working' : done === hidden.length ? 'done' : 'idle';
  const kind = level === 'worker' ? 'worker jobs' : 'postings in validation';
  return {
    node: { id: `more-${level}`, level, name: `${hidden.length} more ${kind}`, title: `+${hidden.length} more`, sub: parts, lane: null, col },
    agent: agentOf(status, parts),
    info: {
      role: `${hidden.length} more ${kind} that do not fit on the map`,
      detail: parts,
      members: hidden.map((n) => ({ name: n.name, status: statusOf(n.status), detail: level === 'validator' ? n.role : n.detail })),
    },
  };
}

const toneOf = (agent: string): Tone => (agent === 'Master agent' ? 'brief' : agent === 'Presentation manager' ? 'done' : 'info');

export function fromLive(live: LiveAgents): MapView {
  const nodes: GraphNode[] = [];
  const agents: Record<string, AgentLive> = {};
  const info: Record<string, NodeInfo> = {};
  const edges: Edge[] = [];
  const transfers: Transfer[] = [];
  const add = (node: GraphNode, agent: AgentLive, source: AgentNode | NodeInfo) => {
    nodes.push(node);
    agents[node.id] = agent;
    info[node.id] = 'members' in source && source.members ? source : { role: source.role, detail: source.detail };
  };
  const running = (id: string) => agents[id]?.status === 'working';

  const { master, managers, workers, validators, presenter } = live;
  if (master) add({ id: master.id, level: 'master', name: master.name, title: master.name, sub: master.role, lane: null }, agentOf(statusOf(master.status), master.detail), master);

  managers.forEach((m, i) => {
    add({ id: m.id, level: 'manager', name: m.name, title: m.name.replace(/ manager(?=( \d+)?$)/i, ''), sub: m.role, lane: i }, agentOf(statusOf(m.status), m.detail), m);
    if (master) {
      edges.push({ from: master.id, to: m.id });
      if (running(m.id)) transfers.push({ from: master.id, to: m.id, kind: 'brief' });
    }
  });

  const row = (level: 'worker' | 'validator', list: AgentNode[]) => {
    const { shown, hidden } = pickRow(list);
    const of = shown.length + (hidden.length ? 1 : 0);
    const ids: string[] = [];
    shown.forEach((n, index) => {
      const col = { index, of };
      if (level === 'worker') add({ id: n.id, level, name: n.name, title: n.name, sub: n.role.split(':')[0] ?? n.role, lane: null, col }, agentOf(statusOf(n.status), n.detail), n);
      // A validation node is one posting; its verdict is the line worth reading on the map.
      else add({ id: n.id, level, name: n.name, title: n.name, sub: n.role, lane: null, col }, agentOf(statusOf(n.status), n.role), n);
      ids.push(n.id);
    });
    if (hidden.length) {
      const more = moreNode(level, hidden, { index: shown.length, of });
      add(more.node, more.agent, more.info);
      ids.push(more.node.id);
    }
    return ids;
  };

  const workerIds = row('worker', workers);
  const validatorIds = row('validator', validators);
  const hubs: Hub[] = [];

  if (workerIds.length) {
    hubs.push(HUBS[0]!);
    const busy = workerIds.some(running);
    for (const m of managers) {
      edges.push({ from: m.id, to: QUEUE_ID });
      if (busy && running(m.id)) transfers.push({ from: m.id, to: QUEUE_ID, kind: 'job' });
    }
    for (const id of workerIds) {
      edges.push({ from: QUEUE_ID, to: id });
      if (running(id)) transfers.push({ from: QUEUE_ID, to: id, kind: 'job' });
    }
  }

  if (validatorIds.length) {
    hubs.push(HUBS[1]!);
    for (const id of workerIds) edges.push({ from: id, to: CHECK_ID });
    for (const id of validatorIds) {
      edges.push({ from: CHECK_ID, to: id });
      if (running(id)) transfers.push({ from: CHECK_ID, to: id, kind: 'result' });
    }
  }

  if (presenter) {
    add(
      { id: presenter.id, level: 'presenter', name: presenter.name, title: 'Presentation', sub: presenter.role, lane: null },
      agentOf(statusOf(presenter.status), presenter.detail),
      presenter,
    );
    const on = running(presenter.id);
    for (const id of validatorIds) {
      edges.push({ from: id, to: presenter.id });
      const v = validators.find((n) => n.id === id);
      if (on && v && isKept(v)) transfers.push({ from: id, to: presenter.id, kind: 'keep' });
    }
    edges.push({ from: presenter.id, to: FEED_ID });
    if (on) transfers.push({ from: presenter.id, to: FEED_ID, kind: 'feed', label: 'Feed' });
  }

  // The backend lists events newest first; the activity list wants them oldest first.
  const events = [...live.events].reverse();
  const start = events.length ? Date.parse(events[0]!.at) : 0;
  const log: LogEntry[] = events.map((e) => ({ id: e.id, t: Math.max(0, Date.parse(e.at) - start) || 0, at: e.at, agent: e.agent, text: e.text, tone: toneOf(e.agent) }));

  const count = (s: NodeStatus) => Object.values(agents).filter((a) => a.status === s).length;
  return {
    source: 'backend',
    beatKey: 'live',
    loop: true,
    status: live.running ? 'running' : 'done',
    nodes,
    agents,
    edges,
    hubs,
    transfers,
    rowLabels: { worker: `Worker fleet (${workers.length})`, validator: `In validation (${validators.length})` },
    sideLeft: { key: `run-${live.summary}`, label: 'This run', text: live.summary, fresh: true },
    sideRight: master ? { key: `master-${master.detail}`, label: 'Master agent', text: master.detail, fresh: true } : null,
    feedCount: null,
    log,
    info,
    summary:
      `The latest run from the agent backend: ${master ? 'a master agent, ' : ''}${managers.length} search managers, ` +
      `${workers.length} worker jobs on a shared job queue, ${validators.length} postings in validation` +
      `${presenter ? ', and a presentation manager that publishes to your feed' : ''}. ` +
      `${workerIds.length + validatorIds.length < workers.length + validators.length ? 'Long rows are cut short with a node for the rest. ' : ''}` +
      `Now ${count('working')} working, ${count('done')} done, ${count('idle')} waiting. Each agent below is a button that opens its details.`,
  };
}
