// What one agent is doing, what it was told, what it returned, what it read, and what it cost.
import { Check, X } from 'lucide-react';
import type { CandidateState, GraphNode, LogEntry, RunState } from '../../lib/agents/engine.ts';
import { clockText, compact } from './AnimatedNumber.tsx';
import { statusWord } from './RunGraph.tsx';

const levelName = { master: 'Master', manager: 'Search manager', worker: 'Worker', validator: 'Validator', presenter: 'Presentation manager' } as const;
// From the model tiers table in backend/AGENT_SYSTEM.md: only the fleet runs on the cheap tier.
const tier = { master: 'normal', manager: 'normal', worker: 'low', validator: 'normal', presenter: 'normal' } as const;

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="ag-panel-label">{label}</p>
      <div className="mt-1 text-[13px] leading-snug text-white/85">{children}</div>
    </div>
  );
}

export function NodeDetail({ run, node }: { run: RunState; node: GraphNode }) {
  const agent = run.agents[node.id];
  if (!agent) return null;
  const items: CandidateState[] =
    node.level === 'validator'
      ? run.candidates.filter((c) => c.judgedBy === node.id)
      : node.id.startsWith('extractor-')
        ? run.candidates.filter((c) => c.foundBy === node.id)
        : node.level === 'presenter'
          ? run.candidates.filter((c) => c.stage === 4 || c.reason === 'disliked')
          : [];
  const showCounts = node.level === 'worker' || node.level === 'validator' || node.level === 'presenter';
  const stats: [string, string][] = [
    ...(showCounts
      ? ([
          ['Found', String(agent.found)],
          ['Kept', String(agent.kept)],
          ['Dropped', String(agent.rejected)],
        ] as [string, string][])
      : []),
    ['Time', clockText(agent.ms)],
    ['Tokens', compact(agent.tokens)],
    ['Grok calls', String(agent.calls)],
  ];

  return (
    <section className="ag-panel flex min-h-0 flex-col p-4" aria-labelledby="ag-detail-title">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="ag-panel-label">
            {levelName[node.level]} · {tier[node.level]} tier
          </p>
          <h3 id="ag-detail-title" className="mt-0.5 truncate text-base font-semibold">
            {node.name}
            {node.level === 'manager' && <span className="font-normal text-white/60"> · {node.title}</span>}
          </h3>
        </div>
        <span className="ag-chip-dark shrink-0">
          <span className="ag-dot" data-status={agent.status} aria-hidden="true" />
          {statusWord[agent.status]}
        </span>
      </div>

      <div className="mt-3 grid min-h-0 gap-3 overflow-y-auto pr-1">
        <Field label="Doing now">{agent.now}</Field>
        <Field label="What it was told">{agent.told || <span className="text-white/50">Nothing yet. It is briefed when the run reaches it.</span>}</Field>
        <Field label="What it returned">{agent.returned || <span className="text-white/50">Nothing yet.</span>}</Field>
        <Field label="Sources read">
          {agent.sources.length ? (
            <ul className="flex flex-wrap gap-1.5">
              {agent.sources.map((source) => (
                <li key={source} className="rounded-full border border-white/10 bg-white/8 px-2 py-0.5 text-[11.5px] text-white/80">
                  {source}
                </li>
              ))}
            </ul>
          ) : (
            <span className="text-white/50">None yet.</span>
          )}
        </Field>
        <dl className="grid grid-cols-3 gap-2">
          {stats.map(([label, value]) => (
            <div key={label} className="rounded-xl bg-white/6 px-2.5 py-2">
              <dd className="font-display text-xl leading-none">{value}</dd>
              <dt className="mt-1 text-[11px] text-white/55">{label}</dt>
            </div>
          ))}
        </dl>
        {items.length > 0 && (
          <Field label={node.level === 'validator' ? 'Its verdicts' : node.level === 'presenter' ? 'What it published' : 'Pages it read'}>
            <ul className="space-y-1.5">
              {items.map((c) => (
                <li key={c.id} className="flex gap-2">
                  {c.judged ? (
                    c.reason ? (
                      <X className="mt-0.5 size-3.5 shrink-0 text-[#ff7a8f]" aria-label="Dropped" />
                    ) : (
                      <Check className="mt-0.5 size-3.5 shrink-0 text-[#34c759]" aria-label="Kept" />
                    )
                  ) : (
                    <span className="mt-1.5 size-2 shrink-0 rounded-full bg-white/40" aria-label="Waiting for a validator" />
                  )}
                  <span className="min-w-0">
                    <span className="block truncate">{c.title}</span>
                    {c.judged && <span className="block text-[11.5px] text-white/55">{c.note}</span>}
                  </span>
                </li>
              ))}
            </ul>
          </Field>
        )}
      </div>
    </section>
  );
}

export function ActivityStream({ log, nodes }: { log: LogEntry[]; nodes: GraphNode[] }) {
  const names = new Map(nodes.map((n) => [n.id, n.name]));
  const entries = [...log].reverse();
  return (
    <section className="ag-panel flex h-full min-h-0 flex-col p-4" aria-labelledby="ag-activity-title">
      <div className="flex items-center justify-between">
        <h3 id="ag-activity-title" className="ag-panel-label">
          Activity
        </h3>
        <span className="text-[11px] text-white/45">{log.length} events</span>
      </div>
      <ol className="ag-log mt-2 min-h-0 flex-1 space-y-2.5 pr-1" role="log" aria-live="polite" aria-relevant="additions">
        {entries.length === 0 && <li className="text-[13px] text-white/55">Press Run now, or tell your agents something, to start a run.</li>}
        {entries.map((entry) => (
          <li key={entry.id} className="flex gap-2.5">
            <span className="ag-log-bar" data-tone={entry.tone} aria-hidden="true" />
            <div className="min-w-0">
              <p className="text-[11px] text-white/50">
                <span className="tabular-nums">{clockText(entry.t)}</span> · {names.get(entry.agent) ?? entry.agent}
              </p>
              <p className="text-[13px] leading-snug text-white/88">{entry.text}</p>
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}
