// Two views of the same ranked list. "For you" is a full-screen reel, one opportunity per
// screen, scrolled like TikTok. "Feed" is everything in an ordinary scrolling grid, with search,
// filters and sorting, for when the student wants to scan and compare.
import {
  ArrowUpRight,
  BookmarkSimple,
  CalendarBlank,
  CaretDown,
  CaretUp,
  Clock,
  Heart,
  Info,
  MapPin,
  Play,
  Sparkle,
  ThumbsDown,
} from '@phosphor-icons/react';
import { LayoutList, PanelLeft, Search, SlidersHorizontal, Undo2, X as XSmall } from 'lucide-react';
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Link, useSearchParams } from 'react-router';
import { BrandMark } from '../components/Brand.tsx';
import { toggleDock } from '../components/Dock.tsx';
import { formatLabel, typeMeta } from '../components/meta.ts';
import { Cover, Details, OpportunityRow } from '../components/OpportunityCard.tsx';
import { DataBadge, useLive, useOpportunities } from '../state/live.tsx';
import { WhyThis } from '../components/WhyThis.tsx';
import { ProfileMenu } from '../components/ProfileMenu.tsx';
import {
  countActive,
  deadlineLabel,
  emptyFilters,
  fieldOfGoal,
  fieldOptions,
  fieldsOf,
  fitOptions,
  matches,
  onlyLabel,
  toggled,
  type DeadlineFilter,
  type FilterContext,
  type Filters,
  type OnlyFilter,
} from '../lib/filters.ts';
import { planFor } from '../lib/roadmap.ts';
import { daysUntil, dueLabel, shortDate } from '../lib/time.ts';
import { explain, rankFeedDetailed, signalLabel, type RankedOpportunity } from '../state/ranking.ts';
import { useStore } from '../state/StoreProvider.tsx';
import type { Format, Opportunity, OpportunityType } from '../types.ts';

type Tab = 'foryou' | 'feed';
type Sort = 'best' | 'deadline' | 'newest';

const sortLabel: Record<Sort, string> = {
  best: 'Best match',
  deadline: 'Deadline soonest',
  newest: 'Newest first',
};

/** Everything a student might type to find a card again. */
function matchesQuery(o: Opportunity, query: string): boolean {
  const words = query.toLowerCase().split(/\s+/).filter(Boolean);
  if (words.length === 0) return true;
  const text = [o.title, o.organizer, o.location ?? '', typeMeta[o.type].label, ...o.tags].join(' ').toLowerCase();
  return words.every((word) => text.includes(word));
}

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

/**
 * The moving picture behind a reel card. It plays, muted and looping, only while its card is
 * the one on screen, and falls back to the photo when there is no clip or it cannot load.
 */
function ReelVideo({ opportunity: o, active, near }: { opportunity: Opportunity; active: boolean; near: boolean }) {
  const ref = useRef<HTMLVideoElement>(null);
  const bar = useRef<HTMLDivElement>(null);
  const [failed, setFailed] = useState(false);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    const video = ref.current;
    if (!video) return;
    const still = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (active && !paused && !still) {
      // Autoplay can be refused; the poster stays up and a click starts it.
      video.play().catch(() => setPaused(true));
    } else {
      video.pause();
      if (!active) video.currentTime = 0;
    }
  }, [active, paused]);

  // Only the card on screen and its neighbours load a video; the rest show their still.
  // In the reel the whole picture sits in the upper part of the card, clear of the text below it.
  if (!o.video || failed || !near) return <Cover opportunity={o} className="absolute inset-0 size-full" box="absolute inset-x-0 top-[6%] h-[44%] px-3" />;
  return (
    <>
      <video
        ref={ref}
        src={o.video}
        poster={o.image ?? undefined}
        muted
        loop
        playsInline
        preload={active ? 'auto' : 'metadata'}
        onError={() => setFailed(true)}
        onTimeUpdate={(event) => {
          const { currentTime, duration } = event.currentTarget;
          if (bar.current && duration) bar.current.style.width = `${(currentTime / duration) * 100}%`;
        }}
        className="absolute inset-0 size-full object-cover"
      />
      <button
        type="button"
        className="reel-video-toggle"
        aria-label={paused ? 'Play video' : 'Pause video'}
        onClick={() => setPaused((value) => !value)}
      >
        {paused && (
          <span className="reel-video-play">
            <Play className="size-7" weight="fill" aria-hidden="true" />
          </span>
        )}
      </button>
      <div className="reel-video-progress" aria-hidden="true">
        <div ref={bar} />
      </div>
    </>
  );
}

