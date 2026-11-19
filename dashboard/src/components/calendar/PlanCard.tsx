// "Plan my week": seven day columns with the student's free hours, the suggested work blocks
// (accept one with a click, or all at once), and why the selected block sits where it does.
import { Check, CheckCheck, Info, Minus, Plus, TriangleExclamationPoint, Undo2, WandSparkles, X } from 'lucide-react';
import { useState } from 'react';
import { dayDate, dayLabel, hoursLabel, shortDay, weekdayOf } from '../../lib/cal/days.ts';
import type { PersonalItem } from '../../lib/cal/items.ts';
import type { PlanBlock, WeekPlan } from '../../lib/cal/planner.ts';
import { Card } from '../Page.tsx';

const MAX_HOURS = 12;

export function PlanCard({
  plan,
  today,
  hours,
  accepted,
  source,
  onHours,
  onAccept,
  onAcceptAll,
  onUnaccept,
  onClearAccepted,
  onClose,
  onJump,
}: {
  plan: WeekPlan;
  today: string;
  hours: number[];
  accepted: PersonalItem[];
  source: string;
  onHours: (weekday: number, hours: number) => void;
  onAccept: (block: PlanBlock) => void;
  onAcceptAll: () => void;
  onUnaccept: (id: string) => void;
  onClearAccepted: () => void;
  onClose: () => void;
  onJump: (day: string) => void;
}) {
  const [focusId, setFocusId] = useState<string | null>(null);
  const focused = plan.blocks.find((b) => b.id === focusId) ?? plan.blocks[0] ?? null;
  const acceptedHours = accepted.reduce((sum, p) => sum + (p.block?.hours ?? 0), 0);
  const fits = !plan.overloaded && plan.shortfalls.length === 0;

  const accept = (block: PlanBlock) => {
    // Move the explanation on to the next suggestion, so accepting in a row reads naturally.
    const next = plan.blocks[plan.blocks.indexOf(block) + 1] ?? null;
    setFocusId(next?.id ?? null);
    onAccept(block);
  };

  return (
    <Card className="cx-plan cx-rise mt-4 p-6">
      <div id="cx-plan" className="flex flex-wrap items-start gap-4">
        <div className="mr-auto min-w-0">
          <p className="cx-ai-chip w-fit">
            <WandSparkles className="size-3.5" aria-hidden="true" />
            Plan my week
          </p>
          <h2 className="mt-2 font-display text-3xl leading-tight">
            {plan.placed > 0 ? `${hoursLabel(plan.placed)} of work, placed before each due date` : acceptedHours > 0 ? 'Your week is planned' : 'Nothing needs planning this week'}
          </h2>
          <p className="mt-1 text-sm text-ink-2">
            {hoursLabel(plan.available)} free this week after what you accepted
            {acceptedHours > 0 && ` (${hoursLabel(acceptedHours)} accepted)`}. Have-to items are placed first, then should-do, never after the due date.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {accepted.length > 0 && (
            <button type="button" onClick={onClearAccepted} className="cal-nav gap-1.5 px-3 text-sm font-semibold">
              <Undo2 className="size-4" aria-hidden="true" /> Clear accepted
            </button>
          )}
          {plan.blocks.length > 0 && (
            <button type="button" onClick={onAcceptAll} className="btn-primary flex items-center gap-2 px-4 py-2 text-sm text-white">
              <CheckCheck className="size-4" aria-hidden="true" /> Accept all {plan.blocks.length}
            </button>
          )}
          <button type="button" onClick={onClose} aria-label="Close the week plan" className="cal-nav w-9">
            <X className="size-4" aria-hidden="true" />
          </button>
        </div>
      </div>

      <div className={`cx-plan-status mt-4 ${fits ? '' : 'cx-plan-warn'}`} role="status">
        {fits ? (
          <>
            <span className="cx-ok-dot" aria-hidden="true" />
            <span>
              Everything fits. {hoursLabel(Math.max(0, plan.available - plan.needed))} stays free for the unexpected.
            </span>
          </>
        ) : (
          <>
            <TriangleExclamationPoint className="mt-0.5 size-4 shrink-0" strokeWidth={2.5} aria-hidden="true" />
            <ul className="grid gap-0.5">
              {plan.warnings.map((warning) => (
                <li key={warning}>{warning}</li>
              ))}
            </ul>
          </>
        )}
      </div>

      <div className="cx-strip mt-4" role="list" aria-label="Your next seven days">
        {plan.days.map((d, dayIndex) => {
          const weekday = weekdayOf(d.day);
          const blocks = plan.blocks.filter((b) => b.day === d.day);
          const mine = accepted.filter((p) => p.day === d.day);
          const used = d.accepted + d.suggested;
          const name = dayDate(d.day).toLocaleDateString('en-US', { weekday: 'long' });
          return (
            <div key={d.day} role="listitem" className="cx-strip-day" data-today={d.day === today} style={{ ['--cx-i' as string]: dayIndex }}>
              <button type="button" onClick={() => onJump(d.day)} className="cx-strip-head">
                <span>{dayLabel(d.day, today) === 'Today' ? 'Today' : dayDate(d.day).toLocaleDateString('en-US', { weekday: 'short' })}</span>
                <span className="text-ink-3">{shortDay(d.day)}</span>
              </button>
              <div className="cx-stepper">
                <button type="button" aria-label={`Fewer free hours on ${name}s`} disabled={hours[weekday]! <= 0} onClick={() => onHours(weekday, Math.max(0, hours[weekday]! - 0.5))}>
                  <Minus className="size-3" aria-hidden="true" />
                </button>
                <span aria-live="polite" aria-label={`${hoursLabel(d.capacity)} free on ${name}s`}>
                  {d.capacity === 0 ? 'Off' : hoursLabel(d.capacity)}
                </span>
                <button type="button" aria-label={`More free hours on ${name}s`} disabled={hours[weekday]! >= MAX_HOURS} onClick={() => onHours(weekday, Math.min(MAX_HOURS, hours[weekday]! + 0.5))}>
                  <Plus className="size-3" aria-hidden="true" />
                </button>
              </div>
              <div className="cx-cap" aria-label={`${hoursLabel(used)} of ${hoursLabel(d.capacity)} planned`} role="img">
                <span className="cx-cap-accepted" style={{ width: d.capacity ? `${(d.accepted / d.capacity) * 100}%` : '0%' }} />
                <span className="cx-cap-suggested" style={{ width: d.capacity ? `${(d.suggested / d.capacity) * 100}%` : '0%' }} />
              </div>
              <ul className="mt-2 grid gap-1.5">
                {mine.map((p) => (
                  <li key={p.id} className="cx-block cx-block-accepted cx-pop" data-priority={p.priority} data-done={p.done}>
                    <span className="cx-block-hours">
                      <Check className="size-3" strokeWidth={3} aria-hidden="true" /> {hoursLabel(p.block?.hours ?? 0)}
                    </span>
                    <span className="cx-block-title">{p.title.replace(/^Work on: /, '')}</span>
                    <button type="button" className="cx-block-x" onClick={() => onUnaccept(p.id)} aria-label={`Remove the accepted block "${p.title}"`}>
                      <X className="size-3" aria-hidden="true" />
                    </button>
                  </li>
                ))}
                {blocks.map((block) => (
                  <li key={block.id} className="cx-block" data-priority={block.priority} data-focus={focused?.id === block.id}>
                    <button type="button" className="cx-block-main" onClick={() => setFocusId(block.id)} aria-pressed={focused?.id === block.id} aria-label={`${hoursLabel(block.hours)} on ${block.title}. Show why`}>
                      <span className="cx-block-hours">{hoursLabel(block.hours)}</span>
                      <span className="cx-block-title">{block.title}</span>
                    </button>
                    <button type="button" className="cx-block-ok" onClick={() => accept(block)} aria-label={`Accept ${hoursLabel(block.hours)} on ${block.title}`}>
                      <Check className="size-3.5" strokeWidth={3} aria-hidden="true" />
                    </button>
                  </li>
                ))}
                {mine.length === 0 && blocks.length === 0 && <li className="px-1 text-xs text-ink-3">{d.capacity === 0 ? 'Day off' : 'Open'}</li>}
              </ul>
            </div>
          );
        })}
      </div>

      {focused && (
        <div className="cx-why cx-fade mt-4" key={focused.id} aria-live="polite">
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold tracking-wide text-ink-3 uppercase">
              Why {hoursLabel(focused.hours)} {dayLabel(focused.day, today) === 'Today' ? 'today' : `on ${dayLabel(focused.day, today)}`}
            </p>
            <p className="mt-0.5 font-semibold">{focused.title}</p>
            <p className="mt-1 text-sm leading-relaxed text-ink-2">{focused.why}</p>
          </div>
          <button type="button" onClick={() => accept(focused)} className="cx-accept self-start">
            <Check className="size-3.5" strokeWidth={3} aria-hidden="true" /> Accept this block
          </button>
        </div>
      )}

      {plan.later.length > 0 && (
        <p className="mt-3 text-sm text-ink-2">
          <span className="font-medium text-ink">Left for later weeks: </span>
          {plan.later.map((t) => t.title).slice(0, 3).join(', ')}
          {plan.later.length > 3 && ` and ${plan.later.length - 3} more`}, due more than two weeks out.
        </p>
      )}
      <p className="mt-3 flex items-center gap-1.5 text-xs text-ink-3">
        <Info className="size-3.5 shrink-0" aria-hidden="true" />
        {source} Hours are estimates; change your free hours and the plan updates at once.
      </p>
    </Card>
  );
}
