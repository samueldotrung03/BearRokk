// The dashboard's glanceable cards: headline numbers, the week ahead, the application pipeline,
// the roadmap's next steps and what the agents are doing. Each one links to the page that owns it.
import { useMemo } from 'react';
import { careerJourney } from '../../lib/roadmapx/journey.ts';
import { useLocal } from '../../lib/useLocal.ts';
import { useStore } from '../../state/StoreProvider.tsx';
import { ArrowRight, ArrowUpRight, Bookmark, CalendarDays, Check, CircleDashed, ClipboardList, Map as MapIcon, Play, Plus, Radar, Sparkles, Target, UserRound } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router';
import { cxKindLabel } from '../../lib/cal/items.ts';
import type { GoalNeed, Headline, PipelineStage, ProfileCheck, RoadmapGlance, UpcomingItem, WeekDay } from '../../lib/today/dashboard.ts';
import { whenText } from '../../lib/today/dashboard.ts';
import { useLive } from '../../state/live.tsx';
import type { Opportunity } from '../../types.ts';
import { stepMeta } from '../meta.ts';

/** A ring that fills clockwise from the top. */
function Ring({ percent, size = 56, stroke = 6 }: { percent: number; size?: number; stroke?: number }) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  return (
    <svg className="db-ring" width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden="true">
      <defs>
        <linearGradient id="db-ring-fill" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#7c6cff" />
          <stop offset="55%" stopColor="#4aa8ff" />
          <stop offset="100%" stopColor="#37d6a0" />
        </linearGradient>
      </defs>
      <circle className="db-ring-track" cx={size / 2} cy={size / 2} r={r} strokeWidth={stroke} fill="none" />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        strokeWidth={stroke}
        fill="none"
        stroke="url(#db-ring-fill)"
        strokeLinecap="round"
        strokeDasharray={c}
        strokeDashoffset={c * (1 - Math.min(100, Math.max(0, percent)) / 100)}
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
      />
    </svg>
  );
}

export function StatTiles({ headline, week, roadmap, saved, fresh }: { headline: Headline; week: WeekDay[]; roadmap: RoadmapGlance; saved: number; fresh: number }) {
  const peak = Math.max(1, ...week.map((d) => d.must + d.should));
  return (
    <section className="db-stats" aria-label="At a glance">
      <Link to="/calendar" className="db-stat">
        <span className="db-stat-label">
          <CalendarDays aria-hidden="true" /> Due this week
        </span>
        <span className="db-stat-row">
          <strong className="db-num">{headline.dueThisWeek}</strong>
          <span className="db-bars" aria-hidden="true">
            {week.map((d) => (
              <i key={d.day} className={d.must > 0 ? 'is-must' : d.should > 0 ? 'is-should' : ''} style={{ height: `${18 + ((d.must + d.should) / peak) * 82}%` }} />
            ))}
          </span>
        </span>
        <span className={`db-stat-note ${headline.overdue > 0 ? 'is-warn' : ''}`}>
          {headline.overdue > 0 ? `${headline.overdue} overdue` : headline.dueToday > 0 ? `${headline.dueToday} today` : 'Nothing due today'}
        </span>
      </Link>

      <Link to="/applications" className="db-stat">
        <span className="db-stat-label">
          <ClipboardList aria-hidden="true" /> Applications
        </span>
        <span className="db-stat-row">
          <strong className="db-num">{headline.inProgress}</strong>
          <span className="db-stat-unit">in progress</span>
        </span>
        <span className="db-stat-note">{headline.tracked === 0 ? 'None tracked yet' : `${headline.applied} sent of ${headline.tracked} tracked`}</span>
      </Link>

      <Link to="/roadmap" className="db-stat">
        <span className="db-stat-label">
          <MapIcon aria-hidden="true" /> Roadmap
        </span>
        <span className="db-stat-row">
          <strong className="db-num">
            {roadmap.percent}
            <small>%</small>
          </strong>
          <Ring percent={roadmap.percent} size={44} stroke={5} />
        </span>
        <span className="db-stat-note">
          {roadmap.done} of {roadmap.total} steps done
        </span>
      </Link>

      <Link to="/saved" className="db-stat">
        <span className="db-stat-label">
          <Bookmark aria-hidden="true" /> Saved
        </span>
        <span className="db-stat-row">
          <strong className="db-num">{saved}</strong>
          <span className="db-stat-unit">kept for later</span>
        </span>
        <span className="db-stat-note">{fresh > 0 ? `${fresh} new in your feed` : 'Your feed is all caught up'}</span>
      </Link>
    </section>
  );
}

