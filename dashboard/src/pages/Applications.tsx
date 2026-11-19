// Everything the student is applying to, in one list: where each one stands, what it still
// needs, when it is due, and the reminders and calendar entry that go with the deadline.
import { ArrowUpRight, Bell, CalendarPlus, Check, ChevronDown, Download, Lock, Plus } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router';
import { typeMeta } from '../components/meta.ts';
import { Cover } from '../components/OpportunityCard.tsx';
import { Card, Page } from '../components/Page.tsx';
import { applicationInfo } from '../data/sample.ts';
import { useOpportunities } from '../state/live.tsx';
import { STATUSES, googleCalendarUrl, icsFile, progressOf, remindersFor, statusLabel } from '../lib/applications.ts';
import { daysUntil, dueLabel, shortDate } from '../lib/time.ts';
import { useStore } from '../state/StoreProvider.tsx';
import type { Application, ApplicationStatus, Opportunity } from '../types.ts';

function Row({ opportunity: o, application }: { opportunity: Opportunity; application: Application }) {
  const { dispatch } = useStore();
  const [open, setOpen] = useState(false);
  const info = applicationInfo[o.id];
  const { done, total } = progressOf(application, info);
  const reminders = remindersFor(application.status, o.deadline);
  const calendar = googleCalendarUrl(o);
  const ics = icsFile(o);
  const wantsReminders = application.status === 'to_apply' || application.status === 'applying';
  const urgent = o.deadline !== null && daysUntil(o.deadline) <= 7 && application.status !== 'applied';

  return (
    <Card className="overflow-hidden">
      <div className="flex flex-col gap-4 p-5 sm:flex-row">
        <Cover opportunity={o} className="h-28 w-full shrink-0 rounded-2xl sm:size-24" />
        <div className="min-w-0 flex-1">
          <p className="text-sm text-ink-3">
            {typeMeta[o.type].label} · {o.organizer}
          </p>
          <h2 className="mt-0.5 text-lg leading-snug font-semibold tracking-tight">{o.title}</h2>
          <p className={`mt-1 text-sm ${urgent ? 'font-semibold text-orange-700' : 'text-ink-2'}`}>
            {o.deadline ? `${dueLabel(o.deadline)} · ${shortDate(o.deadline)}` : 'No deadline on the posting'}
          </p>

          <div className="app-status mt-3" role="group" aria-label="Application status">
            {STATUSES.map((value) => (
              <button
                key={value}
                type="button"
                aria-pressed={application.status === value}
                onClick={() => dispatch({ type: 'setApplication', id: o.id, status: value })}
              >
                {statusLabel[value]}
              </button>
            ))}
          </div>

          {total > 0 && (
            <div className="mt-4 flex items-center gap-3">
              <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-100">
                <div className="h-full rounded-full bg-brand transition-[width] duration-300" style={{ width: `${(done / total) * 100}%` }} />
              </div>
              <span className="text-sm text-ink-3">
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
            {wantsReminders && !o.deadline && (
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
            {calendar && wantsReminders && (
              <a href={calendar} target="_blank" rel="noreferrer" className="app-link">
                <CalendarPlus className="size-4" aria-hidden="true" />
                Add to Google Calendar
              </a>
            )}
            {ics && wantsReminders && (
              <a href={`data:text/calendar;charset=utf-8,${encodeURIComponent(ics)}`} download={`${o.id}.ics`} className="app-link">
                <Download className="size-4" aria-hidden="true" />
                .ics file
              </a>
            )}
          </div>
        </div>
      </div>

      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
        className="flex w-full items-center justify-between border-t border-line px-5 py-3 text-sm font-semibold text-ink-2 hover:bg-slate-50"
      >
        {open ? 'Close' : 'Work on this application'}
        <ChevronDown className={`size-4 transition-transform ${open ? 'rotate-180' : ''}`} aria-hidden="true" />
      </button>

      {open && (
        <div className="grid gap-6 border-t border-line bg-slate-50/60 p-5 lg:grid-cols-[1fr_260px]">
          <div className="space-y-4">
            <h3 className="font-semibold tracking-tight">Questions</h3>
            {info?.requiresLogin && (
              <p className="flex gap-2 rounded-xl bg-white p-3 text-sm leading-relaxed text-ink-2">
                <Lock className="mt-0.5 size-4 shrink-0 text-ink-3" aria-hidden="true" />
                The questions are behind a sign-in on the organizer's site, so the agents could not read them. Sign in there to see them.
              </p>
            )}
            {info && info.prompts.length === 0 && !info.requiresLogin && (
              <p className="text-sm text-ink-2">This one has no written questions.</p>
            )}
            {info?.prompts.map((prompt, index) => (
              <label key={prompt} className="block">
                <span className="text-sm leading-relaxed font-medium">{prompt}</span>
                <textarea
                  value={application.drafts[index] ?? ''}
                  onChange={(event) => dispatch({ type: 'setDraft', id: o.id, index, text: event.target.value })}
                  rows={4}
                  placeholder="Draft your answer here. It is saved as you type."
                  className="mt-2 block w-full rounded-xl border border-line bg-white p-3 text-[15px] leading-relaxed outline-none focus:border-brand focus:ring-3 focus:ring-brand/15"
                />
              </label>
            ))}
          </div>
          <div>
            <h3 className="font-semibold tracking-tight">What to gather</h3>
            <ul className="mt-3 space-y-1">
              {info?.materials.map((name) => (
                <li key={name}>
                  <label className="flex min-h-9 cursor-pointer items-center gap-2.5 text-sm text-ink-2">
                    <input
                      type="checkbox"
                      checked={application.materialsDone.includes(name)}
                      onChange={() => dispatch({ type: 'toggleMaterial', id: o.id, name })}
                      className="size-4 accent-[var(--color-brand)]"
                    />
                    {name}
                  </label>
                </li>
              ))}
            </ul>
            <a
              href={o.actionUrl ?? o.sourceUrl}
              target="_blank"
              rel="noreferrer"
              onClick={() => dispatch({ type: 'opened', id: o.id })}
              className="btn-primary mt-4 inline-flex h-10 items-center gap-1.5 rounded-xl px-4 text-sm text-white"
            >
              Open the official application
              <ArrowUpRight className="size-4" aria-hidden="true" />
            </a>
            <p className="mt-2 text-xs leading-relaxed text-ink-3">You submit on the organizer's own page. Mark it Applied here once it is sent.</p>
            <button
              type="button"
              onClick={() => dispatch({ type: 'setApplication', id: o.id, status: null })}
              className="mt-4 text-sm font-medium text-ink-3 hover:text-ink"
            >
              Stop tracking
            </button>
          </div>
        </div>
      )}
    </Card>
  );
}

export function Applications() {
  const { state, dispatch } = useStore();
  const [filter, setFilter] = useState<ApplicationStatus | 'all'>('all');
  const opportunities = useOpportunities();
  const tracked = opportunities
    .filter((o) => state.applications[o.id])
    .sort((a, b) => (a.deadline ? daysUntil(a.deadline) : Infinity) - (b.deadline ? daysUntil(b.deadline) : Infinity));
  const shown = tracked.filter((o) => filter === 'all' || state.applications[o.id]!.status === filter);
  const untracked = opportunities.filter(
    (o) => (state.saved.includes(o.id) || state.liked.includes(o.id)) && !state.applications[o.id] && !state.dismissed.includes(o.id),
  );

  return (
    <Page title="Applications" subtitle="Everything you are applying to: where each one stands, what it needs and when it is due.">
      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {STATUSES.map((value) => {
          const count = tracked.filter((o) => state.applications[o.id]!.status === value).length;
          return (
            <button
              key={value}
              type="button"
              aria-pressed={filter === value}
              onClick={() => setFilter(filter === value ? 'all' : value)}
              className="app-tile"
            >
              <span className="font-display text-4xl leading-none">{count}</span>
              <span className="mt-1.5 text-sm">{statusLabel[value]}</span>
            </button>
          );
        })}
      </div>

      {tracked.length === 0 ? (
        <Card className="p-10 text-center">
          <p className="text-lg font-semibold">Nothing tracked yet</p>
          <p className="mx-auto mt-2 max-w-sm text-sm leading-relaxed text-ink-2">
            Open a card's details in the feed and set a status, or start from an Apply step on your roadmap.
          </p>
          <Link to="/" className="btn-primary mt-6 inline-flex h-10 items-center rounded-xl px-4 text-sm text-white">
            Go to the feed
          </Link>
        </Card>
      ) : shown.length === 0 ? (
        <Card className="p-8 text-center text-sm text-ink-2">Nothing is marked {statusLabel[filter as ApplicationStatus]} right now.</Card>
      ) : (
        <div className="space-y-4">
          {shown.map((o) => (
            <Row key={o.id} opportunity={o} application={state.applications[o.id]!} />
          ))}
        </div>
      )}

      {untracked.length > 0 && (
        <section className="mt-8">
          <h2 className="text-lg font-semibold tracking-tight">Saved or liked, not tracked yet</h2>
          <ul className="mt-3 grid gap-3 sm:grid-cols-2">
            {untracked.map((o) => (
              <li key={o.id}>
                <Card className="flex items-center gap-3 p-4">
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">{o.title}</p>
                    <p className="text-sm text-ink-3">{o.deadline ? dueLabel(o.deadline) : o.organizer}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => dispatch({ type: 'setApplication', id: o.id, status: 'interested' })}
                    className="flex h-9 shrink-0 items-center gap-1.5 rounded-xl border border-line px-3 text-sm font-semibold text-brand hover:border-brand"
                  >
                    <Plus className="size-4" aria-hidden="true" />
                    Track
                  </button>
                </Card>
              </li>
            ))}
          </ul>
        </section>
      )}
    </Page>
  );
}
