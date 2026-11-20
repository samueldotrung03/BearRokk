// What the agents cost (per level, against today's budget, over the week) and what the master
// agent knows about the student. The week and the budget start from `agentUsage` in sample.ts;
// this run's simulated numbers are added on top. The memory counts are the real app state.
import { Brain, Gauge } from 'lucide-react';
import { Link } from 'react-router';
import { agentUsage } from '../../data/sample.ts';
import { categoryLabels } from '../../data/agents-extra.ts';
import { CATEGORIES, WORKER_JOB_CAP, type Memory } from '../../lib/agents/brief.ts';
import { totals, usageByLevel, type RunState } from '../../lib/agents/engine.ts';
import type { Profile } from '../../types.ts';
import { Card } from '../Page.tsx';
import { AnimatedNumber, compact } from './AnimatedNumber.tsx';

/** An invented daily allowance, so this run's tokens can be shown as a share of the day. */
const DAILY_TOKENS = 500_000;
const levelLabel = { master: 'Master', manager: 'Managers', worker: 'Worker fleet', validator: 'Validators', presenter: 'Presentation' } as const;
const tierLabel = { master: 'normal', manager: 'normal', worker: 'low', validator: 'normal', presenter: 'normal' } as const;

export function UsageCard({ run, reduced }: { run: RunState; reduced: boolean }) {
  const levels = usageByLevel(run);
  const total = totals(run);
  const maxTokens = Math.max(1, ...levels.map((l) => l.tokens));
  const before = agentUsage.budgetUsed;
  const thisRun = Math.min(1 - before, total.tokens / DAILY_TOKENS);
  const week = agentUsage.pagesPerDay.map((pages, i) => (i === agentUsage.pagesPerDay.length - 1 ? pages + run.pages : pages));
  const peak = Math.max(...week);
  const day = (offset: number) => new Date(Date.now() - offset * 86_400_000).toLocaleDateString('en-US', { weekday: 'short' });

  return (
    <Card className="p-6">
      <h2 className="flex items-center gap-2 font-semibold tracking-tight">
        <Gauge className="size-[18px] text-brand" aria-hidden="true" />
        Usage and budget
      </h2>
      <p className="mt-0.5 text-sm text-ink-3">Grok calls and tokens this run, by level. The worker fleet runs on the cheaper tier.</p>

      <table className="mt-4 w-full text-sm">
        <caption className="sr-only">Grok calls and tokens per level of the hierarchy, this run</caption>
        <thead>
          <tr className="text-left text-xs text-ink-3">
            <th className="pb-1.5 font-medium">Level</th>
            <th className="pb-1.5 font-medium">Tier</th>
            <th className="pb-1.5 text-right font-medium">Calls</th>
            <th className="w-[38%] pb-1.5 pl-3 font-medium">Tokens</th>
          </tr>
        </thead>
        <tbody>
          {levels.map((l) => (
            <tr key={l.level} className="border-t border-line">
              <td className="py-2 font-medium">
                {levelLabel[l.level]} <span className="text-xs font-normal text-ink-3">×{l.agents}</span>
              </td>
              <td className="py-2 text-xs text-ink-3">{tierLabel[l.level]}</td>
              <td className="py-2 text-right tabular-nums">
                <AnimatedNumber value={l.calls} reduced={reduced} />
              </td>
              <td className="py-2 pl-3">
                <div className="flex items-center gap-2">
                  <div className="ag-meter flex-1" aria-hidden="true">
                    <span style={{ width: `${(l.tokens / maxTokens) * 100}%`, background: l.level === 'worker' ? '#7fb0ff' : 'var(--color-brand)' }} />
                  </div>
                  <span className="w-12 text-right text-xs tabular-nums text-ink-2">
                    <AnimatedNumber value={l.tokens} format={compact} reduced={reduced} />
                  </span>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="mt-5">
        <div className="flex items-baseline justify-between text-sm">
          <span className="font-medium">Grok budget today</span>
          <span className="tabular-nums text-ink-2">
            {Math.round(before * 100)}% earlier <span className="font-semibold text-[#9a6a00]">+ {Math.round(thisRun * 100)}% this run</span>
          </span>
        </div>
        <div
          className="ag-meter mt-2"
          style={{ height: 10 }}
          role="progressbar"
          aria-label="Grok budget used today"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round((before + thisRun) * 100)}
        >
          <span style={{ width: `${before * 100}%`, background: 'var(--color-brand)' }} />
          <span style={{ width: `${thisRun * 100}%`, background: '#f5c451' }} />
        </div>
        <div className="mt-3 flex items-baseline justify-between text-sm">
          <span className="font-medium">Worker jobs this run</span>
          <span className="tabular-nums text-ink-2">
            {total.workerJobs} of {WORKER_JOB_CAP} <span className="text-ink-3">(demo cap)</span>
          </span>
        </div>
        <div className="ag-meter mt-2" role="progressbar" aria-label="Worker jobs used this run" aria-valuemin={0} aria-valuemax={WORKER_JOB_CAP} aria-valuenow={total.workerJobs}>
          <span style={{ width: `${(total.workerJobs / WORKER_JOB_CAP) * 100}%`, background: '#7fb0ff' }} />
        </div>
      </div>

      <div className="mt-5">
        <div className="flex items-baseline justify-between text-sm">
          <span className="font-medium">Pages read this week</span>
          <span className="font-display text-2xl leading-none">
            <AnimatedNumber value={week.reduce((a, b) => a + b, 0)} reduced={reduced} />
          </span>
        </div>
        <div className="ag-week mt-3" role="img" aria-label={`Pages read per day, oldest first: ${week.join(', ')}. Today includes ${run.pages} from this run.`}>
          {week.map((pages, i) => {
            const today = i === week.length - 1;
            return (
              <div key={i} className="ag-week-bar" data-today={today} style={{ height: `${(pages / peak) * 100}%` }}>
                {today && run.pages > 0 && <span style={{ height: `${(run.pages / pages) * 100}%` }} />}
              </div>
            );
          })}
        </div>
        <div className="mt-1.5 grid grid-flow-col auto-cols-fr gap-2 text-center text-[11px] text-ink-3" aria-hidden="true">
          {week.map((_, i) => (
            <span key={i}>{i === week.length - 1 ? 'Today' : day(week.length - 1 - i)}</span>
          ))}
        </div>
        <p className="mt-2 text-xs text-ink-3">
          <span className="mr-1 inline-block size-2 rounded-sm bg-[#f5c451] align-middle" aria-hidden="true" />
          This run's pages, on top of today's earlier runs.
        </p>
      </div>
    </Card>
  );
}

export function MemoryCard({ profile, memory, instructions }: { profile: Profile; memory: Memory; instructions: number }) {
  const counts: [string, number][] = [
    ['saves', memory.saves],
    ['likes', memory.likes],
    ['dislikes', memory.dislikes],
    ['opened', memory.opens],
    ['applications', memory.applications],
  ];
  const peak = Math.max(1, ...CATEGORIES.map((c) => memory.byCategory[c].saves + memory.byCategory[c].likes + memory.byCategory[c].dislikes));
  return (
    <Card className="p-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 font-semibold tracking-tight">
            <Brain className="size-[18px] text-brand" aria-hidden="true" />
            What the master agent knows
          </h2>
          <p className="mt-0.5 text-sm text-ink-3">Read at the start of every run. It changes as you save, like and dislike cards.</p>
        </div>
        <Link to="/profile" className="shrink-0 text-xs font-semibold text-brand hover:underline">
          Edit profile
        </Link>
      </div>

      <div className="mt-4 rounded-2xl border border-line bg-white p-4">
        <p className="font-semibold">{profile.fullName}</p>
        <p className="text-sm text-ink-2">
          {profile.year} · {profile.major} · {profile.school} · {profile.location}
        </p>
        <div className="mt-3 flex flex-wrap gap-1.5">
          {profile.interests.map((interest) => (
            <span key={interest} className="rounded-full bg-brand-soft px-2.5 py-0.5 text-xs font-medium text-brand">
              {interest}
            </span>
          ))}
          {profile.skills.map((skill) => (
            <span key={skill} className="rounded-full border border-line px-2.5 py-0.5 text-xs text-ink-2">
              {skill}
            </span>
          ))}
        </div>
      </div>

      <dl className="mt-4 grid grid-cols-5 gap-2 text-center">
        {counts.map(([label, value]) => (
          <div key={label} className="rounded-2xl bg-canvas px-1 py-2.5">
            <dd className="font-display text-3xl leading-none">{value}</dd>
            <dt className="mt-1 text-[11px] text-ink-3">{label}</dt>
          </div>
        ))}
      </dl>

      <h3 className="mt-5 text-sm font-semibold">By category</h3>
      <ul className="mt-2 space-y-2">
        {CATEGORIES.map((c) => {
          const m = memory.byCategory[c];
          const good = m.saves + m.likes;
          return (
            <li key={c} className="grid grid-cols-[150px_minmax(0,1fr)_64px] items-center gap-3 text-sm">
              <span className="truncate text-ink-2">{categoryLabels[c]}</span>
              <div className="ag-meter" aria-hidden="true">
                <span style={{ width: `${(good / peak) * 100}%`, background: '#34c759' }} />
                <span style={{ width: `${(m.dislikes / peak) * 100}%`, background: '#ff7a8f' }} />
              </div>
              <span className="text-right text-xs tabular-nums text-ink-3">
                {good}↑ {m.dislikes}↓
              </span>
            </li>
          );
        })}
      </ul>
      <p className="mt-3 text-xs text-ink-3">
        Plus {instructions} standing instruction{instructions === 1 ? '' : 's'}. Three dislikes in a category with no saves take its manager slots away on the next run.
      </p>
    </Card>
  );
}
