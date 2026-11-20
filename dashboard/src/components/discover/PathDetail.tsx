import { ArrowRight, Bookmark, Check, CircleMinus, CirclePlus, Columns3, Heart, Info, Map as MapIcon, Target } from 'lucide-react';
import type { CSSProperties, ReactNode } from 'react';
import type { ClassYear } from '../../types.ts';
import type { AnswerAction } from '../../lib/discover/ask.ts';
import type { PathInsight } from '../../lib/discover/insight.ts';
import type { PathMatch } from '../../lib/discover/match.ts';
import { typeMeta } from '../meta.ts';
import { LevelPill, PathMark, Percent } from './PathMark.tsx';

interface PathDetailProps {
  insight: PathInsight;
  match: PathMatch;
  hue: string;
  isGoal: boolean;
  inCompare: boolean;
  compareFull: boolean;
  year: ClassYear;
  onAction: (action: AnswerAction) => void;
  onToggleCompare: () => void;
}

const shareSegments = { most: 3, some: 2, little: 1 } as const;
const shareLabel = { most: 'Most of the week', some: 'A fair part', little: 'A smaller slice' } as const;
const stateLabel = { have: 'You have this', planned: 'On the roadmap', missing: 'Not yet' } as const;

function Section({ title, children, aside }: { title: string; children: ReactNode; aside?: ReactNode }) {
  return (
    <section className="dc-section">
      <div className="flex items-baseline justify-between gap-3">
        <h3 className="dc-section-title">{title}</h3>
        {aside}
      </div>
      {children}
    </section>
  );
}

