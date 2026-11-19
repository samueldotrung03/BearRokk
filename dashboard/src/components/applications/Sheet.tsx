// The board's detail view: a side sheet built on <dialog>, which gives focus trapping, Escape
// to close and a backdrop without extra code.
import { X } from 'lucide-react';
import { useEffect, useRef } from 'react';
import { Summary } from './Summary.tsx';
import { Workspace } from './Workspace.tsx';
import type { GoTo, Intent, Item } from './shared.tsx';

export function Sheet({ item, onClose, goTo, intent }: { item: Item; onClose: () => void; goTo: GoTo; intent?: Intent }) {
  const dialog = useRef<HTMLDialogElement>(null);
  // No close() on cleanup: StrictMode runs effects twice in development, and closing would fire
  // onClose and shut the sheet the moment it opened. Unmounting removes the dialog anyway.
  useEffect(() => {
    const el = dialog.current;
    if (el && !el.open) el.showModal();
  }, []);

  return (
    <dialog
      ref={dialog}
      className="ap-sheet"
      aria-labelledby="ap-sheet-title"
      onClose={onClose}
      onClick={(event) => {
        // A click on the backdrop lands on the dialog itself, not on its content.
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className="ap-sheet-body">
        <div className="flex items-start justify-between gap-4 border-b border-line px-6 pt-5 pb-4">
          <h2 id="ap-sheet-title" className="font-display text-3xl leading-tight">
            {item.opportunity.title}
          </h2>
          <button type="button" onClick={onClose} className="grid size-9 shrink-0 place-items-center rounded-xl text-ink-3 hover:bg-slate-100 hover:text-ink" aria-label="Close">
            <X className="size-5" aria-hidden="true" />
          </button>
        </div>
        <div className="px-6 pt-4">
          <Summary item={item} goTo={goTo} compact />
        </div>
        <div className="mt-5 border-t border-line bg-slate-50/60 p-6">
          <Workspace item={item} intent={intent} />
        </div>
      </div>
    </dialog>
  );
}
