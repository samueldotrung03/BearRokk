// The Agents page's picture of the agent team: one manager bot that coordinates, and four worker
// bots in one chain toward one goal: scout -> two readers -> validator and presenter -> feed. It is a simplified picture for the student, not the agent system's real shape
// (which has more agents; see backend/AGENT_SYSTEM.md). Each bot in the picture lights up while
// the part of the run it stands for is working.
import type { Level, NodeStatus } from './engine.ts';
import type { MapView } from './view.ts';

export type TeamId = 'manager' | 'scout' | 'reader-1' | 'reader-2' | 'checker';

export interface TeamMember {
  id: TeamId;
  name: string;
  /** Which Grok bot drawing to use. */
  bot: Level;
  /** One line under the bot. */
  role: string;
  /** What this agent does, for the panel beside the picture. */
  about: string;
}

export const TEAM_GOAL = 'Find the opportunities that fit you and put them in your feed';

export const TEAM: TeamMember[] = [
  {
    id: 'manager',
    name: 'Manager',
    bot: 'master',
    role: 'Coordinates the team',
    about:
      'Runs the search toward the goal. It reads your profile, your notes and what you have liked, tells the scout what to look for, and keeps the chain moving from the scout to the readers to the validator and presenter, so only checked opportunities reach your feed.',
  },
  {
    id: 'scout',
    name: 'Opportunity scout',
    bot: 'worker',
    role: 'Step 1: finds leads',
    about:
      'Searches the web for internships, events, clubs, hackathons, research and scholarships that match what you want, skipping anything you have already seen. It passes every promising lead to the readers.',
  },
  {
    id: 'reader-1',
    name: 'Reader 1',
    bot: 'worker',
    role: 'Step 2: reads each lead',
    about:
      'Takes a lead from the scout and opens it on the organizer’s own page to pull out the facts: who runs it, who can apply, the deadline, where it is, any pay, and what the application asks for. Anything the page does not say is left as unknown, never guessed. It passes the posting to the validator and presenter.',
  },
  {
    id: 'reader-2',
    name: 'Reader 2',
    bot: 'worker',
    role: 'Step 2: reads each lead',
    about:
      'Reads leads beside Reader 1, so two are read at once. When a posting leaves out its deadline, it looks for it on other listings and says where it was found. It also passes each posting to the validator and presenter.',
  },
  {
    id: 'checker',
    name: 'Validator and presenter',
    bot: 'validator',
    role: 'Step 3: checks and presents',
    about:
      'One agent with two jobs. First it checks each posting against you: is it real, still open, something you can apply for, and does it fit your notes and rules? Then it presents what passed: it orders your feed and writes a line on why each card fits you.',
  },
];

const text = (n: { name: string; title: string; sub: string }) => `${n.name} ${n.title} ${n.sub}`.toLowerCase();

/** How each bot in the picture is doing, from the agents in the run being shown. */
export function teamStatus(view: Pick<MapView, 'nodes' | 'agents'>): Record<TeamId, NodeStatus> {
  const statusOf = (match: (n: MapView['nodes'][number]) => boolean) => view.nodes.filter(match).map((n) => view.agents[n.id]?.status ?? 'idle');
  const sum = (list: NodeStatus[]): NodeStatus => (list.includes('working') ? 'working' : list.includes('waiting') ? 'waiting' : list.some((s) => s === 'done') ? 'done' : 'idle');

  const scouts = statusOf((n) => n.level === 'worker' && /scout|search|lead/.test(text(n)));
  const readers = statusOf((n) => n.level === 'worker' && !/scout|search|lead/.test(text(n)));
  const checkers = statusOf((n) => n.level === 'validator' || n.level === 'presenter');
  const leads = statusOf((n) => n.level === 'master' || n.level === 'manager');
  const readersWorking = readers.filter((s) => s === 'working').length;
  const all = [...scouts, ...readers, ...checkers, ...leads];
  return {
    manager: sum(all),
    scout: sum(scouts),
    'reader-1': sum(readers),
    // The second reader joins when more than one page is being read at once.
    'reader-2': readersWorking >= 2 ? 'working' : readersWorking === 1 ? sum(readers.filter((s) => s !== 'working')) : sum(readers),
    checker: sum(checkers),
  };
}
