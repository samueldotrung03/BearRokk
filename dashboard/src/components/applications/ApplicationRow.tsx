// One application in the list view. The page decides which rows are open, so the
// "what to do next" strip can open a row and jump to the right question.
import { ChevronDown } from 'lucide-react';
import { Card } from '../Page.tsx';
import { Summary } from './Summary.tsx';
import { Workspace } from './Workspace.tsx';
import type { GoTo, Intent, Item } from './shared.tsx';

export function ApplicationRow({
  item,
  open,
  onToggle,
  goTo,
  intent,
}: {
  item: Item;
  open: boolean;
  onToggle: () => void;
  goTo: GoTo;
  intent?: Intent;
}) {
  const panelId = `ap-work-${item.opportunity.id}`;
  return (
    <Card className="ap-row overflow-hidden">
      <div id={`ap-row-${item.opportunity.id}`} tabIndex={-1} className="outline-none">
        <Summary item={item} goTo={goTo} />
      </div>
      <button
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={onToggle}
        className="flex w-full items-center justify-between border-t border-line px-5 py-3 text-sm font-semibold text-ink-2 hover:bg-slate-50"
      >
        {open ? 'Close' : 'Work on this application'}
        <ChevronDown className={`size-4 transition-transform ${open ? 'rotate-180' : ''}`} aria-hidden="true" />
      </button>
      {open && (
        <div id={panelId} className="ap-work border-t border-line bg-slate-50/60 p-5">
          <Workspace item={item} intent={intent} />
        </div>
      )}
    </Card>
  );
}
