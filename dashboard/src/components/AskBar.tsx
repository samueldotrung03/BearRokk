import { ArrowUp, Sparkles } from 'lucide-react';
import { useRef, useState, type FormEvent } from 'react';
import { applicationInfo, roadmaps } from '../data/sample.ts';
import { answerQuestion, suggestedQuestions } from '../lib/ask.ts';
import { useStore } from '../state/StoreProvider.tsx';
import type { Opportunity } from '../types.ts';

interface Turn {
  question: string;
  answer: string;
}

/** A question box about one opportunity, with the conversation above it. */
export function AskBar({ opportunity: o }: { opportunity: Opportunity }) {
  const { state } = useStore();
  const [turns, setTurns] = useState<Turn[]>([]);
  const [text, setText] = useState('');
  const end = useRef<HTMLDivElement>(null);

  const ask = (question: string) => {
    const trimmed = question.trim();
    if (!trimmed) return;
    const step = roadmaps
      .find((r) => r.goalId === state.goalId)
      ?.phases.flatMap((phase) => phase.steps)
      .find((candidate) => candidate.opportunityId === o.id);
    const answer = answerQuestion(o, trimmed, { info: applicationInfo[o.id], step, profile: state.profile });
    setTurns((current) => [...current, { question: trimmed, answer }]);
    setText('');
    requestAnimationFrame(() => end.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' }));
  };

  const onSubmit = (event: FormEvent) => {
    event.preventDefault();
    ask(text);
  };

  return (
    <section className="ask" aria-label="Ask about this opportunity">
      <h3 className="flex items-center gap-2 text-sm font-semibold">
        <Sparkles className="size-4 text-brand" aria-hidden="true" />
        Ask about this
      </h3>

      {turns.length > 0 && (
        <div className="ask-thread" aria-live="polite">
          {turns.map((turn, index) => (
            <div key={index} className="space-y-2">
              <p className="ask-question">{turn.question}</p>
              <p className="ask-answer">{turn.answer}</p>
            </div>
          ))}
          <div ref={end} />
        </div>
      )}

      <div className="ask-chips">
        {suggestedQuestions.map((question) => (
          <button key={question} type="button" onClick={() => ask(question)} className="ask-chip">
            {question}
          </button>
        ))}
      </div>

      <form onSubmit={onSubmit} className="ask-form mt-3">
        <label className="sr-only" htmlFor={`${o.id}-ask`}>
          Your question
        </label>
        <input
          id={`${o.id}-ask`}
          type="text"
          value={text}
          onChange={(event) => setText(event.target.value)}
          placeholder="Ask anything about this opportunity"
          autoComplete="off"
        />
        <button type="submit" aria-label="Ask" disabled={text.trim() === ''}>
          <ArrowUp className="size-4" strokeWidth={2.5} aria-hidden="true" />
        </button>
      </form>
      <p className="mt-2 text-xs text-ink-3">Sample answers built from this card. Grok answers here once the agents are connected.</p>
    </section>
  );
}
