import { ArrowUpRight, Bookmark, BookmarkCheck, CalendarDays, CircleDashed, Clock, MapPin, Sparkles, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { daysUntil, dueLabel, relativeTime, shortDate } from '../lib/time.ts';
import { useStore } from '../state/StoreProvider.tsx';
import type { Opportunity } from '../types.ts';
import { formatLabel, typeMeta } from './meta.ts';

/** Cover photo, with a tinted icon panel when there is no photo or it fails to load. */
function Cover({ opportunity: o, className = '' }: { opportunity: Opportunity; className?: string }) {
  const [failed, setFailed] = useState(false);
  const meta = typeMeta[o.type];
  if (!o.image || failed) {
    return (
      <div className={`grid place-items-center ${meta.tint} ${className}`}>
        <meta.icon className="size-12 opacity-60" aria-hidden="true" />
      </div>
    );
  }
  return <img src={o.image} alt="" loading="lazy" onError={() => setFailed(true)} className={`bg-slate-100 object-cover ${className}`} />;
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

function Details({ opportunity: o, onClose }: { opportunity: Opportunity; onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  const meta = typeMeta[o.type];
  const place = [o.format ? formatLabel[o.format] : null, o.location].filter(Boolean).join(' · ');

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
      className="m-auto w-[min(880px,calc(100vw-2rem))] overflow-hidden rounded-3xl bg-white p-0 shadow-lift backdrop:bg-ink/45 backdrop:backdrop-blur-sm"
    >
      <div className="grid max-h-[calc(100dvh-2rem)] overflow-y-auto md:grid-cols-[2fr_3fr]">
        <Cover opportunity={o} className="h-56 w-full md:h-full md:min-h-[460px]" />
        <div className="relative p-7">
          <button
            type="button"
            onClick={() => ref.current?.close()}
            aria-label="Close"
            className="absolute top-4 right-4 grid size-9 place-items-center rounded-full bg-slate-100 text-ink-2 hover:bg-slate-200"
          >
            <X className="size-4" aria-hidden="true" />
          </button>
          <p className="pr-10 text-sm text-ink-3">
            {meta.label} · {o.organizer}
          </p>
          <h2 id={`${o.id}-dialog-title`} className="mt-1 font-display text-3xl leading-tight font-medium text-balance">
            {o.title}
          </h2>

          <div className="mt-4 flex flex-col gap-2 text-sm text-ink-2">
            {place && <Fact icon={MapPin}>{place}</Fact>}
            {o.startTime && <Fact icon={CalendarDays}>{`Starts ${shortDate(o.startTime)}`}</Fact>}
            {o.deadline && (
              <Fact icon={Clock} urgent={daysUntil(o.deadline) <= 7}>
                {dueLabel(o.deadline)}
              </Fact>
            )}
            {o.unknowns.map((unknown) => (
              <Fact key={unknown.field} icon={CircleDashed}>
                {unknown.label}
              </Fact>
            ))}
          </div>

          <div className="mt-5 flex gap-3 rounded-2xl bg-brand-soft/70 p-4">
            <Sparkles className="mt-0.5 size-4 shrink-0 text-brand" aria-hidden="true" />
            <p className="text-[15px] leading-relaxed text-ink-2">
              <span className="font-medium text-ink">Why you are seeing this. </span>
              {o.fitExplanation}
            </p>
          </div>

          <ul className="mt-4 flex flex-wrap gap-2">
            {o.tags.map((tag) => (
              <li key={tag} className="rounded-full border border-line px-3 py-1 text-xs font-medium text-ink-2">
                {tag}
              </li>
            ))}
          </ul>

          <div className="mt-6 flex flex-wrap items-center gap-2">
            <SaveButton id={o.id} />
            <OfficialLink opportunity={o} />
          </div>
          <p className="mt-4 text-xs text-ink-3">
            Found {relativeTime(o.foundAt)} · checked against the official page {relativeTime(o.lastCheckedAt)}
          </p>
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
        {onDismiss && (
          <button
            type="button"
            onClick={() => onDismiss(o)}
            className="relative z-10 mt-3 -ml-2 flex h-9 items-center gap-1.5 rounded-lg px-2 text-sm font-medium text-ink-3 transition hover:bg-slate-100 hover:text-ink"
          >
            <X className="size-4" aria-hidden="true" />
            Not for me
          </button>
        )}
      </div>

      <SaveButton id={o.id} overlay />
      {open && <Details opportunity={o} onClose={() => setOpen(false)} />}
    </article>
  );
}
