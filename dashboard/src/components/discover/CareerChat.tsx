import { ArrowUp, CircleHelp, Sparkles } from 'lucide-react';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { localAdvisor, suggestedCareerQuestions, type AnswerAction, type AskCareerContext, type CareerAdvisor, type CareerAnswer } from '../../lib/discover/ask.ts';
import { prefersReducedMotion, useStreamedText } from './motion.ts';

interface Turn {
  id: number;
  question: string;
  answer: CareerAnswer | null;
}

interface CareerChatProps {
  context: AskCareerContext;
  onAction: (action: AnswerAction) => void;
  advisor?: CareerAdvisor;
}

let nextId = 1;

/**
 * "Ask about this career": a short conversation about the selected path. Each path keeps its own
 * thread while the page is open, so switching paths and back does not lose it.
 */
export function CareerChat({ context, onAction, advisor = localAdvisor }: CareerChatProps) {
  const pathId = context.insight.path.id;
  const title = context.insight.path.title;
  const [threads, setThreads] = useState<Record<string, Turn[]>>({});
  const [text, setText] = useState('');
  const [latest, setLatest] = useState<number | null>(null);
  const scroller = useRef<HTMLDivElement>(null);
  const turns = threads[pathId] ?? [];
  const waiting = turns.some((t) => t.answer === null);
  // Keep the newest context for answers that arrive after a short delay.
  const contextRef = useRef(context);
  contextRef.current = context;

  const scrollDown = () =>
    requestAnimationFrame(() => {
      const el = scroller.current;
      if (el) el.scrollTo({ top: el.scrollHeight, behavior: prefersReducedMotion() ? 'auto' : 'smooth' });
    });

  const ask = (question: string) => {
    const trimmed = question.trim();
    if (!trimmed || waiting) return;
    const id = nextId++;
    const forPath = pathId;
    setThreads((all) => ({ ...all, [forPath]: [...(all[forPath] ?? []), { id, question: trimmed, answer: null }] }));
    setText('');
    setLatest(id);
    scrollDown();
    // The local answer is instant. A short "thinking" beat keeps the rhythm of a real reply.
    const delay = prefersReducedMotion() ? 0 : 380;
    void advisor.answer(trimmed, contextRef.current).then((answer) => {
      window.setTimeout(() => {
        setThreads((all) => ({ ...all, [forPath]: (all[forPath] ?? []).map((t) => (t.id === id ? { ...t, answer } : t)) }));
        scrollDown();
      }, delay);
    });
  };

  const onSubmit = (event: FormEvent) => {
    event.preventDefault();
    ask(text);
  };

  const asked = new Set(turns.map((t) => t.question));
  const chips = suggestedCareerQuestions(context).filter((q) => !asked.has(q));

  return (
    <section className="dc-chat" aria-label={`Ask about ${title}`}>
      <header className="flex items-center gap-2.5">
        <span className="dc-chat-orb" aria-hidden="true">
          <Sparkles className="size-3.5" />
        </span>
        <div className="min-w-0">
          <h3 className="text-sm font-semibold text-ink">Ask about this career</h3>
          <p className="truncate text-xs text-ink-3">{title}</p>
        </div>
      </header>

      <div ref={scroller} className="dc-chat-thread" aria-live="polite">
        {turns.length === 0 && (
          <div className="dc-chat-empty">
            <p className="font-display text-[22px] leading-tight text-ink">What would you like to know?</p>
            <p className="mt-1.5 text-[13px] leading-relaxed text-ink-3">
              Answers come from this path's description, your profile, your feed and the sample histories. When the data does not say, the answer says so.
            </p>
          </div>
        )}
        {turns.map((turn) => (
          <div key={turn.id} className="grid gap-2">
            <p className="ask-question">{turn.question}</p>
            {turn.answer === null ? (
              <p className="dc-typing" aria-label="Thinking">
                <span />
                <span />
                <span />
              </p>
            ) : (
              <AnswerBubble answer={turn.answer} stream={turn.id === latest} onAction={onAction} onStreamTick={scrollDown} />
            )}
          </div>
        ))}
      </div>

      {chips.length > 0 && (
        <div className="dc-chips" role="group" aria-label="Suggested questions">
          {chips.map((question) => (
            <button key={question} type="button" onClick={() => ask(question)} disabled={waiting} className="ask-chip">
              {question}
            </button>
          ))}
        </div>
      )}

      <form onSubmit={onSubmit} className="ask-form mt-3">
        <label className="sr-only" htmlFor="dc-chat-input">
          Your question about {title}
        </label>
        <input
          id="dc-chat-input"
          type="text"
          value={text}
          onChange={(event) => setText(event.target.value)}
          placeholder={`Ask about ${title.toLowerCase()}`}
          autoComplete="off"
        />
        <button type="submit" aria-label="Ask" disabled={text.trim() === '' || waiting}>
          <ArrowUp className="size-4" strokeWidth={2.5} aria-hidden="true" />
        </button>
      </form>
      <p className="mt-2 text-xs text-ink-3">Sample answers built from this page's data. Grok answers here once the agents are connected.</p>
    </section>
  );
}

function AnswerBubble({
  answer,
  stream,
  onAction,
  onStreamTick,
}: {
  answer: CareerAnswer;
  stream: boolean;
  onAction: (action: AnswerAction) => void;
  onStreamTick: () => void;
}) {
  const { shown, done } = useStreamedText(answer.text, stream);
  // Follow the text as it grows, but only while it is still streaming.
  useEffect(() => {
    if (!done) onStreamTick();
  }, [shown, done, onStreamTick]);

  return (
    <div className="dc-answer">
      {!answer.known && (
        <span className="dc-unknown">
          <CircleHelp className="size-3" aria-hidden="true" /> Not in the data
        </span>
      )}
      <p>
        {shown}
        {!done && <span className="dc-caret" aria-hidden="true" />}
      </p>
      {done && (
        <div className="dc-fade mt-2.5 flex flex-wrap items-center gap-1.5">
          {answer.actions.map((action) => (
            <button key={action.label} type="button" onClick={() => onAction(action)} className="dc-action">
              {action.label}
            </button>
          ))}
          <span className="ml-auto text-[11px] text-ink-3">From: {answer.basis}</span>
        </div>
      )}
    </div>
  );
}
