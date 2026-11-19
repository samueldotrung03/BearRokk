import { AlertTriangle, CheckCircle2, Clock } from 'lucide-react';
import type { Pace, Readiness } from '../../lib/roadmapx/readiness.ts';
import { Card } from '../Page.tsx';

const R = 54;
const CIRCUMFERENCE = 2 * Math.PI * R;

const paceIcon = { on_track: CheckCircle2, tight: Clock, behind: AlertTriangle } as const;

/** The readiness score as a ring, what it is made of, and whether the dates are being kept. */
export function ReadinessCard({ readiness, pace, onPlan }: { readiness: Readiness; pace: Pace; onPlan: () => void }) {
  const Icon = paceIcon[pace.status];
  return (
    <Card className="rm-ready p-6">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="font-semibold tracking-tight">Readiness for this goal</h2>
        <span className="rm-pace" data-status={pace.status}>
          <Icon className="size-3.5" aria-hidden="true" />
          {pace.label}
        </span>
      </div>

      <div className="mt-4 flex items-center gap-5">
        <div className="rm-ring" role="img" aria-label={`Readiness ${readiness.score} out of 100`}>
          <svg viewBox="0 0 128 128" aria-hidden="true">
            <defs>
              <linearGradient id="rm-ring-grad" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stopColor="#6fb1f0" />
                <stop offset="100%" stopColor="#245bd8" />
              </linearGradient>
            </defs>
            <circle cx="64" cy="64" r={R} className="rm-ring-track" />
            <circle
              cx="64"
              cy="64"
              r={R}
              className="rm-ring-fill"
              strokeDasharray={CIRCUMFERENCE}
              strokeDashoffset={CIRCUMFERENCE * (1 - readiness.score / 100)}
            />
          </svg>
          <span className="rm-ring-num">
            <span className="font-display text-5xl leading-none">{readiness.score}</span>
            <span className="text-xs text-ink-3">of 100</span>
          </span>
        </div>
        <ul className="min-w-0 flex-1 space-y-3">
          {readiness.parts.map((part) => (
            <li key={part.key}>
              <div className="flex items-baseline justify-between gap-2 text-sm">
                <span className="font-medium">{part.label}</span>
                <span className="shrink-0 text-xs text-ink-3">{Math.round(part.weight * 100)}%</span>
              </div>
              <div className="rm-bar mt-1" aria-hidden="true">
                <span style={{ width: `${part.value * 100}%` }} />
              </div>
              <p className="mt-0.5 text-xs text-ink-3">{part.detail}</p>
            </li>
          ))}
        </ul>
      </div>

      <p className="mt-4 text-sm leading-relaxed text-ink-2">{pace.detail}</p>
      {pace.status !== 'on_track' && (
        <button type="button" onClick={onPlan} className="mt-3 text-sm font-semibold text-brand hover:underline">
          Plan my week around it
        </button>
      )}
      <p className="mt-3 text-xs leading-relaxed text-ink-3">
        How much of this plan you have covered, weighted toward what most people did. It is not a prediction of an offer.
      </p>
    </Card>
  );
}
