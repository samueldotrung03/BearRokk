// "For you" is a full-screen reel, one opportunity per screen, scrolled like TikTok.
// Picking a type switches to an ordinary scrolling grid, which is easier to scan and compare.
import {
  ArrowUpRight,
  BookmarkSimple,
  CalendarBlank,
  CaretDown,
  CaretUp,
  Clock,
  Info,
  MapPin,
  Sparkle,
  X,
} from '@phosphor-icons/react';
import { PanelLeft, Undo2 } from 'lucide-react';
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Link } from 'react-router';
import { BrandMark } from '../components/Brand.tsx';
import { toggleDock } from '../components/Dock.tsx';
import { formatLabel, typeMeta } from '../components/meta.ts';
import { Masonry } from '../components/Masonry.tsx';
import { Cover, Details, OpportunityCard } from '../components/OpportunityCard.tsx';
import { opportunities } from '../data/sample.ts';
import { daysUntil, dueLabel, shortDate } from '../lib/time.ts';
import { rankFeedDetailed, signalLabel, type RankedOpportunity } from '../state/ranking.ts';
import { useStore } from '../state/StoreProvider.tsx';
import type { Opportunity, OpportunityType } from '../types.ts';

type Filter = 'all' | OpportunityType;

function RailButton({
  label,
  onClick,
  active = false,
  children,
}: {
  label: string;
  onClick: () => void;
  active?: boolean;
  children: ReactNode;
}) {
  return (
    <button type="button" onClick={onClick} aria-pressed={active || undefined} className="reel-action" data-active={active}>
      <span className="reel-action-icon">{children}</span>
      <span className="reel-action-label">{label}</span>
    </button>
  );
}

function Slide({
  ranked,
  onDismiss,
  onDetails,
}: {
  ranked: RankedOpportunity;
  onDismiss: (o: Opportunity) => void;
  onDetails: (o: Opportunity) => void;
}) {
  const { state, dispatch } = useStore();
  const o = ranked.opportunity;
  const meta = typeMeta[o.type];
  const saved = state.saved.includes(o.id);
  const place = [o.format ? formatLabel[o.format] : null, o.location].filter(Boolean).join(' · ');
  const urgent = o.deadline !== null && daysUntil(o.deadline) <= 7;

  return (
    <section className="reel-slide" aria-labelledby={`${o.id}-title`}>
      <div className="reel-stage">
        <article className="reel-card">
          <Cover opportunity={o} className="absolute inset-0 size-full" />
          <div className="reel-shade" aria-hidden="true" />

          <div className="reel-body">
            <ul className="flex flex-wrap gap-1.5">
              <li className="reel-chip reel-chip-solid">
                <meta.icon className="size-3.5" aria-hidden="true" />
                {meta.label}
              </li>
              {ranked.signals.slice(0, 2).map((signal) => (
                <li key={signal} className="reel-chip">
                  {signalLabel[signal]}
                </li>
              ))}
            </ul>

            <h2 id={`${o.id}-title`} className="mt-3 font-display text-[34px] leading-[1.05] text-balance">
              {o.title}
            </h2>
            <p className="mt-1.5 text-[15px] font-semibold text-white/90">{o.organizer}</p>

            <p className="mt-3 flex gap-2 text-sm leading-relaxed text-white/90">
              <Sparkle weight="fill" className="mt-1 size-3.5 shrink-0" aria-hidden="true" />
              <span className="line-clamp-3">{o.fitExplanation}</span>
            </p>

            <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-[13px] font-medium text-white/85">
              {place && (
                <span className="flex items-center gap-1.5">
                  <MapPin weight="fill" className="size-3.5" aria-hidden="true" />
                  {place}
                </span>
              )}
              {o.startTime && (
                <span className="flex items-center gap-1.5">
                  <CalendarBlank weight="fill" className="size-3.5" aria-hidden="true" />
                  Starts {shortDate(o.startTime)}
                </span>
              )}
              {o.deadline && (
                <span className={`flex items-center gap-1.5 ${urgent ? 'rounded-full bg-orange-600 px-2 py-0.5 text-white' : ''}`}>
                  <Clock weight="fill" className="size-3.5" aria-hidden="true" />
                  {dueLabel(o.deadline)}
                </span>
              )}
            </div>
          </div>
        </article>

        <div className="reel-rail">
          <RailButton label={saved ? 'Saved' : 'Save'} active={saved} onClick={() => dispatch({ type: 'toggleSaved', id: o.id })}>
            <BookmarkSimple weight="fill" aria-hidden="true" />
          </RailButton>
          <RailButton label="Not for me" onClick={() => onDismiss(o)}>
            <X weight="bold" aria-hidden="true" />
          </RailButton>
          <RailButton label="Details" onClick={() => onDetails(o)}>
            <Info weight="fill" aria-hidden="true" />
          </RailButton>
          <a
            href={o.actionUrl ?? o.sourceUrl}
            target="_blank"
            rel="noreferrer"
            onClick={() => dispatch({ type: 'opened', id: o.id })}
            className="reel-action"
            data-primary="true"
          >
            <span className="reel-action-icon">
              <ArrowUpRight weight="bold" aria-hidden="true" />
            </span>
            <span className="reel-action-label">Open</span>
          </a>
        </div>
      </div>
    </section>
  );
}

