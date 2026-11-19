// "Tell your agents": the student types an instruction, sees how the master agent reads it while
// typing, and sends it. Below the hero, the brief card shows the standing instructions and the
// brief and manager slots they produce.
import { ArrowRight, Send, X } from 'lucide-react';
import { useId, useState } from 'react';
import { categoryLabels } from '../../data/agents-extra.ts';
import { parseInstruction, termLabel, type Brief, type ParsedInstruction, type Slot } from '../../lib/agents/brief.ts';
import { Card } from '../Page.tsx';

export interface StandingInstruction {
  id: string;
  text: string;
}

const SUGGESTIONS = ['More research roles, fewer finance', 'Only remote', 'Internships only', 'No events, more hackathons'];
const kindWord = { focus: 'More', avoid: 'Less', only: 'Only' } as const;

export function Directives({ parsed }: { parsed: ParsedInstruction }) {
  return (
    <>
      {parsed.directives.map((d) => (
        <span key={d.key} className="ag-directive" data-kind={d.kind}>
          {kindWord[d.kind]} {termLabel(d.key)}
        </span>
      ))}
      {parsed.unknown.map((text) => (
        <span key={text} className="ag-directive" data-kind="unknown" title="No rule matched this part, so the master agent ignores it">
          Not understood: “{text}”
        </span>
      ))}
    </>
  );
}

export function TellBar({ onSend, standing }: { onSend: (text: string) => void; standing: number }) {
  const [text, setText] = useState('');
  const inputId = useId();
  const parsed = text.trim() ? parseInstruction(text) : null;
  const send = (value: string) => {
    if (!value.trim()) return;
    onSend(value.trim());
    setText('');
  };
  return (
    <div>
      <form
        className="ag-command"
        onSubmit={(event) => {
          event.preventDefault();
          send(text);
        }}
      >
        <label htmlFor={inputId} className="sr-only">
          Tell your agents what you want more or less of
        </label>
        <input
          id={inputId}
          value={text}
          onChange={(event) => setText(event.target.value)}
          placeholder='Tell your agents… "more research roles, fewer finance"'
          autoComplete="off"
          maxLength={160}
        />
        <button type="submit" disabled={!text.trim()} className="btn-primary flex h-10 shrink-0 items-center gap-2 rounded-xl px-4 text-sm text-white disabled:opacity-50">
          <Send className="size-4" aria-hidden="true" />
          <span className="sr-only sm:not-sr-only">Send to master agent</span>
        </button>
      </form>
      <div className="mt-2.5 flex min-h-7 flex-wrap items-center gap-2 text-[12.5px]" aria-live="polite">
        {parsed ? (
          <>
            <span className="text-white/60">The master agent reads this as</span>
            <ArrowRight className="size-3.5 text-white/50" aria-hidden="true" />
            {parsed.directives.length === 0 && parsed.unknown.length === 0 ? null : <Directives parsed={parsed} />}
          </>
        ) : (
          <>
            <span className="text-white/60">Try</span>
            {SUGGESTIONS.map((s) => (
              <button key={s} type="button" onClick={() => send(s)} className="ag-chip-dark transition hover:bg-white/15">
                {s}
              </button>
            ))}
            {standing > 0 && (
              <a href="#ag-brief" className="ml-auto text-white/60 underline-offset-2 hover:text-white hover:underline">
                {standing} standing instruction{standing === 1 ? '' : 's'}
              </a>
            )}
          </>
        )}
      </div>
    </div>
  );
}

export function BriefCard({
  instructions,
  onRemove,
  onClear,
  brief,
  slots,
  stale,
  onApply,
}: {
  instructions: StandingInstruction[];
  onRemove: (id: string) => void;
  onClear: () => void;
  brief: Brief;
  slots: Slot[];
  /** The brief changed since the current run started, so the next run would differ. */
  stale: boolean;
  onApply: () => void;
}) {
  return (
    <Card className="p-6">
      <div id="ag-brief" className="flex scroll-mt-6 items-start justify-between gap-3">
        <div>
          <h2 className="font-semibold tracking-tight">How your agents read you</h2>
          <p className="mt-0.5 text-sm text-ink-3">Your instructions, the brief the master agent writes from them, and how it fills the four manager slots.</p>
        </div>
        {stale && (
          <button type="button" onClick={onApply} className="btn-primary h-9 shrink-0 rounded-lg px-3.5 text-sm text-white">
            Run with this brief
          </button>
        )}
      </div>

      <div className="mt-5">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold">Standing instructions</h3>
          {instructions.length > 0 && (
            <button type="button" onClick={onClear} className="text-xs font-medium text-ink-3 hover:text-ink">
              Clear all
            </button>
          )}
        </div>
        {instructions.length === 0 ? (
          <p className="mt-2 text-sm text-ink-3">None yet. Type one in the bar above; it stays until you remove it.</p>
        ) : (
          <ul className="mt-2 space-y-2">
            {instructions.map((instruction) => (
              <li key={instruction.id} className="flex items-start gap-3 rounded-2xl border border-line bg-white px-3.5 py-2.5">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium">“{instruction.text}”</p>
                  <div className="mt-1.5 flex flex-wrap gap-1.5">
                    <Directives parsed={parseInstruction(instruction.text)} />
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => onRemove(instruction.id)}
                  className="grid size-7 shrink-0 place-items-center rounded-full text-ink-3 transition hover:bg-brand-soft hover:text-ink"
                  aria-label={`Remove the instruction "${instruction.text}"`}
                >
                  <X className="size-4" aria-hidden="true" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="mt-5">
        <h3 className="text-sm font-semibold">The brief</h3>
        <dl className="mt-2 divide-y divide-line rounded-2xl border border-line bg-white">
          {brief.lines.map((line) => (
            <div key={line.label} className="flex items-baseline gap-3 px-3.5 py-2">
              <dt className="w-20 shrink-0 text-xs font-medium text-ink-3">{line.label}</dt>
              <dd className="min-w-0 flex-1 text-sm">{line.value}</dd>
              <span className="ag-from shrink-0" data-from={line.from}>
                {line.from === 'you' ? 'you said' : line.from}
              </span>
            </div>
          ))}
        </dl>
      </div>

      <div className="mt-5">
        <h3 className="text-sm font-semibold">Manager slots</h3>
        <ul className="mt-2 grid grid-cols-2 gap-2">
          {slots.map((slot) => (
            <li key={`${slot.index}-${slot.category}-${slot.label}-${slot.budget}`} className="ag-slot px-3 py-2.5">
              <p className="text-sm font-semibold">{categoryLabels[slot.category]}</p>
              <p className="truncate text-xs text-ink-3">{slot.label}</p>
              <div className="mt-2 flex items-center gap-1" aria-label={`${slot.budget} leads in its budget`}>
                {Array.from({ length: slot.budget }, (_, i) => (
                  <span key={i} className="size-1.5 rounded-full bg-brand" aria-hidden="true" />
                ))}
                <span className="ml-1 text-[11px] text-ink-3" aria-hidden="true">
                  {slot.budget} leads
                </span>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </Card>
  );
}