/** Everything about one path: why it fits, the work, the skills, how people got in, and the plan. */
export function PathDetail(props: PathDetailProps) {
  const { insight, match, hue, isGoal, inCompare, compareFull, year, onAction, onToggleCompare } = props;
  const { path, extra, skills, skillsHave, people, opportunities, plan } = insight;
  const maxYear = Math.max(1, ...people.byYear.map((y) => y.count));

  return (
    <article className="dc-detail" style={{ '--dc-hue': hue } as CSSProperties} aria-labelledby="dc-detail-title">
      <header className="dc-detail-head">
        <div className="flex min-w-0 items-start gap-4">
          <PathMark pathId={path.id} hue={hue} size="lg" />
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h2 id="dc-detail-title" className="font-display text-[40px] leading-[1.02] text-ink">
                {path.title}
              </h2>
              <LevelPill match={match} />
            </div>
            <p className="mt-1.5 text-[15px] text-ink-2">{path.oneLine}</p>
          </div>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-2">
          <Percent value={match.percent} className="text-[56px]" />
          <span className="-mt-2 text-xs text-ink-3">match for you</span>
        </div>
      </header>

      <div className="flex flex-wrap items-center gap-2 px-6 pb-5 sm:px-7">
        {isGoal ? (
          <button type="button" onClick={() => onAction({ kind: 'openRoadmap', label: '' })} className="flex h-10 items-center gap-2 rounded-[9px] bg-brand-soft px-4 text-sm font-medium text-brand">
            <Check className="size-4" aria-hidden="true" /> Your current goal · open roadmap
          </button>
        ) : (
          <button type="button" onClick={() => onAction({ kind: 'setGoal', pathId: path.id, label: '' })} className="btn-primary flex h-10 items-center gap-2 px-4 text-sm text-white">
            <Target className="size-4" aria-hidden="true" /> Set as my goal
          </button>
        )}
        {!isGoal && (
          <button type="button" onClick={() => onAction({ kind: 'openRoadmap', label: '' })} className="dc-soft">
            <MapIcon className="size-4" aria-hidden="true" /> Open roadmap
          </button>
        )}
        <button
          type="button"
          onClick={onToggleCompare}
          disabled={compareFull}
          aria-pressed={inCompare}
          className={`dc-soft ${inCompare ? 'is-on' : ''}`}
          title={compareFull ? 'Compare up to 3 paths at once' : undefined}
        >
          <Columns3 className="size-4" aria-hidden="true" /> {inCompare ? 'In compare' : 'Add to compare'}
        </button>
      </div>

      <div className="dc-detail-grid">
        <Section title="Why it fits you">
          <ul className="mt-3 grid gap-2">
            {match.reasons.map((reason) => (
              <li key={reason.text} className="flex gap-2 text-sm leading-snug text-ink-2">
                {reason.tone === 'plus' ? (
                  <CirclePlus className="mt-0.5 size-4 shrink-0 text-emerald-600" aria-label="For" />
                ) : (
                  <CircleMinus className="mt-0.5 size-4 shrink-0 text-amber-600" aria-label="Against" />
                )}
                {reason.text}
              </li>
            ))}
            {match.reasons.length === 0 && <li className="text-sm text-ink-3">Nothing points strongly either way yet.</li>}
          </ul>
          <div className="mt-4 grid gap-2" aria-label="What the match is built from">
            {match.signals.map((signal) => (
              <div key={signal.source} className="dc-signal">
                <span className="truncate">{signal.label}</span>
                <span className="dc-bar" aria-hidden="true">
                  <span style={{ width: `${Math.round(signal.score * 100)}%` }} />
                </span>
                <span className="tabular-nums text-ink-3" title="Share of the match this counts for">
                  {Math.round(signal.weight * 100)}%
                </span>
              </div>
            ))}
            <p className="text-[11px] text-ink-3">Bar: how well it fits. Number: how much it counts.</p>
          </div>
          {match.unknowns.map((unknown) => (
            <p key={unknown} className="mt-2 flex gap-1.5 text-xs leading-relaxed text-ink-3">
              <Info className="mt-px size-3.5 shrink-0" aria-hidden="true" />
              {unknown}
            </p>
          ))}
        </Section>

        <Section title="What the work is">
          {extra ? (
            <>
              <p className="mt-2 text-sm leading-relaxed text-ink-2">{extra.work}</p>
              <ul className="mt-4 grid gap-2.5" aria-label="A typical week">
                {extra.week.map((item) => (
                  <li key={item.activity} className="dc-week">
                    <span className="text-sm text-ink">{item.activity}</span>
                    <span className="dc-segs" role="img" aria-label={shareLabel[item.share]}>
                      {[1, 2, 3].map((n) => (
                        <span key={n} className={n <= shareSegments[item.share] ? 'is-on' : ''} />
                      ))}
                    </span>
                  </li>
                ))}
              </ul>
              <p className="mt-3 rounded-2xl bg-canvas px-3.5 py-2.5 text-[13px] leading-relaxed text-ink-2">
                <span className="font-medium text-ink">Pace. </span>
                {extra.pace}
              </p>
              <p className="mt-2 text-[11px] text-ink-3">A general picture of the role, not a schedule from one team.</p>
            </>
          ) : (
            <p className="mt-2 text-sm text-ink-3">No description of this work yet.</p>
          )}
        </Section>

        <Section
          title="Skills it expects"
          aside={
            <span className="text-xs text-ink-3">
              <span className="font-display text-[22px] text-ink">{skillsHave}</span> of {skills.length} you have
            </span>
          }
        >
          <ul className="mt-3 grid gap-2.5">
            {skills.map(({ skill, state }) => (
              <li key={skill.label} className="dc-skill">
                <div className="flex items-center justify-between gap-2">
                  <span className="truncate text-sm text-ink">{skill.label}</span>
                  <span className={`dc-skill-tag ${skill.importance === 'core' ? 'is-core' : ''}`}>{skill.importance === 'core' ? 'Core' : 'Useful'}</span>
                </div>
                <div className="dc-overlap" aria-label={`${stateLabel[state]}`}>
                  <span className="dc-overlap-expected" style={{ width: skill.importance === 'core' ? '100%' : '62%' }} />
                  <span className={`dc-overlap-you is-${state}`} style={{ width: state === 'have' ? (skill.importance === 'core' ? '100%' : '62%') : state === 'planned' ? '30%' : '0%' }} />
                </div>
                <span className={`text-[11px] ${state === 'have' ? 'text-emerald-700' : 'text-ink-3'}`}>{stateLabel[state]}</span>
              </li>
            ))}
          </ul>
        </Section>

        <Section title="How people got in" aside={<span className="text-xs text-ink-3">Sample histories, no names kept</span>}>
          {people.total === 0 ? (
            <p className="mt-2 text-sm text-ink-3">No sample histories for this path yet, so this is not known.</p>
          ) : (
            <>
              <div className="mt-3 flex items-end gap-4">
                <p className="leading-none">
                  <span className="font-display text-[44px] text-ink">{people.total}</span>
                  <span className="ml-1.5 text-sm text-ink-2">people reached it</span>
                </p>
                <div className="dc-years" aria-label="Class year when they got in">
                  {people.byYear.map((y) => (
                    <div key={y.year} className={`dc-year ${y.year === year ? 'is-you' : ''}`} title={`${y.count} ${y.year.toLowerCase()}${y.count === 1 ? '' : 's'}`}>
                      <span style={{ height: `${(y.count / maxYear) * 100}%` }} />
                      <small>
                        {y.year.slice(0, 2)} {y.count}
                      </small>
                    </div>
                  ))}
                </div>
              </div>
              <ul className="mt-4 grid gap-2">
                {people.common.slice(0, 3).map((c) => (
                  <li key={c.step.id} className="dc-signal">
                    <span className="truncate" title={c.step.title}>
                      {c.step.title}
                    </span>
                    <span className="dc-bar" aria-hidden="true">
                      <span style={{ width: `${Math.round(c.share * 100)}%` }} />
                    </span>
                    <span className="tabular-nums text-ink-3">
                      {c.count}/{people.total}
                    </span>
                  </li>
                ))}
              </ul>
              <div className="mt-4 grid gap-2">
                {people.timelines.slice(0, 2).map((p) => (
                  <div key={p.id} className="dc-timeline">
                    <p className="text-xs font-medium text-ink">
                      {p.outcome} <span className="font-normal text-ink-3">· {p.year}</span>
                    </p>
                    <ol>
                      {p.timeline.map((item) => (
                        <li key={item}>{item}</li>
                      ))}
                    </ol>
                  </div>
                ))}
              </div>
            </>
          )}
        </Section>

        <Section title="In your feed now" aside={<span className="text-xs text-ink-3">{opportunities.length} lead here</span>}>
          {opportunities.length === 0 ? (
            <p className="mt-2 text-sm text-ink-3">Nothing in the feed leads here right now. The agents look again on the next sweep.</p>
          ) : (
            <ul className="mt-3 grid gap-1.5">
              {opportunities.slice(0, 4).map(({ opportunity: o, saved, liked }) => {
                const meta = typeMeta[o.type];
                const Icon = meta.icon;
                return (
                  <li key={o.id}>
                    <button type="button" onClick={() => onAction({ kind: 'openOpportunity', opportunityId: o.id, label: '' })} className="dc-lead">
                      <span className={`grid size-8 shrink-0 place-items-center rounded-xl ${meta.tint}`}>
                        <Icon className="size-4" aria-hidden="true" />
                      </span>
                      <span className="min-w-0 flex-1 text-left">
                        <span className="block truncate text-sm font-medium text-ink">{o.title}</span>
                        <span className="block truncate text-xs text-ink-3">
                          {meta.label} · {o.organizer}
                        </span>
                      </span>
                      {saved && <Bookmark className="size-3.5 fill-current text-brand" aria-label="Saved" />}
                      {liked && <Heart className="size-3.5 fill-current text-rose-500" aria-label="Liked" />}
                      <ArrowRight className="size-4 text-ink-3" aria-hidden="true" />
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </Section>

        <Section title="What the roadmap looks like" aside={<span className="text-xs text-ink-3">{plan.phases.length} phases · {plan.steps} steps</span>}>
          <ol className="dc-phases mt-3">
            {plan.phases.map((phase, index) => (
              <li key={phase.title}>
                <span className="dc-phase-n" aria-hidden="true">
                  {phase.done === phase.steps && phase.steps > 0 ? <Check className="size-3" strokeWidth={3} /> : index + 1}
                </span>
                <div className="min-w-0">
                  <p className="text-sm font-medium text-ink">{phase.title}</p>
                  <p className="text-xs text-ink-3">
                    {phase.window} · {phase.done ? `${phase.done} of ${phase.steps} done` : `${phase.steps} steps`}
                  </p>
                </div>
              </li>
            ))}
          </ol>
          {plan.next && (
            <p className="mt-3 rounded-2xl bg-brand-soft/80 px-3.5 py-2.5 text-[13px] leading-relaxed text-ink-2">
              <span className="font-medium text-ink">First up: </span>
              {plan.next.title}
            </p>
          )}
          <p className="mt-3 text-xs leading-relaxed text-ink-3">
            <span className="font-medium text-ink-2">The agents' note: </span>
            {path.whyItFits}
          </p>
        </Section>
      </div>
    </article>
  );
}
