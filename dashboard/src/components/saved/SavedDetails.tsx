// The expanded part of a saved row: what a student needs to act on it, in one place. The deadline
// and where it was read, whether it is on their calendar, who runs it and who may apply, where
// and when, what applying takes, and the links. Nothing here is a guess: a fact the posting did
// not state says so.
import { ArrowUpRight, CalendarCheck, CalendarPlus, Clock, ExternalLink, FileText, ListChecks, MapPin, Users } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { CalendarStatus } from '../CalendarStatus.tsx';
import { formatLabel, typeMeta } from '../meta.ts';
import { daysUntil, relativeTime, shortDate } from '../../lib/time.ts';
import { useLive, type TrackedApplication } from '../../state/live.tsx';
import { useStore } from '../../state/StoreProvider.tsx';
import type { Opportunity } from '../../types.ts';

const host = (url: string) => {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
};

const longDate = (iso: string) =>
  new Date(iso).toLocaleString(undefined, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' });

function Fact({ icon: Icon, label, children }: { icon: typeof Clock; label: string; children: ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="flex items-center gap-1.5 text-xs font-semibold tracking-wide text-ink-3 uppercase">
        <Icon className="size-3.5" aria-hidden="true" />
        {label}
      </dt>
      <dd className="mt-1 text-sm leading-relaxed text-ink">{children}</dd>
    </div>
  );
}

function Missing({ children }: { children: ReactNode }) {
  return <span className="text-ink-3">{children}</span>;
}

/** A link that opens outside the app. */
function Out({ href, children }: { href: string; children: ReactNode }) {
  return (
    <a href={href} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 font-medium text-brand hover:underline">
      {children}
      <ExternalLink className="size-3.5" aria-hidden="true" />
    </a>
  );
}

export function SavedDetails({ opportunity: o, application }: { opportunity: Opportunity; application: TrackedApplication | undefined }) {
  const live = useLive();
  const { state } = useStore();
  const [deadlineInput, setDeadlineInput] = useState('');
  const [saving, setSaving] = useState(false);
  const status = state.applications[o.id]?.status ?? null;
  const deadline = application?.deadline ?? o.deadline;
  const days = deadline ? daysUntil(deadline) : null;
  const active = status === 'to_apply' || status === 'applying';
  const prompts = application?.prompts.length ? application.prompts : [];
  const materials = application?.materials.length ? application.materials : [];
  const place = [o.format ? formatLabel[o.format] : null, o.location].filter(Boolean).join(' · ');

  const addDeadline = async () => {
    if (!deadlineInput) return;
    setSaving(true);
    // A date with no time is taken as the end of that day, the way deadlines are usually meant.
    await live.setDeadline(o.id, new Date(`${deadlineInput}T23:59:00`).toISOString());
    setSaving(false);
    setDeadlineInput('');
  };

  return (
    <div className="saved-details">
      <dl className="grid gap-x-6 gap-y-5 sm:grid-cols-2 lg:grid-cols-3">
        <Fact icon={Clock} label="Deadline">
          {deadline ? (
            <>
              <span className={`font-semibold ${days !== null && days >= 0 && days <= 7 ? 'text-orange-700' : ''}`}>{longDate(deadline)}</span>
              <span className="block text-ink-2">{days === null ? '' : days < 0 ? 'Passed' : days === 0 ? 'Due today' : days === 1 ? 'Due tomorrow' : `${days} days left`}</span>
              <span className="mt-1 block text-xs text-ink-3">
                {o.deadline && o.deadlineSource === 'listing' && o.deadlineEvidence ? (
                  <>
                    Not on the organizer's page. Read from <Out href={o.deadlineEvidence.url}>{host(o.deadlineEvidence.url)}</Out>: "{o.deadlineEvidence.quote}"
                  </>
                ) : o.deadline ? (
                  <>From the organizer's page{o.deadlineEvidence ? <>: "{o.deadlineEvidence.quote}"</> : null}</>
                ) : (
                  'Added by you'
                )}
              </span>
            </>
          ) : (
            <>
              <Missing>Not stated on the posting or any listing the agents found.</Missing>
              <form
                className="mt-2 flex flex-wrap items-center gap-2"
                onSubmit={(event) => {
                  event.preventDefault();
                  void addDeadline();
                }}
              >
                <label className="sr-only" htmlFor={`${o.id}-deadline`}>
                  Deadline
                </label>
                <input
                  id={`${o.id}-deadline`}
                  type="date"
                  value={deadlineInput}
                  onChange={(event) => setDeadlineInput(event.target.value)}
                  className="h-9 rounded-lg border border-slate-300 bg-white px-2 text-sm outline-none focus:border-brand"
                />
                <button type="submit" disabled={!deadlineInput || saving} className="h-9 rounded-lg border border-line bg-white px-3 text-sm font-semibold disabled:opacity-50">
                  {saving ? 'Saving…' : 'Add deadline'}
                </button>
              </form>
            </>
          )}
        </Fact>

        <Fact icon={application?.calendar.state === 'synced' ? CalendarCheck : CalendarPlus} label="Calendar">
          <CalendarStatus id={o.id} deadline={deadline} />
          {active && application?.reminders.length ? (
            <span className="mt-1 block text-xs text-ink-3">Reminders: {application.reminders.map((r) => `${shortDate(r.at)} (${r.label.toLowerCase()})`).join(', ')}</span>
          ) : null}
        </Fact>

        <Fact icon={typeMeta[o.type].icon} label="Organizer">
          <span className="font-semibold">{o.organizer}</span>
          <span className="block text-ink-2">{typeMeta[o.type].label}{o.tags.length ? ` · ${o.tags.slice(0, 3).join(', ')}` : ''}</span>
        </Fact>

        <Fact icon={Users} label="Who can apply">
          {o.eligibility ? o.eligibility : <Missing>The posting does not say. Check the official page.</Missing>}
        </Fact>

        <Fact icon={MapPin} label="Where and when">
          {place || <Missing>Place not stated.</Missing>}
          {o.startTime && <span className="block text-ink-2">Starts {longDate(o.startTime)}</span>}
        </Fact>

        <Fact icon={ListChecks} label="What applying takes">
          {materials.length ? <span className="block">Needs: {materials.join(', ')}</span> : null}
          {prompts.length ? (
            <details className="mt-1">
              <summary className="cursor-pointer text-brand">
                {prompts.length} {prompts.length === 1 ? 'question' : 'questions'} on the form
              </summary>
              <ol className="mt-1.5 list-decimal space-y-1 pl-5 text-ink-2">
                {prompts.map((p) => (
                  <li key={p}>{p}</li>
                ))}
              </ol>
            </details>
          ) : null}
          {!materials.length && !prompts.length && <Missing>The agents have not read the application form yet, or it needs a sign-in.</Missing>}
        </Fact>
      </dl>

      <div className="mt-5 flex flex-wrap items-center gap-2 border-t border-line pt-4">
        {(application?.actionUrl ?? o.actionUrl) && (
          <a href={application?.actionUrl ?? o.actionUrl ?? undefined} target="_blank" rel="noreferrer" className="btn-primary inline-flex h-10 items-center gap-1.5 rounded-xl px-4 text-sm font-semibold text-white">
            Apply <ArrowUpRight className="size-4" aria-hidden="true" />
          </a>
        )}
        <a href={o.sourceUrl} target="_blank" rel="noreferrer" className="inline-flex h-10 items-center gap-1.5 rounded-xl border border-line bg-white px-4 text-sm font-semibold text-ink">
          <FileText className="size-4" aria-hidden="true" /> Official page
        </a>
        <span className="ml-auto text-xs text-ink-3">
          Found {relativeTime(o.foundAt)}, checked {relativeTime(o.lastCheckedAt)} · fit {Math.round(o.baseScore * 100)}%
        </span>
      </div>
    </div>
  );
}
