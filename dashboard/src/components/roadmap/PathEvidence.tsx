import { ChevronDown, Users } from 'lucide-react';
import { useState } from 'react';
import { pathProfiles } from '../../data/sample.ts';
import type { StepEvidence } from '../../lib/pathways.ts';
import { Card } from '../Page.tsx';

/** Where the plan comes from: what people who reached this goal did, counted across profiles. */
export function PathEvidence({ goal, common, rare, total }: { goal: string; common: StepEvidence[]; rare: StepEvidence[]; total: number }) {
  const [open, setOpen] = useState(false);
  const profiles = pathProfiles.filter((profile) => profile.goalId === goal);
  if (total === 0) return null;

  return (
    <Card className="overflow-hidden">
      <div className="p-6">
        <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
          <h2 className="flex items-center gap-2 text-lg font-semibold tracking-tight">
            <Users className="size-[18px] text-brand" aria-hidden="true" />
            Built from what people actually did
          </h2>
          <span className="text-sm text-ink-3">{total} profiles of people who got this role · sample data</span>
        </div>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-ink-2">
          Your agents read the public profiles of people who landed this role and noted what each did first. The steps below are
          the ones they share, and inside each phase the most common come first.
        </p>

        <ul className="mt-5 grid gap-x-8 gap-y-3 sm:grid-cols-2">
          {common.slice(0, 6).map((item) => (
            <li key={item.step.id}>
              <div className="flex items-baseline justify-between gap-3 text-sm">
                <span className="truncate font-medium">{item.step.title}</span>
                <span className="shrink-0 text-ink-3">
                  {item.count} of {total}
                </span>
              </div>
              <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-slate-100">
                <div className="h-full rounded-full bg-brand" style={{ width: `${item.share * 100}%` }} />
              </div>
            </li>
          ))}
        </ul>
        {rare.length > 0 && (
          <p className="mt-4 text-sm leading-relaxed text-ink-3">
            Few of them did: {rare.map((item) => `"${item.step.title}" (${item.count} of ${total})`).join(', ')}. Still useful, but
            not what got most people in.
          </p>
        )}
      </div>

      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
        className="flex w-full items-center justify-between border-t border-line px-6 py-3 text-sm font-semibold text-ink-2 hover:bg-slate-50"
      >
        {open ? 'Hide the paths' : `See the ${total} paths`}
        <ChevronDown className={`size-4 transition-transform ${open ? 'rotate-180' : ''}`} aria-hidden="true" />
      </button>
      {open && (
        <ul className="grid gap-3 border-t border-line bg-slate-50/60 p-5 sm:grid-cols-2">
          {profiles.map((profile) => (
            <li key={profile.id} className="rounded-2xl bg-white p-4 shadow-card">
              <p className="text-sm leading-snug font-semibold">{profile.outcome}</p>
              <p className="text-xs text-ink-3">Got it as a {profile.year.toLowerCase()}</p>
              <ol className="path-line mt-3">
                {profile.timeline.map((entry) => (
                  <li key={entry}>{entry}</li>
                ))}
              </ol>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
