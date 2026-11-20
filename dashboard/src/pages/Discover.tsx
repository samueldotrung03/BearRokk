// Career discovery: learn any career in four steps - the basics, what people in the job share on X,
// how to start, and what the interviews ask. The agents research a career the first time anyone
// asks for it (backend/src/careers); the guide is kept and refreshed with "Search again". Students
// who do not know what to look up can open "Find my path", the quiz and ranked matches.
import { Check, ChevronDown, Map as MapIcon, Search, X } from 'lucide-react';
import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router';
import { CareerGuide } from '../components/discover/CareerGuide.tsx';
import { MatchList } from '../components/discover/MatchList.tsx';
import { prefersReducedMotion } from '../components/discover/motion.ts';
import { PathMark } from '../components/discover/PathMark.tsx';
import { Quiz } from '../components/discover/Quiz.tsx';
import { Details } from '../components/OpportunityCard.tsx';
import { Page } from '../components/Page.tsx';
import { pathExtras, quizQuestions } from '../data/discover-extra.ts';
import { pathGroups } from '../data/fields.ts';
import { careerPaths, opportunities } from '../data/sample.ts';
import type { AnswerAction } from '../lib/discover/ask.ts';
import { askerId, slugFor, useCareerGuide, useGuideList, type StudentContext } from '../lib/discover/guide.ts';
import { SAMPLE_FEED } from '../state/live.tsx';
import { rankPaths, type PathMatch, type QuizAnswers } from '../lib/discover/match.ts';
import { currentRoadmap } from '../lib/roadmap.ts';
import { useLocal } from '../lib/useLocal.ts';
import { useAuth } from '../auth/AuthProvider.tsx';
import { useStore } from '../state/StoreProvider.tsx';
import '../styles/discover.css';

// The roadmaps in the order the Roadmap page shows their steps, so "first up" agrees with it.
const orderedRoadmaps = careerPaths.map((path) => currentRoadmap(path.id));
const titles = Object.fromEntries(careerPaths.map((p) => [p.id, p.title]));
const oneLines = Object.fromEntries(careerPaths.map((p) => [p.id, p.oneLine]));
const hues = Object.fromEntries(pathExtras.map((e) => [e.pathId, e.hue]));
const groups = Object.fromEntries(careerPaths.map((p) => [p.id, p.group ?? 'Other']));
/** A typed career that names a roadmap path can become the goal. */
const pathBySlug = Object.fromEntries(careerPaths.map((p) => [slugFor(p.title), p.id]));

const MAX_PICKS = 6;

