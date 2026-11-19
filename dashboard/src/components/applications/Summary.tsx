// The top of an application, shared by the list row and the board's detail sheet: what it is,
// when it is due, its status, readiness and next step, and the reminders and calendar links.
import { ArrowRight, Bell, CalendarPlus, Check, Download } from 'lucide-react';
import { typeMeta } from '../meta.ts';
import { Cover } from '../OpportunityCard.tsx';
import { STATUSES, progressOf, remindersFor, statusLabel } from '../../lib/applications.ts';
import { wantsReminders } from '../../lib/apps/export.ts';
import { dueLabel, shortDate } from '../../lib/time.ts';
import { CalendarStatus } from '../CalendarStatus.tsx';
import { useStore } from '../../state/StoreProvider.tsx';
import { ReadinessRing, type GoTo, type Item } from './shared.tsx';

export function Summary({ item, goTo, compact = false }: { item: Item; goTo: GoTo; compact?: boolean }) {
  const { dispatch } = useStore();
  const { opportunity: o, application, info, readiness } = item;
  const { done, total } = progressOf(application, info);
  const reminders = remindersFor(application.status, o.deadline);
  const reminding = wantsReminders(application.status);
  const urgent = readiness.daysLeft !== null && readiness.daysLeft <= 7 && application.status !== 'applied';
  const next = readiness.next;

  return (
    <div className={`flex flex-col gap-4 sm:flex-row ${compact ? '' : 'p-5'}`}>
      {!compact && <Cover opportunity={o} className="h-28 w-full shrink-0 rounded-2xl sm:size-24" />}
      <div className="min-w-0 flex-1">
        <div className="flex items-start gap-4">
          <div className="min-w-0 flex-1">
            <p className="text-sm text-ink-3">
              {typeMeta[o.type].label} · {o.organizer} · {Math.round(o.baseScore * 100)}% fit
            </p>
            {!compact && <h2 className="mt-0.5 text-lg leading-snug font-semibold tracking-tight">{o.title}</h2>}
            <p className={`mt-1 text-sm ${urgent ? 'font-semibold text-orange-700' : 'text-ink-2'}`}>
              {o.deadline ? `${dueLabel(o.deadline)} · ${shortDate(o.deadline)}` : 'No deadline on the posting'}
            </p>
          </div>
          <ReadinessRing score={readiness.score} size={compact ? 52 : 60} />
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-3">
          <div className="app-status" role="group" aria-label="Application status">
            {STATUSES.map((value) => (
              <button
                key={value}
                type="button"
                aria-pressed={application.status === value}
                onClick={() => {
                  dispatch({ type: 'setApplication', id: o.id, status: value });
                }}
              >
                {statusLabel[value]}
              </button>
            ))}
          </div>
          {next.kind !== 'follow_up' && next.kind !== 'closed' && (
            <NextButton item={item} goTo={goTo} />
          )}
        </div>

        {total > 0 && (
          <div className="mt-4 flex items-center gap-3">
            <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-100">
              <div className="ap-progress h-full rounded-full bg-brand" style={{ width: `${(done / total) * 100}%` }} />
            </div>
            <span className="text-sm text-ink-3 tabular-nums">
              {done} of {total} ready
            </span>
          </div>
        )}

        <div className="mt-4 flex flex-wrap items-center gap-2 text-sm">
          {reminders.map((reminder) => (
            <span key={reminder.label} className={`app-reminder ${reminder.past ? 'opacity-45' : ''}`}>
              <Bell className="size-3.5" aria-hidden="true" />
              {reminder.label} · {shortDate(reminder.at)}
            </span>
          ))}
          {reminding && !o.deadline && (
            <span className="app-reminder">
              <Bell className="size-3.5" aria-hidden="true" />
              No date to remind you on yet. Check the posting and confirm one.
            </span>
          )}
          {application.status === 'applied' && (
            <span className="app-reminder text-emerald-700">
              <Check className="size-3.5" aria-hidden="true" />
              Sent. Reminders are off.
            </span>
          )}
          {reminding && <CalendarStatus id={o.id} deadline={o.deadline} compact />}
        </div>
      </div>
    </div>
  );
}

/** The single next step as one button that does it, or opens the exact spot to do it. */
export function NextButton({ item, goTo, tone = 'soft' }: { item: Item; goTo: GoTo; tone?: 'soft' | 'solid' }) {
  const { dispatch } = useStore();
  const { opportunity: o, readiness } = item;
  const next = readiness.next;
  const className = tone === 'solid' ? 'ap-next ap-next-solid' : 'ap-next';
  const body = (text: string) => (
    <>
      {text}
      <ArrowRight className="size-3.5" aria-hidden="true" />
    </>
  );

  if (next.moveTo) {
    return (
      <button type="button" className={className} onClick={() => dispatch({ type: 'setApplication', id: o.id, status: next.moveTo! })}>
        {body(`Move to ${statusLabel[next.moveTo]}`)}
      </button>
    );
  }
  if (next.kind === 'confirm_deadline' || next.kind === 'read_questions' || next.kind === 'submit' || next.kind === 'closed') {
    return (
      <a href={o.actionUrl ?? o.sourceUrl} target="_blank" rel="noreferrer" className={className} onClick={() => dispatch({ type: 'opened', id: o.id })}>
        {body(next.kind === 'submit' ? 'Open the application' : 'Open the posting')}
      </a>
    );
  }
  if (next.kind === 'draft') {
    return (
      <button type="button" className={className} onClick={() => goTo(o.id, { promptIndex: next.promptIndex, helper: 'outline' })}>
        {body('Start with an outline')}
      </button>
    );
  }
  if (next.kind === 'finish_draft') {
    return (
      <button type="button" className={className} onClick={() => goTo(o.id, { promptIndex: next.promptIndex, helper: 'review' })}>
        {body('Check my draft')}
      </button>
    );
  }
  if (next.kind === 'gather') {
    return (
      <button type="button" className={className} onClick={() => goTo(o.id, { material: next.material })}>
        {body('Open the checklist')}
      </button>
    );
  }
  return (
    <button type="button" className={className} onClick={() => goTo(o.id)}>
      {body('Open')}
    </button>
  );
}
