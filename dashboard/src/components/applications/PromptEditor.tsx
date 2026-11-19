// One application question with its draft box and the writing helper. The helper's two
// actions, "Outline my answer" and "Check my draft", go through a WritingAssistant, so the rule
// based one used here can be swapped for Grok without changing this component.
import { Check, CheckCheck, CircleAlert, Copy, Lightbulb, CircleCheck, PencilLine, Sparkles, Undo2, WandSparkles, X } from 'lucide-react';
import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { countWords, findBlanks, parseLimit, promptText } from '../../lib/apps/text.ts';
import { localAssistant, outlineToDraft, type Note, type Outline, type Review, type WritingAssistant } from '../../lib/apps/writer.ts';
import { useStore } from '../../state/StoreProvider.tsx';
import type { Opportunity } from '../../types.ts';
import { ReadinessRing, WithBlanks, promptDomId, scoreTone, useReducedMotion, useReveal, type Intent } from './shared.tsx';

// A short pause before the answer appears. It reads as the helper "thinking" and keeps the
// streaming feel honest to how a model call will behave once it is connected.
const THINK_MS = 420;

// Requests already acted on, so reopening a question later does not start the helper again.
const handled = new Set<number>();

const toneIcon = { fix: CircleAlert, tip: Lightbulb, good: CircleCheck } as const;
const toneLabel = { fix: 'Fix', tip: 'Tip', good: 'Good' } as const;

