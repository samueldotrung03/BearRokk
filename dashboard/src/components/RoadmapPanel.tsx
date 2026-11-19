// The roadmap beside the feed: progress, a coaching line, the one step to do next, and the
// opportunities in the feed that would move the roadmap forward. Steps can be ticked and cards
// opened or saved from here, so the student never has to leave the feed to act on the plan.
import { ArrowRight, Bookmark, BookmarkCheck, Check, Sparkles } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router';
import { planFor } from '../lib/roadmap.ts';
import { coachLine, opportunitiesForRoadmap } from '../lib/roadmapMatch.ts';
import { daysUntil, dueLabel, shortDate } from '../lib/time.ts';
import { useOpportunities } from '../state/live.tsx';
import { rankFeed } from '../state/ranking.ts';
import { useStore } from '../state/StoreProvider.tsx';
import type { Opportunity } from '../types.ts';
import { askAssistant } from './Assistant.tsx';
import { typeMeta } from './meta.ts';
import { Details } from './OpportunityCard.tsx';

const RADIUS = 34;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;
const QUESTIONS = ['What should I do this week?', 'Am I on track?', 'What are my deadlines?'];

export function RoadmapPanel({ highlight }: { highlight?: (opportunityId: string | null) => void }) {
  const { state, dispatch } = useStore();
  const [details, setDetails] = useState<Opportunity | null>(null);
  // What the agents found, not the sample set.
  const opportunities = useOpportunities();
  const plan = planFor(state, opportunities);
  const { roadmap, steps, doneCount, percent, next } = plan;
  const matches = opportunitiesForRoadmap(plan, state, rankFeed(opportunities, state), 9);
  const nextCard = next?.opportunityId ? opportunities.find((o) => o.id === next.opportunityId && !state.dismissed.includes(o.id)) : undefined;

  return (
    <aside className="feed-roadmap glass" aria-label="Your roadmap">
      <div className="flex items-center gap-4">
        <svg viewBox="0 0 80 80" className="size-[68px] shrink-0 -rotate-90" role="img" aria-label={`Roadmap ${percent}% done`}>
          <circle cx="40" cy="40" r={RADIUS} fill="none" stroke="rgb(21 43 67 / 0.1)" strokeWidth="7" />
          <circle
            cx="40"
            cy="40"
            r={RADIUS}
            fill="none"
            stroke="var(--color-brand)"
            strokeWidth="7"
            strokeLinecap="round"
            strokeDasharray={CIRCUMFERENCE}
            strokeDashoffset={CIRCUMFERENCE * (1 - percent / 100)}
            className="transition-[stroke-dashoffset] duration-700"
          />
          <text x="40" y="40" className="rotate-90" style={{ transformOrigin: '40px 40px' }} textAnchor="middle" dominantBaseline="central" fontSize="19" fontWeight="700" fill="var(--color-ink)">
            {percent}%
          </text>
        </svg>
        <div className="min-w-0">
          <p className="text-xs font-semibold tracking-wide text-ink-3 uppercase">Your roadmap</p>
          <p className="mt-0.5 line-clamp-2 leading-snug font-semibold">{roadmap.goal}</p>
          <p className="mt-0.5 text-sm text-ink-3">
            {doneCount} of {steps.length} steps done
          </p>
        </div>
      </div>

      <div className="feed-coach">
        <p className="flex items-center gap-1.5 text-xs font-semibold text-brand">
          <Sparkles className="size-3.5" aria-hidden="true" />
          Your coach
        </p>
        <p className="mt-1 text-sm leading-snug text-ink">{coachLine(plan)}</p>
        <div className="feed-coach-chips">
          {QUESTIONS.map((question) => (
            <button key={question} type="button" onClick={() => askAssistant(question)}>
              {question}
            </button>
          ))}
        </div>
      </div>

      {next && (
        <div className="feed-roadmap-next" onPointerEnter={() => highlight?.(next.opportunityId)} onPointerLeave={() => highlight?.(null)}>
          <p className="text-xs font-semibold text-brand">Do this next</p>
          <div className="mt-1.5 flex gap-3">
            <button
              type="button"
              role="checkbox"
              aria-checked={false}
              aria-label={`Mark "${next.title}" as done`}
              onClick={() => dispatch({ type: 'toggleStep', id: next.id })}
              className="mt-0.5 grid size-6 shrink-0 place-items-center rounded-full border-2 border-brand/50 bg-white text-transparent transition hover:border-brand hover:text-brand"
            >
              <Check className="size-3.5" strokeWidth={3} aria-hidden="true" />
            </button>
            <div className="min-w-0">
              <p className="leading-snug font-semibold">{next.title}</p>
              {next.due && (
                <p className={`mt-0.5 text-sm ${daysUntil(next.due) <= 7 ? 'font-semibold text-orange-700' : 'text-ink-3'}`}>{dueLabel(next.due)}</p>
              )}
              {nextCard && (
                <button type="button" onClick={() => setDetails(nextCard)} className="mt-1.5 flex items-center gap-1 text-sm font-semibold text-brand">
                  Do it with {nextCard.organizer}
                  <ArrowRight className="size-3.5" aria-hidden="true" />
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {matches.length > 0 && (
        <section>
          <h3 className="flex items-baseline justify-between text-sm font-semibold">
            Opportunities for your roadmap
            <span className="text-xs font-medium text-ink-3">{matches.length} matched</span>
          </h3>
          <ul className="feed-roadmap-matches">
            {matches.map(({ opportunity: o, reason, linked }) => {
              const saved = state.saved.includes(o.id);
              const Icon = typeMeta[o.type].icon;
              const when = o.deadline ? dueLabel(o.deadline) : o.startTime ? `Starts ${shortDate(o.startTime)}` : typeMeta[o.type].label;
              return (
                <li key={o.id} onPointerEnter={() => highlight?.(o.id)} onPointerLeave={() => highlight?.(null)}>
                  <button type="button" className="feed-match" onClick={() => setDetails(o)}>
                    <span className="feed-match-thumb">
                      {o.image ? <img src={o.image} alt="" loading="lazy" /> : <Icon className="size-4" aria-hidden="true" />}
                    </span>
                    <span className="min-w-0 flex-1 text-left">
                      <span className="block truncate text-sm font-semibold">{o.title}</span>
                      <span className="block truncate text-xs text-ink-2">{reason}</span>
                      <span className="mt-0.5 flex items-center gap-1.5 text-xs text-ink-3">
                        {linked && <span className="feed-match-tag">On your roadmap</span>}
                        {when}
                      </span>
                    </span>
                  </button>
                  <button
                    type="button"
                    className="feed-match-save"
                    aria-pressed={saved}
                    aria-label={saved ? `Remove ${o.title} from saved` : `Save ${o.title}`}
                    onClick={() => dispatch({ type: 'toggleSaved', id: o.id })}
                  >
                    {saved ? <BookmarkCheck className="size-4" aria-hidden="true" /> : <Bookmark className="size-4" aria-hidden="true" />}
                  </button>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      <Link to="/roadmap" className="feed-roadmap-link shrink-0">
        Open the full roadmap
        <ArrowRight className="size-4" aria-hidden="true" />
      </Link>
      {details && <Details opportunity={details} onClose={() => setDetails(null)} />}
    </aside>
  );
}
