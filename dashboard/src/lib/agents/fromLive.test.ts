import { describe, expect, it } from 'vitest';
import type { LiveAgents } from '../../state/live.tsx';
import type { AgentNode, AgentStatus } from '../../types.ts';
import { FEED_ID } from './engine.ts';
import { CHECK_ID, fromLive, liveStats, MAX_ROW, pickRow, QUEUE_ID, sourceLabel } from './fromLive.ts';
import { GRAPH_MIN_WIDTH, layoutGraph, routeOf } from './layout.ts';

const agent = (id: string, name: string, status: AgentStatus, role = 'role', detail = `${name} detail`): AgentNode => ({ id, name, role, status, detail });

const worker = (i: number, status: AgentStatus = 'done') =>
  agent(`job-${i}`, `Search: topic ${i}`, status, 'Scout: searches for leads', status === 'done' ? `${i} leads` : 'Working…');

function liveRun(over: Partial<LiveAgents> = {}): LiveAgents {
  return {
    master: agent('master', 'Master agent', 'done', 'Reads the profile, background and memory', 'Brief: internships for a freshman'),
    managers: [
      agent('manager-1', 'Internships manager', 'running', 'Internships, by field', 'Covering software'),
      agent('manager-2', 'Events manager', 'done', 'Events, by field', 'Covered data'),
    ],
    workers: [worker(1), worker(2, 'running'), worker(3, 'idle')],
    validators: [
      agent('v-a', 'Posting A', 'done', 'Kept by both reviewers, fit 0.78', 'Criteria reviewer: fine. Status reviewer: open.'),
      agent('v-b', 'Posting B', 'done', 'Rejected by the status reviewer', 'Status reviewer: closed.'),
      agent('v-c', 'Posting C', 'running', 'Under review: 1 of 2 reviews in', 'Criteria reviewer: reviewing…'),
    ],
    presenter: agent('presentation', 'Presentation manager', 'idle', 'Orders the feed and writes the reasons', 'Waiting'),
    events: [
      { id: '3', at: '2026-11-19T05:00:10.000Z', agent: 'Worker fleet', text: 'third' },
      { id: '2', at: '2026-11-19T05:00:05.000Z', agent: 'Master agent', text: 'second' },
      { id: '1', at: '2026-11-19T05:00:00.000Z', agent: 'System', text: 'first' },
    ],
    running: true,
    summary: 'Run 2 in progress',
    ...over,
  };
}

describe('sourceLabel', () => {
  it('names the source exactly', () => {
    expect(sourceLabel('grok')).toBe('Live run on Grok');
    expect(sourceLabel('simulated')).toBe('Backend run, simulated agents');
    expect(sourceLabel(null)).toMatch(/^Simulated run on sample data/);
  });
});