export function WeekCard({
  week,
  upcoming,
  onOpen,
  onTick,
  onTickOwn,
  onAdd,
}: {
  week: WeekDay[];
  upcoming: UpcomingItem[];
  onOpen: (opportunityId: string) => void;
  onTick: (stepId: string) => void;
  /** Finishes a reminder the student added themselves. */
  onTickOwn: (personalId: string) => void;
  /** Adds a reminder on a day (YYYY-MM-DD). */
  onAdd: (title: string, day: string) => void;
}) {
  const [picked, setPicked] = useState<string | null>(null);
  const [text, setText] = useState('');
  const addDay = picked ?? week[0]!.day;
  const addOn = week.find((d) => d.day === addDay)!;
  const day = week.find((d) => d.day === picked);
  const rows: UpcomingItem[] = day ? day.items.filter((item) => !item.done).map((item) => ({ item, daysAway: week.indexOf(day) })) : upcoming;
  return (
    <section className="db-card db-week">
      <header className="db-head">
        <h2>This week</h2>
        <Link to="/calendar">
          Calendar <ArrowRight aria-hidden="true" />
        </Link>
      </header>
      <div className="db-days" role="group" aria-label="The next seven days">
        {week.map((d) => (
          <button
            key={d.day}
            type="button"
            className={`db-day ${d.isToday ? 'is-today' : ''} ${picked === d.day ? 'is-picked' : ''}`}
            aria-pressed={picked === d.day}
            aria-label={`${d.weekday} ${d.date}: ${d.must + d.should} open`}
            onClick={() => setPicked(picked === d.day ? null : d.day)}
          >
            <span>{d.isToday ? 'Today' : d.weekday}</span>
            <strong>{d.date}</strong>
            <span className="db-dots" aria-hidden="true">
              {Array.from({ length: Math.min(3, d.must) }, (_, i) => (
                <i key={`m${i}`} className="is-must" />
              ))}
              {Array.from({ length: Math.min(3 - Math.min(3, d.must), d.should) }, (_, i) => (
                <i key={`s${i}`} />
              ))}
            </span>
          </button>
        ))}
      </div>
      <form
        className="db-add"
        onSubmit={(event) => {
          event.preventDefault();
          if (!text.trim()) return;
          onAdd(text, addDay);
          setText('');
        }}
      >
        <Plus aria-hidden="true" />
        <input
          value={text}
          onChange={(event) => setText(event.target.value)}
          placeholder={`Add a reminder for ${addOn.isToday ? 'today' : `${addOn.weekday} ${addOn.date}`}`}
          aria-label={`Add a reminder for ${addOn.isToday ? 'today' : `${addOn.weekday} ${addOn.date}`}`}
          maxLength={120}
        />
        <button type="submit" disabled={!text.trim()}>
          Add
        </button>
      </form>
      <h3 className="db-sub">{day ? (day.isToday ? 'Today' : `${day.weekday} ${day.date}`) : 'Coming up'}</h3>
      {rows.length > 0 ? (
        <ul className="db-agenda">
          {rows.map(({ item, daysAway }) => (
            <li key={item.id} className={item.priority === 'must' ? 'is-must' : ''}>
              {item.stepId || item.personalId ? (
                <button type="button" className="db-tick" aria-label={`Mark done: ${item.title}`} onClick={() => (item.stepId ? onTick(item.stepId) : onTickOwn(item.personalId!))}>
                  <Check aria-hidden="true" />
                </button>
              ) : (
                <span className="db-mark" aria-hidden="true" />
              )}
              <div className="min-w-0 flex-1">
                {item.opportunityId ? (
                  <button type="button" className="db-agenda-title" onClick={() => onOpen(item.opportunityId!)}>
                    {item.title}
                  </button>
                ) : (
                  <p className="db-agenda-title">{item.title}</p>
                )}
                <p className="db-agenda-meta">
                  {cxKindLabel[item.kind]}
                  {item.priority === 'must' ? ' · You committed to this' : ''}
                </p>
              </div>
              <span className={`db-when ${daysAway < 0 ? 'is-late' : daysAway <= 1 ? 'is-soon' : ''}`}>{whenText(daysAway)}</span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="db-empty">{day ? 'Nothing on this day.' : 'Nothing is coming up. Track an opportunity and its dates appear here.'}</p>
      )}
    </section>
  );
}

export function PipelineCard({ stages, onOpen }: { stages: PipelineStage[]; onOpen: (o: Opportunity) => void }) {
  const total = stages.reduce((sum, stage) => sum + stage.count, 0);
  return (
    <section className="db-card db-pipeline">
      <header className="db-head">
        <h2>Applications</h2>
        <Link to="/applications">
          Open the manager <ArrowRight aria-hidden="true" />
        </Link>
      </header>
      {total === 0 ? (
        <p className="db-empty">
          Nothing tracked yet. On any card, choose a status such as Interested or To apply, and it shows up here with its deadline and what is left to do.
        </p>
      ) : (
        <>
          <div className="db-flow" aria-hidden="true">
            {stages.map((stage) => (
              <i key={stage.status} className={`is-${stage.status}`} style={{ flexGrow: Math.max(stage.count, 0.35) }} />
            ))}
          </div>
          <div className="db-stages">
            {stages.map((stage) => (
              <div key={stage.status} className="db-stage">
                <p className="db-stage-head">
                  <i className={`is-${stage.status}`} aria-hidden="true" />
                  {stage.label}
                  <strong>{stage.count}</strong>
                </p>
                {stage.items.map(({ opportunity: o, readiness, daysLeft, next }) => (
                  <button key={o.id} type="button" className="db-app" onClick={() => onOpen(o)}>
                    <span className="db-app-title">{o.title}</span>
                    <span className="db-app-org">{o.organizer}</span>
                    <span className="db-meter" role="img" aria-label={`${readiness} percent ready`}>
                      <i style={{ width: `${readiness}%` }} />
                    </span>
                    <span className="db-app-foot">
                      <span>{next}</span>
                      {daysLeft !== null && <span className={daysLeft <= 3 ? 'is-soon' : ''}>{daysLeft < 0 ? 'Closed' : daysLeft === 0 ? 'Today' : `${daysLeft}d`}</span>}
                    </span>
                  </button>
                ))}
                {stage.count > stage.items.length && (
                  <Link to="/applications" className="db-more">
                    {stage.count - stage.items.length} more
                  </Link>
                )}
                {stage.count === 0 && <p className="db-stage-empty">None</p>}
              </div>
            ))}
          </div>
        </>
      )}
    </section>
  );
}

export function RoadmapCard({ roadmap, onTick }: { roadmap: RoadmapGlance; onTick: (stepId: string) => void }) {
  // What the student put on their own path on the roadmap page comes first; the roadmap has no set order.
  const { state } = useStore();
  const [picked] = useLocal<string[]>('bearrok.roadmap.picked', []);
  const mine = useMemo(() => (picked.length ? careerJourney(state).steps.filter((step) => picked.includes(step.id) && !step.done).slice(0, 4) : []), [state, picked]);
  const steps = mine.length > 0 ? mine : roadmap.next;
  return (
    <section className="db-card db-roadmap">
      <header className="db-head">
        <h2>Roadmap</h2>
        <Link to="/roadmap">
          Open <ArrowRight aria-hidden="true" />
        </Link>
      </header>
      <div className="db-goal">
        <div className="db-goal-ring">
          <Ring percent={roadmap.percent} size={68} stroke={7} />
          <strong>{roadmap.percent}%</strong>
        </div>
        <div className="min-w-0">
          <p className="db-goal-label">Your goal</p>
          <p className="db-goal-name">{roadmap.goal}</p>
          <p className="db-goal-note">
            {roadmap.done} of {roadmap.total} steps done
          </p>
        </div>
      </div>
      <h3 className="db-sub">{mine.length > 0 ? 'On my path' : 'Options most people took'}</h3>
      {steps.length > 0 ? (
        <ul className="db-steps">
          {steps.map((step) => {
            const Icon = stepMeta[step.kind].icon;
            return (
              <li key={step.id}>
                <button type="button" className="db-tick" aria-label={`Mark done: ${step.title}`} onClick={() => onTick(step.id)}>
                  <Check aria-hidden="true" />
                </button>
                <div className="min-w-0 flex-1">
                  <p className="db-step-title">{step.title}</p>
                  <p className="db-step-kind">
                    <Icon aria-hidden="true" /> {stepMeta[step.kind].label}
                  </p>
                </div>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="db-empty">Everything here is done. Open the roadmap to pick more, or explore another career.</p>
      )}
    </section>
  );
}

const providerWords = { grok: 'Running on Grok', claude: 'Test run on Claude', simulated: 'Simulated agents' } as const;

export function AgentsCard({ inFeed }: { inFeed: number }) {
  const live = useLive();
  const [busy, setBusy] = useState(false);
  const connected = live.status === 'connected';
  const run = live.agents;
  const state = live.searching ? 'Searching now' : !connected ? (live.sample ? 'Sample mode: no agents behind this copy' : 'Backend not connected') : run ? 'Latest search finished' : 'Waiting for the first search';
  return (
    <section className="db-card db-agents">
      <header className="db-head">
        <h2>
          <Radar aria-hidden="true" /> Your agents
        </h2>
        <Link to="/agents">
          Watch <ArrowRight aria-hidden="true" />
        </Link>
      </header>
      <p className="db-agent-state">
        <i className={live.searching ? 'is-live' : connected ? 'is-on' : ''} aria-hidden="true" />
        {state}
      </p>
      <p className="db-agent-note">{connected ? (run?.summary ?? providerWords[live.provider]) : 'The cards you see are sample data until the agent backend is running.'}</p>
      <dl className="db-agent-stats">
        <div>
          <dt>In your feed</dt>
          <dd>{inFeed}</dd>
        </div>
        <div>
          <dt>Worker jobs</dt>
          <dd>{run ? run.workers.length : '–'}</dd>
        </div>
        <div>
          <dt>Checked</dt>
          <dd>{run ? run.validators.length : '–'}</dd>
        </div>
      </dl>
      {connected && (
        <button
          type="button"
          className="db-run"
          disabled={busy || live.searching}
          onClick={() => {
            setBusy(true);
            void live.runNow().finally(() => setBusy(false));
          }}
        >
          <Play aria-hidden="true" /> {live.searching ? 'Searching…' : 'Search again now'}
        </button>
      )}
      {connected && <p className="db-agent-foot">{providerWords[live.provider]}</p>}
    </section>
  );
}

export function NeedsCard({ met, total, needs }: { met: number; total: number; needs: GoalNeed[] }) {
  return (
    <section className="db-card db-needs">
      <header className="db-head">
        <h2>
          <Target aria-hidden="true" /> What your goal asks for
        </h2>
        <Link to="/roadmap">
          {met} of {total} <ArrowRight aria-hidden="true" />
        </Link>
      </header>
      <span className="db-meter db-meter-lg" role="img" aria-label={`${met} of ${total} met`}>
        <i style={{ width: `${total ? (met / total) * 100 : 0}%` }} />
      </span>
      <ul className="db-checks">
        {needs.map((need) => (
          <li key={need.id} className={need.met ? 'is-done' : ''}>
            {need.met ? <Check aria-hidden="true" /> : <CircleDashed aria-hidden="true" />}
            <div className="min-w-0">
              <p>{need.label}</p>
              <span>{need.how}</span>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}

export function ProfileCard({ percent, checks }: { percent: number; checks: ProfileCheck[] }) {
  const missing = checks.filter((check) => !check.done);
  return (
    <section className="db-card db-profile">
      <header className="db-head">
        <h2>
          <UserRound aria-hidden="true" /> Profile strength
        </h2>
        <Link to="/profile">
          Edit <ArrowRight aria-hidden="true" />
        </Link>
      </header>
      <div className="db-goal">
        <div className="db-goal-ring">
          <Ring percent={percent} size={68} stroke={7} />
          <strong>{percent}%</strong>
        </div>
        <p className="db-profile-note">
          {missing.length === 0 ? 'Your agents have everything the profile asks for.' : 'The more your agents know, the better they match. Still missing:'}
        </p>
      </div>
      <ul className="db-checks">
        {checks.slice(0, 6).map((check) => (
          <li key={check.id} className={check.done ? 'is-done' : ''}>
            {check.done ? <Check aria-hidden="true" /> : <CircleDashed aria-hidden="true" />}
            <div className="min-w-0">
              <p>{check.label}</p>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}

/** Shortcuts under the greeting: the things a student reaches for most. */
export function QuickActions() {
  return (
    <div className="db-quick">
      <button type="button" onClick={() => window.dispatchEvent(new Event('bearrok:spotlight'))}>
        <Sparkles aria-hidden="true" /> Search everything
      </button>
      <Link to="/calendar">
        <CalendarDays aria-hidden="true" /> Add a reminder
      </Link>
      <Link to="/">
        <ArrowUpRight aria-hidden="true" /> Open the feed
      </Link>
    </div>
  );
}

