import { ArrowLeft, ArrowRight, Check, RotateCcw, Sparkles, Target } from 'lucide-react';
import { useEffect, useRef, useState, type KeyboardEvent } from 'react';
import type { QuizAnswers, PathMatch } from '../../lib/discover/match.ts';
import type { AnswerAction } from '../../lib/discover/ask.ts';
import type { QuizQuestion } from '../../data/discover-extra.ts';
import { LevelPill, PathMark, Percent } from './PathMark.tsx';
import { prefersReducedMotion, useStreamedText } from './motion.ts';

type Step = 'intro' | number | 'thinking' | 'result';

interface QuizProps {
  questions: QuizQuestion[];
  answers: QuizAnswers;
  onAnswer: (questionId: string, optionId: string) => void;
  onReset: () => void;
  ranked: PathMatch[];
  titles: Record<string, string>;
  hues: Record<string, string>;
  goalId: string;
  hasFeedHistory: boolean;
  onAction: (action: AnswerAction) => void;
  /** Bumped by the page when an answer elsewhere says "Take the quiz". */
  startSignal: number;
}

const KEYS = ['1', '2', '3', '4', '5', '6'];

function firstStep(questions: QuizQuestion[], answers: QuizAnswers): Step {
  const next = questions.findIndex((q) => !answers[q.id]);
  if (next === -1) return 'result';
  return next === 0 ? 'intro' : next;
}

