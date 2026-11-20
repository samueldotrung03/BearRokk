// The agent team as one picture: the goal at the top, the manager bot that coordinates, and under
// it the chain the work moves along: opportunity scout -> two readers -> validator and presenter
// (one agent) -> your feed. Beside it, what each of the five does. A simplified picture of the
// agent system for the student; the bots light up while their part of the run is working.
import { ArrowRight } from 'lucide-react';
import { Link } from 'react-router';
import { TEAM, TEAM_GOAL, teamStatus, type TeamId } from '../../lib/agents/team.ts';
import type { MapView } from '../../lib/agents/view.ts';
import { GrokBot } from './GrokBot.tsx';
import { statusWord } from './RunGraph.tsx';

export function TeamMap({ view, selected, onSelect }: { view: Pick<MapView, 'nodes' | 'agents'>; selected: TeamId; onSelect: (id: TeamId) => void }) {
  const status = teamStatus(view);
  const working = (id: TeamId) => status[id] === 'working';
  const bot = (id: TeamId, size: number) => {
    const m = TEAM.find((x) => x.id === id)!;
    return (
      <button
        type="button"
        className="ag-team-bot"
        data-status={status[id]}
        aria-pressed={selected === id}
        aria-label={`${m.name}, ${m.role}. ${statusWord[status[id]]}.`}
        onClick={() => onSelect(id)}
      >
        <GrokBot level={m.bot} status={status[id]} size={size} seed={id} />
        <span className="ag-team-name">
          <span className="ag-dot" data-status={status[id]} aria-hidden="true" />
          {m.name}
        </span>
        <span className="ag-team-role">{m.role}</span>
      </button>
    );
  };
  // An arrow is lit while the agent it hands work to is working.
  const arrow = (to: boolean) => (
    <span className="ag-team-arrow" data-active={to} aria-hidden="true">
      <ArrowRight className="size-4" />
    </span>
  );

  return (
    <div className="ag-team" role="group" aria-label="Your agent team: the manager coordinates; the scout passes leads to the readers, who pass them to the validator and presenter, who puts them in your feed">
      <p className="ag-team-goal">
        <span>Goal</span>
        {TEAM_GOAL}
      </p>
      <span className="ag-team-line" data-active={working('manager')} aria-hidden="true" />
      {bot('manager', 60)}
      <span className="ag-team-line" data-active={working('manager')} aria-hidden="true" />
      <p className="ag-team-coord">coordinates the chain</p>

      <ol className="ag-chain">
        <li className="ag-chain-step">{bot('scout', 44)}</li>
        <li className="ag-chain-link">{arrow(working('reader-1') || working('reader-2'))}</li>
        <li className="ag-chain-step ag-chain-pair">
          {bot('reader-1', 40)}
          {bot('reader-2', 40)}
        </li>
        <li className="ag-chain-link">{arrow(working('checker'))}</li>
        <li className="ag-chain-step">{bot('checker', 44)}</li>
        <li className="ag-chain-link">{arrow(status.checker === 'done' || working('checker'))}</li>
        <li className="ag-chain-step">
          <Link to="/" className="ag-team-feed">
            Your feed
          </Link>
        </li>
      </ol>
    </div>
  );
}

/** Beside the picture: what each of the five agents does, in the order the work moves. */
export function TeamAbout({ selected, onSelect }: { selected: TeamId; onSelect: (id: TeamId) => void }) {
  return (
    <section className="ag-panel flex h-full min-h-0 flex-col p-4" aria-labelledby="ag-team-about">
      <h3 id="ag-team-about" className="ag-panel-label">
        What your agents do
      </h3>
      <p className="mt-1.5 text-[13px] leading-relaxed text-white/60">
        The manager coordinates. The work moves along one chain: the scout finds leads, the readers read them, and the validator and presenter checks them and puts the
        ones that fit in your feed.
      </p>
      <ul className="mt-3 min-h-0 flex-1 space-y-2 overflow-y-auto pr-1">
        {TEAM.map((m) => (
          <li key={m.id}>
            <button type="button" className="ag-team-card" aria-pressed={selected === m.id} onClick={() => onSelect(m.id)}>
              <span className="flex items-center gap-2.5">
                <GrokBot level={m.bot} status="idle" size={26} seed={`about-${m.id}`} />
                <span>
                  <span className="block text-[13.5px] font-semibold text-white">{m.name}</span>
                  <span className="block text-[11.5px] text-white/50">{m.role}</span>
                </span>
              </span>
              <span className="mt-2 block text-[12.5px] leading-relaxed text-white/70">{m.about}</span>
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
