// One application on the Applications list, laid out like a row on the Saved page (the posting's
// picture on the left) but with what matters for applying: the deadline, who can apply, what the
// application asks for, and how much of it is written. The title opens its portal.
import { ArrowRight, Clock, FileText, ListChecks, PenLine, Users } from 'lucide-react';
import { Link } from 'react-router';
import { statusLabel } from '../../../lib/applications.ts';
import { daysLeft, deadlineLabel, progressLabel, type ListApplication } from '../../../lib/portal/list.ts';
import type { TrackedApplication } from '../../../state/live.tsx';
import type { Opportunity } from '../../../types.ts';
import { typeMeta } from '../../meta.ts';
import { Cover } from '../../OpportunityCard.tsx';
import { StatusSelect } from '../../StatusSelect.tsx';

/** The portal's address for an application. */
export const portalPath = (opportunityId: string) => `/applications/${encodeURIComponent(opportunityId)}`;

/** "3 questions, résumé, transcript": what the application asks for, as far as is known. */
export function needsLabel(prompts: string[], materials: string[]): string | null {
  const parts = [prompts.length ? `${prompts.length} ${prompts.length === 1 ? 'question' : 'questions'}` : null, ...materials.map((m) => m.toLowerCase())].filter(Boolean);
  return parts.length ? parts.join(', ') : null;
}

export function ApplicationListRow({
  application: a,
  posting,
  tracked,
  now = Date.now(),
}: {
  application: ListApplication;
  /** The posting behind it; absent for one the student made themselves. */
  posting?: Opportunity;
  tracked?: TrackedApplication;
  now?: number;
}) {
  const meta = a.kind && a.kind !== 'custom' ? typeMeta[a.kind] : null;
  const Icon = meta?.icon ?? (a.kind === 'custom' ? PenLine : FileText);
  const days = daysLeft(a.deadline, now);
  // Only an application still to send can be late or urgent.
  const tone = a.status === 'applied' ? 'quiet' : days === null ? 'none' : days < 0 ? 'passed' : days <= 7 ? 'soon' : 'later';
  const share = a.progress.total === 0 ? 0 : Math.round((a.progress.done / a.progress.total) * 100);
  const needs = needsLabel(tracked?.prompts ?? [], tracked?.materials ?? []);
  const who = posting?.eligibility ?? null;

  return (
    <li className="saved-item">
      <article className="feed-row apl-card" aria-labelledby={`apl-${a.opportunityId}`} data-status={a.status}>
        <div className="feed-row-media">
          {posting ? (
            <Cover opportunity={posting} className="absolute inset-0 size-full" />
          ) : (
            <div className="absolute inset-0 grid place-items-center bg-slate-100 text-slate-500">
              <PenLine className="size-10" aria-hidden="true" />
            </div>
          )}
        </div>
        <div className="feed-row-body">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs font-semibold">
            <span className={`flex items-center gap-1.5 rounded-full px-2.5 py-1 ${meta?.tint ?? 'bg-slate-100 text-slate-600'}`}>
              <Icon className="size-3.5" aria-hidden="true" />
              {meta?.label ?? (a.kind === 'custom' ? 'Made by you' : 'Application')}
            </span>
            <span className="apl-status" data-status={a.status}>
              {statusLabel[a.status]}
            </span>
          </div>
          <h2 id={`apl-${a.opportunityId}`} className="mt-2 line-clamp-2 text-[17px] leading-snug font-semibold text-ink text-balance">
            <Link to={portalPath(a.opportunityId)} className="text-left after:absolute after:inset-0">
              {a.title}
            </Link>
          </h2>
          <p className="mt-0.5 truncate text-sm font-medium text-ink-2">{a.organizer || 'No organizer given'}</p>

          {/* Application details in place of the posting's description. */}
          <dl className="apl-facts">
            <div>
              <dt>
                <Clock className="size-3.5" aria-hidden="true" /> Deadline
              </dt>
              <dd className="apl-due" data-tone={tone}>
                {deadlineLabel(a.deadline, now)}
              </dd>
            </div>
            <div>
              <dt>
                <Users className="size-3.5" aria-hidden="true" /> Who can apply
              </dt>
              <dd className={who ? 'line-clamp-2' : 'text-ink-3'}>{who ?? (a.custom ? 'Not given' : 'The posting does not say')}</dd>
            </div>
            <div>
              <dt>
                <ListChecks className="size-3.5" aria-hidden="true" /> Asks for
              </dt>
              <dd className={needs ? 'line-clamp-2' : 'text-ink-3'}>{needs ?? 'Open it to find the questions'}</dd>
            </div>
          </dl>

          <div className="relative z-10 mt-auto flex flex-wrap items-center gap-3 pt-3">
            <span className="apl-progress">
              <span className="apl-progress-text">{progressLabel(a.progress)}</span>
              <span className="apl-bar" aria-hidden="true">
                <span style={{ width: `${share}%` }} data-full={a.progress.total > 0 && a.progress.done === a.progress.total} />
              </span>
            </span>
            <span className="ml-auto flex flex-wrap items-center gap-2 text-sm text-ink-2">
              {/* Status is changed here as on Saved; one made by the student is changed in its portal. */}
              {!a.custom && <StatusSelect id={a.opportunityId} />}
              <Link to={portalPath(a.opportunityId)} className="btn-primary inline-flex h-9 items-center gap-1.5 rounded-lg px-3 text-sm font-semibold text-white">
                Open application <ArrowRight className="size-4" aria-hidden="true" />
              </Link>
            </span>
          </div>
        </div>
      </article>
    </li>
  );
}
