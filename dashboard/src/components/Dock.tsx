// Left-edge navigation modeled on the macOS Dock: hidden until the pointer reaches the left
// edge, liquid-glass backing, icons that magnify under the pointer.
import { Bookmark, Compass, House, Map, Pin, PinOff, UserRound, Workflow, type LucideIcon } from 'lucide-react';
import { useCallback, useEffect, useRef, useState, type PointerEvent } from 'react';
import { NavLink } from 'react-router';

interface DockItem {
  to: string;
  label: string;
  icon: LucideIcon;
  gradient: string;
  /** Draw a divider before this item. */
  divided?: boolean;
}

export const dockItems: DockItem[] = [
  { to: '/', label: 'Feed', icon: House, gradient: 'linear-gradient(160deg, #4aa8f8, #1f5fe6)' },
  { to: '/roadmap', label: 'Roadmap', icon: Map, gradient: 'linear-gradient(160deg, #46d3c2, #0f8f9c)' },
  { to: '/discover', label: 'Career discovery', icon: Compass, gradient: 'linear-gradient(160deg, #8d8bff, #4b3fe0)' },
  { to: '/saved', label: 'Saved', icon: Bookmark, gradient: 'linear-gradient(160deg, #ffc35a, #f0792a)' },
  { to: '/agents', label: 'Agents', icon: Workflow, gradient: 'linear-gradient(160deg, #4b5263, #1b1d26)' },
  { to: '/profile', label: 'Profile', icon: UserRound, gradient: 'linear-gradient(160deg, #b6c0d2, #7a869c)', divided: true },
];

const BASE = 46; // resting icon size in px
const MAX_SCALE = 1.5;
const REACH = 130; // how far from the pointer, in px, an icon still grows
const CLOSE_DELAY = 320;
const PEEK_MS = 2600;

const TOGGLE_EVENT = 'dock:toggle';
const PIN_KEY = 'bearrok.dock.pinned';

/** Lets a button elsewhere on the page pin the dock open, or unpin it. */
export function toggleDock() {
  window.dispatchEvent(new Event(TOGGLE_EVENT));
}

function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(() => window.matchMedia(query).matches);
  useEffect(() => {
    const media = window.matchMedia(query);
    const onChange = () => setMatches(media.matches);
    media.addEventListener('change', onChange);
    return () => media.removeEventListener('change', onChange);
  }, [query]);
  return matches;
}

/** Cosine falloff: full size under the pointer, easing to resting size at REACH. */
export function magnification(distance: number): number {
  if (distance >= REACH) return 1;
  return 1 + (MAX_SCALE - 1) * Math.cos((distance / REACH) * (Math.PI / 2));
}

export function Dock() {
  const canHover = useMediaQuery('(hover: hover) and (pointer: fine)');
  const reducedMotion = useMediaQuery('(prefers-reduced-motion: reduce)');
  const narrow = useMediaQuery('(max-width: 639px)');

  // Starts open for a moment so a first-time visitor sees where navigation lives.
  const [open, setOpen] = useState(true);
  const [pinned, setPinned] = useState(() => localStorage.getItem(PIN_KEY) === '1');
  const [pointerY, setPointerY] = useState<number | null>(null);
  const restCenters = useRef<number[]>([]);
  const itemRefs = useRef<(HTMLAnchorElement | null)[]>([]);
  const closeTimer = useRef<number | undefined>(undefined);

  const cancelClose = useCallback(() => window.clearTimeout(closeTimer.current), []);
  const scheduleClose = useCallback(
    (delay = CLOSE_DELAY) => {
      cancelClose();
      closeTimer.current = window.setTimeout(() => setOpen(false), delay);
    },
    [cancelClose],
  );
  const show = useCallback(() => {
    cancelClose();
    setOpen(true);
  }, [cancelClose]);

  useEffect(() => {
    scheduleClose(PEEK_MS);
    return cancelClose;
  }, [scheduleClose, cancelClose]);

  useEffect(() => {
    const onToggle = () => setPinned((value) => !value);
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      setOpen(false);
      if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
    };
    window.addEventListener(TOGGLE_EVENT, onToggle);
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener(TOGGLE_EVENT, onToggle);
      window.removeEventListener('keydown', onKey);
    };
  }, [cancelClose]);

  // The page reads this attribute to make room for a pinned dock.
  useEffect(() => {
    document.documentElement.dataset.dockPinned = String(pinned);
    localStorage.setItem(PIN_KEY, pinned ? '1' : '0');
  }, [pinned]);

  const onPointerEnter = () => {
    show();
    // Measure once, before anything grows, so magnification does not chase its own layout.
    restCenters.current = itemRefs.current.map((el) => {
      if (!el) return 0;
      const rect = el.getBoundingClientRect();
      return rect.top + rect.height / 2;
    });
  };
  const onPointerMove = (event: PointerEvent) => {
    if (canHover && !reducedMotion) setPointerY(event.clientY);
  };
  const onPointerLeave = () => {
    setPointerY(null);
    scheduleClose();
  };

  // Touch screens and phone widths have no edge to hover, so the dock stays put there.
  const visible = open || pinned || !canHover || narrow;

  return (
    <>
      <div className="dock-edge" onPointerEnter={show} aria-hidden="true" />
      <div className="dock-handle" style={{ opacity: visible ? 0 : 1 }} aria-hidden="true" />
      <div
        className="dock-zone"
        data-open={visible}
        onPointerEnter={onPointerEnter}
        onPointerMove={onPointerMove}
        onPointerLeave={onPointerLeave}
        onFocus={show}
        onBlur={() => scheduleClose()}
      >
        <nav className="dock" aria-label="Primary">
          <div className="dock-glass glass" aria-hidden="true" />
          {dockItems.map((item, index) => {
            const center = restCenters.current[index];
            const scale = pointerY === null || center === undefined ? 1 : magnification(Math.abs(pointerY - center));
            const size = Math.round(BASE * scale);
            return (
              <div key={item.to} className="contents">
                {item.divided && <div className="dock-separator" aria-hidden="true" />}
                <NavLink
                  to={item.to}
                  end={item.to === '/'}
                  className="dock-item"
                  aria-label={item.label}
                  ref={(el) => {
                    itemRefs.current[index] = el;
                  }}
                >
                  {({ isActive }) => (
                    <>
                      {isActive && <span className="dock-dot" aria-hidden="true" />}
                      <span className="dock-tile" style={{ width: size, height: size, background: item.gradient }}>
                        <item.icon strokeWidth={2} aria-hidden="true" />
                      </span>
                      <span className="dock-label glass" aria-hidden="true">
                        {item.label}
                      </span>
                    </>
                  )}
                </NavLink>
              </div>
            );
          })}
          <button
            type="button"
            className="dock-item dock-pin"
            aria-pressed={pinned}
            aria-label="Keep the dock open"
            onClick={() => setPinned((value) => !value)}
          >
            {pinned ? <PinOff aria-hidden="true" /> : <Pin aria-hidden="true" />}
            <span className="dock-label glass" aria-hidden="true">
              {pinned ? 'Unpin dock' : 'Keep dock open'}
            </span>
          </button>
        </nav>
      </div>
    </>
  );
}
