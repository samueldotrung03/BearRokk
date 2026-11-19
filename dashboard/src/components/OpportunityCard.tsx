import { ArrowUpRight, Bell, Bookmark, BookmarkCheck, CalendarDays, CalendarPlus, Check, Route, CircleDashed, Clock, Heart, MapPin, Sparkles, ThumbsDown, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router';
import { applicationInfo } from '../data/sample.ts';
import { remindersFor } from '../lib/applications.ts';
import { CalendarStatus } from './CalendarStatus.tsx';
import { buildOpportunityRoadmap } from '../lib/roadmap.ts';
import { daysUntil, dueLabel, relativeTime, shortDate } from '../lib/time.ts';
import { useStore } from '../state/StoreProvider.tsx';
import type { Opportunity } from '../types.ts';
import { AskBar } from './AskBar.tsx';
import { formatLabel, typeMeta } from './meta.ts';
import { StatusSelect } from './StatusSelect.tsx';

function LikeButton({ id }: { id: string }) {
  const { state, dispatch } = useStore();
  const liked = state.liked.includes(id);
  return (
    <button
      type="button"
      aria-pressed={liked}
      onClick={() => dispatch({ type: 'toggleLiked', id })}
      className={`relative z-10 flex h-9 items-center gap-1.5 rounded-lg px-2 text-sm font-medium transition hover:bg-slate-100 ${
        liked ? 'text-rose-600' : 'text-ink-3 hover:text-ink'
      }`}
    >
      <Heart className="size-4" fill={liked ? 'currentColor' : 'none'} aria-hidden="true" />
      {liked ? 'Liked' : 'Like'}
    </button>
  );
}

/**
 * Cover picture, shown whole: never cropped. The picture sits inside `box` (by default the whole
 * cover), scaled to fit, and a blurred copy of it fills the rest, so a wide banner in a tall card
 * has no empty bars. A logo gets room around it on a light panel. Stock photos and AI
 * illustrations carry their credit. Without a picture, or if it fails to load, a tinted icon panel.
 */
export function Cover({ opportunity: o, className = '', box = 'absolute inset-0' }: { opportunity: Opportunity; className?: string; box?: string }) {
  const [failed, setFailed] = useState(false);
  const meta = typeMeta[o.type];
  if (!o.image || failed) {
    return (
      <div className={`grid place-items-center ${meta.tint} ${className}`}>
        <meta.icon className="size-12 opacity-60" aria-hidden="true" />
      </div>
    );
  }
  // A class list that already places the cover keeps it; otherwise the layers need a frame.
  const frame = /\babsolute\b/.test(className) ? '' : 'relative';
  const logo = o.imageKind === 'logo';
  return (
    <div className={`${frame} overflow-hidden ${logo ? 'bg-white' : 'bg-slate-800'} ${className}`}>
      <img src={o.image} alt="" aria-hidden="true" loading="lazy" className={`cover-fill absolute inset-0 size-full object-cover ${logo ? 'opacity-25' : ''}`} />
      <div className={`${box} ${logo ? 'p-[14%]' : ''}`}>
        <img src={o.image} alt={logo ? `${o.organizer} logo` : ''} loading="lazy" onError={() => setFailed(true)} className="cover-whole size-full object-contain" />
      </div>
      {o.imageCredit && (
        <span className="absolute right-2 bottom-2 z-10 max-w-[80%] truncate rounded-full bg-black/45 px-2 py-0.5 text-[10px] text-white/90 backdrop-blur">
          {o.imageCreditUrl ? (
            <a href={o.imageCreditUrl} target="_blank" rel="noreferrer" onClick={(event) => event.stopPropagation()}>
              {o.imageCredit}
            </a>
          ) : (
            o.imageCredit
          )}
        </span>
      )}
    </div>
  );
}

function Fact({ icon: Icon, children, urgent = false }: { icon: typeof Clock; children: string; urgent?: boolean }) {
  return (
    <span className={`flex items-center gap-1.5 ${urgent ? 'font-medium text-orange-700' : ''}`}>
      <Icon className="size-4 shrink-0" aria-hidden="true" />
      {children}
    </span>
  );
}

function SaveButton({ id, overlay = false }: { id: string; overlay?: boolean }) {
  const { state, dispatch } = useStore();
  const saved = state.saved.includes(id);
  const Icon = saved ? BookmarkCheck : Bookmark;
  return (
    <button
      type="button"
      onClick={() => dispatch({ type: 'toggleSaved', id })}
      aria-pressed={saved}
      className={
        overlay
          ? `absolute top-3 right-3 z-10 grid size-10 place-items-center rounded-full shadow-card backdrop-blur transition ${
              saved ? 'bg-brand text-white' : 'bg-white/90 text-ink hover:bg-white'
            }`
          : `flex h-10 items-center gap-2 rounded-xl px-3.5 text-sm font-medium transition ${
              saved ? 'bg-brand-soft text-brand' : 'bg-slate-100 text-ink-2 hover:bg-slate-200'
            }`
      }
    >
      <Icon className="size-[18px]" aria-hidden="true" />
      {overlay ? <span className="sr-only">{saved ? 'Saved' : 'Save'}</span> : saved ? 'Saved' : 'Save'}
    </button>
  );
}

function OfficialLink({ opportunity: o }: { opportunity: Opportunity }) {
  const { dispatch } = useStore();
  return (
    <a
      href={o.actionUrl ?? o.sourceUrl}
      target="_blank"
      rel="noreferrer"
      onClick={() => dispatch({ type: 'opened', id: o.id })}
      className="btn-primary flex h-10 items-center gap-1.5 rounded-xl px-4 text-sm font-medium text-white"
    >
      Official posting
      <ArrowUpRight className="size-4" aria-hidden="true" />
    </a>
  );
}

/** The dates that matter for one opportunity, oldest first, with reminders once it is tracked. */
function KeyDates({ opportunity: o }: { opportunity: Opportunity }) {
  const { state } = useStore();
  const status = state.applications[o.id]?.status;
  const reminders = status ? remindersFor(status, o.deadline).filter((reminder) => !reminder.past) : [];
  const rows = [
    { label: 'Found by your agents', value: relativeTime(o.foundAt), urgent: false },
    { label: 'Checked against the official page', value: relativeTime(o.lastCheckedAt), urgent: false },
    ...(o.startTime ? [{ label: 'Starts', value: shortDate(o.startTime), urgent: false }] : []),
    o.deadline
      ? { label: 'Deadline', value: `${shortDate(o.deadline)} · ${Math.max(0, daysUntil(o.deadline))} days left`, urgent: daysUntil(o.deadline) <= 7 }
      : { label: 'Deadline', value: 'Not on the posting', urgent: false },
  ];
  return (
    <section className="detail-section">
      <h3>Key dates</h3>
      <dl className="mt-2 space-y-1.5">
        {rows.map((row) => (
          <div key={row.label} className="flex justify-between gap-4 text-sm">
            <dt className="text-ink-3">{row.label}</dt>
            <dd className={`text-right font-medium ${row.urgent ? 'text-orange-700' : ''}`}>{row.value}</dd>
          </div>
        ))}
      </dl>
      <div className="mt-3">
        <CalendarStatus id={o.id} deadline={o.deadline} compact />
      </div>
      {reminders.length > 0 && (
        <div className="mt-3 flex flex-wrap items-center gap-2 text-sm">
          {reminders.map((reminder) => (
            <span key={reminder.label} className="app-reminder">
              <Bell className="size-3.5" aria-hidden="true" />
              {reminder.label} · {shortDate(reminder.at)}
            </span>
          ))}
        </div>
      )}
    </section>
  );
}

/** What applying takes. */
function Needs({ opportunity: o }: { opportunity: Opportunity }) {
  const info = applicationInfo[o.id];
  if (!info) return null;
  return (
    <section className="detail-section">
      <h3>What it takes</h3>
      {(
        <ul className="mt-2 space-y-1 text-sm text-ink-2">
          {info.materials.map((name) => (
            <li key={name} className="flex gap-2">
              <span className="mt-2 size-1 shrink-0 rounded-full bg-ink-3" aria-hidden="true" />
              {name}
            </li>
          ))}
          <li className="flex gap-2">
            <span className="mt-2 size-1 shrink-0 rounded-full bg-ink-3" aria-hidden="true" />
            {info.requiresLogin
              ? "Written questions: behind a sign-in on the organizer's site"
              : info.prompts.length === 0
                ? 'No written questions'
                : `${info.prompts.length} written ${info.prompts.length === 1 ? 'question' : 'questions'}`}
          </li>
        </ul>
      )}
    </section>
  );
}

/**
 * The roadmap for this one opportunity. Nothing is built until the student asks: the button
 * starts it, and from then on the steps for this opportunity show here with tick boxes.
 */
function OpportunityRoadmap({ opportunity: o, onNavigate }: { opportunity: Opportunity; onNavigate: () => void }) {
  const { state, dispatch } = useStore();
  const started = state.extraSteps.includes(o.id);

  if (!started) {
    return (
      <section className="detail-roadmap">
        <h3 className="text-sm font-semibold">Roadmap for this opportunity</h3>
        <p className="mt-1 text-sm leading-snug text-ink-2">
          Want a step-by-step plan for this one? It is built from this posting: what to get ready and by when.
        </p>
        <button type="button" onClick={() => dispatch({ type: 'addStep', id: o.id })} className="detail-roadmap-add mt-3">
          <Route className="size-4" aria-hidden="true" />
          Start the roadmap
        </button>
      </section>
    );
  }

  const steps = buildOpportunityRoadmap(o, applicationInfo[o.id], state.profile.skills);
  const doneCount = steps.filter((step) => state.doneSteps.includes(step.id)).length;
  return (
    <section className="detail-roadmap">
      <div className="flex items-baseline justify-between gap-3">
        <h3 className="text-sm font-semibold">Your roadmap for this</h3>
        <Link to="/roadmap" onClick={onNavigate} className="text-sm font-medium text-brand">
          Open roadmap
        </Link>
      </div>
      <div className="mt-2.5 flex items-center gap-3">
        <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-white">
          <div className="h-full rounded-full bg-brand transition-[width] duration-500" style={{ width: `${(doneCount / steps.length) * 100}%` }} />
        </div>
        <span className="text-xs text-ink-3">
          {doneCount} of {steps.length} steps
        </span>
      </div>
      <ol className="detail-steps">
        {steps.map((step) => {
          const done = state.doneSteps.includes(step.id);
          return (
            <li key={step.id}>
              <button
                type="button"
                role="checkbox"
                aria-checked={done}
                aria-label={`Mark "${step.title}" as done`}
                onClick={() => dispatch({ type: 'toggleStep', id: step.id })}
                className={`grid size-6 shrink-0 place-items-center rounded-full border-2 transition ${
                  done ? 'border-brand bg-brand text-white' : 'border-slate-300 bg-white hover:border-brand'
                }`}
              >
                {done && <Check className="size-3.5" strokeWidth={3} aria-hidden="true" />}
              </button>
              <div className="min-w-0">
                <p className={`truncate text-sm font-medium ${done ? 'line-through opacity-60' : ''}`} title={step.title}>
                  {step.title}
                </p>
                {step.due && !done && (
                  <p className={`text-xs ${daysUntil(step.due) <= 3 ? 'font-medium text-orange-700' : 'text-ink-3'}`}>By {shortDate(step.due)}</p>
                )}
              </div>
            </li>
          );
        })}
      </ol>
      <button type="button" onClick={() => dispatch({ type: 'removeStep', id: o.id })} className="mt-2 text-xs font-medium text-ink-3 hover:text-ink">
        Remove this roadmap
      </button>
    </section>
  );
}

/**
 * Everything about one opportunity in a single window that fits the screen: the photo and the
 * facts, the dates and what applying takes, and beside them its place on the roadmap and a box
 * for questions. On a laptop nothing here needs scrolling except a long conversation.
 */
export function Details({ opportunity: o, onClose }: { opportunity: Opportunity; onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  const meta = typeMeta[o.type];
  const place = [o.format ? formatLabel[o.format] : null, o.location].filter(Boolean).join(' · ');
  const fit = Math.round(o.baseScore * 100);

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
      aria-labelledby={`${o.id}-dialog-title`}
      className="detail-dialog"
    >
      <button type="button" onClick={() => ref.current?.close()} aria-label="Close" className="detail-close">
        <X className="size-4" aria-hidden="true" />
      </button>

      <div className="detail-grid">
        <div className="detail-photo">
          <Cover opportunity={o} className="absolute inset-0 size-full" />
          <div className="detail-photo-shade" aria-hidden="true" />
          <div className="relative mt-auto p-6 text-white">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-white px-3 py-1 text-xs font-semibold text-ink">
              <meta.icon className="size-3.5" aria-hidden="true" />
              {meta.label}
            </span>
            <h2 id={`${o.id}-dialog-title`} className="mt-3 font-display text-[34px] leading-[1.1] text-balance">
              {o.title}
            </h2>
            <p className="mt-2 font-semibold text-white/90">{o.organizer}</p>
            <div className="mt-3 flex flex-col gap-1.5 text-sm text-white/85">
              {place && <Fact icon={MapPin}>{place}</Fact>}
              {o.deadline ? (
                <Fact icon={Clock}>{dueLabel(o.deadline)}</Fact>
              ) : (
                o.startTime && <Fact icon={CalendarDays}>{`Starts ${shortDate(o.startTime)}`}</Fact>
              )}
              {o.unknowns.map((unknown) => (
                <Fact key={unknown.field} icon={CircleDashed}>
                  {unknown.label}
                </Fact>
              ))}
            </div>
            <div className="mt-4 flex items-center gap-3">
              <span className="text-sm font-semibold">Fit</span>
              <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/25">
                <div className="h-full rounded-full bg-white" style={{ width: `${fit}%` }} />
              </div>
              <span className="text-sm text-white/80">{fit} of 100</span>
            </div>
          </div>
        </div>

        <div className="detail-col">
          <div className="flex gap-3 rounded-2xl bg-brand-soft/70 p-4">
            <Sparkles className="mt-0.5 size-4 shrink-0 text-brand" aria-hidden="true" />
            <p className="text-[15px] leading-relaxed text-ink-2">
              <span className="font-medium text-ink">Why you are seeing this. </span>
              {o.fitExplanation}
            </p>
          </div>

          <KeyDates opportunity={o} />
          <Needs opportunity={o} />

          <ul className="mt-4 flex flex-wrap gap-2">
            {o.tags.map((tag) => (
              <li key={tag} className="rounded-full border border-line px-3 py-1 text-xs font-medium text-ink-2">
                {tag}
              </li>
            ))}
          </ul>

          <div className="mt-auto pt-5">
            <div className="flex flex-wrap items-center gap-2">
              <SaveButton id={o.id} />
              <LikeButton id={o.id} />
              <OfficialLink opportunity={o} />
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-3 text-sm text-ink-2">
              <span className="font-medium">Applying?</span>
              <StatusSelect id={o.id} />
            </div>
          </div>
        </div>

        <div className="detail-col detail-side">
          <OpportunityRoadmap opportunity={o} onNavigate={() => ref.current?.close()} />
          <AskBar opportunity={o} />
        </div>
      </div>
    </dialog>
  );
}

/** One tile in the feed: photo first, then the title and the reason it was recommended. */
export function OpportunityCard({ opportunity: o, onDismiss }: { opportunity: Opportunity; onDismiss?: (o: Opportunity) => void }) {
  const [open, setOpen] = useState(false);
  const meta = typeMeta[o.type];
  const urgent = o.deadline !== null && daysUntil(o.deadline) <= 7;
  const when = o.deadline ? dueLabel(o.deadline) : o.startTime ? `Starts ${shortDate(o.startTime)}` : null;

  return (
    <article
      aria-labelledby={`${o.id}-title`}
      className="group relative overflow-hidden rounded-3xl bg-white shadow-card transition-shadow hover:shadow-lift"
    >
      <div className="relative" style={{ aspectRatio: o.imageAspect }}>
        <Cover opportunity={o} className="absolute inset-0 size-full" />
        <div className="absolute inset-x-0 bottom-0 h-24 bg-linear-to-t from-black/45 to-transparent" aria-hidden="true" />
        <span className="absolute top-3 left-3 flex items-center gap-1.5 rounded-full bg-white/90 px-3 py-1.5 text-xs font-medium text-ink shadow-card backdrop-blur">
          <meta.icon className="size-3.5" aria-hidden="true" />
          {meta.label}
        </span>
        {when && (
          <span
            className={`absolute bottom-3 left-3 flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium backdrop-blur ${
              urgent ? 'bg-orange-600 text-white' : 'bg-black/45 text-white'
            }`}
          >
            <Clock className="size-3.5" aria-hidden="true" />
            {when}
          </span>
        )}
      </div>

      <div className="p-5">
        <h2 id={`${o.id}-title`} className="text-[17px] leading-snug font-semibold tracking-tight text-balance">
          {/* The stretched button makes the whole tile open the details. */}
          <button type="button" onClick={() => setOpen(true)} className="text-left after:absolute after:inset-0 after:rounded-3xl">
            {o.title}
          </button>
        </h2>
        <p className="mt-1 text-sm text-ink-3">{o.organizer}</p>
        <p className="mt-3 flex gap-2 text-sm leading-relaxed text-ink-2">
          <Sparkles className="mt-1 size-3.5 shrink-0 text-brand" aria-hidden="true" />
          <span className="line-clamp-3">{o.fitExplanation}</span>
        </p>
        <div className="mt-3 -ml-2 flex items-center gap-1">
          <LikeButton id={o.id} />
          {onDismiss && (
            <button
              type="button"
              onClick={() => onDismiss(o)}
              className="relative z-10 flex h-9 items-center gap-1.5 rounded-lg px-2 text-sm font-medium text-ink-3 transition hover:bg-slate-100 hover:text-ink"
            >
              <ThumbsDown className="size-4" aria-hidden="true" />
              Dislike
            </button>
          )}
        </div>
      </div>

      <SaveButton id={o.id} overlay />
      {open && <Details opportunity={o} onClose={() => setOpen(false)} />}
    </article>
  );
}

/**
 * One opportunity as a wide row in the feed list: its picture on the left, shown whole, and on
 * the right what it is, the title, the organizer and why it fits. The whole row opens the
 * details; Save, Like and Dislike sit along the bottom.
 */
export function OpportunityRow({
  opportunity: o,
  onDismiss,
  onRoadmap = false,
  actions,
}: {
  opportunity: Opportunity;
  onDismiss: (o: Opportunity) => void;
  onRoadmap?: boolean;
  /** More controls at the end of the row's button line, such as the application status on the Saved page. */
  actions?: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const meta = typeMeta[o.type];
  const urgent = o.deadline !== null && daysUntil(o.deadline) <= 7;
  const when = o.deadline ? dueLabel(o.deadline) : o.startTime ? `Starts ${shortDate(o.startTime)}` : null;
  const place = [o.format ? formatLabel[o.format] : null, o.location].filter(Boolean).join(' · ');

  return (
    <article className="feed-row" aria-labelledby={`${o.id}-row`}>
      <div className="feed-row-media">
        <Cover opportunity={o} className="absolute inset-0 size-full" />
      </div>
      <div className="feed-row-body">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs font-semibold">
          <span className={`flex items-center gap-1.5 rounded-full px-2.5 py-1 ${meta.tint}`}>
            <meta.icon className="size-3.5" aria-hidden="true" />
            {meta.label}
          </span>
          {when && (
            <span className={`flex items-center gap-1 ${urgent ? 'text-orange-700' : 'text-ink-3'}`}>
              <Clock className="size-3.5" aria-hidden="true" />
              {when}
            </span>
          )}
          {onRoadmap && <span className="text-brand">On your roadmap</span>}
        </div>
        <h2 id={`${o.id}-row`} className="mt-2 line-clamp-2 text-[17px] leading-snug font-semibold text-ink text-balance">
          <button type="button" onClick={() => setOpen(true)} className="text-left after:absolute after:inset-0">
            {o.title}
          </button>
        </h2>
        <p className="mt-0.5 truncate text-sm font-medium text-ink-2">
          {o.organizer}
          {place && <span className="font-normal text-ink-3"> · {place}</span>}
        </p>
        <p className="mt-2 line-clamp-2 text-sm leading-relaxed text-ink-2">{o.fitExplanation}</p>
        <div className="relative z-10 mt-auto flex flex-wrap items-center gap-1 pt-3">
          <SaveButton id={o.id} />
          <LikeButton id={o.id} />
          <button
            type="button"
            onClick={() => onDismiss(o)}
            className="flex h-9 items-center gap-1.5 rounded-lg px-2 text-sm font-medium text-ink-3 transition hover:bg-slate-100 hover:text-ink"
          >
            <ThumbsDown className="size-4" aria-hidden="true" />
            Dislike
          </button>
          {actions}
        </div>
      </div>
      {open && <Details opportunity={o} onClose={() => setOpen(false)} />}
    </article>
  );
}

/**
 * A compact photo tile for the feed board, where every card has to fit in the window. The whole
 * tile opens the details; Save, Like and Dislike sit on top of the photo.
 */
export function OpportunityTile({
  opportunity: o,
  onDismiss,
  onRoadmap = false,
  lit = false,
}: {
  opportunity: Opportunity;
  onDismiss: (o: Opportunity) => void;
  /** This card is a step on the student's roadmap. */
  onRoadmap?: boolean;
  /** Hovered from the roadmap panel. */
  lit?: boolean;
}) {
  const { state, dispatch } = useStore();
  const [open, setOpen] = useState(false);
  const meta = typeMeta[o.type];
  const liked = state.liked.includes(o.id);
  const urgent = o.deadline !== null && daysUntil(o.deadline) <= 7;
  const when = o.deadline ? dueLabel(o.deadline) : o.startTime ? `Starts ${shortDate(o.startTime)}` : null;

  return (
    <article className="feed-tile" data-lit={lit} aria-labelledby={`${o.id}-tile`}>
      <Cover opportunity={o} className="absolute inset-0 size-full" box="absolute inset-x-0 top-0 h-[60%] pt-10" />
      <div className="feed-tile-shade" aria-hidden="true" />
      <div className="absolute inset-x-3 top-3 flex items-center gap-1.5">
        <span className="flex items-center gap-1.5 rounded-full bg-white/90 px-2.5 py-1 text-xs font-semibold text-ink backdrop-blur">
          <meta.icon className="size-3.5" aria-hidden="true" />
          {meta.label}
        </span>
      </div>

      <div className="absolute inset-x-0 bottom-0 p-3.5 text-white">
        {onRoadmap && (
          <p className="mb-1 flex items-center gap-1.5 text-[11px] font-semibold tracking-wide text-[#a9ccff] uppercase">
            <span className="size-1.5 rounded-full bg-[#7fb2ff]" aria-hidden="true" />
            On your roadmap
          </p>
        )}
        <h2 id={`${o.id}-tile`} className="line-clamp-2 text-[15px] leading-snug font-semibold text-balance">
          <button type="button" onClick={() => setOpen(true)} className="text-left after:absolute after:inset-0">
            {o.title}
          </button>
        </h2>
        <p className="mt-0.5 truncate text-[13px] text-white/75">{o.organizer}</p>
        <div className="mt-2 flex items-center justify-between gap-2">
          {when ? (
            <span className={`flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold whitespace-nowrap ${urgent ? 'bg-orange-600' : 'bg-white/20 backdrop-blur'}`}>
              <Clock className="size-3" aria-hidden="true" />
              {when}
            </span>
          ) : (
            <span />
          )}
          <span className="feed-tile-actions">
            <button type="button" aria-pressed={liked} aria-label={liked ? 'Liked' : 'Like'} onClick={() => dispatch({ type: 'toggleLiked', id: o.id })}>
              <Heart className="size-4" fill={liked ? 'currentColor' : 'none'} aria-hidden="true" />
            </button>
            <button type="button" aria-label="Dislike" onClick={() => onDismiss(o)}>
              <ThumbsDown className="size-4" aria-hidden="true" />
            </button>
          </span>
        </div>
      </div>

      <SaveButton id={o.id} overlay />
      {open && <Details opportunity={o} onClose={() => setOpen(false)} />}
    </article>
  );
}
