import { ArrowUpRight, BookOpen, Check, ChevronDown, Clock, Lightbulb, MessageCircle, StickyNote, Users, X } from 'lucide-react';
import { useId, useState } from 'react';
import { Link } from 'react-router';
import { stepResources } from '../../data/roadmap-extra.ts';
import { applicationInfo, opportunities } from '../../data/sample.ts';
import type { StepEvidence } from '../../lib/pathways.ts';
import { daysLeft, dueShort, formatHours, whyStep, type CoachContext } from '../../lib/roadmapx/context.ts';
import { useStore } from '../../state/StoreProvider.tsx';
import type { RoadmapStep } from '../../types.ts';
import { stepMeta } from '../meta.ts';
import { StatusSelect } from '../StatusSelect.tsx';

/** DOM id of a step's row, so the coach and the week plan can scroll to it. */
export const stepDomId = (stepId: string) => `rm-step-${stepId.replace(/[^a-zA-Z0-9_-]/g, '-')}`;

/**
 * One roadmap step: the tick box, what to do and when, the evidence chip, and a drawer with why
 * it is there, a time estimate, places to start and a private note.
 */
export function StepRow({
  step,
  ctx,
  isNext,
  onRemove,
  evidence,
  total = 0,
  note,
  onNote,
  onAsk,
}: {
  step: RoadmapStep;
  ctx: CoachContext;
  isNext: boolean;
  onRemove?: () => void;
  /** How many of the people who reached this goal did this step. */
  evidence?: StepEvidence;
  total?: number;
  note: string;
  onNote: (text: string) => void;
  onAsk: (question: string) => void;
}) {
  const { state, dispatch } = useStore();
  const [open, setOpen] = useState(false);
  const drawerId = useId();
  const done = state.doneSteps.includes(step.id);
  const meta = stepMeta[step.kind];
  const linked = opportunities.find((o) => o.id === step.opportunityId && !state.dismissed.includes(o.id));
  const tracks = linked && applicationInfo[linked.id];
  const info = ctx.steps.find((s) => s.id === step.id);
  const resources = stepResources[step.id] ?? [];

  return (
    <li id={stepDomId(step.id)} className={`rm-step rounded-2xl p-4 transition ${isNext ? 'bg-brand-soft/70' : 'hover:bg-slate-50'}`}>
      <div className="flex gap-4">
        <button
          type="button"
          role="checkbox"
          aria-checked={done}
          aria-label={`Mark "${step.title}" as done`}
          onClick={() => dispatch({ type: 'toggleStep', id: step.id })}
          className={`rm-check mt-0.5 grid size-6 shrink-0 place-items-center rounded-full border-2 transition ${
            done ? 'border-brand bg-brand text-white' : 'border-slate-300 bg-white hover:border-brand'
          }`}
          data-done={done}
        >
          {done && <Check className="size-3.5" strokeWidth={3} aria-hidden="true" />}
        </button>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <p className={`font-medium ${done ? 'text-ink-3 line-through' : ''}`}>{step.title}</p>
            {isNext && <span className="rounded-full bg-brand px-2.5 py-0.5 text-xs font-medium text-white">Do this next</span>}
          </div>
          <p className="mt-1 text-sm leading-relaxed text-ink-2">{step.detail}</p>
          <div className="mt-2.5 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-ink-3">
            <span className="flex items-center gap-1.5">
              <meta.icon className="size-4" aria-hidden="true" />
              {meta.label}
            </span>
            {step.due && !done && (
              <span className={daysLeft(step.due, ctx.now) <= 7 ? 'font-medium text-orange-700' : ''}>{dueShort(step.due, ctx.now)}</span>
            )}
            {info && (
              <span className="flex items-center gap-1" title="Rough estimate">
                <Clock className="size-3.5" aria-hidden="true" />
                about {formatHours(info.hours)}
              </span>
            )}
            {evidence && total > 0 && (
              <span className="path-chip" data-strong={evidence.share >= 0.6}>
                <Users className="size-3.5" aria-hidden="true" />
                {evidence.count} of {total} people did this
              </span>
            )}
            {linked && !onRemove && (
              <a
                href={linked.actionUrl ?? linked.sourceUrl}
                target="_blank"
                rel="noreferrer"
                onClick={() => dispatch({ type: 'opened', id: linked.id })}
                className="flex items-center gap-1 rounded-full border border-line bg-white px-3 py-1 font-medium text-brand hover:border-brand"
              >
                {linked.title}
                <ArrowUpRight className="size-3.5 shrink-0" aria-hidden="true" />
              </a>
            )}
            {tracks && <StatusSelect id={linked.id} />}
            {tracks && state.applications[linked.id] && (
              <Link to="/applications" className="font-medium text-brand">
                Open application
              </Link>
            )}
            {onRemove && (
              <button type="button" onClick={onRemove} className="flex items-center gap-1 font-medium hover:text-ink">
                <X className="size-3.5" aria-hidden="true" />
                Remove
              </button>
            )}
            <button
              type="button"
              aria-expanded={open}
              aria-controls={drawerId}
              onClick={() => setOpen((value) => !value)}
              className="rm-why-toggle"
            >
              {note.trim() ? <StickyNote className="size-3.5" aria-label="Has a note" /> : <Lightbulb className="size-3.5" aria-hidden="true" />}
              Why this step
              <ChevronDown className={`size-3.5 transition-transform ${open ? 'rotate-180' : ''}`} aria-hidden="true" />
            </button>
          </div>
        </div>
      </div>

      {open && info && (
        <div id={drawerId} className="rm-drawer">
          <div>
            <h3 className="rm-drawer-h">Why it is on your plan</h3>
            <ul className="mt-1.5 space-y-1.5 text-sm leading-relaxed text-ink-2">
              {whyStep(info, ctx).map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
            <button type="button" onClick={() => onAsk(`Why "${step.title}"?`)} className="mt-3 flex items-center gap-1.5 text-sm font-semibold text-brand hover:underline">
              <MessageCircle className="size-3.5" aria-hidden="true" />
              Ask the coach about it
            </button>
          </div>
          <div className="space-y-4">
            <div>
              <h3 className="rm-drawer-h">Time</h3>
              <p className="mt-1 text-sm text-ink-2">About {formatHours(info.hours)}, a rough planning estimate.</p>
            </div>
            {(resources.length > 0 || linked) && (
              <div>
                <h3 className="rm-drawer-h">Places to start</h3>
                <ul className="mt-1.5 space-y-1">
                  {resources.map((resource) => (
                    <li key={resource.url}>
                      <a href={resource.url} target="_blank" rel="noreferrer" className="flex items-center gap-1.5 text-sm font-medium text-brand hover:underline">
                        <BookOpen className="size-3.5 shrink-0" aria-hidden="true" />
                        {resource.label}
                      </a>
                    </li>
                  ))}
                  {linked && (
                    <li className="text-sm text-ink-2">
                      The linked opportunity: {linked.title}, {linked.organizer}
                    </li>
                  )}
                </ul>
              </div>
            )}
            <div>
              <label htmlFor={`${drawerId}-note`} className="rm-drawer-h">
                Your note
              </label>
              <textarea
                id={`${drawerId}-note`}
                value={note}
                onChange={(event) => onNote(event.target.value)}
                rows={2}
                placeholder="Only you see this. It is saved on this device."
                className="rm-note mt-1.5"
              />
            </div>
          </div>
        </div>
      )}
    </li>
  );
}
