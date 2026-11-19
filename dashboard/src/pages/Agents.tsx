import { Card, Page } from '../components/Page.tsx';
import { agentEvents, agents } from '../data/sample.ts';
import { relativeTime } from '../lib/time.ts';
import type { AgentNode, AgentStatus } from '../types.ts';

const statusMeta: Record<AgentStatus, { label: string; dot: string }> = {
  running: { label: 'Running', dot: 'live-dot bg-[#34c759]' },
  done: { label: 'Done', dot: 'bg-brand' },
  idle: { label: 'Waiting', dot: 'bg-slate-300' },
};

function Status({ status }: { status: AgentStatus }) {
  const meta = statusMeta[status];
  return (
    <span className="flex shrink-0 items-center gap-2 text-xs font-medium text-ink-2">
      <span className={`size-2 rounded-full ${meta.dot}`} aria-hidden="true" />
      {meta.label}
    </span>
  );
}

function Node({ node, compact = false }: { node: AgentNode; compact?: boolean }) {
  return (
    <Card className={compact ? 'p-4' : 'p-5'}>
      <div className="flex items-start justify-between gap-3">
        <h3 className="leading-snug font-semibold tracking-tight">{node.name}</h3>
        <Status status={node.status} />
      </div>
      <p className="mt-0.5 text-sm text-ink-3">{node.role}</p>
      <p className="mt-3 text-sm leading-relaxed text-ink-2">{node.detail}</p>
    </Card>
  );
}

/** A vertical connector between two levels of the hierarchy. */
function Link() {
  return <div className="mx-auto h-7 w-px bg-linear-to-b from-brand/50 to-brand/15" aria-hidden="true" />;
}

function Level({ label, hideLabel = false, children }: { label: string; hideLabel?: boolean; children: React.ReactNode }) {
  return (
    <section aria-label={label}>
      {!hideLabel && <p className="mb-2 text-center text-sm font-medium text-ink-2">{label}</p>}
      {children}
    </section>
  );
}

export function Agents() {
  return (
    <Page
      title="Your agents"
      subtitle="How your agents are organised. The activity below is an example until Grok is connected."
      aside={
        <span className="w-fit rounded-full bg-white/85 px-4 py-2 text-sm font-medium text-ink shadow-card backdrop-blur">Example activity</span>
      }
    >
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div>
          <Level label="Master" hideLabel>
            <div className="mx-auto max-w-md">
              <Node node={agents.master} />
            </div>
          </Level>
          <Link />
          <Level label="Managers">
            <div className="grid gap-4 sm:grid-cols-2">
              {agents.managers.map((node) => (
                <Node key={node.id} node={node} />
              ))}
            </div>
          </Level>
          <Link />
          <Level label="Workers">
            <div className="grid gap-4 sm:grid-cols-2">
              {agents.workers.map((node) => (
                <Node key={node.id} node={node} compact />
              ))}
            </div>
          </Level>
        </div>

        <aside className="lg:sticky lg:top-6 lg:self-start">
          <Card className="p-6">
            <h2 className="font-semibold tracking-tight">Activity</h2>
            <ol className="mt-4 space-y-4 border-l border-line pl-5">
              {agentEvents.map((event) => (
                <li key={event.id} className="relative">
                  <span className="absolute top-1.5 -left-[25px] size-2 rounded-full bg-brand ring-4 ring-white" aria-hidden="true" />
                  <p className="text-xs text-ink-3">
                    {event.agent} · {relativeTime(event.at)}
                  </p>
                  <p className="mt-0.5 text-sm leading-relaxed text-ink-2">{event.text}</p>
                </li>
              ))}
            </ol>
          </Card>
        </aside>
      </div>
    </Page>
  );
}
