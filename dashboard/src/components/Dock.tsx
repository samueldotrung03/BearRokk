// Left-edge navigation: a full-height liquid-glass sidebar that stays hidden until the pointer
// reaches the left edge of the window, the way the macOS Dock hides. Pinned, it stays open and
// the page moves over to make room.
import {
  BookmarkSimple,
  ClipboardText,
  Compass,
  GearSix,
  House,
  Path,
  PushPin,
  PushPinSlash,
  Robot,
  UserCircle,
  X,
  type Icon,
} from '@phosphor-icons/react';
import { useCallback, useEffect, useRef, useState, type CSSProperties } from 'react';
import { createPortal } from 'react-dom';
import { Link, NavLink } from 'react-router';
import { roadmaps } from '../data/sample.ts';
import { relativeTime } from '../lib/time.ts';
import { useLive, useOpportunities, type LiveAgents } from '../state/live.tsx';
import { useStore } from '../state/StoreProvider.tsx';
import { BrandMark } from './Brand.tsx';

interface DockItem {
  to: string;
  label: string;
  icon: Icon;
  /** Three colors that swirl inside the icon's orb. */
  colors: [string, string, string];
  /** Sits at the bottom of the dock, apart from the main pages. */
  bottom?: boolean;
}

export const dockItems: DockItem[] = [
  { to: '/', label: 'Feed', icon: House, colors: ['#3ad6ff', '#4f6bff', '#b14bff'] },
  { to: '/roadmap', label: 'Roadmap', icon: Path, colors: ['#5cf2c0', '#19b5e6', '#3d6bff'] },
  { to: '/discover', label: 'Career discovery', icon: Compass, colors: ['#ff7ad9', '#9a5bff', '#4f8cff'] },
  { to: '/applications', label: 'Applications', icon: ClipboardText, colors: ['#7cf29c', '#22c4a6', '#2f7bff'] },
  { to: '/saved', label: 'Saved', icon: BookmarkSimple, colors: ['#ffd15c', '#ff8a3d', '#ff4f8b'] },
  { to: '/agents', label: 'Agents', icon: Robot, colors: ['#ff5fa2', '#ff7a45', '#b04bff'] },
  { to: '/settings', label: 'Settings', icon: GearSix, colors: ['#c6d0e0', '#7f93b5', '#4f6bff'], bottom: true },
  { to: '/profile', label: 'Profile', icon: UserCircle, colors: ['#9fb4ff', '#6a7cff', '#40e0d0'], bottom: true },
];

const CLOSE_DELAY = 420;
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

/** Every agent in the latest search, top of the chain first. Empty before the first search. */
function everyAgent(run: LiveAgents | null) {
  if (!run) return [];
  return [run.master, ...run.managers, ...run.workers, ...run.validators, run.presenter].filter((node) => node !== null);
}

/** Live panel in the dock: what the agents did on their latest search and where the student stands. */
/** The full agent report, opened from the small "Agents live" button in the dock. */
function UsageWindow({ onClose }: { onClose: () => void }) {
  const { state } = useStore();
  const shown = useOpportunities();
  const ref = useRef<HTMLDialogElement>(null);
  const live = useLive();
  const all = everyAgent(live.agents);
  const running = all.filter((node) => node.status === 'running');
  const agentEvents = live.agents?.events ?? [];
  const jobs = live.agents?.workers.length ?? 0;

  const steps = roadmaps.find((r) => r.goalId === state.goalId)?.phases.flatMap((phase) => phase.steps) ?? [];
  const done = steps.filter((step) => state.doneSteps.includes(step.id)).length;
  const stats = [
    { label: 'in feed', value: shown.filter((o) => !state.dismissed.includes(o.id)).length },
    { label: 'saved', value: state.saved.length },
    { label: 'applications', value: Object.keys(state.applications).length },
    { label: 'roadmap', value: steps.length ? `${Math.round((done / steps.length) * 100)}%` : '0%' },
  ];

  useEffect(() => {
    ref.current?.showModal();
  }, []);

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onClick={(event) => {
        if (event.target === ref.current) ref.current.close();
      }}
      aria-labelledby="usage-title"
      className="usage-window"
    >
      <div className="usage-hero">
        <div className="flex items-center justify-between">
          <h2 id="usage-title" className="flex items-center gap-2 text-sm font-semibold">
            Your agents
            <span className="font-normal text-white/65">
              {live.status === 'offline' ? 'offline' : all.length === 0 ? 'no search yet' : `${running.length} of ${all.length} working`}
            </span>
          </h2>
          <button type="button" onClick={() => ref.current?.close()} aria-label="Close" className="usage-close">
            <X weight="bold" aria-hidden="true" />
          </button>
        </div>

        <div className="mt-5">
          <p className="font-display text-6xl leading-none">{jobs}</p>
          <p className="mt-1.5 text-sm text-white/65">searches and pages read in the latest search</p>
          {live.agents && <p className="mt-3 text-sm text-white/65">{live.agents.summary}</p>}
        </div>

        <dl className="mt-5 grid grid-cols-4 gap-1 border-t border-white/15 pt-4 text-center">
          {stats.map((stat) => (
            <div key={stat.label}>
              <dd className="text-lg font-bold">{stat.value}</dd>
              <dt className="text-xs text-white/55">{stat.label}</dt>
            </div>
          ))}
        </dl>
      </div>

      <div className="grid gap-6 p-6 sm:grid-cols-2">
        <section>
          <h3 className="text-sm font-semibold">Working now</h3>
          <ul className="mt-3 space-y-3">
            {running.length === 0 && <li className="text-sm text-ink-3">Nothing running right now.</li>}
            {running.map((node) => (
              <li key={node.id} className="flex gap-2.5">
                <span className="live-dot mt-1.5 size-2 shrink-0 rounded-full bg-[#34c759]" aria-hidden="true" />
                <div className="min-w-0">
                  <p className="text-sm font-medium">{node.name}</p>
                  <p className="text-sm leading-snug text-ink-3">{node.detail}</p>
                </div>
              </li>
            ))}
          </ul>
        </section>
        <section>
          <h3 className="text-sm font-semibold">Latest activity</h3>
          <ul className="mt-3 space-y-3">
            {agentEvents.length === 0 && <li className="text-sm text-ink-3">Nothing yet.</li>}
            {agentEvents.slice(0, 3).map((event) => (
              <li key={event.id}>
                <p className="text-sm leading-snug text-ink-2">{event.text}</p>
                <p className="text-xs text-ink-3">
                  {event.agent} · {relativeTime(event.at)}
                </p>
              </li>
            ))}
          </ul>
        </section>
      </div>
      <div className="flex items-center justify-between border-t border-line px-6 py-4">
        <span className="text-xs text-ink-3">{live.usingLive ? 'From your agents' : 'No results yet'}</span>
        <Link to="/agents" onClick={() => ref.current?.close()} className="btn-primary flex h-9 items-center rounded-lg px-4 text-sm text-white">
          Open the Agents page
        </Link>
      </div>
    </dialog>
  );
}