export function Feed() {
  const { state, dispatch } = useStore();
  const [filter, setFilter] = useState<Filter>('all');
  const [index, setIndex] = useState(0);
  const [details, setDetails] = useState<Opportunity | null>(null);
  const [lastDismissed, setLastDismissed] = useState<Opportunity | null>(null);
  const scroller = useRef<HTMLDivElement>(null);

  // The order is fixed when the feed is opened or refreshed. Saving a card must not reshuffle
  // the reel under the student's thumb; what they do shows up in the next ranking.
  const [basis, setBasis] = useState(state);
  const ranked = useMemo(() => rankFeedDetailed(opportunities, basis), [basis]);
  const slides = ranked.filter(
    (r) => !state.dismissed.includes(r.opportunity.id) && (filter === 'all' || r.opportunity.type === filter),
  );

  const present = new Set(ranked.map((r) => r.opportunity.type));
  const filters: Filter[] = ['all', ...(Object.keys(typeMeta) as OpportunityType[]).filter((type) => present.has(type))];
  const total = slides.length + 1; // the last screen is the "caught up" slide

  const goTo = (target: number) => {
    const el = scroller.current;
    if (!el) return;
    const next = Math.min(total - 1, Math.max(0, target));
    el.scrollTo({ top: next * el.clientHeight, behavior: 'smooth' });
  };

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement;
      if (filter !== 'all') return; // the grid scrolls the ordinary way
      if (document.querySelector('dialog[open]') || ['INPUT', 'TEXTAREA'].includes(target.tagName)) return;
      if (event.key === 'ArrowDown' || event.key === 'j') {
        event.preventDefault();
        goTo(index + 1);
      } else if (event.key === 'ArrowUp' || event.key === 'k') {
        event.preventDefault();
        goTo(index - 1);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  const toTop = () => {
    scroller.current?.scrollTo({ top: 0 });
  };
  const dismiss = (o: Opportunity) => {
    dispatch({ type: 'dismiss', id: o.id });
    setLastDismissed(o);
  };
  const refresh = () => {
    setBasis(state);
    setLastDismissed(null);
    toTop();
  };

  return (
    <div className="page-outer reel sky">
      <header className="reel-header">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={toggleDock}
            className="hidden size-9 place-items-center rounded-xl bg-white/15 text-white transition hover:bg-white/25 sm:grid"
            aria-label="Pin or unpin the navigation dock"
            title="Pin the dock open, or move your pointer to the left edge"
          >
            <PanelLeft className="size-[18px]" aria-hidden="true" />
          </button>
          <Link to="/" className="flex items-center gap-2.5 text-white">
            <BrandMark light />
            <span className="hidden text-[19px] font-bold tracking-tight sm:block">BearRok</span>
          </Link>
        </div>

        <div className="reel-filters" role="group" aria-label="Filter by type">
          {filters.map((value) => (
            <button
              key={value}
              type="button"
              aria-pressed={filter === value}
              onClick={() => {
                setFilter(value);
                toTop();
              }}
              className="reel-filter"
            >
              {value === 'all' ? 'For you' : typeMeta[value].plural}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-3">
          <span className="hidden rounded-full bg-white/20 px-3 py-1 text-xs font-medium text-white backdrop-blur md:block">
            Sample data
          </span>
          <Link
            to="/profile"
            className="grid size-9 place-items-center rounded-full bg-white text-sm font-semibold text-brand shadow-card"
            aria-label="Your profile"
          >
            {state.profile.name.charAt(0)}
          </Link>
        </div>
      </header>

      {filter === 'all' ? (
        <>
          <div
            ref={scroller}
            className="reel-scroller"
            onScroll={(event) => setIndex(Math.round(event.currentTarget.scrollTop / event.currentTarget.clientHeight))}
            tabIndex={0}
            aria-label="Recommended opportunities. Scroll or use the arrow keys to move between them."
          >
            {slides.map((r) => (
              <Slide key={r.opportunity.id} ranked={r} onDismiss={dismiss} onDetails={setDetails} />
            ))}

            <section className="reel-slide" aria-label="End of feed">
              <div className="reel-end">
                <span className="live-dot mx-auto block size-2.5 rounded-full bg-[#34c759]" aria-hidden="true" />
                <h2 className="mt-5 font-display text-4xl leading-tight">
                  {slides.length === 0 ? 'Nothing here right now' : 'You are all caught up'}
                </h2>
                <p className="mx-auto mt-3 max-w-xs text-[15px] leading-relaxed text-ink-2">
                  Your agents are still searching. Refresh to re-rank the feed with what you saved and skipped.
                </p>
                <div className="mt-6 flex flex-wrap justify-center gap-2">
                  <button type="button" onClick={refresh} className="btn-primary h-11 px-5 text-sm text-white">
                    Refresh feed
                  </button>
                  <Link
                    to="/roadmap"
                    className="flex h-11 items-center rounded-[9px] border border-line bg-white px-5 text-sm font-semibold text-ink"
                  >
                    Open roadmap
                  </Link>
                </div>
              </div>
            </section>
          </div>
          <div className="reel-pager">
            <button type="button" onClick={() => goTo(index - 1)} disabled={index === 0} aria-label="Previous opportunity">
              <CaretUp weight="bold" aria-hidden="true" />
            </button>
            <span aria-live="polite">
              {Math.min(index + 1, total)} / {total}
            </span>
            <button type="button" onClick={() => goTo(index + 1)} disabled={index >= total - 1} aria-label="Next opportunity">
              <CaretDown weight="bold" aria-hidden="true" />
            </button>
          </div>
        </>
      ) : (
        <div ref={scroller} className="feed-scroller">
          <div className="mx-auto max-w-6xl">
            <h1 className="font-display text-5xl leading-tight text-white">{typeMeta[filter].plural}</h1>
            <p className="mt-1 mb-6 text-[15px] font-medium text-white/90">
              {slides.length} {slides.length === 1 ? 'match' : 'matches'} for you, best fit first.
            </p>
            {slides.length === 0 ? (
              <div className="reel-end mx-auto">
                <h2 className="font-display text-3xl leading-tight">Nothing here right now</h2>
                <p className="mx-auto mt-3 max-w-xs text-[15px] leading-relaxed text-ink-2">
                  Your agents are still searching. New cards appear here as they are verified.
                </p>
              </div>
            ) : (
              <Masonry>
                {slides.map((r) => (
                  <OpportunityCard key={r.opportunity.id} opportunity={r.opportunity} onDismiss={dismiss} />
                ))}
              </Masonry>
            )}
          </div>
        </div>
      )}

      {lastDismissed && (
        <div role="status" className="reel-toast">
          <span>Removed. You will see fewer {typeMeta[lastDismissed.type].plural.toLowerCase()} like it.</span>
          <button
            type="button"
            onClick={() => {
              dispatch({ type: 'restore', id: lastDismissed.id });
              setLastDismissed(null);
            }}
            className="flex shrink-0 items-center gap-1.5 font-semibold"
          >
            <Undo2 className="size-4" aria-hidden="true" /> Undo
          </button>
        </div>
      )}

      {details && <Details opportunity={details} onClose={() => setDetails(null)} />}
    </div>
  );
}
