import { Check, Map as MapIcon, X } from 'lucide-react';
import { useEffect, useMemo, useRef, useState, type RefObject } from 'react';
import { useNavigate } from 'react-router';
import { CareerChat } from '../components/discover/CareerChat.tsx';
import { CompareTable } from '../components/discover/CompareTable.tsx';
import { MatchList, MAX_COMPARE } from '../components/discover/MatchList.tsx';
import { prefersReducedMotion } from '../components/discover/motion.ts';
import { PathDetail } from '../components/discover/PathDetail.tsx';
import { PathMark } from '../components/discover/PathMark.tsx';
import { Quiz } from '../components/discover/Quiz.tsx';
import { Details } from '../components/OpportunityCard.tsx';
import { Page } from '../components/Page.tsx';
import { pathExtras, quizQuestions } from '../data/discover-extra.ts';
import { careerPaths, opportunities, pathProfiles } from '../data/sample.ts';
import type { AnswerAction, AskCareerContext } from '../lib/discover/ask.ts';
import { pathInsight, type PathInsight } from '../lib/discover/insight.ts';
import { answeredCount, rankPaths, type PathMatch, type QuizAnswers } from '../lib/discover/match.ts';
import { currentRoadmap } from '../lib/roadmap.ts';
import { useLocal } from '../lib/useLocal.ts';
import { useStore } from '../state/StoreProvider.tsx';
import '../styles/discover.css';

// The roadmaps in the order the Roadmap page shows their steps, so "first up" agrees with it.
const orderedRoadmaps = careerPaths.map((path) => currentRoadmap(path.id));
const titles = Object.fromEntries(careerPaths.map((p) => [p.id, p.title]));
const oneLines = Object.fromEntries(careerPaths.map((p) => [p.id, p.oneLine]));
const paces = Object.fromEntries(pathExtras.map((e) => [e.pathId, e.paceShort]));
const hues = Object.fromEntries(pathExtras.map((e) => [e.pathId, e.hue]));
const pathIds = careerPaths.map((p) => p.id);

export function Discover() {
  const { state, dispatch } = useStore();
  const navigate = useNavigate();
  const [answers, setAnswers] = useLocal<QuizAnswers>('bearrok.discover.answers', {});
  const [compare, setCompare] = useLocal<string[]>('bearrok.discover.compare', pathIds.slice(0, 2));
  const [selected, setSelected] = useLocal<string | null>('bearrok.discover.selected', null);
  const [quizSignal, setQuizSignal] = useState(0);
  const [openOpportunity, setOpenOpportunity] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const detailRef = useRef<HTMLDivElement>(null);
  const compareRef = useRef<HTMLDivElement>(null);
  const quizRef = useRef<HTMLDivElement>(null);

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
  const matches = useMemo(() => Object.fromEntries(ranked.map((m) => [m.pathId, m])), [ranked]);

  const insights = useMemo(
    () =>
      Object.fromEntries(
        careerPaths.map((path): [string, PathInsight] => [
          path.id,
          pathInsight({
            path,
            extras: pathExtras,
            roadmaps: orderedRoadmaps,
            profiles: pathProfiles,
            opportunities,
            profile: state.profile,
            doneSteps: state.doneSteps,
            ...history,
          }),
        ]),
      ),
    [state.profile, state.doneSteps, history],
  );

  // Until the student picks one, the detail view follows the top match.
  const selectedId = selected && insights[selected] ? selected : (ranked[0]?.pathId ?? pathIds[0]!);
  const insight = insights[selectedId]!;
  const match = matches[selectedId]!;
  const quizTaken = answeredCount(quizQuestions, answers) > 0;

  const askContext: AskCareerContext = {
    insight,
    match,
    ranked,
    titles,
    paces,
    profile: state.profile,
    goalId: state.goalId,
    quizTaken,
  };

  useEffect(() => {
    if (!toast) return;
    const id = window.setTimeout(() => setToast(null), 5000);
    return () => window.clearTimeout(id);
  }, [toast]);

  const scrollTo = (ref: RefObject<HTMLDivElement | null>) =>
    requestAnimationFrame(() => ref.current?.scrollIntoView({ behavior: prefersReducedMotion() ? 'auto' : 'smooth', block: 'start' }));

  const toggleCompare = (id: string) =>
    setCompare((current) => (current.includes(id) ? current.filter((x) => x !== id) : current.length >= MAX_COMPARE ? current : [...current, id]));

  // One place that carries out what a button or an answer offers, so the quiz, the detail view,
  // the compare table and the chat all behave the same way.
  const act = (action: AnswerAction) => {
    switch (action.kind) {
      case 'setGoal':
        // Uses the existing store action; finished steps stay marked when the goal changes.
        dispatch({ type: 'setGoal', id: action.pathId });
        setToast(action.pathId);
        return;
      case 'openRoadmap':
        navigate('/roadmap');
        return;
      case 'viewPath':
        setSelected(action.pathId);
        scrollTo(detailRef);
        return;
      case 'compare':
        setCompare(action.pathIds.slice(0, MAX_COMPARE));
        scrollTo(compareRef);
        return;
      case 'openOpportunity':
        dispatch({ type: 'opened', id: action.opportunityId });
        setOpenOpportunity(action.opportunityId);
        return;
      case 'startQuiz':
        setQuizSignal((n) => n + 1);
        scrollTo(quizRef);
        return;
    }
  };

  const goal = careerPaths.find((p) => p.id === state.goalId);
  const details = openOpportunity ? opportunities.find((o) => o.id === openOpportunity) : undefined;

  return (
    <Page
      title="Career discovery"
      subtitle="Answer six quick questions. We weigh them with your profile and your feed, rank the paths that fit, and show what each one really involves."
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
        <div ref={quizRef} className="dc-top scroll-mt-6">
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
            selectedId={selectedId}
            goalId={state.goalId}
            compare={compare}
            onSelect={(id) => {
              setSelected(id);
              scrollTo(detailRef);
            }}
            onToggleCompare={toggleCompare}
          />
        </div>

        <div ref={detailRef} className="dc-body scroll-mt-6">
          <PathDetail
            key={selectedId}
            insight={insight}
            match={match}
            hue={hues[selectedId] ?? '#245bd8'}
            isGoal={state.goalId === selectedId}
            inCompare={compare.includes(selectedId)}
            compareFull={!compare.includes(selectedId) && compare.length >= MAX_COMPARE}
            year={state.profile.year}
            onAction={act}
            onToggleCompare={() => toggleCompare(selectedId)}
          />
          <div className="dc-chat-col">
            <CareerChat context={askContext} onAction={act} />
          </div>
        </div>

        <div ref={compareRef} className="scroll-mt-6">
          <CompareTable
            ids={compare}
            allIds={ranked.map((m) => m.pathId)}
            insights={insights}
            matches={matches}
            hues={hues}
            goalId={state.goalId}
            year={state.profile.year}
            onToggle={toggleCompare}
            onAction={act}
          />
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
