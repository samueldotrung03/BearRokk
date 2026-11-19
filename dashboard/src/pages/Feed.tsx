import { ArrowRight, Undo2 } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Link } from 'react-router';
import { Masonry } from '../components/Masonry.tsx';
import { typeMeta } from '../components/meta.ts';
import { OpportunityCard } from '../components/OpportunityCard.tsx';
import { Card, Page, StatusPill } from '../components/Page.tsx';
import { agentEvents, opportunities, roadmaps } from '../data/sample.ts';
import { daysUntil, dueLabel, greeting, relativeTime } from '../lib/time.ts';
import { useStore } from '../state/StoreProvider.tsx';
import { rankFeed } from '../state/store.ts';
import type { Opportunity, OpportunityType } from '../types.ts';

type Filter = 'all' | OpportunityType;

function NextStep() {
  const { state } = useStore();
  const roadmap = roadmaps.find((r) => r.goalId === state.goalId);
  const steps = roadmap?.phases.flatMap((phase) => phase.steps) ?? [];
  const next = steps.find((step) => !state.doneSteps.includes(step.id));
  const done = steps.filter((step) => state.doneSteps.includes(step.id)).length;

  return (
    <div className="rounded-3xl bg-linear-to-br from-[#7fa6ff] to-[#5b7cf5] p-6 text-white shadow-lift">
      <p className="text-sm font-medium text-white/80">Next on your roadmap</p>
      {next ? (
        <>
          <p className="mt-2 text-xl leading-snug font-semibold tracking-tight">{next.title}</p>
          <p className="mt-2 text-sm leading-relaxed text-white/85">{next.detail}</p>
          <div className="mt-5 h-1.5 overflow-hidden rounded-full bg-white/25">
            <div className="h-full rounded-full bg-white" style={{ width: `${(done / steps.length) * 100}%` }} />
          </div>
          <p className="mt-2 text-xs text-white/80">
            {done} of {steps.length} steps done
          </p>
        </>
      ) : (
        <p className="mt-2 text-sm leading-relaxed text-white/90">
          {roadmap ? 'Every step is done. Pick the next goal in career discovery.' : 'The agents are building a roadmap for your new goal.'}
        </p>
      )}
      <Link to="/roadmap" className="mt-5 inline-flex items-center gap-1.5 text-sm font-medium">
        Open roadmap <ArrowRight className="size-4" aria-hidden="true" />
      </Link>
    </div>
  );
}

function ClosingSoon({ items }: { items: Opportunity[] }) {
  const soon = items
    .filter((o) => o.deadline && daysUntil(o.deadline) >= 0 && daysUntil(o.deadline) <= 14)
    .sort((a, b) => daysUntil(a.deadline!) - daysUntil(b.deadline!))
    .slice(0, 4);
  if (soon.length === 0) return null;
  return (
    <Card className="p-6">
      <h2 className="font-semibold tracking-tight">Closing soon</h2>
      <ul className="mt-3 divide-y divide-line">
        {soon.map((o) => (
          <li key={o.id} className="py-3 last:pb-0">
            <p className="text-sm leading-snug font-medium">{o.title}</p>
            <p className="mt-0.5 text-sm text-ink-3">
              {o.organizer} · <span className="font-medium text-orange-700">{dueLabel(o.deadline!)}</span>
            </p>
          </li>
        ))}
      </ul>
    </Card>
  );
}

function AgentGlance() {
  return (
    <Card className="p-6">
      <div className="flex items-center justify-between">
        <h2 className="font-semibold tracking-tight">While you were away</h2>
        <Link to="/agents" className="text-sm font-medium text-brand">
          See agents
        </Link>
      </div>
      <ul className="mt-3 space-y-3">
        {agentEvents.slice(0, 3).map((event) => (
          <li key={event.id} className="text-sm leading-relaxed text-ink-2">
            {event.text} <span className="whitespace-nowrap text-ink-3">{relativeTime(event.at)}</span>
          </li>
        ))}
      </ul>
    </Card>
  );
}

export function Feed() {
  const { state, dispatch } = useStore();
  const [filter, setFilter] = useState<Filter>('all');
  const [lastDismissed, setLastDismissed] = useState<Opportunity | null>(null);

  const ranked = useMemo(() => rankFeed(opportunities, state), [state]);
  const visible = filter === 'all' ? ranked : ranked.filter((o) => o.type === filter);
  // Chips keep a fixed order, so they do not jump around as the ranking changes.
  const present = new Set(ranked.map((o) => o.type));
  const filters: Filter[] = ['all', ...(Object.keys(typeMeta) as OpportunityType[]).filter((type) => present.has(type))];
  const newToday = ranked.filter((o) => Date.now() - new Date(o.foundAt).getTime() < 86_400_000).length;

  const dismiss = (o: Opportunity) => {
    dispatch({ type: 'dismiss', id: o.id });
    setLastDismissed(o);
  };

  // The unfiltered feed mixes in the roadmap, deadlines and agent news, the way a social feed
  // mixes posts with other kinds of tiles.
  const tiles = visible.map((o) => <OpportunityCard key={o.id} opportunity={o} onDismiss={dismiss} />);
  if (filter === 'all') {
    tiles.splice(2, 0, <NextStep key="next-step" />);
    // Spaced so that, in three columns, each column gets one of these shorter tiles.
    tiles.splice(6, 0, <ClosingSoon key="closing-soon" items={ranked} />);
    tiles.splice(10, 0, <AgentGlance key="agent-glance" />);
  }


  return (
    <Page
      title={`${greeting()}, ${state.profile.name}`}
      subtitle={`Your agents kept looking while you were away. ${newToday} new ${newToday === 1 ? 'opportunity' : 'opportunities'} since yesterday.`}
      aside={<StatusPill>Agents running · last sweep 12 min ago</StatusPill>}
    >
      <section aria-label="Recommended opportunities" className="space-y-5">
        <div className="flex flex-wrap gap-2" role="group" aria-label="Filter by type">
          {filters.map((value) => (
            <button
              key={value}
              type="button"
              aria-pressed={filter === value}
              onClick={() => setFilter(value)}
              className={`h-9 rounded-full px-4 text-sm font-medium shadow-card transition ${
                filter === value ? 'bg-ink text-white' : 'bg-white/90 text-ink-2 hover:bg-white'
              }`}
            >
              {value === 'all' ? 'For you' : typeMeta[value].plural}
            </button>
          ))}
        </div>

        {lastDismissed && (
          <div role="status" className="flex items-center justify-between gap-4 rounded-2xl bg-ink px-5 py-3 text-sm text-white">
            <span>Removed. You will see fewer {typeMeta[lastDismissed.type].plural.toLowerCase()} like it.</span>
            <button
              type="button"
              onClick={() => {
                dispatch({ type: 'restore', id: lastDismissed.id });
                setLastDismissed(null);
              }}
              className="flex shrink-0 items-center gap-1.5 font-medium"
            >
              <Undo2 className="size-4" aria-hidden="true" /> Undo
            </button>
          </div>
        )}

        {visible.length === 0 ? (
          <Card className="p-10 text-center">
            <p className="font-semibold">Nothing here right now</p>
            <p className="mt-1 text-sm text-ink-3">The agents are still searching. New cards appear here as they are verified.</p>
          </Card>
        ) : (
          <Masonry>{tiles}</Masonry>
        )}
      </section>
    </Page>
  );
}
