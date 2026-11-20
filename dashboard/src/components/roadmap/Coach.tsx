import { ArrowUp, CalendarDays, Check, Eye, Lightbulb, Sparkles, Target, Timer, TrendingUp, type LucideIcon } from 'lucide-react';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { askCoach, suggestionsFor, type CoachAction, type CoachAnswer } from '../../lib/roadmapx/coach.ts';
import type { CoachContext } from '../../lib/roadmapx/context.ts';
import { reducedMotion } from './motion.ts';

interface Turn {
  id: number;
  question: string;
  answer: CoachAnswer | null;
  /** Characters revealed so far, for the streamed feel. */
  shown: number;
}

const lengthOf = (answer: CoachAnswer) => answer.text.length + answer.bullets.reduce((sum, b) => sum + b.length, 0);
const plainText = (answer: CoachAnswer) => [answer.text, ...answer.bullets].join(' ');

const chipIcons: LucideIcon[] = [CalendarDays, TrendingUp, Target, Lightbulb, Timer, CalendarDays];

/** Renders as much of the answer as has "arrived", text first and then each bullet in turn. */
function AnswerBody({ answer, shown }: { answer: CoachAnswer; shown: number }) {
  const text = answer.text.slice(0, shown);
  let rest = shown - answer.text.length;
  const bullets: string[] = [];
  for (const bullet of answer.bullets) {
    if (rest <= 0) break;
    bullets.push(bullet.slice(0, rest));
    rest -= bullet.length;
  }
  const streaming = shown < lengthOf(answer);
  return (
    <>
      <p>
        {text}
        {streaming && bullets.length === 0 && <span className="rm-caret" aria-hidden="true" />}
      </p>
      {bullets.length > 0 && (
        <ul className="rm-answer-list">
          {bullets.map((bullet, index) => (
            <li key={index}>
              {bullet}
              {streaming && index === bullets.length - 1 && <span className="rm-caret" aria-hidden="true" />}
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

/**
 * "Ask your roadmap": a chat box whose answers come from the student's own plan. Answers stream
 * in for a live feel (instantly with reduced motion), and end in one-click actions such as
 * ticking the step they talk about.
 */
export function Coach({
  ctx,
  onAction,
  incoming,
}: {
  ctx: CoachContext;
  onAction: (action: CoachAction) => void;
  /** A question sent from elsewhere on the page, such as a step's "Ask the coach" button. */
  incoming: { id: number; question: string } | null;
}) {
  const [turns, setTurns] = useState<Turn[]>([]);
  const [text, setText] = useState('');
  const [announce, setAnnounce] = useState('');
  const thread = useRef<HTMLDivElement>(null);
  const nextId = useRef(1);
  const frames = useRef<number[]>([]);
  // The latest plan, so an answer that arrives after a tick reads the new state.
  const latest = useRef(ctx);
  useEffect(() => {
    latest.current = ctx;
  }, [ctx]);
  useEffect(() => () => frames.current.forEach((id) => cancelAnimationFrame(id)), []);

  const busy = turns.some((turn) => !turn.answer || turn.shown < lengthOf(turn.answer));

  const stream = (id: number, answer: CoachAnswer) => {
    const total = lengthOf(answer);
    if (reducedMotion()) {
      setTurns((all) => all.map((turn) => (turn.id === id ? { ...turn, answer, shown: total } : turn)));
      setAnnounce(plainText(answer));
      return;
    }
    const started = performance.now();
    const duration = Math.min(1400, Math.max(420, total * 7));
    const tickFrame = (now: number) => {
      const progress = Math.min(1, (now - started) / duration);
      // Ease out, so the answer lands softly instead of stopping dead.
      const shown = Math.round((1 - (1 - progress) ** 2) * total);
      setTurns((all) => all.map((turn) => (turn.id === id ? { ...turn, answer, shown } : turn)));
      if (progress < 1) frames.current.push(requestAnimationFrame(tickFrame));
      else setAnnounce(plainText(answer));
    };
    frames.current.push(requestAnimationFrame(tickFrame));
  };

  const ask = async (question: string) => {
    const trimmed = question.trim();
    if (!trimmed || busy) return;
    const id = nextId.current++;
    // Keep the thread short: old answers describe a plan that has since moved on.
    setTurns((all) => [...all.slice(-5), { id, question: trimmed, answer: null, shown: 0 }]);
    setText('');
    const answer = await askCoach(trimmed, latest.current);
    // A short pause reads as the coach thinking; with reduced motion it answers at once.
    if (reducedMotion()) stream(id, answer);
    else window.setTimeout(() => stream(id, answer), 380);
  };

  const askRef = useRef(ask);
  useEffect(() => {
    askRef.current = ask;
  });
  useEffect(() => {
    if (incoming) void askRef.current(incoming.question);
  }, [incoming]);

  // Follow the conversation inside its own box, never by moving the page.
  useEffect(() => {
    const el = thread.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [turns]);

  const onSubmit = (event: FormEvent) => {
    event.preventDefault();
    void ask(text);
  };

  const asked = new Set(turns.map((turn) => turn.question));
  const chips = suggestionsFor(ctx).filter((q) => !asked.has(q));
  const open = ctx.steps.filter((s) => !s.done).length;

  return (
    <section className="rm-coach" aria-labelledby="rm-coach-title">
      <div className="rm-coach-head">
        <span className="rm-orb" aria-hidden="true">
          <Sparkles className="size-4" />
        </span>
        <div className="min-w-0">
          <h2 id="rm-coach-title" className="text-lg font-semibold tracking-tight">
            Ask your roadmap
          </h2>
          <p className="text-sm text-ink-3">
            Reading {ctx.steps.length} steps, {ctx.requirements.length} requirements{ctx.profiles > 0 ? ` and ${ctx.profiles} paths` : ''}
          </p>
        </div>
      </div>

      <div ref={thread} className="rm-thread" tabIndex={0} aria-label="Conversation with the roadmap coach">
        {turns.length === 0 ? (
          <div className="rm-hello">
            <p className="font-display text-3xl leading-tight text-ink">Hi {ctx.profile.name}.</p>
            <p className="mt-1 text-[15px] leading-relaxed text-ink-2">
              You have {open} open {open === 1 ? 'step' : 'steps'} toward {ctx.goal.toLowerCase()}. Ask what to do this week, whether you are on
              track, or why any step is on your plan.
            </p>
            <div className="rm-starters">
              {chips.map((question, index) => {
                const Icon = chipIcons[index % chipIcons.length]!;
                return (
                  <button key={question} type="button" className="rm-starter" onClick={() => void ask(question)}>
                    <Icon className="size-4 shrink-0 text-brand" aria-hidden="true" />
                    <span className="truncate">{question}</span>
                  </button>
                );
              })}
            </div>
          </div>
        ) : (
          turns.map((turn) => (
            <div key={turn.id} className="rm-turn">
              <p className="rm-q">{turn.question}</p>
              {!turn.answer ? (
                <p className="rm-a rm-typing" aria-label="The coach is reading your roadmap">
                  <span />
                  <span />
                  <span />
                </p>
              ) : (
                <div className="rm-a">
                  <AnswerBody answer={turn.answer} shown={turn.shown} />
                  {turn.shown >= lengthOf(turn.answer) && (
                    <div className="rm-a-foot">
                      {turn.answer.actions.length > 0 && (
                        <div className="rm-actions">
                          {turn.answer.actions.map((action, index) => {
                            const done = action.type === 'tick' && ctx.steps.find((s) => s.id === action.stepId)?.done;
                            return (
                              <button
                                key={index}
                                type="button"
                                className="rm-action"
                                data-primary={index === 0}
                                data-done={Boolean(done)}
                                onClick={() => onAction(action)}
                              >
                                {action.type === 'tick' && <Check className="size-3.5" strokeWidth={done ? 3 : 2} aria-hidden="true" />}
                                {action.type === 'show' && <Eye className="size-3.5" aria-hidden="true" />}
                                {action.type === 'planWeek' && <CalendarDays className="size-3.5" aria-hidden="true" />}
                                {action.type === 'view' && <TrendingUp className="size-3.5" aria-hidden="true" />}
                                {done ? 'Done, tap to undo' : action.label}
                              </button>
                            );
                          })}
                        </div>
                      )}
                      <p className="rm-basis">From: {turn.answer.basis}</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          ))
        )}
      </div>
      <p className="sr-only" aria-live="polite">
        {announce}
      </p>

      {turns.length > 0 && chips.length > 0 && (
        <div className="rm-chips" role="group" aria-label="Suggested questions">
          {chips.map((question) => (
            <button key={question} type="button" className="rm-chip" disabled={busy} onClick={() => void ask(question)}>
              {question}
            </button>
          ))}
        </div>
      )}

      <form onSubmit={onSubmit} className="rm-form">
        <label className="sr-only" htmlFor="rm-coach-input">
          Ask about your roadmap
        </label>
        <input
          id="rm-coach-input"
          type="text"
          value={text}
          onChange={(event) => setText(event.target.value)}
          placeholder='Try "I have 4 hours this week" or "what should I do first?"'
          autoComplete="off"
        />
        <button type="submit" aria-label="Ask" disabled={text.trim() === '' || busy}>
          <ArrowUp className="size-4" strokeWidth={2.5} aria-hidden="true" />
        </button>
      </form>
      <p className="mt-2.5 px-1 text-xs text-ink-3">
        Answers are built from your own roadmap data. Grok answers here once the agents are connected.
      </p>
    </section>
  );
}
