import { Check, Copy, Download, Flame, Trophy } from 'lucide-react';
import { useState } from 'react';
import type { Milestone, Streak } from '../../lib/roadmapx/milestones.ts';

/** Milestones reached and the next one, with the week streak above them. */
export function Milestones({ items, streak }: { items: Milestone[]; streak: Streak }) {
  const nextUp = items.find((item) => !item.reached);
  return (
    <div className="mt-5 border-t border-line pt-4">
      <div className="flex items-center gap-3">
        <span className="rm-flame" data-on={streak.weeks > 0} aria-hidden="true">
          <Flame className="size-4" />
        </span>
        <p className="text-sm leading-snug">
          {streak.weeks > 0 ? (
            <>
              <span className="font-semibold">
                {streak.weeks} {streak.weeks === 1 ? 'week' : 'weeks'} in a row
              </span>
              <span className="text-ink-3"> · {streak.thisWeek} done in the last 7 days</span>
            </>
          ) : (
            <span className="text-ink-2">Finish a step this week to start a streak.</span>
          )}
        </p>
      </div>
      <ol className="rm-miles mt-4" aria-label="Milestones">
        {items.map((item) => (
          <li key={item.id} data-reached={item.reached} data-next={item === nextUp}>
            <span className="rm-mile-dot" aria-hidden="true">
              {item.reached ? <Check className="size-3" strokeWidth={3} /> : item === nextUp ? <Trophy className="size-3" /> : null}
            </span>
            <span className="min-w-0">
              <span className="block text-sm font-medium">{item.label}</span>
              {item === nextUp && <span className="block text-xs text-ink-3">{item.toGo}</span>}
            </span>
            <span className="sr-only">{item.reached ? 'reached' : 'not reached yet'}</span>
          </li>
        ))}
      </ol>
    </div>
  );
}

/** Copies the roadmap as plain text; if the clipboard is blocked, downloads it as a file. */
export function ExportButton({ getText, fileName }: { getText: () => string; fileName: string }) {
  const [status, setStatus] = useState<'idle' | 'copied' | 'saved'>('idle');
  const run = async () => {
    const text = getText();
    try {
      await navigator.clipboard.writeText(text);
      setStatus('copied');
    } catch {
      const url = URL.createObjectURL(new Blob([text], { type: 'text/plain' }));
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName;
      a.click();
      URL.revokeObjectURL(url);
      setStatus('saved');
    }
    window.setTimeout(() => setStatus('idle'), 2200);
  };
  return (
    <button type="button" onClick={() => void run()} className="rm-ghost-btn" aria-live="polite">
      {status === 'idle' ? <Copy className="size-4" aria-hidden="true" /> : status === 'copied' ? <Check className="size-4" aria-hidden="true" /> : <Download className="size-4" aria-hidden="true" />}
      {status === 'idle' ? 'Copy as text' : status === 'copied' ? 'Copied' : 'Saved as a file'}
    </button>
  );
}