/** A one-line summary in the dock. Clicking it opens the full report in a window. */
function DockUsage() {
  const [open, setOpen] = useState(false);
  const live = useLive();
  const all = everyAgent(live.agents);
  const running = all.filter((node) => node.status === 'running').length;

  return (
    <>
      <button type="button" className="dock-usage" aria-haspopup="dialog" aria-label="Agent activity. Open the report" onClick={() => setOpen(true)}>
        <span className="flex min-w-0 flex-col items-start">
          <span className="flex items-center gap-2 text-xs font-semibold">
            {running > 0 && <span className="live-dot size-1.5 rounded-full bg-[#34c759]" aria-hidden="true" />}
            Your agents
          </span>
          <span className="mt-0.5 text-[11px] text-white/60">
            {live.status === 'offline' ? 'Offline' : all.length === 0 ? 'No search yet' : running > 0 ? `${running} of ${all.length} working` : 'Latest search finished'}
          </span>
        </span>
      </button>
      {/* Outside the dock, so it stays up when the dock slides away. */}
      {open && createPortal(<UsageWindow onClose={() => setOpen(false)} />, document.body)}
    </>
  );
}

export function Dock() {
  const canHover = useMediaQuery('(hover: hover) and (pointer: fine)');
  const narrow = useMediaQuery('(max-width: 639px)');

  // Starts open for a moment so a first-time visitor sees where navigation lives.
  const [open, setOpen] = useState(true);
  const [pinned, setPinned] = useState(() => localStorage.getItem(PIN_KEY) === '1');
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
      if (document.activeElement instanceof HTMLElement && document.activeElement.closest('.dock-zone')) document.activeElement.blur();
    };
    window.addEventListener(TOGGLE_EVENT, onToggle);
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener(TOGGLE_EVENT, onToggle);
      window.removeEventListener('keydown', onKey);
    };
  }, []);

  // The page reads this attribute to make room for a pinned dock.
  useEffect(() => {
    document.documentElement.dataset.dockPinned = String(pinned);
    localStorage.setItem(PIN_KEY, pinned ? '1' : '0');
  }, [pinned]);

  const visible = open || pinned || !canHover || narrow;

  const renderItem = (item: DockItem) => (
    <NavLink key={item.to} to={item.to} end={item.to === '/'} className="dock-item" aria-label={item.label}>
      <span
        className="dock-tile"
        style={{ '--c1': item.colors[0], '--c2': item.colors[1], '--c3': item.colors[2] } as CSSProperties}
      >
        <item.icon weight="fill" aria-hidden="true" />
      </span>
      <span className="dock-name" aria-hidden="true">
        {item.label}
      </span>
      <span className="dock-dot" aria-hidden="true" />
    </NavLink>
  );

  return (
    <>
      <div className="dock-edge" onPointerEnter={show} aria-hidden="true" />
      <div className="dock-handle" style={{ opacity: visible ? 0 : 1 }} aria-hidden="true" />
      <div
        className="dock-zone"
        data-open={visible}
        data-pinned={pinned}
        onPointerEnter={show}
        onPointerLeave={() => scheduleClose()}
        onFocus={show}
        onBlur={() => scheduleClose()}
      >
        <nav className="dock" aria-label="Primary">
          <div className="dock-glass glass" aria-hidden="true" />
          <Link to="/" className="dock-item dock-brand" aria-label="BearRok home">
            <BrandMark />
            <span className="dock-name" aria-hidden="true">
              BearRok
            </span>
          </Link>
          <div className="dock-divider" aria-hidden="true" />
          {dockItems.filter((item) => !item.bottom).map(renderItem)}
          <div className="dock-spacer" />
          <DockUsage />
          {dockItems.filter((item) => item.bottom).map(renderItem)}
          <button
            type="button"
            className="dock-item dock-pin"
            aria-pressed={pinned}
            aria-label="Keep the sidebar open"
            onClick={() => setPinned((value) => !value)}
          >
            <span className="dock-pin-icon">
              {pinned ? <PushPinSlash weight="fill" aria-hidden="true" /> : <PushPin weight="duotone" aria-hidden="true" />}
            </span>
            <span className="dock-name" aria-hidden="true">
              {pinned ? 'Unpin sidebar' : 'Keep sidebar open'}
            </span>
          </button>
        </nav>
      </div>
    </>
  );
}
