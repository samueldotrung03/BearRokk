// The top of the Today page: the brief sentence, then up to three things to do today, each with
// its reason and one button that does it or goes there. A brand-new student gets a calm start
// screen that points to the feed and to career discovery instead of an empty list.
import { ArrowRight, Check, Compass, Newspaper, Sparkles } from 'lucide-react';
import { Link } from 'react-router';
import { dueText, type TodayAction, type TodayCta } from '../../lib/today/today.ts';
import { Card } from '../Page.tsx';

/** A short line under the list after a one-click action, with a way to take it back. */
export interface Undoable {
  text: string;
  undo: () => void;
}

function dueTone(action: TodayAction): 'late' | 'soon' | 'none' | undefined {
  if (action.daysLeft === null) return 'none';
  if (action.daysLeft < 0) return 'late';
  if (action.daysLeft <= 2) return 'soon';
  return undefined;
}

function StartLinks() {
  return (
    <div className="td-start">
      <Link to="/">
        <span className="td-start-icon">
          <Newspaper className="size-[18px]" aria-hidden="true" />
        </span>
        <span className="min-w-0">
          <span className="block text-sm font-semibold text-ink">Open your feed</span>
          <span className="block text-sm text-ink-3">Save what looks good and it shows up here.</span>
        </span>
      </Link>
      <Link to="/discover">
        <span className="td-start-icon">
          <Compass className="size-[18px]" aria-hidden="true" />
        </span>
        <span className="min-w-0">
          <span className="block text-sm font-semibold text-ink">Find a career to aim for</span>
          <span className="block text-sm text-ink-3">Your roadmap is built from the goal you pick.</span>
        </span>
      </Link>
    </div>
  );
}

export function DoToday({
  brief,
  actions,
  fresh,
  status,
  onAct,
}: {
  brief: string;
  actions: TodayAction[];
  fresh: boolean;
  status: Undoable | null;
  onAct: (action: TodayAction) => void;
}) {
  const ctaClass = (index: number) => `td-btn ${index === 0 ? 'btn-primary td-btn-primary' : 'td-btn-quiet'}`;
  const icon = (cta: TodayCta) => (cta.kind === 'tick' ? <Check className="size-4" strokeWidth={2.5} aria-hidden="true" /> : <ArrowRight className="size-4" aria-hidden="true" />);

  return (
    <Card className="td-do td-hero p-6">
      <div className="td-hero-glow" aria-hidden="true" />
      <div className="relative">
        <span className="td-ai-chip">
          <Sparkles className="size-3.5" aria-hidden="true" />
          Today's brief
        </span>
        <p className="td-brief">{brief}</p>

        <div className="mt-6 flex items-baseline justify-between gap-3">
          <h2 className="td-section-title">Do today</h2>
          {actions.length > 0 && <span className="td-count">Most urgent first</span>}
        </div>

        {actions.length > 0 ? (
          <ol className="td-actions">
            {actions.map((action, index) => (
              <li key={action.id} className="td-action" data-priority={action.priority} style={{ ['--td-i' as string]: index }}>
                <span className="td-rank" aria-hidden="true">
                  {index + 1}
                </span>
                <div className="min-w-0">
                  <p className="td-action-title">
                    {action.title}
                    {action.subject && <span className="font-medium text-ink-2"> · {action.subject}</span>}
                  </p>
                  <p className="td-action-reason" title={action.reason}>
                    {action.reason}
                  </p>
                  <p className="td-action-meta">
                    <span className="td-due" data-tone={dueTone(action)}>
                      {dueText(action)}
                    </span>
                    <span>{action.priority === 'must' ? 'You committed to this' : 'Moves you toward your goal'}</span>
                  </p>
                </div>
                {action.cta.kind === 'go' ? (
                  <Link to={action.cta.to} className={`td-action-do ${ctaClass(index)}`}>
                    {icon(action.cta)}
                    {action.cta.label}
                  </Link>
                ) : (
                  <button type="button" className={`td-action-do ${ctaClass(index)}`} onClick={() => onAct(action)}>
                    {icon(action.cta)}
                    {action.cta.label}
                  </button>
                )}
              </li>
            ))}
          </ol>
        ) : (
          <div className="td-empty">
            <p className="font-semibold text-ink">Nothing to do today</p>
            <p className="text-sm text-ink-2">
              {fresh
                ? 'Once you save or track an opportunity, its deadlines and next steps show up here.'
                : 'Nothing you are tracking needs you today. A good moment to look for something new.'}
            </p>
          </div>
        )}

        {status && (
          <p className="mt-3 flex flex-wrap items-center gap-2 text-sm text-ink-2" role="status">
            <Check className="size-4 text-emerald-600" strokeWidth={2.5} aria-hidden="true" />
            {status.text}
            <button type="button" onClick={status.undo} className="font-semibold text-brand hover:underline">
              Undo
            </button>
          </p>
        )}

        {fresh && <StartLinks />}
      </div>
    </Card>
  );
}
