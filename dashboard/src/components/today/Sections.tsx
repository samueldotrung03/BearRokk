// The smaller sections of the Today page: deadlines closing this week, new cards for the student,
// a progress strip that links to each page, and questions for the assistant.
import { ArrowRight, Bookmark, ClipboardList, MessageCircle, Route } from 'lucide-react';
import { Link } from 'react-router';
import { shortDate } from '../../lib/time.ts';
import type { ClosingItem, NewItem, ProgressSummary } from '../../lib/today/today.ts';
import type { Opportunity } from '../../types.ts';
import { askAssistant } from '../Assistant.tsx';
import { typeMeta } from '../meta.ts';
import { Card } from '../Page.tsx';

export function ClosingThisWeek({ items, onOpen }: { items: ClosingItem[]; onOpen: (o: Opportunity) => void }) {
  return (
    <Card className="td-closing p-5">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="td-section-title">Closing this week</h2>
        <Link to="/calendar" className="text-sm font-medium text-brand">
          Calendar
        </Link>
      </div>
      {items.length > 0 ? (
        <ul className="td-closing-list">
          {items.map(({ opportunity: o, daysLeft, mine, label }) => (
            <li key={o.id}>
              <button type="button" className="td-closing-row" onClick={() => onOpen(o)}>
                <span className="td-days" data-tone={daysLeft <= 2 ? 'soon' : undefined} aria-hidden="true">
                  {daysLeft === 0 ? (
                    <small className="mt-0! text-[12px]!">Today</small>
                  ) : (
                    <>
                      <b>{daysLeft}</b>
                      <small>{daysLeft === 1 ? 'day' : 'days'}</small>
                    </>
                  )}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold text-ink">{o.title}</span>
                  <span className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-ink-3">
                    <span className="td-tag" data-mine={mine}>
                      {label}
                    </span>
                    <span className="sr-only">
                      {daysLeft === 0 ? 'Closes today' : `${daysLeft} ${daysLeft === 1 ? 'day' : 'days'} left`},
                    </span>
                    Closes {daysLeft === 0 ? 'today' : shortDate(o.deadline!)}
                  </span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-3 text-sm text-ink-3">Nothing closes in the next 7 days.</p>
      )}
    </Card>
  );
}

export function NewForYou({ items, onOpen }: { items: NewItem[]; onOpen: (o: Opportunity) => void }) {
  return (
    <Card className="td-new p-5">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="td-section-title">New for you</h2>
        <Link to="/" className="flex items-center gap-1 text-sm font-medium text-brand">
          Open the feed
          <ArrowRight className="size-3.5" aria-hidden="true" />
        </Link>
      </div>
      {items.length > 0 ? (
        <div className="td-new-list">
          <ul className="td-new-grid">
            {items.map(({ opportunity: o, signal }) => {
              const meta = typeMeta[o.type];
              const Icon = meta.icon;
              return (
                <li key={o.id} className="min-w-0">
                  <button type="button" className="td-tile" onClick={() => onOpen(o)}>
                    <span className="td-thumb">
                      {o.image ? <img src={o.image} alt="" loading="lazy" /> : <Icon className="size-5 text-brand" aria-hidden="true" />}
                    </span>
                    <span className="td-tile-body">
                      <span className="flex flex-wrap items-center gap-1.5">
                        <span className={`rounded-full px-2 py-0.5 text-[11.5px] font-semibold ${meta.tint}`}>{meta.label}</span>
                      </span>
                      <span className="td-tile-title">{o.title}</span>
                      <span className="td-signal">{signal}</span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      ) : (
        <p className="mt-3 text-sm text-ink-3">You have looked at everything new. Your agents will bring more.</p>
      )}
    </Card>
  );
}

export function ProgressStrip({ progress }: { progress: ProgressSummary }) {
  const apps = progress.applications.map((a) => `${a.count} ${a.label.toLowerCase()}`).join(', ');
  return (
    <Card className="td-progress p-5">
      <h2 className="td-section-title">Your progress</h2>
      <div className="td-stats">
        <Link to="/roadmap" className="td-stat">
          <Route className="size-[18px] shrink-0 text-brand" aria-hidden="true" />
          <span className="min-w-0 flex-1">
            <span className="flex items-baseline justify-between gap-2 text-sm">
              <span className="font-semibold text-ink">Roadmap</span>
              <span className="font-semibold text-ink">{progress.percent}%</span>
            </span>
            <span className="td-meter" role="progressbar" aria-valuenow={progress.percent} aria-valuemin={0} aria-valuemax={100} aria-label="Roadmap done">
              <span style={{ width: `${progress.percent}%` }} />
            </span>
            <span className="mt-1 block text-xs text-ink-3">
              {progress.doneSteps} of {progress.totalSteps} steps done
            </span>
          </span>
        </Link>
        <Link to="/applications" className="td-stat">
          <ClipboardList className="size-[18px] shrink-0 text-brand" aria-hidden="true" />
          <span className="min-w-0 flex-1">
            <span className="flex items-baseline justify-between gap-2 text-sm">
              <span className="font-semibold text-ink">Applications</span>
              <span className="font-semibold text-ink">{progress.tracked}</span>
            </span>
            <span className="block truncate text-xs text-ink-3">{apps || 'None tracked yet'}</span>
          </span>
        </Link>
        <Link to="/saved" className="td-stat">
          <Bookmark className="size-[18px] shrink-0 text-brand" aria-hidden="true" />
          <span className="flex min-w-0 flex-1 items-baseline justify-between gap-2 text-sm">
            <span className="font-semibold text-ink">Saved</span>
            <span className="font-semibold text-ink">{progress.saved}</span>
          </span>
        </Link>
      </div>
    </Card>
  );
}

export function AskChips({ questions }: { questions: string[] }) {
  return (
    <Card className="td-ask p-5">
      <h2 className="td-section-title flex items-center gap-2">
        <MessageCircle className="size-4 text-brand" aria-hidden="true" />
        Ask BearRok
      </h2>
      <div className="td-chips">
        {questions.map((question) => (
          <button key={question} type="button" onClick={() => askAssistant(question)}>
            {question}
          </button>
        ))}
      </div>
    </Card>
  );
}
