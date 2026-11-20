// The large writing box for answers and notes: plain text, paragraphs split by blank lines, a
// reading font and width, and a box that grows with the text instead of scrolling inside itself.
import { useLayoutEffect, useRef, type Ref } from 'react';
import { TAB_LIMITS } from '../../../lib/portal/tabs.ts';

/** Browsers that size a textarea to its content in CSS need no measuring. */
const growsInCss = () => typeof CSS !== 'undefined' && CSS.supports?.('field-sizing', 'content');

export function WritingArea({
  value,
  onChange,
  label,
  placeholder,
  over = false,
  autoFocus = false,
  describedBy,
  inputRef,
}: {
  value: string;
  onChange: (value: string) => void;
  label: string;
  placeholder?: string;
  over?: boolean;
  autoFocus?: boolean;
  describedBy?: string;
  inputRef?: Ref<HTMLTextAreaElement>;
}) {
  const own = useRef<HTMLTextAreaElement | null>(null);

  // Elsewhere, grow the box to fit, keeping the page where it was so the text does not jump.
  useLayoutEffect(() => {
    const el = own.current;
    if (!el || growsInCss()) return;
    const scroller = document.scrollingElement;
    const top = scroller?.scrollTop ?? 0;
    el.style.height = 'auto';
    el.style.height = `${el.scrollHeight + 2}px`;
    if (scroller) scroller.scrollTop = top;
  }, [value]);

  return (
    <textarea
      ref={(el) => {
        own.current = el;
        if (typeof inputRef === 'function') inputRef(el);
        else if (inputRef) inputRef.current = el;
      }}
      className="pt-writing"
      data-over={over || undefined}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      aria-label={label}
      aria-describedby={describedBy}
      placeholder={placeholder}
      autoFocus={autoFocus}
      spellCheck
      maxLength={TAB_LIMITS.body}
    />
  );
}