export function PromptEditor({
  opportunity: o,
  prompt,
  index,
  draft,
  intent,
  assistant = localAssistant,
}: {
  opportunity: Opportunity;
  prompt: string;
  index: number;
  draft: string;
  intent?: Intent;
  assistant?: WritingAssistant;
}) {
  const { state, dispatch } = useStore();
  const profile = state.profile;
  const textarea = useRef<HTMLTextAreaElement>(null);
  const headingId = useId();
  const reduced = useReducedMotion();
  const limit = useMemo(() => parseLimit(prompt), [prompt]);
  const words = countWords(draft);
  const blanks = findBlanks(draft);

  const [panel, setPanel] = useState<'outline' | 'review' | null>(null);
  const [thinking, setThinking] = useState(false);
  const [outline, setOutline] = useState<Outline | null>(null);
  const [review, setReview] = useState<Review | null>(null);
  const [answerKey, setAnswerKey] = useState(0);
  const [undo, setUndo] = useState<string | null>(null);
  const [saved, setSaved] = useState<'idle' | 'saving' | 'saved'>(draft ? 'saved' : 'idle');
  const [copied, setCopied] = useState(false);
  const saveTimer = useRef<number | undefined>(undefined);

  const setDraft = (text: string) => {
    dispatch({ type: 'setDraft', id: o.id, index, text });
    // The store writes to localStorage on every change; the pause only keeps the label calm.
    setSaved('saving');
    window.clearTimeout(saveTimer.current);
    saveTimer.current = window.setTimeout(() => setSaved('saved'), 550);
  };
  useEffect(() => () => window.clearTimeout(saveTimer.current), []);

  const request = () => ({ prompt, draft, opportunity: o, profile });

  async function runOutline() {
    setPanel('outline');
    setThinking(true);
    const [result] = await Promise.all([assistant.outline(request()), wait(reduced ? 0 : THINK_MS)]);
    setOutline(result);
    setAnswerKey((k) => k + 1);
    setThinking(false);
  }

  async function runReview() {
    setPanel('review');
    setThinking(true);
    const [result] = await Promise.all([assistant.review(request()), wait(reduced ? 0 : THINK_MS)]);
    setReview(result);
    setAnswerKey((k) => k + 1);
    setThinking(false);
  }

  // Once the check is open it follows the draft, so fixing a note makes it go away as you type.
  useEffect(() => {
    if (panel !== 'review' || thinking) return;
    const timer = window.setTimeout(() => {
      void assistant.review({ prompt, draft, opportunity: o, profile }).then(setReview);
    }, 220);
    return () => window.clearTimeout(timer);
    // Only a draft change should re-run the check; the other values are read fresh each time.
  }, [draft]);

  // A request from the "what to do next" strip: focus this question and start the helper.
  useEffect(() => {
    if (!intent || intent.index !== index || handled.has(intent.nonce)) return;
    handled.add(intent.nonce);
    if (intent.kind === 'outline') void runOutline();
    if (intent.kind === 'review') void runReview();
    // Runs once per request; the nonce changes even when the same question is asked for twice.
  }, [intent?.nonce]);

  function select(start: number, end: number) {
    const el = textarea.current;
    if (!el) return;
    el.focus();
    el.setSelectionRange(start, end);
  }

  function nextBlank() {
    const el = textarea.current;
    const from = el && el.selectionEnd < draft.length ? el.selectionEnd : 0;
    const blank = blanks.find((b) => b.start >= from) ?? blanks[0];
    if (blank) select(blank.start, blank.end);
  }

  /** Puts text where the cursor is, with a space on either side when the words would touch. */
  function insertAtCursor(text: string) {
    const el = textarea.current;
    const start = el ? el.selectionStart : draft.length;
    const end = el ? el.selectionEnd : draft.length;
    const before = draft.slice(0, start);
    const after = draft.slice(end);
    const lead = before && !/\s$/.test(before) ? ' ' : '';
    const trail = after && !/^\s/.test(after) ? ' ' : '';
    setUndo(draft);
    setDraft(before + lead + text + trail + after);
    const caret = (before + lead + text).length;
    requestAnimationFrame(() => select(caret, caret));
  }

  function insertOutline(text: string) {
    setUndo(draft);
    const next = draft.trim() ? `${draft.trimEnd()}\n\n${text}` : text;
    setDraft(next);
    // Land on the first blank of what was just added, ready to type over it.
    const offset = next.length - text.length;
    const first = findBlanks(text)[0];
    requestAnimationFrame(() => (first ? select(offset + first.start, offset + first.end) : select(next.length, next.length)));
  }

  const outlineText = outline ? outlineToDraft(outline) : '';
  const sectionsShown = useReveal(outline?.sections.length ?? 0, panel === 'outline' ? answerKey : -1);
  const notesShown = useReveal(review?.notes.length ?? 0, panel === 'review' ? answerKey : -1, 140);
  const streaming = panel === 'outline' && outline !== null && sectionsShown < outline.sections.length;

  const over = limit.max !== null && words > limit.max;
  const meterTone = limit.max === null ? 'none' : over ? 'over' : words >= limit.max * 0.5 ? 'good' : 'under';

  return (
    <section className="ap-prompt" aria-labelledby={headingId} data-flash>
      <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-1">
        <h4 id={headingId} className="max-w-[60ch] text-[15px] leading-relaxed font-semibold text-ink">
          <span className="mr-2 font-display text-lg font-normal text-ink-3">{index + 1}</span>
          {promptText(prompt)}
        </h4>
        <span className="ap-chip-quiet">{limit.max ? `${limit.max} words` : limit.optional ? 'Optional' : 'No limit stated'}</span>
      </div>

      <label className="sr-only" htmlFor={promptDomId(o.id, index)}>
        Your answer to: {promptText(prompt)}
      </label>
      <textarea
        id={promptDomId(o.id, index)}
        ref={textarea}
        value={draft}
        onChange={(event) => {
          setUndo(null);
          setDraft(event.target.value);
        }}
        rows={draft.length > 280 ? 8 : 5}
        placeholder="Draft your answer here, or start from an outline. It is saved as you type."
        className="ap-textarea"
      />

      <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs">
        <div className="flex min-w-44 flex-1 items-center gap-2.5" aria-live="polite">
          {limit.max !== null && (
            <div className="ap-meter" data-tone={meterTone} aria-hidden="true">
              <span style={{ width: `${Math.min(100, (words / limit.max) * 100)}%` }} />
              <i style={{ left: '50%' }} />
            </div>
          )}
          <span className={`tabular-nums ${over ? 'font-semibold text-orange-700' : 'text-ink-3'}`}>
            {words} {limit.max !== null ? `of ${limit.max} words` : words === 1 ? 'word' : 'words'}
            {over && ` · ${words - limit.max!} over`}
          </span>
        </div>
        {blanks.length > 0 && (
          <button type="button" onClick={nextBlank} className="ap-chip ap-chip-warn">
            <PencilLine className="size-3.5" aria-hidden="true" />
            Fill next blank · {blanks.length} left
          </button>
        )}
        {undo !== null && (
          <button type="button" onClick={() => (setDraft(undo), setUndo(null))} className="ap-chip">
            <Undo2 className="size-3.5" aria-hidden="true" />
            Undo insert
          </button>
        )}
        <span className="ap-saved" data-state={saved} aria-live="polite">
          {saved === 'saving' ? 'Saving…' : saved === 'saved' ? (
            <>
              <Check className="size-3.5" aria-hidden="true" />
              Saved on this device
            </>
          ) : null}
        </span>
      </div>

      <div className="ap-helper">
        <div className="flex flex-wrap items-center gap-2">
          <span className="ap-helper-badge">
            <Sparkles className="size-3.5" aria-hidden="true" />
            Writing helper
          </span>
          <button type="button" onClick={() => void runOutline()} className="ap-ai-btn" aria-pressed={panel === 'outline'}>
            <WandSparkles className="size-4" aria-hidden="true" />
            Outline my answer
          </button>
          <button
            type="button"
            onClick={() => void runReview()}
            className="ap-ai-btn"
            aria-pressed={panel === 'review'}
            disabled={words === 0}
            title={words === 0 ? 'Write something first' : undefined}
          >
            <CheckCheck className="size-4" aria-hidden="true" />
            Check my draft
          </button>
          {panel && (
            <button type="button" onClick={() => setPanel(null)} className="ml-auto grid size-8 place-items-center rounded-lg text-ink-3 hover:bg-white hover:text-ink" aria-label="Close the helper">
              <X className="size-4" aria-hidden="true" />
            </button>
          )}
        </div>

        <div aria-live="polite" aria-busy={thinking}>
          {thinking && (
            <div className="ap-thinking">
              <span className="ap-dots" aria-hidden="true">
                <i />
                <i />
                <i />
              </span>
              {panel === 'outline' ? `Reading the ${o.organizer} posting and your profile…` : 'Reading your draft against the question…'}
            </div>
          )}

          {!thinking && panel === 'outline' && outline && (
            <div className="mt-3">
              {outline.parts.length > 1 && (
                <p className="text-xs text-ink-3">
                  The question asks {outline.parts.length} things: {outline.parts.map((p) => `“${p}”`).join(' ')}
                </p>
              )}
              <ol className="mt-2 space-y-2">
                {outline.sections.slice(0, sectionsShown).map((section, i) => (
                  <li key={section.heading} className="ap-section" data-streaming={streaming && i === sectionsShown - 1}>
                    <div className="flex items-baseline justify-between gap-3">
                      <p className="text-sm font-semibold text-ink">
                        <span className="mr-1.5 font-display text-base font-normal text-brand">{i + 1}.</span>
                        {section.heading}
                      </p>
                      {section.words && <span className="shrink-0 text-xs text-ink-3 tabular-nums">~{section.words} words</span>}
                    </div>
                    <p className="mt-0.5 text-[13px] leading-relaxed text-ink-2">{section.guide}</p>
                    <div className="mt-1.5 flex items-start gap-2">
                      <p className="ap-starter flex-1">
                        <WithBlanks text={section.starter} />
                      </p>
                      <button type="button" onClick={() => insertAtCursor(section.starter)} className="ap-mini" aria-label={`Insert “${section.heading}” at the cursor`}>
                        Insert
                      </button>
                    </div>
                  </li>
                ))}
              </ol>
              {!streaming && (
                <>
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <button type="button" onClick={() => insertOutline(outlineText)} className="btn-primary inline-flex h-9 items-center gap-1.5 rounded-xl px-3.5 text-sm text-white">
                      <PencilLine className="size-4" aria-hidden="true" />
                      Put the outline in my draft
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        void navigator.clipboard?.writeText(outlineText).then(() => {
                          setCopied(true);
                          window.setTimeout(() => setCopied(false), 1500);
                        });
                      }}
                      className="ap-chip"
                    >
                      {copied ? <Check className="size-3.5" aria-hidden="true" /> : <Copy className="size-3.5" aria-hidden="true" />}
                      {copied ? 'Copied' : 'Copy'}
                    </button>
                  </div>
                  <div className="mt-3">
                    <p className="text-xs font-medium text-ink-3">Built from these facts. Click one to add it at the cursor.</p>
                    <div className="mt-1.5 flex flex-wrap gap-1.5">
                      {outline.facts.map((fact) => (
                        <button key={`${fact.source}-${fact.value}`} type="button" onClick={() => insertAtCursor(fact.value)} className="ap-fact" data-source={fact.source} title={fact.label}>
                          <span className="ap-fact-src">{fact.source === 'profile' ? 'You' : 'Posting'}</span>
                          {fact.value}
                        </button>
                      ))}
                    </div>
                  </div>
                </>
              )}
            </div>
          )}

          {!thinking && panel === 'review' && review && (
            <div className="mt-3">
              <div className="flex items-center gap-3">
                <ReadinessRing score={review.score} size={44} />
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-ink">{verdict(review)}</p>
                  <p className="text-xs text-ink-3">Updates as you type.</p>
                </div>
              </div>
              <ul className="mt-3 space-y-1.5">
                {review.notes.slice(0, notesShown).map((note) => (
                  <NoteRow key={note.id} note={note} onShow={note.target ? () => select(note.target!.start, note.target!.end) : undefined} />
                ))}
              </ul>
            </div>
          )}
        </div>

        <p className="mt-3 text-[11px] leading-relaxed text-ink-3">
          Built from the posting and your profile, and it never writes your experiences for you. Grok will write with you here once the agents are connected.
        </p>
      </div>
    </section>
  );
}

function NoteRow({ note, onShow }: { note: Note; onShow?: () => void }) {
  const Icon = toneIcon[note.tone];
  return (
    <li className="ap-note" data-tone={note.tone}>
      <Icon className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
      <div className="min-w-0 flex-1">
        <p className="text-[13px] font-semibold text-ink">
          <span className="sr-only">{toneLabel[note.tone]}: </span>
          {note.title}
        </p>
        <p className="text-[13px] leading-relaxed text-ink-2">{note.detail}</p>
      </div>
      {onShow && (
        <button type="button" onClick={onShow} className="ap-mini">
          Show me
        </button>
      )}
    </li>
  );
}

function verdict(review: Review): string {
  const tone = scoreTone(review.score);
  const fixes = review.notes.filter((n) => n.tone === 'fix').length;
  if (tone === 'high' && fixes === 0) return 'Close to ready';
  if (fixes > 0) return `${fixes} ${fixes === 1 ? 'thing' : 'things'} to fix`;
  return 'On the way. A few tips below';
}

const wait = (ms: number) => new Promise<void>((resolve) => window.setTimeout(resolve, ms));
