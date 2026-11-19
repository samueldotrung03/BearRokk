// The roadmap page. The student picks nothing to get one: there is a roadmap to their career
// goal, and one for every posting they are working on (set to Applying or To apply on the Saved
// page, from what the agents found, never the sample set), written by comparing the posting
// with their profile and with how people got in (src/lib/roadmapx/journey.ts). Two ways to look
// at each: the 3D journey to travel it, and a quiet overview to see its whole scope.
import { Briefcase, ArrowUpRight, Check, Pencil, Plus, ChevronDown, Compass, List, Map as MapIcon, Mountain, RefreshCw, RotateCcw, Search, Sparkles, Target, Users } from 'lucide-react';
import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { Link } from 'react-router';
import { CareerMap } from '../components/journey/CareerMap.tsx';
import { Overview } from '../components/journey/Overview.tsx';
import { Scene } from '../components/journey/Scene.tsx';
import { SkillChips, StepPanel } from '../components/journey/StepPanel.tsx';
import { Details } from '../components/OpportunityCard.tsx';
import { Page } from '../components/Page.tsx';
import { careerPaths } from '../data/sample.ts';
import { aiJourney, aiPlan, chosenFrom, roadmapRequest } from '../lib/roadmapx/ai.ts';
import { formatHours } from '../lib/roadmapx/context.ts';
import { activeApplications, careerJourney, careerSearch, customCareer, jobJourney, planJourney } from '../lib/roadmapx/journey.ts';
import { useLocal } from '../lib/useLocal.ts';
import { useAiRoadmap } from '../state/aiRoadmap.ts';
import { useLive } from '../state/live.tsx';
import { useStore } from '../state/StoreProvider.tsx';
import type { ApplicationStatus, Opportunity } from '../types.ts';
import '../styles/journey.css';

/** Puts the cursor in a search box without the browser scrolling the page to it. */
const focusQuietly = (input: HTMLInputElement | null) => input?.focus({ preventScroll: true });

const statusWords: Record<ApplicationStatus, string> = { interested: 'Interested', to_apply: 'To apply', applying: 'Applying', applied: 'Applied' };

