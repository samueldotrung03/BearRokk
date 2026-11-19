import { describe, expect, it } from 'vitest';
import { initialState, opportunities } from '../../data/sample.ts';
import { memoryFrom } from './brief.ts';
import { planRun } from './engine.ts';
import { GRAPH_MIN_WIDTH, layoutGraph, routeOf } from './layout.ts';

const plan = (instructions: string[]) =>
  planRun({ profile: initialState.profile, memory: memoryFrom(initialState, opportunities), instructions, dismissed: [], trigger: 'x' }, 1);

describe('layoutGraph', () => {
  it('has a drawn connector for every hand-off in a run, so no pulse goes missing', () => {
    for (const instructions of [[], ['internships only'], ['only remote, no clubs']]) {
      const { nodes, beats } = plan(instructions);
      const { paths } = layoutGraph(nodes, 900);
      for (const t of beats.flatMap((b) => b.transfers)) expect(routeOf(paths, t.from, t.to), `${t.from} -> ${t.to}`).not.toBeNull();
    }
  });

  it('keeps nodes in the same row from overlapping, even at the narrowest width', () => {
    const { placed } = layoutGraph(plan([]).nodes, GRAPH_MIN_WIDTH);
    const boxes = [...placed.values()];
    for (const a of boxes) {
      for (const b of boxes) {
        if (a === b || a.y !== b.y) continue;
        expect(Math.abs(a.x - b.x)).toBeGreaterThanOrEqual((a.w + b.w) / 2);
      }
    }
  });
});