export function Discover() {
  const { state, dispatch } = useStore();
  const navigate = useNavigate();
  const [answers, setAnswers] = useLocal<QuizAnswers>('bearrok.discover.answers', {});
  const [career, setCareer] = useLocal<string | null>('bearrok.discover.career', null);
  const [draft, setDraft] = useState(career ?? '');
  const [finderOpen, setFinderOpen] = useState(false);
  const [quizSignal, setQuizSignal] = useState(0);
  const [openOpportunity, setOpenOpportunity] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const guideRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const auth = useAuth();
  const by = useMemo(() => askerId(auth.user?.uid), [auth.user?.uid]);
  // What the agents may know about the student when they add to a part for them; their notes come first.
  const student: StudentContext = useMemo(
    () => ({
      year: state.profile.year || null,
      major: state.profile.major || null,
      school: state.profile.school || null,
      location: state.profile.location || null,
      interests: state.profile.interests ?? [],
      careerInterests: state.profile.careerInterests ?? [],
      skills: state.profile.skills ?? [],
      notes: (state.preferences?.notes ?? []).map((n) => [n.title, n.body].filter(Boolean).join(': ')).filter(Boolean),
    }),
    [state.profile, state.preferences?.notes],
  );
  const { guide, error, busy, searchAgain, retry, addMore, suggest } = useCareerGuide(career, by, student);
  const kept = useGuideList(guide?.status);

  const history = useMemo(() => ({ saved: state.saved, liked: state.liked, dismissed: state.dismissed }), [state.saved, state.liked, state.dismissed]);
  const ranked: PathMatch[] = useMemo(
    () =>
      rankPaths({
        paths: careerPaths,
        extras: pathExtras,
        roadmaps: orderedRoadmaps,
        opportunities,
        questions: quizQuestions,
        answers,
        profile: state.profile,
        history,
        doneSteps: state.doneSteps,
      }),
    [answers, state.profile, history, state.doneSteps],
  );

  // Quick picks: the goal, the best matches for this student, then guides already researched.
  const picks = useMemo(() => {
    const seen = new Set<string>();
    const out: string[] = [];
    // A guide is known by the words that were typed (its slug) and by the title the agents gave it,
    // so "Software engineering" and the guide it became, "Software Engineer", show once.
    const add = (title: string | undefined, also?: string) => {
      const keys = [title ? slugFor(title) : '', also ?? ''].filter(Boolean);
      if (!title || !keys.length || keys.some((k) => seen.has(k)) || out.length >= MAX_PICKS) return;
      keys.forEach((k) => seen.add(k));
      out.push(title);
    };
    // The public showcase offers only the careers it has sample guides for.
    if (!SAMPLE_FEED) {
      add(titles[state.goalId]);
      ranked.slice(0, 3).forEach((m) => add(titles[m.pathId]));
    }
    kept.forEach((g) => add(g.title, g.slug));
    return out;
  }, [state.goalId, ranked, kept]);

  useEffect(() => {
    if (!toast) return;
    const id = window.setTimeout(() => setToast(null), 5000);
    return () => window.clearTimeout(id);
  }, [toast]);

  // "/" puts the cursor in the search box, as in the feed's search.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const typing = e.target instanceof Element && e.target.closest('input, textarea, select, [contenteditable="true"]');
      if (e.key !== '/' || e.metaKey || e.ctrlKey || typing) return;
      e.preventDefault();
      inputRef.current?.focus();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const learn = (title: string) => {
    const clean = title.trim();
    if (clean.length < 2) return;
    setDraft(clean);
    setFinderOpen(false);
    if (slugFor(clean) === slugFor(career ?? '')) retry();
    else setCareer(clean);
    requestAnimationFrame(() => guideRef.current?.scrollIntoView({ behavior: prefersReducedMotion() ? 'auto' : 'smooth', block: 'start' }));
  };

  const submit = (e: FormEvent) => {
    e.preventDefault();
    learn(draft);
  };

  const act = (action: AnswerAction) => {
    switch (action.kind) {
      case 'setGoal':
        dispatch({ type: 'setGoal', id: action.pathId });
        setToast(action.pathId);
        return;
      case 'openRoadmap':
        navigate('/roadmap');
        return;
      case 'viewPath':
        learn(titles[action.pathId] ?? '');
        return;
      case 'compare':
        learn(titles[action.pathIds[0] ?? ''] ?? '');
        return;
      case 'openOpportunity':
        dispatch({ type: 'opened', id: action.opportunityId });
        setOpenOpportunity(action.opportunityId);
        return;
      case 'startQuiz':
        setFinderOpen(true);
        setQuizSignal((n) => n + 1);
    }
  };

  const goal = careerPaths.find((p) => p.id === state.goalId);
  const guidePath = guide ? pathBySlug[slugFor(guide.title)] ?? pathBySlug[guide.slug] : undefined;
  const details = openOpportunity ? opportunities.find((o) => o.id === openOpportunity) : undefined;

  return (
    <Page
      title="Career discovery"
      subtitle="Learn any career in four steps: the basics, what people in the job share, what the interviews ask, and how to start."
      aside={
        goal && (
          <button type="button" onClick={() => navigate('/roadmap')} className="dc-goal-pill">
            <PathMark pathId={goal.id} hue={hues[goal.id] ?? '#245bd8'} size="sm" />
            <span className="text-left">
              <span className="block text-[11px] font-medium text-ink-3">Your goal</span>
              <span className="block text-sm font-semibold text-ink">{goal.title}</span>
            </span>
            <MapIcon className="size-4 text-ink-3" aria-hidden="true" />
          </button>
        )
      }
    >
      <div className="grid gap-5">
        <section className="dc-panel dc-learn" aria-label="Choose a career">
          <form onSubmit={submit} className="dc-learn-form" role="search">
            <label htmlFor="dc-career" className="sr-only">
              Career to learn about
            </label>
            <div className="dc-learn-field">
              <Search className="size-4 text-ink-3" aria-hidden="true" />
              <input
                ref={inputRef}
                id="dc-career"
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                placeholder="Which career do you want to learn about? For example, economist"
                maxLength={60}
                autoComplete="off"
              />
              <kbd className="dc-kbd" aria-hidden="true">
                /
              </kbd>
            </div>
            <button type="submit" className="btn-primary h-10 px-5 text-sm text-white disabled:opacity-60" disabled={draft.trim().length < 2 || busy}>
              Learn
            </button>
          </form>
          <div className="dc-learn-picks">
            {picks.map((title) => (
              <button key={title} type="button" className={`dc-chip ${slugFor(title) === slugFor(career ?? '') ? 'is-on' : ''}`} onClick={() => learn(title)}>
                {title}
              </button>
            ))}
            <button type="button" className="dc-finder-toggle" aria-expanded={finderOpen} aria-controls="dc-finder" onClick={() => setFinderOpen((o) => !o)}>
              Not sure? Find my path
              <ChevronDown className="size-4" aria-hidden="true" />
            </button>
          </div>
        </section>

        {finderOpen && (
          <div id="dc-finder" className="dc-top">
            <Quiz
              questions={quizQuestions}
              answers={answers}
              onAnswer={(questionId, optionId) => setAnswers((current) => ({ ...current, [questionId]: optionId }))}
              onReset={() => setAnswers({})}
              ranked={ranked}
              titles={titles}
              hues={hues}
              goalId={state.goalId}
              hasFeedHistory={history.saved.length + history.liked.length + history.dismissed.length > 0}
              onAction={act}
              startSignal={quizSignal}
            />
            <MatchList
              ranked={ranked}
              titles={titles}
              oneLines={oneLines}
              hues={hues}
              groups={groups}
              groupOrder={pathGroups}
              selectedId={guidePath ?? ''}
              goalId={state.goalId}
              compare={[]}
              onSelect={(id) => learn(titles[id] ?? '')}
              onToggleCompare={() => {}}
            />
          </div>
        )}

        <div ref={guideRef} className="scroll-mt-6">
          {error ? (
            <p className="dc-panel dc-empty p-6" role="alert">
              {error}{' '}
              <button type="button" className="dc-link" onClick={retry}>
                Try again
              </button>
            </p>
          ) : guide ? (
            <CareerGuide
              key={guide.slug}
              guide={guide}
              onSearchAgain={searchAgain}
              onAddMore={addMore}
              onSuggest={suggest}
              goalAction={guidePath && guidePath !== state.goalId ? () => act({ kind: 'setGoal', pathId: guidePath, label: '' }) : undefined}
            />
          ) : busy ? (
            <p className="dc-panel dc-empty p-6" aria-live="polite">
              Asking your agents about {career}
            </p>
          ) : (
            <p className="dc-panel dc-empty p-6">Type a career above, or pick one, to see its guide.</p>
          )}
        </div>
      </div>

      <div className="dc-toast-region" aria-live="polite">
        {toast && (
          <div className="dc-toast">
            <span className="grid size-7 place-items-center rounded-full bg-emerald-500 text-white">
              <Check className="size-4" strokeWidth={3} aria-hidden="true" />
            </span>
            <span className="text-sm">
              <span className="font-semibold">{titles[toast]}</span> is now your goal. Your roadmap has switched to it.
            </span>
            <button type="button" onClick={() => navigate('/roadmap')} className="dc-action is-primary">
              Open roadmap
            </button>
            <button type="button" onClick={() => setToast(null)} aria-label="Dismiss" className="grid size-7 place-items-center rounded-full text-ink-3 hover:bg-canvas">
              <X className="size-4" aria-hidden="true" />
            </button>
          </div>
        )}
      </div>

      {details && <Details opportunity={details} onClose={() => setOpenOpportunity(null)} />}
    </Page>
  );
}
