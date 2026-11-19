// "Why am I seeing this?" for one feed card: the reasons the ranking actually used, biggest
// first, and two quick ways for the student to say the feed got it wrong.
import { ArrowDown, ArrowUp, CircleHelp, X } from 'lucide-react';
import { useEffect, useId, useRef, useState } from 'react';
import type { Reason } from '../state/ranking.ts';
import '../styles/why.css';

const strengthWords: Record<Reason['strength'], string> = { strong: 'a lot', some: 'somewhat', slight: 'a little' };
const strengthLevel: Record<Reason['strength'], number> = { slight: 1, some: 2, strong: 3 };

/** The list of reasons on its own, so the details window can show the same thing. */
export function ReasonList({ reasons }: { reasons: Reason[] }) {
  if (reasons.length === 0) {
    return <p className="why-empty">Nothing stands out yet. It is placed by your agents’ fit score alone.</p>;
  }
  return (
    <ul className="why-list">
      {reasons.map((reason) => (
        <li key={reason.kind} className="why-item" data-direction={reason.direction}>
          <span className="why-arrow" aria-hidden="true">
            {reason.direction === 'up' ? <ArrowUp /> : <ArrowDown />}
          </span>
          <span className="why-text">
            <span className="sr-only">
              {reason.direction === 'up' ? 'Raises it' : 'Lowers it'} {strengthWords[reason.strength]}:{' '}
            </span>
            {reason.text}
          </span>
          <span className="why-meter" aria-hidden="true" title={`${reason.direction === 'up' ? 'Raises it' : 'Lowers it'} ${strengthWords[reason.strength]}`}>
            {[1, 2, 3].map((level) => (
              <i key={level} data-on={level <= strengthLevel[reason.strength]} />
            ))}
          </span>
        </li>
      ))}
    </ul>
  );
}

/**
 * The "Why this?" chip on a reel card and the small window it opens. The window is a non-modal
 * dialog so the reel's arrow keys stay out of the way while it is open; Escape closes it and puts
 * focus back on the chip.
 */
export function WhyThis({
  reasons,
  active,
  onLess,
  onNotMyField,
}: {
  reasons: Reason[];
  /** The card is the one on screen; the window closes when the student scrolls away. */
  active: boolean;
  /** Removes the card and shows fewer of its type, the same as Dislike. */
  onLess: () => void;
  /** Removes the card; offered only when the card leads to a field other than the goal. */
  onNotMyField: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [wasActive, setWasActive] = useState(active);
  if (active !== wasActive) {
    setWasActive(active);
    if (!active) setOpen(false);
  }
  const button = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const panelId = useId();
  const otherField = reasons.some((reason) => reason.kind === 'other-field');

  useEffect(() => {
    if (!open) return;
    panel.current?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      event.stopPropagation();
      setOpen(false);
      button.current?.focus();
    };
    const onDown = (event: MouseEvent) => {
      const target = event.target as Node;
      if (!panel.current?.contains(target) && !button.current?.contains(target)) setOpen(false);
    };
    document.addEventListener('keydown', onKey);
    document.addEventListener('mousedown', onDown);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('mousedown', onDown);
    };
  }, [open]);

  return (
    <>
      <button
        ref={button}
        type="button"
        className="reel-chip why-chip"
        aria-expanded={open}
        aria-controls={open ? panelId : undefined}
        aria-haspopup="dialog"
        onClick={() => setOpen((value) => !value)}
      >
        <CircleHelp className="size-3.5" aria-hidden="true" />
        Why this?
      </button>

      {open && (
        <dialog ref={panel} id={panelId} open className="why-pop" aria-labelledby={titleId} tabIndex={-1}>
          <div className="why-head">
            <h3 id={titleId}>Why you are seeing this</h3>
            <button
              type="button"
              className="why-close"
              aria-label="Close"
              onClick={() => {
                setOpen(false);
                button.current?.focus();
              }}
            >
              <X aria-hidden="true" />
            </button>
          </div>
          <ReasonList reasons={reasons} />
          <div className="why-actions">
            <button type="button" className="why-action" onClick={onLess}>
              Show me less like this
            </button>
            {otherField && (
              <button type="button" className="why-action" onClick={onNotMyField}>
                This is not my field
              </button>
            )}
          </div>
        </dialog>
      )}
    </>
  );
}
