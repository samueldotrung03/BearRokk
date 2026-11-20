// The right side of the portal: one part of the application, ready to work on. A question shows
// its prompt, word limit and a writing area with a live word count; an upload shows what to upload
// and its files; a note is a free document. Every part can be renamed, ticked done or deleted.
import { Check, Trash } from 'lucide-react';
import { useId } from 'react';
import { TAB_LIMITS, titleFromPrompt, wordStatus } from '../../../lib/portal/tabs.ts';
import type { PortalFile, PortalTab } from '../../../lib/portal/types.ts';
import { kindIcon, kindLabel, sourceLabel } from './kinds.ts';
import { UploadZone } from './UploadZone.tsx';
import { WritingArea } from './WritingArea.tsx';

export type TabPatch = Partial<Pick<PortalTab, 'title' | 'prompt' | 'wordLimit' | 'body' | 'files' | 'done'>>;

export function TabEditor({
  tab,
  index,
  total,
  onChange,
  onDelete,
  autoFocus = false,
}: {
  tab: PortalTab;
  index: number;
  total: number;
  /** `immediate` saves at once (ticks, files) rather than after the typing pause. */
  onChange: (patch: TabPatch, immediate?: boolean) => void;
  onDelete: () => void;
  /** A tab just added starts with the cursor in its first field. */
  autoFocus?: boolean;
}) {
  const ids = useId();
  const Icon = kindIcon[tab.kind];
  const own = tab.source === 'student';
  const words = wordStatus(tab.body, tab.wordLimit);

  // A question still named after its prompt keeps following the prompt as the student writes it.
  const changePrompt = (prompt: string) => {
    const following = !tab.title || tab.title === 'New question' || tab.title === titleFromPrompt(tab.prompt);
    onChange(tab.kind === 'question' && following ? { prompt, title: titleFromPrompt(prompt) || 'New question' } : { prompt });
  };

  return (
    <article className="pt-editor" aria-labelledby={`${ids}-title`}>
      <div className="pt-editor-top">
        <span className="pt-kind">
          <Icon className="size-3.5" aria-hidden="true" />
          {kindLabel[tab.kind]}
          <span className="text-ink-3">
            · Part {index + 1} of {total} · {sourceLabel[tab.source]}
          </span>
        </span>
        <span className="flex items-center gap-2">
          <button type="button" className="pt-done-btn" aria-pressed={tab.done} onClick={() => onChange({ done: !tab.done }, true)}>
            <Check className="size-4" aria-hidden="true" />
            {tab.done ? 'Done' : 'Mark part done'}
          </button>
          <button type="button" className="pt-icon-btn" onClick={onDelete} aria-label={`Delete ${tab.title || 'this part'}`} title="Delete this part">
            <Trash className="size-4" aria-hidden="true" />
          </button>
        </span>
      </div>

      <input
        id={`${ids}-title`}
        className="pt-title-input"
        value={tab.title}
        onChange={(e) => onChange({ title: e.target.value })}
        aria-label="Part name"
        maxLength={TAB_LIMITS.title}
        placeholder={tab.kind === 'note' ? 'Untitled note' : 'Name this part'}
        autoFocus={autoFocus && tab.kind !== 'question'}
      />

      {tab.kind === 'question' && (
        <>
          {own ? (
            <div className="pt-fields">
              <label className="pt-field">
                <span className="pt-label">Prompt</span>
                <textarea
                  className="pt-prompt-input"
                  value={tab.prompt}
                  onChange={(e) => changePrompt(e.target.value)}
                  placeholder="Type or paste the question as the organizer asks it"
                  rows={3}
                  maxLength={TAB_LIMITS.prompt}
                  autoFocus={autoFocus}
                />
              </label>
              <label className="pt-field pt-field-narrow">
                <span className="pt-label">Word limit (optional)</span>
                <input
                  className="pt-number"
                  type="number"
                  min={1}
                  inputMode="numeric"
                  value={tab.wordLimit ?? ''}
                  onChange={(e) => {
                    const n = Number.parseInt(e.target.value, 10);
                    onChange({ wordLimit: Number.isFinite(n) && n > 0 ? n : null });
                  }}
                  placeholder="None"
                />
              </label>
            </div>
          ) : (
            <>
              {tab.prompt ? <blockquote className="pt-prompt">{tab.prompt}</blockquote> : <p className="pt-prompt pt-prompt-missing">No prompt was given for this part.</p>}
              <p className="pt-limit">{tab.wordLimit ? `Word limit: ${tab.wordLimit}` : 'No word limit given'}</p>
            </>
          )}
          <WritingArea value={tab.body} onChange={(body) => onChange({ body })} label={`Your answer to ${tab.title || 'this question'}`} placeholder="Write your answer here. Leave a blank line between paragraphs." over={words.over} describedBy={`${ids}-count`} />
          <p id={`${ids}-count`} className="pt-count" data-over={words.over || undefined} aria-live="polite">
            {words.label}
            {words.over && tab.wordLimit ? `. ${words.count - tab.wordLimit} over the limit; trim it before you submit.` : ''}
          </p>
        </>
      )}

      {tab.kind === 'upload' && (
        <>
          {own ? (
            <label className="pt-field">
              <span className="pt-label">What to upload</span>
              <textarea className="pt-prompt-input" value={tab.prompt} onChange={(e) => onChange({ prompt: e.target.value })} placeholder="For example: one-page résumé as a PDF" rows={2} maxLength={TAB_LIMITS.prompt} />
            </label>
          ) : tab.prompt ? (
            <blockquote className="pt-prompt">{tab.prompt}</blockquote>
          ) : null}
          <UploadZone tab={tab} onFiles={(files: PortalFile[]) => onChange({ files }, true)} />
        </>
      )}

      {tab.kind === 'note' && (
        <>
          <p className="pt-limit">A note works as your own doc: drafts, lists, people to ask, anything for this application.</p>
          <WritingArea value={tab.body} onChange={(body) => onChange({ body })} label={`Note: ${tab.title || 'untitled'}`} placeholder="Start writing…" />
          <p className="pt-count">{words.label}</p>
        </>
      )}
    </article>
  );
}
