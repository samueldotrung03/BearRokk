// The portal's left bar: every part of the application as a tab, in the student's order. Tabs are
// reordered by dragging (native HTML5 drag events, with a line where the tab will land), with
// Alt+ArrowUp and Alt+ArrowDown on a focused tab, or with the small move buttons. "+ Add" makes a
// new question, upload or note.
import { Check, ChevronDown, ChevronUp, GripVertical, LoaderCircle, Plus, Search } from 'lucide-react';
import { useEffect, useRef, useState, type DragEvent, type KeyboardEvent } from 'react';
import { TAB_LIMITS, wordStatus } from '../../../lib/portal/tabs.ts';
import type { PortalTab, PortalTabKind } from '../../../lib/portal/types.ts';
import { kindHint, kindIcon, kindLabel } from './kinds.ts';

const KINDS: PortalTabKind[] = ['question', 'upload', 'note'];

export function AddMenu({ onAdd, full = false }: { onAdd: (kind: PortalTabKind) => void; full?: boolean }) {
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);

  // Closes on a click elsewhere or Escape, as menus do.
  useEffect(() => {
    if (!open) return;
    const away = (e: PointerEvent) => {
      if (!box.current?.contains(e.target as Node)) setOpen(false);
    };
    const escape = (e: globalThis.KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('pointerdown', away);
    document.addEventListener('keydown', escape);
    return () => {
      document.removeEventListener('pointerdown', away);
      document.removeEventListener('keydown', escape);
    };
  }, [open]);

  return (
    <div className="pt-add" ref={box}>
      <button
        type="button"
        className="pt-add-btn"
        aria-expanded={open}
        aria-haspopup="menu"
        disabled={full}
        title={full ? `An application can have up to ${TAB_LIMITS.tabs} parts. Delete one to add another.` : undefined}
        onClick={() => setOpen((v) => !v)}
      >
        <Plus className="size-4" aria-hidden="true" />
        Add
      </button>
      {open && (
        <div className="pt-add-menu" role="menu">
          {KINDS.map((kind) => {
            const Icon = kindIcon[kind];
            return (
              <button
                key={kind}
                type="button"
                role="menuitem"
                className="pt-add-item"
                onClick={() => {
                  setOpen(false);
                  onAdd(kind);
                }}
              >
                <Icon className="mt-0.5 size-4 shrink-0 text-brand" aria-hidden="true" />
                <span>
                  <span className="block text-sm font-semibold text-ink">{kindLabel[kind]}</span>
                  <span className="block text-xs leading-snug text-ink-3">{kindHint[kind]}</span>
                </span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

export function TabList({
  tabs,
  selectedId,
  onSelect,
  onMoveToGap,
  onMoveBy,
  onAdd,
  drafting,
  draftNote,
  onFindAgain,
}: {
  tabs: PortalTab[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onMoveToGap: (id: string, gap: number) => void;
  onMoveBy: (id: string, delta: -1 | 1) => void;
  onAdd: (kind: PortalTabKind) => void;
  drafting: boolean;
  /** Shown under the list, e.g. the agents' note when they found nothing. */
  draftNote: string | null;
  onFindAgain: () => void;
}) {
  const [dragId, setDragId] = useState<string | null>(null);
  const [gap, setGap] = useState<number | null>(null);
  const buttons = useRef(new Map<string, HTMLButtonElement>());
  const refocus = useRef<string | null>(null);

  // A tab moved with the keyboard keeps focus, so it can be moved again straight away.
  useEffect(() => {
    if (!refocus.current) return;
    buttons.current.get(refocus.current)?.focus();
    refocus.current = null;
  }, [tabs]);

  const from = dragId ? tabs.findIndex((t) => t.id === dragId) : -1;
  // A drop line that would leave the tab where it is is not drawn.
  const shownGap = gap !== null && from >= 0 && gap !== from && gap !== from + 1 ? gap : null;

  const endDrag = () => {
    setDragId(null);
    setGap(null);
  };

  const overItem = (e: DragEvent<HTMLLIElement>, index: number) => {
    if (!dragId) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    const rect = e.currentTarget.getBoundingClientRect();
    setGap(e.clientY > rect.top + rect.height / 2 ? index + 1 : index);
  };

  const keys = (e: KeyboardEvent<HTMLButtonElement>, tab: PortalTab, index: number) => {
    if (e.altKey && (e.key === 'ArrowUp' || e.key === 'ArrowDown')) {
      e.preventDefault();
      refocus.current = tab.id;
      onMoveBy(tab.id, e.key === 'ArrowUp' ? -1 : 1);
      return;
    }
    // Plain arrows step through the tabs, as in a list.
    if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
      e.preventDefault();
      const next = tabs[index + (e.key === 'ArrowUp' ? -1 : 1)];
      if (next) buttons.current.get(next.id)?.focus();
    }
  };

  return (
    <nav className="pt-side" aria-label="Parts of this application">
      <div className="pt-side-head">
        <p className="text-xs font-semibold tracking-wide text-ink-3 uppercase">Parts</p>
        <AddMenu onAdd={onAdd} full={tabs.length >= TAB_LIMITS.tabs} />
      </div>

      {tabs.length === 0 ? (
        <p className="px-2 py-3 text-sm text-ink-3">{drafting ? 'Looking for the parts of this application…' : 'No parts yet.'}</p>
      ) : (
        <ol
          className="pt-tabs"
          onDragOver={(e) => {
            if (dragId) e.preventDefault();
          }}
          onDrop={(e) => {
            e.preventDefault();
            if (dragId && gap !== null) onMoveToGap(dragId, gap);
            endDrag();
          }}
        >
          {tabs.map((tab, index) => {
            const Icon = kindIcon[tab.kind];
            const words = tab.kind === 'question' ? wordStatus(tab.body, tab.wordLimit) : null;
            return (
              <li
                key={tab.id}
                className="pt-tab"
                draggable
                data-dragging={dragId === tab.id || undefined}
                data-drop={shownGap === index ? 'before' : shownGap === index + 1 && index === tabs.length - 1 ? 'after' : undefined}
                onDragStart={(e) => {
                  e.dataTransfer.effectAllowed = 'move';
                  e.dataTransfer.setData('text/plain', tab.title);
                  setDragId(tab.id);
                }}
                onDragOver={(e) => overItem(e, index)}
                onDragEnd={endDrag}
              >
                <GripVertical className="pt-grip" aria-hidden="true" />
                <button
                  type="button"
                  ref={(el) => {
                    if (el) buttons.current.set(tab.id, el);
                    else buttons.current.delete(tab.id);
                  }}
                  className="pt-tab-main"
                  aria-current={tab.id === selectedId ? 'true' : undefined}
                  aria-keyshortcuts="Alt+ArrowUp Alt+ArrowDown"
                  title="Drag to reorder, or press Alt with the up or down arrow"
                  onClick={() => onSelect(tab.id)}
                  onKeyDown={(e) => keys(e, tab, index)}
                >
                  <Icon className="size-4 shrink-0" aria-hidden="true" />
                  <span className="min-w-0 flex-1">
                    <span className="pt-tab-title">{tab.title || 'Untitled'}</span>
                    {words && (
                      <span className="pt-tab-words" data-over={words.over || undefined}>
                        {tab.wordLimit ? `${words.count}/${tab.wordLimit}` : `${words.count} ${words.count === 1 ? 'word' : 'words'}`}
                      </span>
                    )}
                  </span>
                  {tab.done ? (
                    <span className="pt-tick" title="Done">
                      <Check className="size-3" aria-hidden="true" />
                      <span className="sr-only">, done</span>
                    </span>
                  ) : (
                    <span className="pt-tick-empty" aria-hidden="true" />
                  )}
                </button>
                <span className="pt-moves">
                  <button type="button" className="pt-move" onClick={() => onMoveBy(tab.id, -1)} disabled={index === 0} aria-label={`Move ${tab.title || 'this part'} up`}>
                    <ChevronUp className="size-3.5" aria-hidden="true" />
                  </button>
                  <button type="button" className="pt-move" onClick={() => onMoveBy(tab.id, 1)} disabled={index === tabs.length - 1} aria-label={`Move ${tab.title || 'this part'} down`}>
                    <ChevronDown className="size-3.5" aria-hidden="true" />
                  </button>
                </span>
              </li>
            );
          })}
        </ol>
      )}

      <div className="pt-side-foot">
        {draftNote && <p className="pt-draft-note">{draftNote}</p>}
        <button type="button" className="pt-find" onClick={onFindAgain} disabled={drafting}>
          {drafting ? <LoaderCircle className="size-4 animate-spin" aria-hidden="true" /> : <Search className="size-4" aria-hidden="true" />}
          {drafting ? 'Your agents are looking…' : 'Find questions again'}
        </button>
      </div>
    </nav>
  );
}
