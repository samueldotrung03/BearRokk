// The "Add more" window: the student tells the agents what they want more of on one part of a
// guide. It offers requests the agents wrote for this student, shows what they asked here before
// and what each found, and stays open while the agents work so the student can watch or ask again.
import { Sparkles, X } from 'lucide-react';
import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from 'react';
import { SECTION_TITLES, type Guide, type GuideAsk, type SectionId } from '../../lib/discover/guide.ts';

const PLACEHOLDER: Record<SectionId, string> = {
  basics: 'For example: which tools do people use most in their first job?',
  voices: 'For example: posts from people who switched into this career',
  interview: 'For example: more technical questions for new graduates',
  start: 'For example: what can I do this summer as a sophomore?',
};

function ago(iso: string, now = Date.now()) {
  const minutes = Math.round((now - new Date(iso).getTime()) / 60000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} h ago`;
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

/** What one earlier ask came to, in one line. */
export function askOutcome(ask: GuideAsk): string {
  if (ask.status === 'working') return 'Working on it';
  if (ask.status === 'redirected') return ask.note ?? 'This is a search for postings; the Feed is where your agents look for those.';
  if (ask.status === 'failed') return 'Could not finish this one';
  return ask.added ? `Added ${ask.added} new ${ask.added === 1 ? 'item' : 'items'}` : 'Found nothing new';
}

export function AskAgents({
  guide,
  section,
  onSend,
  onSuggest,
  onClose,
}: {
  guide: Guide;
  section: SectionId;
  /** Resolves to an error line, or null once the agents have started. */
  onSend: (prompt: string) => Promise<string | null>;
  onSuggest: () => Promise<string[]>;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const field = useRef<HTMLTextAreaElement>(null);
  const [prompt, setPrompt] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [suggestions, setSuggestions] = useState<string[] | null>(null);

  const state = guide.sections[section];
  const working = state.status === 'working';
  const asks = (guide.asks ?? []).filter((a) => a.section === section);
  const current = [...asks].reverse().find((a) => a.status === 'working');
  const progress = current ? (guide.activity ?? []).filter((e) => e.ask === current.id) : [];
  const finished = asks.filter((a) => a.status !== 'working').length;

  useEffect(() => {
    ref.current?.showModal();
    field.current?.focus();
  }, []);

  // New suggestions when the window opens and after each ask finishes, since the part has changed.
  useEffect(() => {
    let live = true;
    setSuggestions(null);
    void onSuggest().then((list) => live && setSuggestions(list));
    return () => {
      live = false;
    };
  }, [section, finished]);

  const send = async (e?: FormEvent) => {
    e?.preventDefault();
    const text = prompt.trim();
    if (!text || sending || working) return;
    setSending(true);
    setError(null);
    const problem = await onSend(text);
    setSending(false);
    if (problem) setError(problem);
    else setPrompt('');
  };

  const onKey = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) void send();
  };

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onClick={(event) => {
        if (event.target === ref.current) ref.current.close();
      }}
      aria-labelledby="dc-ask-title"
      className="dc-ask"
    >
      <header className="dc-ask-head">
        <div className="min-w-0">
          <p className="dc-eyebrow">{guide.title}</p>
          <h2 id="dc-ask-title" className="mt-0.5 text-lg font-semibold text-ink">
            {`Add more to ${SECTION_TITLES[section].toLowerCase()}`}
          </h2>
        </div>
        <button type="button" onClick={() => ref.current?.close()} aria-label="Close" className="dc-ask-close">
          <X className="size-4" aria-hidden="true" />
        </button>
      </header>

      <div className="dc-ask-body">
        {working && (
          <section className="dc-ask-progress" aria-live="polite">
            <p className="flex items-center gap-2 text-sm font-semibold text-ink">
              <span className="live-dot size-2 rounded-full bg-[#34c759]" aria-hidden="true" />
              Your agents are working on it
            </p>
            {current && <p className="mt-1 text-sm text-ink-2">{current.note ?? `"${current.prompt}"`}</p>}
            {progress.length > 0 && (
              <ol className="dc-ask-log">
                {progress.slice(-5).map((e, i) => (
                  <li key={`${e.at}-${i}`} className={e.tone === 'bad' ? 'is-bad' : e.tone === 'good' ? 'is-good' : ''}>
                    <span className="font-medium text-ink">{e.agent}</span> {e.text}
                  </li>
                ))}
              </ol>
            )}
          </section>
        )}

        <form onSubmit={send} className="grid gap-2">
          <label htmlFor="dc-ask-prompt" className="text-sm font-medium text-ink">
            What do you want to know more about?
          </label>
          <textarea
            ref={field}
            id="dc-ask-prompt"
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            onKeyDown={onKey}
            placeholder={PLACEHOLDER[section]}
            maxLength={300}
            rows={3}
            className="dc-ask-field"
          />
          {error && (
            <p className="text-sm text-[var(--danger)]" role="alert">
              {error}
            </p>
          )}
          <div className="flex items-center justify-between gap-3">
            <span className="flex shrink-0 items-center gap-1 whitespace-nowrap text-xs text-ink-3">
              <kbd className="dc-kbd">Ctrl</kbd> <kbd className="dc-kbd">Enter</kbd> to send
            </span>
            <button type="submit" className="btn-primary h-9 px-4 text-sm text-white disabled:opacity-60" disabled={!prompt.trim() || sending || working}>
              {working ? 'Agents working' : sending ? 'Sending' : 'Send to the agents'}
            </button>
          </div>
        </form>

        <section>
          <h3 className="dc-eyebrow flex items-center gap-1.5">
            <Sparkles className="size-3.5" aria-hidden="true" />
            Suggested for you
          </h3>
          {suggestions === null ? (
            <p className="mt-2 text-sm text-ink-3">Your agents are writing suggestions</p>
          ) : suggestions.length === 0 ? (
            <p className="mt-2 text-sm text-ink-3">No suggestions right now. Write your own above.</p>
          ) : (
            <div className="mt-2 flex flex-wrap gap-2">
              {suggestions.map((s) => (
                <button
                  key={s}
                  type="button"
                  className="dc-chip"
                  onClick={() => {
                    setPrompt(s);
                    field.current?.focus();
                  }}
                >
                  {s}
                </button>
              ))}
            </div>
          )}
        </section>

        <section>
          <h3 className="dc-eyebrow">Your asks on this part</h3>
          {asks.length === 0 ? (
            <p className="mt-2 text-sm text-ink-3">Nothing asked here yet.</p>
          ) : (
            <ul className="dc-ask-history">
              {[...asks].reverse().map((a) => (
                <li key={a.id}>
                  <p className="text-sm text-ink">{a.prompt}</p>
                  <p className="text-xs text-ink-3">
                    {`${askOutcome(a)} · ${ago(a.at)}`}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </dialog>
  );
}
