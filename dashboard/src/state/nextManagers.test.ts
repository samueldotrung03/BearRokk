import { describe, expect, it } from 'vitest';
import { withNextManagers, type LiveAgents } from './live.tsx';

const node = (name: string, status: 'idle' | 'running' | 'done' = 'done') => ({ id: name, name, role: '', status, detail: '' });
const last: LiveAgents = {
  master: node('Master agent'),
  managers: ['Internships manager', 'Events manager', 'Clubs manager', 'Hackathons manager'].map((n) => node(n)),
  workers: [node('Scout')],
  validators: [node('Check')],
  presenter: node('Presentation manager'),
  events: [],
  running: false,
  summary: 'Last run',
};
const four = (kind: string) => [1, 2, 3, 4].map((i) => ({ name: `${kind} manager ${i}`, role: kind.toLowerCase() }));

describe('Agents page: managers follow the kinds chosen in Agent settings', () => {
  it('shows four internship managers, ready, once only internships are chosen', () => {
    const view = withNextManagers(last, four('Internships'));
    expect(view.managers.map((m) => m.name)).toEqual(['Internships manager 1', 'Internships manager 2', 'Internships manager 3', 'Internships manager 4']);
    expect(view.managers.every((m) => m.status === 'idle')).toBe(true);
    expect(view.workers).toEqual([]);
    expect(view.summary).toBe('Next search: 4 on internships');
  });

  it('leaves a running search, or an unchanged line-up, as it is', () => {
    expect(withNextManagers({ ...last, running: true }, four('Internships'))).toEqual({ ...last, running: true });
    const same = last.managers.map((m) => ({ name: m.name, role: '' }));
    expect(withNextManagers(last, same)).toBe(last);
  });
});
