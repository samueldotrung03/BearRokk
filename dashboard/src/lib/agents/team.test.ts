import { describe, expect, it } from 'vitest';
import { TEAM, teamStatus } from './team.ts';

const node = (id: string, level: 'master' | 'manager' | 'worker' | 'validator' | 'presenter', title: string, sub = '') => ({ id, level, name: title, title, sub, lane: null });
const agent = (status: 'idle' | 'working' | 'waiting' | 'done') => ({ status }) as never;

describe('agent team picture', () => {
  it('is one manager and a chain of four workers: an opportunity scout, two readers, and a validator and presenter', () => {
    expect(TEAM.map((m) => m.name)).toEqual(['Manager', 'Opportunity scout', 'Reader 1', 'Reader 2', 'Validator and presenter']);
    expect(TEAM.find((m) => m.id === 'scout')!.about).toContain('passes every promising lead to the readers');
    expect(TEAM.find((m) => m.id === 'reader-1')!.about).toContain('passes the posting to the validator and presenter');
    expect(TEAM.find((m) => m.id === 'checker')!.about).toContain('orders your feed');
    expect(TEAM.every((m) => m.about.length > 60)).toBe(true);
  });

  it('lights up the bot for whichever part of the run is working', () => {
    const view = {
      nodes: [node('m', 'master', 'Master agent'), node('s', 'worker', 'Scout', 'finds leads'), node('r1', 'worker', 'Reader'), node('r2', 'worker', 'Reader'), node('v', 'validator', 'Validator')],
      agents: { m: agent('done'), s: agent('done'), r1: agent('working'), r2: agent('idle'), v: agent('idle') },
    };
    expect(teamStatus(view)).toEqual({ manager: 'working', scout: 'done', 'reader-1': 'working', 'reader-2': 'idle', checker: 'idle' });
    view.agents.r2 = agent('working');
    expect(teamStatus(view)['reader-2']).toBe('working');
  });
});
