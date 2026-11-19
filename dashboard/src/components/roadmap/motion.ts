// One place to ask whether the student turned motion down, so every animation on the page
// (streamed answers, smooth scrolling, the ring) gives way to it the same way.
export function reducedMotion(): boolean {
  return typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true;
}

/** Scrolls an element into view and makes it glow for a moment, so the eye finds it. */
export function reveal(id: string, block: ScrollLogicalPosition = 'center'): void {
  const el = document.getElementById(id);
  if (!el) return;
  el.scrollIntoView({ block, behavior: reducedMotion() ? 'auto' : 'smooth' });
  el.classList.remove('rm-flash');
  // Reading layout restarts the animation when the same element is revealed twice in a row.
  void el.offsetWidth;
  el.classList.add('rm-flash');
  window.setTimeout(() => el.classList.remove('rm-flash'), 1800);
}
