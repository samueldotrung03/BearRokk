// "Ask BearRok": one assistant on every page. A button in the corner (or Cmd/Ctrl+K) opens a
// small chat that answers from the student's own data and offers the next action as a button.
import { ArrowUp, Sparkles, X } from 'lucide-react';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { useLocation, useNavigate } from 'react-router';
import { opportunities } from '../data/sample.ts';
import { respond, suggestionsFor, type AssistantAction, type AssistantReply } from '../lib/assistant.ts';
import { useStore } from '../state/StoreProvider.tsx';
import type { Opportunity } from '../types.ts';
import { Details } from './OpportunityCard.tsx';

/** Opens the assistant from anywhere in the app and asks it a question. */
export function askAssistant(question: string) {
  window.dispatchEvent(new CustomEvent('bearrok:ask', { detail: question }));
}

type Turn = { from: 'student'; text: string } | { from: 'assistant'; reply: AssistantReply; done: string[] };

export function Assistant() {
  const { state, dispatch } = useStore();
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [thread, setThread] = useState<Turn[]>([]);
  const [draft, setDraft] = useState('');
  const [thinking, setThinking] = useState(false);
  const [details, setDetails] = useState<Opportunity | null>(null);
  // A question sent from elsewhere in the app, asked once the panel is open.
  const [pending, setPending] = useState<string | null>(null);
  const input = useRef<HTMLInputElement>(null);
  const end = useRef<HTMLDivElement>(null);
  const timer = useRef<number | undefined>(undefined);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        setOpen((value) => !value);
      } else if (event.key === 'Escape' && !document.querySelector('dialog[open]')) {
        setOpen(false);
      }
    };
    const onAsk = (event: Event) => {
      setOpen(true);
      setPending((event as CustomEvent<string>).detail);
    };
    window.addEventListener('keydown', onKey);
    window.addEventListener('bearrok:ask', onAsk);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('bearrok:ask', onAsk);
      window.clearTimeout(timer.current);
    };
  }, []);

  useEffect(() => {
    if (open) input.current?.focus();
  }, [open]);
  useEffect(() => {
    end.current?.scrollIntoView({ block: 'end' });
  }, [thread, thinking]);

  const ask = (question: string) => {
    const text = question.trim();
    if (!text || thinking) return;
    setDraft('');
    setThread((current) => [...current, { from: 'student', text }]);
    setThinking(true);
    // A short pause so the answer reads as a reply rather than a flash.
    timer.current = window.setTimeout(() => {
      setThread((current) => [...current, { from: 'assistant', reply: respond(text, state), done: [] }]);
      setThinking(false);
    }, 450);
  };

  useEffect(() => {
    if (pending === null || thinking) return;
    setPending(null);
    if (pending) ask(pending);
  });

  const run = (turn: number, action: AssistantAction) => {
    if (action.dispatch) dispatch(action.dispatch);
    if (action.open) setDetails(opportunities.find((o) => o.id === action.open) ?? null);
    if (action.to) navigate(action.to);
    // Store changes are marked done so the same button is not pressed twice by mistake.
    if (action.dispatch) {
      setThread((current) =>
        current.map((entry, index) => (index === turn && entry.from === 'assistant' ? { ...entry, done: [...entry.done, action.label] } : entry)),
      );
    }
  };

  if (pathname === '/signin') return null;

  return (
    <>
      {!open && (
        <button type="button" className="assistant-launch" onClick={() => setOpen(true)} aria-label="Ask BearRok (Command K)">
          <Sparkles className="size-[18px]" aria-hidden="true" />
          <span>Ask BearRok</span>
          <kbd>⌘K</kbd>
        </button>
      )}

      {open && (
        <section className="assistant" aria-label="Ask BearRok">
          <header>
            <span className="assistant-mark">
              <Sparkles className="size-4" aria-hidden="true" />
            </span>
            <div className="min-w-0 flex-1">
              <h2 className="leading-tight font-semibold">Ask BearRok</h2>
              <p className="text-xs text-white/70">Knows your feed, roadmap, applications and calendar</p>
            </div>
            <button type="button" onClick={() => setOpen(false)} aria-label="Close" className="assistant-close">
              <X className="size-4" aria-hidden="true" />
            </button>
          </header>

          <div className="assistant-thread" aria-live="polite">
            {thread.length === 0 && (
              <div className="assistant-empty">
                <p className="font-display text-2xl leading-tight">What do you want to get done?</p>
                <p className="mt-1 text-sm text-ink-2">Ask a question, or tell me what to do with a card.</p>
              </div>
            )}
            {thread.map((turn, index) =>
              turn.from === 'student' ? (
                <p key={index} className="assistant-question">
                  {turn.text}
                </p>
              ) : (
                <div key={index} className="assistant-answer">
                  <p>{turn.reply.text}</p>
                  {turn.reply.points && turn.reply.points.length > 0 && (
                    <ul>
                      {turn.reply.points.map((point) => (
                        <li key={point}>
                          {thread.length - 1 === index && turn.reply.actions === undefined ? (
                            <button type="button" onClick={() => ask(point)} className="text-left font-medium text-brand">
                              {point}
                            </button>
                          ) : (
                            point
                          )}
                        </li>
                      ))}
                    </ul>
                  )}
                  {turn.reply.actions && (
                    <div className="assistant-actions">
                      {turn.reply.actions.map((action) => {
                        const done = turn.done.includes(action.label);
                        return (
                          <button key={action.label} type="button" disabled={done} onClick={() => run(index, action)}>
                            {done ? 'Done' : action.label}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              ),
            )}
            {thinking && (
              <div className="assistant-answer assistant-thinking" aria-label="Thinking">
                <span />
                <span />
                <span />
              </div>
            )}
            <div ref={end} />
          </div>

          <div className="assistant-chips">
            {suggestionsFor(pathname).map((suggestion) => (
              <button key={suggestion} type="button" onClick={() => ask(suggestion)}>
                {suggestion}
              </button>
            ))}
          </div>
          <form
            className="assistant-form"
            onSubmit={(event: FormEvent) => {
              event.preventDefault();
              ask(draft);
            }}
          >
            <label className="sr-only" htmlFor="assistant-input">
              Ask BearRok
            </label>
            <input id="assistant-input" ref={input} value={draft} onChange={(event) => setDraft(event.target.value)} placeholder="Ask, or say what to do" autoComplete="off" />
            <button type="submit" disabled={!draft.trim() || thinking} aria-label="Send">
              <ArrowUp className="size-4" aria-hidden="true" />
            </button>
          </form>
          <p className="assistant-note">Answers are built from your own data in this app. Grok answers here once the agents are connected.</p>
        </section>
      )}

      {details && <Details opportunity={details} onClose={() => setDetails(null)} />}
    </>
  );
}