export function Roadmap() {
  const { state, dispatch } = useStore();
  const live = useLive();
  // What the agents found and what the student saved: the real postings, never the sample set.
  const list = useMemo(() => {
    const seen = new Map<string, Opportunity>();
    for (const o of [...live.opportunities, ...live.savedCards]) seen.set(o.id, o);
    return [...seen.values()];
  }, [live.opportunities, live.savedCards]);
  const [open, setOpen] = useLocal<string>('bearrok.roadmap.open', 'career');
  const [view, setView] = useLocal<'journey' | 'overview'>('bearrok.roadmap.look', 'journey');
  const [skip, setSkip] = useLocal<string[]>('bearrok.roadmap.skip', []);
  // Options the student added to their own path, across every career they look at.
  const [picked, setPicked] = useLocal<string[]>('bearrok.roadmap.picked', []);
  const pickOption = (id: string) => setPicked(picked.includes(id) ? picked.filter((x) => x !== id) : [...picked, id]);
  // The career being looked at. Empty means the student's own goal; "custom:" is one they typed.
  const [viewing, setViewing] = useLocal<string>('bearrok.roadmap.career', '');
  const [find, setFind] = useState('');
  const [finding, setFinding] = useState(false);
  const [query, setQuery] = useState('');
  const [listing, setListing] = useState(false);
  const [details, setDetails] = useState<Opportunity | null>(null);
  const [burst, setBurst] = useState<string | null>(null);
  const now = useMemo(() => Date.now(), []);

  const byId = useMemo(() => new Map(list.map((o) => [o.id, o])), [list]);
  const dests = useMemo(() => activeApplications(state, byId), [state, byId]);
  const dest = dests.find((d) => d.opportunity.id === open);

  // The draft by fixed rules is there at once; Grok's roadmap replaces it when it arrives.
  const careerId = viewing && (viewing.startsWith('custom:') || careerPaths.some((p) => p.id === viewing)) ? viewing : state.goalId;
  // The student's own wording of where a career roadmap leads, kept per career. It is what the writer is asked for.
  const [towards, setTowards] = useLocal<Record<string, string>>('bearrok.roadmap.toward', {});
  const built = useMemo(
    () => (dest ? jobJourney(state, dest.opportunity, now, skip) : careerId.startsWith('custom:') ? customCareer(careerId.slice(7)) : careerJourney(state, now, skip, careerId, [...byId.values()])),
    [dest, state, now, skip, careerId, byId],
  );
  const toward = dest ? '' : (towards[careerId] ?? '');
  const draft = useMemo(() => (toward ? { ...built, goal: toward } : built), [built, toward]);
  const hits = useMemo(() => careerSearch(state, find), [state, find]);
  const typed = find.trim();
  const openCareer = (id: string) => {
    setViewing(id === state.goalId ? '' : id);
    setOpen('career');
    setFind('');
    setFinding(false);
  };
  const request = useMemo(() => roadmapRequest(state, draft.goal, dest ?? null, draft.analysis.stories), [state, draft, dest]);
  const boardWritten = useAiRoadmap(request);
  const board = useMemo(() => (boardWritten.answer ? aiJourney(state, draft, boardWritten.answer, skip) : draft), [boardWritten.answer, state, draft, skip]);

  // Once the student is done choosing, their picks become a roadmap of their own, and the writer fills it in.
  const [plans, setPlans] = useLocal<string[]>('bearrok.roadmap.plans', []);
  // Ticked things-to-do inside a step, as "<step id>#<position>".
  const [ticked, setTicked] = useLocal<string[]>('bearrok.roadmap.ticked', []);
  const tick = (id: string) => setTicked(ticked.includes(id) ? ticked.filter((x) => x !== id) : [...ticked, id]);
  const planning = !dest && board.open && plans.includes(careerId) && board.steps.some((s) => picked.includes(s.id));
  const planDraft = useMemo(() => (planning ? planJourney(board, picked) : null), [planning, board, picked]);
  const planRequest = useMemo(() => roadmapRequest(state, draft.goal, null, draft.analysis.stories, planDraft ? chosenFrom(planDraft) : []), [state, draft, planDraft]);
  const planWritten = useAiRoadmap(planRequest, planning);
  const journey = useMemo(() => (planDraft ? (planWritten.answer ? aiPlan(planDraft, planWritten.answer) : planDraft) : board), [planDraft, planWritten.answer, board]);
  const written = planning ? planWritten : boardWritten;
  const writer = written.answer?.writer;
  const build = (on: boolean) => {
    setPlans(on ? [...new Set([...plans, careerId])] : plans.filter((id) => id !== careerId));
    setView('journey');
  };

  const q = query.trim().toLowerCase();
  const shown = dests.filter((d) => !q || `${d.opportunity.title} ${d.opportunity.organizer}`.toLowerCase().includes(q));
  const tracked = dests.length > 0;
  const pick = (id: string) => {
    setOpen(id);
    setListing(false);
    setQuery('');
  };
  const count = journey.steps.length;
  const { analysis } = journey;

  // Opening a different roadmap starts at its next step; finishing steps does not move the view.
  const key = `${dest ? `job:${dest.opportunity.id}:${dest.status}` : `career:${careerId}${planning ? ':plan' : ''}`}:${written.answer ? 'written' : 'draft'}`;
  const [focus, setFocus] = useState(() => Math.min(journey.nextIndex, count));
  const opened = useRef(key);
  useEffect(() => {
    if (opened.current === key) return;
    opened.current = key;
    setFocus(Math.min(journey.nextIndex, count));
  }, [key, journey.nextIndex, count]);
  const at = Math.min(focus, count);
  const go = (index: number) => setFocus(Math.max(0, Math.min(count, index)));

  const toggle = (stepId: string) => {
    const step = journey.steps.find((s) => s.id === stepId);
    dispatch({ type: 'toggleStep', id: stepId });
    if (!step || step.done) return;
    // Let the marker celebrate, then carry the view on to what comes next.
    setBurst(stepId);
    window.setTimeout(() => {
      setBurst(null);
      if (journey.open) return;
      const next = journey.steps.findIndex((s) => !s.done && s.id !== stepId);
      setFocus(next === -1 ? count : next);
    }, 900);
  };

  const goalTitle = careerId.startsWith('custom:') ? careerId.slice(7) : (careerPaths.find((p) => p.id === careerId)?.title ?? journey.goal);
  const isGoal = careerId === state.goalId;
  const mapped = journey.open && view === 'journey';

  return (
    <Page title="Roadmap" subtitle="Written for you from your profile, the postings you are going for, and how people actually got in. Nothing to set up.">
      <div className="rm3" style={{ '--rm3-accent': journey.accent } as CSSProperties}>
        <div className="rm3-dests" role="tablist" aria-label="Your roadmaps">
          <div className="rm3-apps">
            {finding ? (
              <label className="rm3-search rm3-inplace">
                <Search aria-hidden="true" />
                <input
                  type="search"
                  ref={focusQuietly}
                  value={find}
                  onChange={(event) => setFind(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === 'Escape') setFinding(false);
                    if (event.key !== 'Enter') return;
                    if (hits[0]) openCareer(hits[0].id);
                    else if (typed) openCareer(`custom:${typed.slice(0, 80)}`);
                  }}
                  placeholder="Search a career, role, skill or interest"
                  aria-label="Search a career, role, skill or interest"
                />
              </label>
            ) : (
              <button type="button" role="tab" aria-selected={!dest} aria-expanded={finding} aria-haspopup="listbox" onClick={() => (setFinding((on) => !on), setListing(false))}>
                <Compass aria-hidden="true" />
                <span>
                  <small>
                    {isGoal ? 'Career goal' : 'Exploring a career'} · {careerPaths.length}
                  </small>
                  {goalTitle}
                </span>
                <ChevronDown aria-hidden="true" className="rm3-caret" />
              </button>
            )}
            {finding && (
              <>
                <div className="rm3-shade" onClick={() => (setFinding(false), setFind(''))} aria-hidden="true" />
                <div className="rm3-menu rm3-apps-menu">
                  <div role="listbox" aria-label="Careers">
                    {hits.map((hit) => (
                      <button key={hit.id} type="button" role="option" aria-selected={!dest && hit.id === careerId} onClick={() => openCareer(hit.id)}>
                        <strong>
                          {hit.title}
                          {hit.id === state.goalId ? <em className="is-applied">Your goal</em> : hit.match !== null && <em>{hit.match}% on your profile</em>}
                        </strong>
                        <span>{hit.reason && hit.reason !== 'Your goal' ? hit.reason : hit.oneLine}</span>
                      </button>
                    ))}
                    {typed && !hits.some((hit) => hit.title.toLowerCase() === typed.toLowerCase()) && (
                      <button type="button" role="option" aria-selected={false} onClick={() => openCareer(`custom:${typed.slice(0, 80)}`)}>
                        <strong>Map "{typed}"</strong>
                        <span>Not one the app holds. Grok maps it for you when it is connected.</span>
                      </button>
                    )}
                  </div>
                </div>
              </>
            )}
          </div>
          {dests.length > 0 && (
            <div className="rm3-apps">
              {listing ? (
                <label className="rm3-search rm3-inplace">
                  <Search aria-hidden="true" />
                  <input
                    type="search"
                    ref={focusQuietly}
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === 'Escape') setListing(false);
                      if (event.key === 'Enter' && shown[0]) pick(shown[0].opportunity.id);
                    }}
                    placeholder={`Search your ${dests.length} applications`}
                    aria-label="Search by role or organization"
                  />
                </label>
              ) : (
                <button type="button" role="tab" aria-selected={Boolean(dest)} aria-expanded={listing} aria-haspopup="listbox" onClick={() => (setListing((on) => !on), setFinding(false))}>
                  <Briefcase aria-hidden="true" />
                  <span>
                    <small>
                      Applying and to apply · {dests.length}
                    </small>
                    {dest ? dest.opportunity.title : 'Choose an application'}
                  </span>
                  <ChevronDown aria-hidden="true" className="rm3-caret" />
                </button>
              )}
              {listing && (
                <>
                  <div className="rm3-shade" onClick={() => (setListing(false), setQuery(''))} aria-hidden="true" />
                  <div className="rm3-menu rm3-apps-menu">
                    <div role="listbox" aria-label="Your applications">
                      {shown.map((d) => (
                        <button key={d.opportunity.id} type="button" role="option" aria-selected={d === dest} onClick={() => pick(d.opportunity.id)}>
                          <strong>
                            {d.opportunity.title}
                            {d.status && <em className={`is-${d.status}`}>{statusWords[d.status]}</em>}
                          </strong>
                          <span>{d.opportunity.organizer}</span>
                        </button>
                      ))}
                      {shown.length === 0 && <p className="rm3-none">Nothing matches "{query.trim()}".</p>}
                    </div>
                  </div>
                </>
              )}
            </div>
          )}
          {!tracked && live.status !== 'connecting' && (
            // Nothing in progress: point the student at where postings come from, not at guesses.
            <div className="rm3-noapps" role="note">
              <Briefcase aria-hidden="true" />
              <span>
                <strong>No applications in progress</strong>
                Set a posting to To apply or Applying and its roadmap appears here.
              </span>
              <Link to="/" className="rm3-noapps-go">
                Explore the feed
              </Link>
              <Link to="/saved" className="rm3-noapps-go">
                Go to Saved
              </Link>
            </div>
          )}
        </div>

        {!dest && !isGoal && (
          <div className="rm3-explore">
            {!isGoal && (
              <p className="rm3-exploring">
                Exploring, not committed.
                {!careerId.startsWith('custom:') && (
                  <button type="button" onClick={() => (dispatch({ type: 'setGoal', id: careerId }), setViewing(''))}>
                    <Target aria-hidden="true" /> Make this my goal
                  </button>
                )}
                <button type="button" onClick={() => setViewing('')}>
                  Back to my goal
                </button>
              </p>
            )}
          </div>
        )}

        <div className="rm3-bar">
          <ol className="rm3-think" key={key} aria-label="How this roadmap was written">
            {analysis.stages.map((stage, i) => (
              <li key={stage.label} style={{ '--i': i } as CSSProperties}>
                <i aria-hidden="true">
                  <Check />
                </i>
                <span>
                  <small>{stage.label}</small>
                  {stage.result}
                </span>
              </li>
            ))}
          </ol>
          <p className={`rm3-writer is-${written.status}`} role="status">
            <i aria-hidden="true" />
            {written.status === 'ready'
              ? writer === 'claude'
                ? 'Written by Claude, standing in for Grok during testing'
                : 'Written by Grok for you'
              : written.status === 'writing'
                ? 'Your roadmap is being written. This is a first draft by fixed rules.'
                : written.status === 'failed'
                  ? 'The writer could not finish this one. This is a draft by fixed rules.'
                  : 'Grok is not connected. This is a draft by fixed rules.'}
            {(written.status === 'ready' || written.status === 'failed') && (
              <button type="button" onClick={written.rewrite} title="Write it again from your profile as it is now">
                <RefreshCw aria-hidden="true" /> Rewrite
              </button>
            )}
          </p>
          <div className="rm3-views" role="tablist" aria-label="How to look at it">
            <button type="button" role="tab" aria-selected={view === 'journey'} onClick={() => setView('journey')}>
              <Mountain aria-hidden="true" /> {journey.open ? 'Pick and choose' : 'Journey'}
            </button>
            <button type="button" role="tab" aria-selected={view === 'overview'} onClick={() => setView('overview')}>
              <MapIcon aria-hidden="true" /> Overview
            </button>
          </div>
          <div className="rm3-progress">
            <strong>{journey.open ? journey.doneCount : `${journey.percent}%`}</strong>
            <span>{journey.open ? `of ${count} options done · ${picked.filter((id) => journey.steps.some((s) => s.id === id)).length} on my path` : `${journey.doneCount} of ${count} steps${journey.hoursLeft > 0 ? ` · about ${formatHours(journey.hoursLeft)} left` : ''}`}</span>
            <i aria-hidden="true">
              <b style={{ width: `${journey.percent}%` }} />
            </i>
          </div>
        </div>

        {journey.plan && (
          <p className="rm3-planbar" role="status">
            <Sparkles aria-hidden="true" />
            <span>
              <strong>Your roadmap, built from the {count} {count === 1 ? 'option' : 'options'} you chose.</strong> Open a step for what to do; each category ends with what else to add.
            </span>
            <button type="button" onClick={() => build(false)}>
              <Pencil aria-hidden="true" /> Change my picks
            </button>
          </p>
        )}

        <div className={`rm3-stage ${view === 'overview' || mapped ? 'is-over' : ''} ${mapped ? 'is-long' : ''}`}>
          {view !== 'journey' ? (
            <Overview key={key} journey={journey} focus={at} onFocus={go} />
          ) : journey.open ? (
            <CareerMap key={key} journey={journey} focus={at} onFocus={go} picked={picked} onPick={pickOption} onBuild={() => build(true)} onRename={(goal) => setTowards(({ [careerId]: _old, ...rest }) => (goal ? { ...rest, [careerId]: goal.slice(0, 120) } : rest))} />
          ) : (
            <Scene key={key} journey={journey} focus={at} onFocus={go} burst={burst} />
          )}
          <StepPanel journey={journey} focus={at} onFocus={go} onToggle={toggle} onOpen={(id) => setDetails(byId.get(id) ?? null)} onSkip={(id) => setSkip([...skip, id])} picked={picked} onPick={pickOption} ticked={ticked} onTick={tick} now={now} />
        </div>

        {view === 'journey' && !journey.open && (
          <nav className="rm3-rail" aria-label="Every step">
            {journey.phases.map((phase) => (
              <div key={phase.id} className="rm3-rail-phase" style={{ flexGrow: phase.count }}>
                <p>
                  {phase.title}
                  {phase.window && <span>{phase.window}</span>}
                </p>
                <div>
                  {journey.steps.slice(phase.from, phase.from + phase.count).map((step) => (
                    <button
                      key={step.id}
                      type="button"
                      className={`${step.done ? 'is-done' : ''} ${step.index === journey.nextIndex ? 'is-next' : ''} ${step.index === at ? 'is-focus' : ''}`}
                      aria-label={`Step ${step.index + 1}: ${step.title}`}
                      title={step.title}
                      onClick={() => setFocus(step.index)}
                    />
                  ))}
                </div>
              </div>
            ))}
            <button type="button" className={`rm3-rail-goal ${at === count ? 'is-focus' : ''}`} onClick={() => setFocus(count)}>
              <Target aria-hidden="true" /> Goal
            </button>
          </nav>
        )}

        {journey.skipped.length > 0 && (
          <p className="rm3-skipped">
            Set aside:
            {journey.skipped.map((s) => (
              <button key={s.id} type="button" onClick={() => setSkip(skip.filter((id) => id !== s.id))} title="Put it back on the roadmap">
                {s.title} <RotateCcw aria-hidden="true" />
              </button>
            ))}
          </p>
        )}

        {journey.plan && (
          <section className="rm3-card rm3-more">
            <h2>
              <Sparkles aria-hidden="true" /> What else to do in each category
            </h2>
            <div>
              {journey.phases.map((phase) => {
                const own = journey.steps.slice(phase.from, phase.from + phase.count);
                const next = own.find((s) => !s.done);
                return (
                  <article key={phase.id}>
                    <h3>
                      {phase.title}
                      <span>
                        {own.filter((s) => s.done).length} of {own.length} done
                      </span>
                    </h3>
                    {next ? (
                      <button type="button" className="rm3-more-next" onClick={() => go(next.index)}>
                        <small>Next for you</small>
                        {next.title}
                      </button>
                    ) : (
                      <p className="rm3-small">Everything you chose here is done.</p>
                    )}
                    {(phase.more ?? []).length > 0 && <h4>Recommended to add next</h4>}
                    <ul>
                      {(phase.more ?? []).map((more) => (
                        <li key={more.title}>
                          <div>
                            <strong>{more.title}</strong>
                            <p>{more.why}</p>
                          </div>
                          {more.id && (
                            <button type="button" className="rm3-add" aria-label={`Add ${more.title} to my roadmap`} onClick={() => pickOption(more.id!)}>
                              <Plus aria-hidden="true" />
                            </button>
                          )}
                        </li>
                      ))}
                    </ul>
                  </article>
                );
              })}
              {(journey.left ?? []).map((phase) => (
                <article key={phase.id} className="is-left">
                  <h3>
                    {phase.title}
                    <span>not on your path</span>
                  </h3>
                  <p className="rm3-small">You left this out, and that is fine. If you ever want one thing from it:</p>
                  <ul>
                    {phase.more.map((more) => (
                      <li key={more.title}>
                        <div>
                          <strong>{more.title}</strong>
                          <p>{more.why}</p>
                        </div>
                        {more.id && (
                          <button type="button" className="rm3-add" aria-label={`Add ${more.title} to my roadmap`} onClick={() => pickOption(more.id!)}>
                            <Plus aria-hidden="true" />
                          </button>
                        )}
                      </li>
                    ))}
                  </ul>
                </article>
              ))}
            </div>
          </section>
        )}

        <div className="rm3-cards">
          {analysis.fit ? (
            <section className="rm3-card">
              <h2>
                <Sparkles aria-hidden="true" /> Qualification check
              </h2>
              <div className="rm3-fit">
                <strong>{analysis.fit.score}%</strong>
                <p>{journey.summary}</p>
              </div>
              {analysis.fit.met.length > 0 && (
                <>
                  <h3>You already show</h3>
                  <SkillChips skills={analysis.fit.met.map((label) => ({ label, core: true, have: true }))} />
                </>
              )}
              {analysis.fit.missing.length > 0 && (
                <>
                  <h3>Asked for, not on your profile yet</h3>
                  <SkillChips skills={analysis.fit.missing.map((label) => ({ label, core: true, have: false }))} />
                  <p className="rm3-small">Each of these became a step on the roadmap. If you have one already, add it to your profile and the roadmap rewrites itself.</p>
                </>
              )}
            </section>
          ) : (
            <section className="rm3-card">
              <h2>
                <Sparkles aria-hidden="true" /> What people in this career tend to have
              </h2>
              <SkillChips skills={journey.skills} />
              {journey.skills.length === 0 && <p className="rm3-small">Nothing to show yet.</p>}
              <p className="rm3-small">Recommendations, not requirements. Outlined ones come up in most postings; ticked ones are on your profile or covered by something you finished.</p>
            </section>
          )}

          <section className="rm3-card">
            <h2>
              <Users aria-hidden="true" /> How people got in
            </h2>
            {analysis.stories.length === 0 ? (
              <p className="rm3-small">No paths were found for this kind of role yet, so this roadmap rests on the posting and your profile alone.</p>
            ) : (
              <div className="rm3-stories">
                {analysis.stories.map((story) => (
                  <details key={story.id}>
                    <summary>
                      <strong>{story.outcome}</strong>
                      {story.year && <span>{story.year}</span>}
                    </summary>
                    <ol>
                      {story.timeline.map((line) => (
                        <li key={line}>{line}</li>
                      ))}
                    </ol>
                  </details>
                ))}
              </div>
            )}
            {analysis.sources.length > 0 && (
              <>
                <h3>Pages it read</h3>
                <ul className="rm3-sources">
                  {analysis.sources.slice(0, 8).map((url) => (
                    <li key={url}>
                      <a href={url} target="_blank" rel="noreferrer">
                        {url.replace(/^https?:\/\/(www\.)?/, '').slice(0, 60)}
                      </a>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </section>
        </div>

        {analysis.process && analysis.process.length > 0 && (
          <section className="rm3-card rm3-process">
            <h2>
              <List aria-hidden="true" /> What their process looks like
            </h2>
            <ol>
              {analysis.process.map((stage, i) => (
                <li key={stage.stage} style={{ '--i': i } as CSSProperties}>
                  <b>{i + 1}</b>
                  <div>
                    <strong>{stage.stage}</strong>
                    <p>{stage.detail}</p>
                  </div>
                </li>
              ))}
            </ol>
            <p className="rm3-small">From what the writer found on the web and on X. Check the organizer's own page before you rely on it.</p>
          </section>
        )}

        {journey.related.length > 0 && (
          <section className="rm3-card rm3-related">
            <h2>
              <Compass aria-hidden="true" /> Paths next to this one
            </h2>
            <div>
              {journey.related.map((r) => (
                <button key={r.title} type="button" onClick={() => openCareer(r.id ?? `custom:${r.title}`)}>
                  <strong>
                    {r.title} <ArrowUpRight aria-hidden="true" />
                  </strong>
                  <span>{r.why}</span>
                  {r.match !== null && (
                    <i aria-label={`${r.match}% of what it asks for is on your profile`}>
                      <b style={{ width: `${r.match}%` }} />
                    </i>
                  )}
                </button>
              ))}
            </div>
          </section>
        )}

        <footer className="rm3-foot">
          <p>{analysis.basis}</p>
          <Link to="/roadmap/list">
            <List aria-hidden="true" /> Coach and week plan
          </Link>
        </footer>
      </div>
      {details && <Details opportunity={details} onClose={() => setDetails(null)} />}
    </Page>
  );
}
