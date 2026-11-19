import { Check, Users } from 'lucide-react';
import { useStore } from '../../state/StoreProvider.tsx';
import { dueShort, formatHours, type CoachContext } from '../../lib/roadmapx/context.ts';
import { groupByWeek } from '../../lib/roadmapx/timeline.ts';
import { shortDate } from '../../lib/time.ts';
import { stepMeta } from '../meta.ts';
import { Card } from '../Page.tsx';
import { stepDomId } from './StepRow.tsx';

/**
 * The same steps laid out by week from today. Each week shows how much open work falls in it
 * against the hours the student has, so an overloaded week is visible before it arrives.
 */
export function Timeline({ ctx }: { ctx: CoachContext }) {
  const { dispatch } = useStore();
  const buckets = groupByWeek(ctx.steps, ctx.now);

  return (
    <Card className="p-5 sm:p-6">
      <ol className="rm-timeline">
        {buckets.map((bucket, index) => {
          const previous = buckets[index - 1];
          const gap = previous?.index != null && bucket.index !== null ? bucket.index - previous.index - 1 : 0;
          const load = ctx.hoursPerWeek > 0 ? bucket.hours / ctx.hoursPerWeek : 0;
          const over = bucket.index !== null && bucket.index >= 0 && load > 1;
          return (
            <li key={bucket.key} className="rm-week-row" data-kind={bucket.index === -1 ? 'overdue' : bucket.index === null ? 'none' : 'week'}>
              {gap > 0 && (
                <p className="rm-gap">
                  {gap} quiet {gap === 1 ? 'week' : 'weeks'}
                </p>
              )}
              <div className="rm-week-label">
                <p className="font-semibold tracking-tight">{bucket.label}</p>
                {bucket.start !== null && bucket.index !== 0 && bucket.index !== 1 && <p className="text-xs text-ink-3">from {shortDate(new Date(bucket.start).toISOString())}</p>}
                {bucket.hours > 0 && (
                  <>
                    <p className={`mt-1 text-xs ${over ? 'font-semibold text-orange-700' : 'text-ink-3'}`}>
                      {formatHours(bucket.hours)} open{bucket.index !== null && bucket.index >= 0 ? ` of your ${formatHours(ctx.hoursPerWeek)}` : ''}
                    </p>
                    {bucket.index !== null && bucket.index >= 0 && (
                      <div className="rm-load" data-over={over} aria-hidden="true">
                        <span style={{ width: `${Math.min(1, load) * 100}%` }} />
                      </div>
                    )}
                  </>
                )}
              </div>
              <ul className="rm-week-steps">
                {bucket.steps.map((step) => {
                  const Icon = stepMeta[step.kind].icon;
                  return (
                    <li key={step.id} id={stepDomId(step.id)} className="rm-tl-step" data-done={step.done} data-next={step.isNext}>
                      <button
                        type="button"
                        role="checkbox"
                        aria-checked={step.done}
                        aria-label={`Mark "${step.title}" as done`}
                        onClick={() => dispatch({ type: 'toggleStep', id: step.id })}
                        className="rm-tick"
                        data-done={step.done}
                      >
                        <Check className="size-3.5" strokeWidth={3} aria-hidden="true" />
                      </button>
                      <div className="min-w-0 flex-1">
                        <p className={`truncate text-sm font-medium ${step.done ? 'text-ink-3 line-through' : ''}`}>{step.title}</p>
                        <p className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-ink-3">
                          <span className="flex items-center gap-1">
                            <Icon className="size-3.5" aria-hidden="true" />
                            {step.extra ? step.phase : stepMeta[step.kind].label}
                          </span>
                          {step.due && !step.done && <span>{dueShort(step.due, ctx.now)}</span>}
                          <span>about {formatHours(step.hours)}</span>
                          {step.evidence && (
                            <span className="flex items-center gap-1">
                              <Users className="size-3" aria-hidden="true" />
                              {step.evidence.count} of {step.evidence.total}
                            </span>
                          )}
                        </p>
                      </div>
                      {step.isNext && <span className="rm-next-tag">Next</span>}
                    </li>
                  );
                })}
              </ul>
            </li>
          );
        })}
      </ol>
    </Card>
  );
}
