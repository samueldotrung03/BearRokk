// "Today's brief": the assistant's short read of today and this week, with each line linked to
// the day it is about, and the switch that opens "Plan my week".
import { ArrowRight, Info, Sparkles, WandSparkles } from 'lucide-react';
import type { Brief } from '../../lib/cal/brief.ts';
import { longDay } from '../../lib/cal/days.ts';
import { Card } from '../Page.tsx';

export function BriefCard({
  brief,
  today,
  source,
  planOpen,
  overloaded,
  onTogglePlan,
  onJump,
}: {
  brief: Brief;
  today: string;
  source: string;
  planOpen: boolean;
  overloaded: boolean;
  onTogglePlan: () => void;
  onJump: (day: string) => void;
}) {
  return (
    <Card className="cx-brief relative overflow-hidden p-6">
      <div className="cx-brief-glow" aria-hidden="true" />
      <div className="relative">
        <div className="flex flex-wrap items-center gap-2">
          <span className="cx-ai-chip">
            <Sparkles className="size-3.5" aria-hidden="true" />
            Today's brief
          </span>
          <span className="text-sm text-ink-3">{longDay(today)}</span>
        </div>
        <h2 className="mt-3 font-display text-[30px] leading-[1.12] text-ink">{brief.headline}</h2>
        <ul className="mt-4 grid gap-2">
          {brief.lines.map((line, index) => (
            <li key={`${line.tone}-${index}`} className="cx-brief-line" data-tone={line.tone} style={{ ['--cx-i' as string]: index }}>
              <span className="cx-brief-dot" aria-hidden="true" />
              <span className="flex-1">{line.text}</span>
              {line.day && line.day !== today && (
                <button type="button" onClick={() => onJump(line.day!)} className="cx-brief-jump" aria-label={`Show ${longDay(line.day)}`}>
                  Show <ArrowRight className="size-3" aria-hidden="true" />
                </button>
              )}
            </li>
          ))}
        </ul>
        <div className="mt-5 flex flex-wrap items-center gap-x-4 gap-y-2">
          <button
            type="button"
            onClick={onTogglePlan}
            aria-expanded={planOpen}
            aria-controls="cx-plan"
            className="btn-primary flex items-center gap-2 px-4 py-2.5 text-sm text-white"
          >
            <WandSparkles className="size-4" aria-hidden="true" />
            {planOpen ? 'Hide my week plan' : 'Plan my week'}
            {overloaded && !planOpen && <span className="cx-badge">Overloaded</span>}
          </button>
          <p className="flex items-center gap-1.5 text-xs text-ink-3">
            <Info className="size-3.5 shrink-0" aria-hidden="true" />
            {source}
          </p>
        </div>
      </div>
    </Card>
  );
}