/** The "find my path" quiz: one quick question at a time, then the best fit with the reasons. */
export function Quiz(props: QuizProps) {
  const { questions, answers, onAnswer, onReset, ranked, titles, hues, goalId, hasFeedHistory, onAction, startSignal } = props;
  const [step, setStep] = useState<Step>(() => firstStep(questions, answers));
  // The explanation streams in only right after the student finishes, not when the page reloads.
  const [fresh, setFresh] = useState(false);
  const heading = useRef<HTMLHeadingElement>(null);
  const advance = useRef<number | undefined>(undefined);

  useEffect(() => {
    if (startSignal > 0) setStep(0);
  }, [startSignal]);

  // Move focus to each new question so keyboard and screen reader users follow along, but not on
  // the first render, where it would pull focus away from wherever the page put it.
  const mounted = useRef(false);
  useEffect(() => {
    if (mounted.current && typeof step === 'number') heading.current?.focus({ preventScroll: true });
    mounted.current = true;
  }, [step]);

  useEffect(() => () => window.clearTimeout(advance.current), []);

  const finish = () => {
    setFresh(true);
    setStep('thinking');
    // A short beat where the page shows what it is weighing. It is honest about being local:
    // the work is instant, the pause is only there so the change of state is easy to follow.
    window.clearTimeout(advance.current);
    advance.current = window.setTimeout(() => setStep('result'), prefersReducedMotion() ? 0 : 900);
  };

  const goTo = (index: number) => {
    if (index >= questions.length) finish();
    else setStep(Math.max(0, index));
  };

  const pick = (index: number, optionId: string) => {
    const question = questions[index];
    if (!question) return;
    onAnswer(question.id, optionId);
    window.clearTimeout(advance.current);
    // Long enough to see the choice light up, short enough to feel instant.
    advance.current = window.setTimeout(() => goTo(index + 1), prefersReducedMotion() ? 0 : 260);
  };

  const onKeyDown = (event: KeyboardEvent) => {
    if (typeof step !== 'number') return;
    const question = questions[step];
    const index = KEYS.indexOf(event.key);
    if (question && index >= 0 && question.options[index]) {
      event.preventDefault();
      pick(step, question.options[index].id);
    } else if (event.key === 'ArrowLeft' && step > 0) {
      goTo(step - 1);
    } else if (event.key === 'ArrowRight') {
      goTo(step + 1);
    }
  };

  const answered = questions.filter((q) => answers[q.id]).length;
  const current = typeof step === 'number' ? questions[step] : undefined;

  return (
    <section className="dc-quiz" aria-labelledby="dc-quiz-title" onKeyDown={onKeyDown}>
      <div className="dc-quiz-glow" aria-hidden="true" />
      <header className="relative flex items-center justify-between gap-3">
        <h2 id="dc-quiz-title" className="flex items-center gap-2 text-sm font-semibold text-ink">
          <Sparkles className="size-4 text-brand" aria-hidden="true" />
          Find my path
        </h2>
        {step !== 'intro' && (
          <ol className="dc-progress" aria-label={`${answered} of ${questions.length} questions answered`}>
            {questions.map((q, index) => (
              <li key={q.id}>
                <button
                  type="button"
                  onClick={() => goTo(index)}
                  className={`dc-progress-dot ${answers[q.id] ? 'is-done' : ''} ${step === index ? 'is-current' : ''}`}
                  aria-label={`Question ${index + 1}${answers[q.id] ? ', answered' : ''}`}
                  aria-current={step === index ? 'step' : undefined}
                />
              </li>
            ))}
          </ol>
        )}
      </header>

      {step === 'intro' && (
        <div className="dc-fade relative flex flex-1 flex-col">
          <p className="dc-eyebrow mt-6">Six questions · about a minute</p>
          <h3 className="mt-2 font-display text-[40px] leading-[1.05] text-ink">Like coding, not sure what to aim for?</h3>
          <p className="mt-3 max-w-md text-[15px] leading-relaxed text-ink-2">
            Tell us how you like to work. Your answers are weighed with the interests and skills on your profile
            {hasFeedHistory ? ' and what you saved in the feed' : ''}, and every match says why.
          </p>
          <div className="mt-auto flex flex-wrap items-center gap-3 pt-7">
            <button type="button" onClick={() => setStep(0)} className="btn-primary flex h-11 items-center gap-2 px-5 text-sm text-white">
              Start the quiz <ArrowRight className="size-4" aria-hidden="true" />
            </button>
            <span className="text-xs text-ink-3">Tip: press 1 to 4 to answer</span>
          </div>
        </div>
      )}

      {typeof step === 'number' && current && (
        <div key={current.id} className="dc-slide relative flex flex-1 flex-col">
          <p className="dc-eyebrow mt-6">
            Question {step + 1} of {questions.length}
          </p>
          <h3 ref={heading} tabIndex={-1} id={`dc-q-${current.id}`} className="mt-2 font-display text-[32px] leading-[1.1] text-ink outline-none">
            {current.prompt}
          </h3>
          <div role="group" aria-labelledby={`dc-q-${current.id}`} className="mt-5 grid gap-2.5 sm:grid-cols-2">
            {current.options.map((option, index) => {
              const chosen = answers[current.id] === option.id;
              return (
                <button
                  key={option.id}
                  type="button"
                  aria-pressed={chosen}
                  onClick={() => pick(step, option.id)}
                  className={`dc-option ${chosen ? 'is-chosen' : ''}`}
                >
                  <kbd className="dc-key" aria-hidden="true">
                    {chosen ? <Check className="size-3.5" strokeWidth={3} /> : index + 1}
                  </kbd>
                  <span>{option.label}</span>
                </button>
              );
            })}
          </div>
          <div className="mt-auto flex items-center justify-between pt-5 text-sm">
            <button
              type="button"
              onClick={() => (step === 0 ? setStep('intro') : goTo(step - 1))}
              className="dc-ghost"
            >
              <ArrowLeft className="size-4" aria-hidden="true" /> Back
            </button>
            <button type="button" onClick={() => goTo(step + 1)} className="dc-ghost">
              {step === questions.length - 1 ? (answered > 0 ? 'See my matches' : 'Skip') : answers[current.id] ? 'Next' : 'Skip'}
              <ArrowRight className="size-4" aria-hidden="true" />
            </button>
          </div>
        </div>
      )}

      {step === 'thinking' && <Thinking answered={answered} hasFeedHistory={hasFeedHistory} />}

      {step === 'result' && ranked[0] && (
        <Result
          ranked={ranked}
          titles={titles}
          hues={hues}
          goalId={goalId}
          fresh={fresh}
          answered={answered}
          total={questions.length}
          onAction={onAction}
          onRetake={() => {
            onReset();
            setFresh(false);
            setStep(0);
          }}
        />
      )}
    </section>
  );
}

