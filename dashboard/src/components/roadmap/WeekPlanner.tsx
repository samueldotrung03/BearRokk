import { CalendarDays, Check, MessageCircle } from 'lucide-react';
import { useId } from 'react';
import { formatHours, type CoachContext } from '../../lib/roadmapx/context.ts';
import { planWeek } from '../../lib/roadmapx/week.ts';
import { Card } from '../Page.tsx';

const PRESETS = [2, 4, 6, 10, 15];

/**
 * "Plan my week": the student says how many hours they have, and the plan fills them with the
 * open steps that matter most now, each with its reasons. Ticking one re-plans at once.
 */
export function WeekPlanner({
  ctx,
  hours,
  onHours,
  onTick,
  onShow,
  onAsk,
}: {
  ctx: CoachContext;
  hours: number;
  onHours: (hours: number) => void;
  onTick: (stepId: string) => void;
  onShow: (stepId: string) => void;
  onAsk: (question: string) => void;
}) {
  const plan = planWeek(ctx, hours);
  const sliderId = useId();

  return (
    <Card className="rm-week overflow-hidden">
      <div className="p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="flex items-center gap-2 text-lg font-semibold tracking-tight">
              <CalendarDays className="size-[18px] text-brand" aria-hidden="true" />
              Plan my week
            </h2>
            <p className="mt-1 text-sm text-ink-2">{plan.summary}</p>
          </div>
          <div className="rm-hours">
            <label htmlFor={sliderId} className="text-xs font-medium text-ink-3">
              Hours I have this week
            </label>
            <div className="flex items-center gap-3">
              <span className="font-display text-4xl leading-none text-ink">{formatHours(hours)}</span>
              <input
                id={sliderId}
                type="range"
                min={1}
                max={20}
                step={0.5}
                value={hours}
                onChange={(event) => onHours(Number(event.target.value))}
                className="rm-range"
                aria-valuetext={`${hours} hours`}
              />
            </div>
            <div className="rm-seg" role="group" aria-label="Quick picks">
              {PRESETS.map((preset) => (
                <button key={preset} type="button" aria-pressed={preset === hours} onClick={() => onHours(preset)}>
                  {preset}h
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* How the hours are spent, one segment per step, so a full week looks full. */}
        <div className="rm-budget mt-5" aria-hidden="true">
          {plan.picks.map((pick, index) => (
            <span
              key={pick.step.id}
              data-partial={pick.partial}
              style={{ width: `${(pick.hours / hours) * 100}%`, opacity: Math.max(0.4, 1 - index * 0.12) }}
              title={`${pick.step.title}: ${formatHours(pick.hours)}`}
            />
          ))}
        </div>
        <p className="mt-1.5 text-xs text-ink-3">
          {formatHours(plan.used)} planned of {formatHours(hours)}. Hours are rough estimates.
        </p>

        {plan.picks.length > 0 && (
          <ol className="mt-4 space-y-2">
            {plan.picks.map((pick, index) => (
              <li key={pick.step.id} className="rm-pick">
                <span className="rm-pick-num font-display">{index + 1}</span>
                <button
                  type="button"
                  role="checkbox"
                  aria-checked={false}
                  aria-label={`Mark "${pick.step.title}" as done`}
                  onClick={() => onTick(pick.step.id)}
                  className="rm-tick"
                >
                  <Check className="size-3.5" strokeWidth={3} aria-hidden="true" />
                </button>
                <div className="min-w-0 flex-1">
                  <button type="button" onClick={() => onShow(pick.step.id)} className="block max-w-full truncate text-left font-medium hover:text-brand">
                    {pick.partial ? 'Start: ' : ''}
                    {pick.step.title}
                  </button>
                  <div className="mt-1 flex flex-wrap gap-1.5">
                    {pick.reasons.map((reason) => (
                      <span key={reason} className="rm-reason">
                        {reason}
                      </span>
                    ))}
                  </div>
                </div>
                <span className="rm-hour-pill">{formatHours(pick.hours)}</span>
                <button
                  type="button"
                  onClick={() => onAsk(`Why "${pick.step.title}"?`)}
                  className="rm-icon-btn"
                  aria-label={`Ask the coach why "${pick.step.title}" is in this week`}
                  title="Why this step?"
                >
                  <MessageCircle className="size-4" aria-hidden="true" />
                </button>
              </li>
            ))}
          </ol>
        )}

        {plan.leftOut.length > 0 && (
          <div className="rm-leftout mt-4">
            <p className="text-sm font-semibold text-orange-800">Did not fit this week</p>
            <ul className="mt-1 space-y-1">
              {plan.leftOut.map(({ step, reason }) => (
                <li key={step.id} className="text-sm text-ink-2">
                  <button type="button" onClick={() => onShow(step.id)} className="font-medium text-ink hover:text-brand">
                    {step.title}
                  </button>
                  . {reason}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </Card>
  );
}