describe('fromLive', () => {
  it('draws the real names, statuses and details', () => {
    const view = fromLive(liveRun());
    const byId = new Map(view.nodes.map((n) => [n.id, n]));
    expect(byId.get('master')?.name).toBe('Master agent');
    expect(view.agents['master']).toMatchObject({ status: 'done', now: 'Brief: internships for a freshman' });
    expect(byId.get('manager-1')).toMatchObject({ level: 'manager', title: 'Internships', name: 'Internships manager', lane: 0 });
    expect(view.agents['manager-1']?.status).toBe('working');
    expect(view.agents['job-3']?.status).toBe('idle');
    expect(byId.get('job-1')).toMatchObject({ level: 'worker', title: 'Search: topic 1', sub: 'Scout' });
    expect(view.agents['job-1']?.now).toBe('1 leads');
    expect(byId.get('v-b')?.sub).toBe('Rejected by the status reviewer');
    expect(view.info['v-b']).toEqual({ role: 'Rejected by the status reviewer', detail: 'Status reviewer: closed.' });
    expect(view.sideLeft?.text).toBe('Run 2 in progress');
    expect(view.sideRight?.text).toBe('Brief: internships for a freshman');
    expect(view.status).toBe('running');
    expect(view.feedCount).toBeNull();
  });

  it('pulses only along connectors whose lower node is running, and every pulse has a drawn path', () => {
    const view = fromLive(liveRun());
    const ends = view.transfers.map((t) => `${t.from}>${t.to}`).sort();
    expect(ends).toEqual([`${CHECK_ID}>v-c`, `${QUEUE_ID}>job-2`, `manager-1>${QUEUE_ID}`, 'master>manager-1'].sort());
    const { paths } = layoutGraph(view.nodes, 900, view.edges, view.hubs);
    for (const t of view.transfers) expect(routeOf(paths, t.from, t.to), `${t.from} -> ${t.to}`).not.toBeNull();
  });

  it('sends kept postings and the feed pulse while the presentation manager runs', () => {
    const view = fromLive(liveRun({ presenter: agent('presentation', 'Presentation manager', 'running') }));
    const ends = view.transfers.map((t) => `${t.from}>${t.to}`);
    expect(ends).toContain('v-a>presentation');
    expect(ends).not.toContain('v-b>presentation');
    expect(ends).toContain(`presentation>${FEED_ID}`);
  });

  it('settles with no pulses when the run is done', () => {
    const done = (n: AgentNode): AgentNode => ({ ...n, status: 'done' });
    const run = liveRun();
    const view = fromLive({
      ...run,
      running: false,
      master: done(run.master!),
      managers: run.managers.map(done),
      workers: run.workers.map(done),
      validators: run.validators.map(done),
      presenter: done(run.presenter!),
    });
    expect(view.transfers).toEqual([]);
    expect(Object.values(view.agents).every((a) => a.status === 'done')).toBe(true);
    expect(view.status).toBe('done');
  });

  it('caps a long worker row, keeps the running ones, and counts the rest in a "+N more" node', () => {
    const workers = Array.from({ length: 20 }, (_, i) => worker(i + 1, i >= 17 ? 'running' : 'done'));
    const view = fromLive(liveRun({ workers }));
    const row = view.nodes.filter((n) => n.level === 'worker');
    expect(row).toHaveLength(MAX_ROW);
    expect(row.map((n) => n.id)).toEqual(expect.arrayContaining(['job-18', 'job-19', 'job-20']));
    const more = row.at(-1)!;
    expect(more).toMatchObject({ id: 'more-worker', title: `+${20 - (MAX_ROW - 1)} more`, col: { index: MAX_ROW - 1, of: MAX_ROW } });
    expect(view.info['more-worker']?.members).toHaveLength(20 - (MAX_ROW - 1));
    expect(view.rowLabels.worker).toBe('Worker fleet (20)');
  });

  it('keeps every row from overlapping at the narrowest width', () => {
    const workers = Array.from({ length: 30 }, (_, i) => worker(i + 1));
    const validators = Array.from({ length: 15 }, (_, i) => agent(`v-${i}`, `Posting ${i}`, 'done', 'Kept by both reviewers, fit 0.7'));
    const view = fromLive(liveRun({ workers, validators }));
    const { placed } = layoutGraph(view.nodes, GRAPH_MIN_WIDTH, view.edges, view.hubs);
    const boxes = [...placed.values()];
    for (const a of boxes) {
      for (const b of boxes) {
        if (a === b || a.y !== b.y) continue;
        expect(Math.abs(a.x - b.x)).toBeGreaterThanOrEqual((a.w + b.w) / 2);
      }
    }
  });

  it('lists activity oldest first with the real time kept', () => {
    const { log } = fromLive(liveRun());
    expect(log.map((e) => e.text)).toEqual(['first', 'second', 'third']);
    expect(log.map((e) => e.t)).toEqual([0, 5000, 10000]);
    expect(log[1]).toMatchObject({ at: '2026-11-19T05:00:05.000Z', agent: 'Master agent', tone: 'brief' });
  });

  it('copes with a run that has not reported any agents yet', () => {
    const view = fromLive(liveRun({ master: null, managers: [], workers: [], validators: [], presenter: null, events: [] }));
    expect(view.nodes).toEqual([]);
    expect(view.edges).toEqual([]);
    expect(view.hubs).toEqual([]);
    expect(view.sideRight).toBeNull();
  });
});

describe('pickRow', () => {
  it('returns a short row unchanged', () => {
    const list = [worker(1), worker(2)];
    expect(pickRow(list)).toEqual({ shown: list, hidden: [] });
  });
});

describe('liveStats', () => {
  it('counts only what the backend reports', () => {
    expect(liveStats(liveRun())).toEqual([
      ['agents working', 3],
      ['worker jobs', 3],
      ['postings checked', 3],
      ['kept', 1],
      ['rejected', 1],
    ]);
  });
});