function Thinking({ answered, hasFeedHistory }: { answered: number; hasFeedHistory: boolean }) {
  const lines = [
    `${answered} ${answered === 1 ? 'answer' : 'answers'} from you`,
    'Interests and skills on your profile',
    hasFeedHistory ? 'Cards you saved, liked or passed on' : 'Feed history (none yet)',
    'Roadmaps and the people who reached each path',
  ];
  return (
    <div className="dc-fade relative flex flex-1 flex-col justify-center py-8" role="status" aria-live="polite">
      <p className="font-display text-[30px] leading-tight text-ink">Weighing your answers…</p>
      <ul className="mt-5 space-y-2.5">
        {lines.map((line, index) => (
          <li key={line} className="dc-think-line" style={{ animationDelay: `${index * 140}ms` }}>
            <span className="dc-think-dot" aria-hidden="true" />
            {line}
          </li>
        ))}
      </ul>
    </div>
  );
}

function Result(props: {
  ranked: PathMatch[];
  titles: Record<string, string>;
  hues: Record<string, string>;
  goalId: string;
  fresh: boolean;
  answered: number;
  total: number;
  onAction: (action: AnswerAction) => void;
  onRetake: () => void;
}) {
  const { ranked, titles, hues, goalId, fresh, answered, total, onAction, onRetake } = props;
  const top = ranked[0]!;
  const runnerUp = ranked[1];
  const { shown, done } = useStreamedText(top.summary, fresh);
  const isGoal = goalId === top.pathId;

  return (
    <div className="dc-fade relative flex flex-1 flex-col" aria-live="polite">
      <p className="dc-eyebrow mt-6">Your best fit{answered < total ? ` · ${answered} of ${total} answered` : ''}</p>
      <div className="mt-2 flex items-center gap-4">
        <PathMark pathId={top.pathId} hue={hues[top.pathId] ?? '#245bd8'} size="lg" />
        <div className="min-w-0 flex-1">
          <h3 className="font-display text-[34px] leading-[1.05] text-ink">{titles[top.pathId]}</h3>
          <div className="mt-1">
            <LevelPill match={top} />
          </div>
        </div>
        <Percent value={top.percent} className="text-[64px]" />
      </div>

      <p className="dc-explain mt-4">
        {shown}
        {!done && <span className="dc-caret" aria-hidden="true" />}
      </p>

      <ul className="mt-4 grid gap-1.5" aria-label="Your other matches">
        {ranked.slice(1).map((m, index) => (
          <li key={m.pathId}>
            <button type="button" onClick={() => onAction({ kind: 'viewPath', pathId: m.pathId, label: '' })} className="dc-runner">
              <span className="w-4 text-xs text-ink-3">{index + 2}</span>
              <PathMark pathId={m.pathId} hue={hues[m.pathId] ?? '#245bd8'} size="sm" />
              <span className="min-w-0 flex-1 truncate text-left">{titles[m.pathId]}</span>
              <span className="dc-runner-bar" aria-hidden="true">
                <span style={{ width: `${m.percent}%`, background: hues[m.pathId] }} />
              </span>
              <span className="w-10 text-right font-semibold tabular-nums text-ink">{m.percent}%</span>
            </button>
          </li>
        ))}
      </ul>

      <div className="mt-auto flex flex-wrap items-center gap-2 pt-5">
        {isGoal ? (
          <button type="button" onClick={() => onAction({ kind: 'openRoadmap', label: '' })} className="btn-primary flex h-10 items-center gap-2 px-4 text-sm text-white">
            <Check className="size-4" aria-hidden="true" /> Already your goal · open roadmap
          </button>
        ) : (
          <button type="button" onClick={() => onAction({ kind: 'setGoal', pathId: top.pathId, label: '' })} className="btn-primary flex h-10 items-center gap-2 px-4 text-sm text-white">
            <Target className="size-4" aria-hidden="true" /> Make it my goal
          </button>
        )}
        <button type="button" onClick={() => onAction({ kind: 'viewPath', pathId: top.pathId, label: '' })} className="dc-soft">
          See what it involves
        </button>
        {runnerUp && (
          <button type="button" onClick={() => onAction({ kind: 'compare', pathIds: [top.pathId, runnerUp.pathId], label: '' })} className="dc-soft">
            Compare top two
          </button>
        )}
        <button type="button" onClick={onRetake} className="dc-ghost ml-auto text-sm">
          <RotateCcw className="size-3.5" aria-hidden="true" /> Retake
        </button>
      </div>
    </div>
  );
}