function Slide({
  ranked,
  active,
  near,
  onDismiss,
  onDetails,
  opportunities,
  onWhyDismiss,
}: {
  ranked: RankedOpportunity;
  /** This card is the one on screen. */
  active: boolean;
  /** On screen or right next to it, so its video is worth loading. */
  near: boolean;
  onDismiss: (o: Opportunity) => void;
  onDetails: (o: Opportunity) => void;
  /** Everything that was ranked, which the reasons are worked out from. */
  opportunities: Opportunity[];
  /** Dismisses from the "Why this?" window, which closes with the card. */
  onWhyDismiss: (o: Opportunity) => void;
}) {
  const { state, dispatch } = useStore();
  const o = ranked.opportunity;
  const reasons = useMemo(() => explain(ranked, state, opportunities), [ranked, state, opportunities]);
  const meta = typeMeta[o.type];
  const saved = state.saved.includes(o.id);
  const liked = state.liked.includes(o.id);
  const place = [o.format ? formatLabel[o.format] : null, o.location].filter(Boolean).join(' · ');
  const urgent = o.deadline !== null && daysUntil(o.deadline) <= 7;

  return (
    <section className="reel-slide" aria-labelledby={`${o.id}-title`}>
      <div className="reel-stage">
        <article className="reel-card">
          <ReelVideo opportunity={o} active={active} near={near} />
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
              <li className="flex">
                <WhyThis reasons={reasons} active={active} onLess={() => onWhyDismiss(o)} onNotMyField={() => onWhyDismiss(o)} />
              </li>
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
          <RailButton label={liked ? 'Liked' : 'Like'} active={liked} onClick={() => dispatch({ type: 'toggleLiked', id: o.id })}>
            <Heart weight="fill" aria-hidden="true" />
          </RailButton>
          <RailButton label="Dislike" onClick={() => onDismiss(o)}>
            <ThumbsDown weight="fill" aria-hidden="true" />
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

/** A kind of opportunity with nothing found yet, and a way to ask the agents for more of it. */
export function EmptyKind({ type, searching, onSearch, saved = false }: { type: OpportunityType; searching: boolean; onSearch: () => void; saved?: boolean }) {
  const meta = typeMeta[type];
  const [asked, setAsked] = useState(false);
  return (
    <div className="reel-end">
      <span className={`mx-auto grid size-12 place-items-center rounded-2xl ${meta.tint}`} aria-hidden="true">
        <meta.icon className="size-6" />
      </span>
      <h2 className="mt-4 font-display text-3xl leading-tight">{saved ? `No ${meta.plural.toLowerCase()} saved yet` : `No ${meta.plural.toLowerCase()} yet`}</h2>
      <p className="mx-auto mt-3 max-w-xs text-[15px] leading-relaxed text-ink-2">
        {asked && searching
          ? `Your agents are searching for ${meta.plural.toLowerCase()} now. New ones appear in the feed as they are checked.`
          : asked
            ? `Your agents looked for ${meta.plural.toLowerCase()}. Anything they found and checked is in the feed.`
            : saved
              ? `Nothing here yet. Search for more and save the ones you like.`
              : `Nothing here yet. Search for more and your agents will look for ${meta.plural.toLowerCase()} specifically.`}
      </p>
      <button
        type="button"
        disabled={asked && searching}
        onClick={() => {
          setAsked(true);
          onSearch();
        }}
        className="btn-primary mt-6 inline-flex h-11 items-center gap-2 rounded-xl px-5 text-sm font-semibold text-white disabled:opacity-60"
      >
        <Search className="size-4" aria-hidden="true" />
        {asked && searching ? 'Searching…' : `Search for more ${meta.plural.toLowerCase()}`}
      </button>
    </div>
  );
}

export function Feed() {
  const { state, dispatch } = useStore();
  // The Saved page links here with ?view=feed&type=… to show one kind in the feed list.
  const [params] = useSearchParams();
  const askedType = params.get('type');
  const [tab, setTab] = useState<Tab>(params.get('view') === 'feed' ? 'feed' : 'foryou');
  const [query, setQuery] = useState('');
  const [filters, setFilters] = useState<Filters>(() => (askedType && askedType in typeMeta ? { ...emptyFilters, types: [askedType as OpportunityType] } : emptyFilters));
  const [filtersOpen, setFiltersOpen] = useState(false);
  const filterMenu = useRef<HTMLDivElement>(null);
  const [sort, setSort] = useState<Sort>('best');
  const [index, setIndex] = useState(0);
  const [details, setDetails] = useState<Opportunity | null>(null);
  const [lastDismissed, setLastDismissed] = useState<Opportunity | null>(null);
  const opportunities = useOpportunities();
  const agentsLive = useLive();
  const plan = planFor(state, opportunities);
  const scroller = useRef<HTMLDivElement>(null);

  // The ranking runs again on every save, like and dislike, but only for cards the student has
  // not reached yet: cards already scrolled past keep their place, so nothing moves under the thumb.
  const [seen, setSeen] = useState<string[]>([]);
  const live = useMemo(() => rankFeedDetailed(opportunities, state), [opportunities, state]);
  const slides = useMemo(() => {
    const byId = new Map(live.map((r) => [r.opportunity.id, r]));
    const kept = seen.map((id) => byId.get(id)).filter((r): r is RankedOpportunity => r !== undefined);
    return [...kept, ...live.filter((r) => !seen.includes(r.opportunity.id))];
  }, [live, seen]);
  useEffect(() => {
    const reached = slides.slice(0, index + 1).map((r) => r.opportunity.id);
    if (reached.some((id) => !seen.includes(id))) setSeen(reached);
  }, [index, slides, seen]);

  // Until the student's data has arrived there is nothing to say about the feed yet.
  const loading = agentsLive.status === 'connecting';
  // When the first cards arrive the reel starts at the first one, not wherever it was while empty.
  const hadCards = useRef(false);
  useEffect(() => {
    if (slides.length > 0 && !hadCards.current) {
      hadCards.current = true;
      setSeen([]);
      setIndex(0);
      scroller.current?.scrollTo({ top: 0 });
    }
    if (slides.length === 0) hadCards.current = false;
  }, [slides.length]);

  // Every kind is listed, found or not, so an empty one shows 0 and can be searched for.
  const typeOptions = Object.keys(typeMeta) as OpportunityType[];
  // Fields some card actually leads into, plus the goal's own field for the "My field" shortcut.
  const goalField = fieldOfGoal(state.goalId);
  const presentFields = new Set(slides.flatMap((r) => fieldsOf(r.opportunity)));
  const fieldChoices = fieldOptions.filter((field) => presentFields.has(field) || field === goalField);
  const chosenFields = filters.fields ?? [];
  const myFieldOn = goalField !== null && chosenFields.length === 1 && chosenFields[0] === goalField;
  const activeCount = countActive(filters);
  // What the Filters button holds: everything but the category, which has its own column.
  const panelCount = countActive({ ...filters, types: [] });
  const filtersOn = query.trim() !== '' || activeCount > 0;
  const patch = (change: Partial<Filters>) => setFilters((current) => ({ ...current, ...change }));
  const clearFilters = () => {
    setQuery('');
    setFilters(emptyFilters);
  };
  const context: FilterContext = {
    saved: state.saved,
    liked: state.liked,
    roadmap: new Set(
      plan.steps.filter((step) => step.opportunityId && !state.doneSteps.includes(step.id)).map((step) => step.opportunityId!),
    ),
    now: Date.now(),
  };
  const searched = live.map((r) => r.opportunity).filter((o) => matchesQuery(o, query));
  // A kind chosen in the categories that the agents have found none of at all.
  const emptyKind = filters.types.length === 1 && !slides.some((r) => r.opportunity.type === filters.types[0]) ? filters.types[0]! : null;
  const results = searched.filter((o) => matches(o, filters, context));
  // How many cards a choice would leave, with the search and the other filters as they are.
  const countWith = (change: Partial<Filters>) => searched.filter((o) => matches(o, { ...filters, ...change }, context)).length;
  const activeChips: { label: string; remove: () => void }[] = [
    ...(filters.format !== 'any' ? [{ label: formatLabel[filters.format], remove: () => patch({ format: 'any' }) }] : []),
    ...(filters.deadline !== 'any' ? [{ label: deadlineLabel[filters.deadline], remove: () => patch({ deadline: 'any' }) }] : []),
    ...(filters.minFit > 0 ? [{ label: `Fit ${filters.minFit}+`, remove: () => patch({ minFit: 0 }) }] : []),
    ...filters.only.map((value) => ({ label: onlyLabel[value], remove: () => patch({ only: toggled(filters.only, value) }) })),
    ...chosenFields.map((value) => ({ label: value, remove: () => patch({ fields: toggled(chosenFields, value) }) })),
  ];
  // "Best match" keeps the ranker's order; the other two sort on one field, with blanks last.
  if (sort === 'deadline') {
    const time = (o: Opportunity) => (o.deadline ? new Date(o.deadline).getTime() : Infinity);
    results.sort((x, y) => time(x) - time(y));
  } else if (sort === 'newest') {
    results.sort((x, y) => new Date(y.foundAt).getTime() - new Date(x.foundAt).getTime());
  }

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
      if (tab !== 'foryou') return; // the grid scrolls the ordinary way
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

  // The filter menu closes on Escape or a click anywhere outside it.
  useEffect(() => {
    if (!filtersOpen) return;
    const onDown = (event: MouseEvent) => {
      if (!filterMenu.current?.contains(event.target as Node)) setFiltersOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setFiltersOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [filtersOpen]);

  const toTop = () => {
    scroller.current?.scrollTo({ top: 0 });
  };
  const dismiss = (o: Opportunity) => {
    dispatch({ type: 'dismiss', id: o.id });
    setLastDismissed(o);
  };
  // The card and its "Why this?" window go away together, so focus moves back to the reel.
  const dismissFromWhy = (o: Opportunity) => {
    dismiss(o);
    scroller.current?.focus({ preventScroll: true });
  };
  const refresh = () => {
    setSeen([]);
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
            <BrandMark />
            <span className="hidden text-[19px] font-bold tracking-tight sm:block">BearRok</span>
          </Link>
        </div>

        <div className="reel-filters" role="group" aria-label="Choose a view">
          {(['foryou', 'feed'] as const).map((value) => (
            <button
              key={value}
              type="button"
              aria-pressed={tab === value}
              onClick={() => {
                setTab(value);
                toTop();
              }}
              className="reel-filter"
            >
              {value === 'foryou' ? 'For you' : 'Feed'}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-3">
          <DataBadge />
          <ProfileMenu />
        </div>
      </header>

      {tab === 'foryou' ? (
        <>
          <div
            // A fresh reel when the first cards arrive: otherwise the browser stays snapped to the
            // closing card that was alone on screen, and the student lands at the end.
            key={slides.length > 0 ? 'cards' : 'empty'}
            ref={scroller}
            className="reel-scroller"
            onScroll={(event) => setIndex(Math.round(event.currentTarget.scrollTop / event.currentTarget.clientHeight))}
            tabIndex={0}
            aria-label="Recommended opportunities. Scroll or use the arrow keys to move between them."
          >
            {slides.map((r, position) => (
              <Slide key={r.opportunity.id} ranked={r} active={tab === 'foryou' && position === index && !details} near={Math.abs(position - index) <= 1} onDismiss={dismiss} onDetails={setDetails} opportunities={opportunities} onWhyDismiss={dismissFromWhy} />
            ))}

            {loading && slides.length === 0 ? (
              <section className="reel-slide" aria-label="Loading">
                <div className="reel-end">
                  <span className="live-dot mx-auto block size-2.5 rounded-full bg-brand" aria-hidden="true" />
                  <h2 className="mt-5 font-display text-4xl leading-tight">Loading your feed…</h2>
                  <p className="mx-auto mt-3 max-w-xs text-[15px] leading-relaxed text-ink-2">Getting what your agents have found.</p>
                </div>
              </section>
            ) : (
            <section className="reel-slide" aria-label="End of feed">
              <div className="reel-end">
                <span className="live-dot mx-auto block size-2.5 rounded-full bg-[#34c759]" aria-hidden="true" />
                <h2 className="mt-5 font-display text-4xl leading-tight">
                  {slides.length > 0 ? 'You are all caught up' : agentsLive.searching ? 'Your agents are searching' : 'Nothing here yet'}
                </h2>
                <p className="mx-auto mt-3 max-w-xs text-[15px] leading-relaxed text-ink-2">
                  {agentsLive.status === 'offline'
                    ? 'The agents cannot be reached right now, so there is nothing new to show. This page fills in on its own once they are back.'
                    : slides.length < agentsLive.feedTarget
                      ? `Your agents have found ${slides.length} of the ${agentsLive.feedTarget} opportunities they aim for${agentsLive.searching ? ' and are searching for more' : '. They search again on their own'}.`
                      : 'Refresh to re-rank the feed with what you saved and skipped.'}
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
            )}
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
          <div className="feed-board feed-board-list">
            <div className="flex flex-wrap items-baseline gap-x-4">
              <h1 className="font-display text-4xl leading-tight text-white">Feed</h1>
              <p className="text-[15px] font-medium text-white/90">
                Everything your agents found. {results.length} of {slides.length} shown.
              </p>
            </div>

            <div className="feed-layout">
              {/* Categories: one kind of opportunity at a time, or all of them. */}
              <nav className="feed-cats" aria-label="Categories">
                {([null, ...typeOptions] as (OpportunityType | null)[]).map((value) => {
                  const on = value === null ? filters.types.length === 0 : filters.types.length === 1 && filters.types[0] === value;
                  const Icon = value ? typeMeta[value].icon : LayoutList;
                  return (
                    <button key={value ?? 'all'} type="button" className="feed-cat" aria-pressed={on} onClick={() => patch({ types: value === null ? [] : [value] })}>
                      <Icon className="size-4 shrink-0" aria-hidden="true" />
                      <span className="min-w-0 flex-1 truncate text-left">{value === null ? 'All' : typeMeta[value].plural}</span>
                      <span className="feed-cat-count">{countWith({ types: value === null ? [] : [value] })}</span>
                    </button>
                  );
                })}
              </nav>

              <div className="feed-column">
                <div className="feed-toolbar">
                  <label className="feed-search">
                    <Search className="size-[18px] shrink-0 text-ink-3" aria-hidden="true" />
                    <span className="sr-only">Search the feed</span>
                    <input
                      type="search"
                      value={query}
                      onChange={(event) => setQuery(event.target.value)}
                      placeholder="Search by title, organizer, place or tag"
                    />
                  </label>
                  <div ref={filterMenu} className="relative">
                    <button
                      type="button"
                      className="feed-filter-button"
                      aria-expanded={filtersOpen}
                      aria-controls="feed-filters"
                      data-active={panelCount > 0}
                      onClick={() => setFiltersOpen((value) => !value)}
                    >
                      <SlidersHorizontal className="size-4" aria-hidden="true" />
                      Filters
                      {panelCount > 0 && <span className="feed-filter-count">{panelCount}</span>}
                    </button>

                    {filtersOpen && (
                      <div id="feed-filters" className="feed-filter-panel" role="group" aria-label="Filters">
                        <div className="flex items-baseline justify-between">
                          <h2 className="text-base font-semibold">Filters</h2>
                          <span className="text-sm text-ink-3">
                            {results.length} of {searched.length} match
                          </span>
                        </div>


                        <fieldset>
                          <legend>Field</legend>
                          <div className="filter-pills">
                            {goalField && (
                              <button
                                type="button"
                                className="filter-pill"
                                aria-pressed={myFieldOn}
                                disabled={countWith({ fields: [goalField] }) === 0 && !myFieldOn}
                                onClick={() => patch({ fields: myFieldOn ? [] : [goalField] })}
                                title={`Only ${goalField}, the field of your goal`}
                              >
                                My field
                                <span className="filter-pill-count">{countWith({ fields: [goalField] })}</span>
                              </button>
                            )}
                            {fieldChoices.map((value) => {
                              const on = chosenFields.includes(value);
                              const count = countWith({ fields: [value] });
                              return (
                                <button
                                  key={value}
                                  type="button"
                                  className="filter-pill"
                                  aria-pressed={on}
                                  disabled={count === 0 && !on}
                                  onClick={() => patch({ fields: toggled(chosenFields, value) })}
                                >
                                  {value}
                                  <span className="filter-pill-count">{count}</span>
                                </button>
                              );
                            })}
                          </div>
                          <p className="mt-1.5 text-xs text-ink-3">Cards open to any field stay in every choice.</p>
                        </fieldset>

                        <fieldset>
                          <legend>Only show</legend>
                          <div className="filter-pills">
                            {(Object.keys(onlyLabel) as OnlyFilter[]).map((value) => {
                              const on = filters.only.includes(value);
                              const count = countWith({ only: on ? filters.only : [...filters.only, value] });
                              return (
                                <button
                                  key={value}
                                  type="button"
                                  className="filter-pill"
                                  aria-pressed={on}
                                  disabled={count === 0 && !on}
                                  onClick={() => patch({ only: toggled(filters.only, value) })}
                                >
                                  {onlyLabel[value]}
                                  <span className="filter-pill-count">{count}</span>
                                </button>
                              );
                            })}
                          </div>
                        </fieldset>

                        <div className="grid gap-4 sm:grid-cols-2">
                          <fieldset>
                            <legend>Deadline</legend>
                            <div className="filter-list">
                              {(Object.keys(deadlineLabel) as DeadlineFilter[]).map((value) => {
                                const count = countWith({ deadline: value });
                                return (
                                  <button
                                    key={value}
                                    type="button"
                                    role="radio"
                                    aria-checked={filters.deadline === value}
                                    disabled={count === 0 && filters.deadline !== value}
                                    onClick={() => patch({ deadline: value })}
                                  >
                                    {deadlineLabel[value]}
                                    <span>{count}</span>
                                  </button>
                                );
                              })}
                            </div>
                          </fieldset>

                          <div className="grid content-start gap-4">
                            <fieldset>
                              <legend>Format</legend>
                              <div className="filter-list">
                                {(['any', ...Object.keys(formatLabel)] as Filters['format'][]).map((value) => {
                                  const count = countWith({ format: value });
                                  return (
                                    <button
                                      key={value}
                                      type="button"
                                      role="radio"
                                      aria-checked={filters.format === value}
                                      disabled={count === 0 && filters.format !== value}
                                      onClick={() => patch({ format: value })}
                                    >
                                      {value === 'any' ? 'Any format' : formatLabel[value]}
                                      <span>{count}</span>
                                    </button>
                                  );
                                })}
                              </div>
                            </fieldset>

                            <fieldset>
                              <legend>Fit score</legend>
                              <div className="filter-segment">
                                {fitOptions.map((value) => (
                                  <button
                                    key={value}
                                    type="button"
                                    role="radio"
                                    aria-checked={filters.minFit === value}
                                    disabled={countWith({ minFit: value }) === 0 && filters.minFit !== value}
                                    onClick={() => patch({ minFit: value })}
                                  >
                                    {value === 0 ? 'Any' : `${value}+`}
                                  </button>
                                ))}
                              </div>
                            </fieldset>
                          </div>
                        </div>

                        <div className="filter-footer">
                          <button type="button" onClick={clearFilters} disabled={!filtersOn} className="h-9 text-sm font-semibold text-ink-2 disabled:opacity-40">
                            Clear all
                          </button>
                          <button type="button" onClick={() => setFiltersOpen(false)} className="btn-primary h-9 px-4 text-sm text-white">
                            Show {results.length} {results.length === 1 ? 'result' : 'results'}
                          </button>
                        </div>
                      </div>
                    )}
                  </div>

                  <label className="feed-select">
                    <span className="sr-only">Sort by</span>
                    <select value={sort} onChange={(event) => setSort(event.target.value as Sort)}>
                      {(Object.keys(sortLabel) as Sort[]).map((value) => (
                        <option key={value} value={value}>
                          {sortLabel[value]}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>

                {/* What is switched on, each removable, so the list never looks filtered for no reason. */}
                <div className="feed-active">
                  {activeChips.map((chip) => (
                    <button key={chip.label} type="button" onClick={chip.remove} className="feed-chip">
                      {chip.label}
                      <XSmall className="size-3.5" aria-hidden="true" />
                      <span className="sr-only">Remove filter</span>
                    </button>
                  ))}
                  {panelCount > 0 && (
                    <button type="button" onClick={() => setFilters((current) => ({ ...emptyFilters, types: current.types }))} className="h-9 px-2 text-sm font-semibold text-white">
                      Clear filters
                    </button>
                  )}
                </div>

                {results.length === 0 && emptyKind && !loading ? (
                  <div className="feed-list-empty">
                    <EmptyKind type={emptyKind} searching={agentsLive.searching} onSearch={() => void agentsLive.runNow(emptyKind)} />
                  </div>
                ) : results.length === 0 && loading ? (
                  <div className="feed-list-empty">
                    <div className="reel-end">
                      <h2 className="font-display text-3xl leading-tight">Loading your feed…</h2>
                      <p className="mx-auto mt-3 max-w-xs text-[15px] leading-relaxed text-ink-2">Getting what your agents have found.</p>
                    </div>
                  </div>
                ) : results.length === 0 ? (
                  <div className="feed-list-empty">
                    <div className="reel-end">
                      <h2 className="font-display text-3xl leading-tight">{filtersOn ? 'Nothing matches those filters' : 'Nothing here right now'}</h2>
                      <p className="mx-auto mt-3 max-w-xs text-[15px] leading-relaxed text-ink-2">
                        {filtersOn ? 'Try fewer words, another category, or clear the filters.' : 'Your agents are still searching. New cards appear here as they are verified.'}
                      </p>
                    </div>
                  </div>
                ) : (
                  <ul className="feed-list">
                    {results.map((o) => (
                      <li key={o.id}>
                        <OpportunityRow
                          opportunity={o}
                          onDismiss={dismiss}
                          onRoadmap={plan.steps.some((step) => step.opportunityId === o.id && !state.doneSteps.includes(step.id))}
                        />
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
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
