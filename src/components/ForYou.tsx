import { ArrowUpRight, Bookmark, ChevronDown, ChevronUp, Heart, Info, MapPin, Sparkles, ThumbsDown } from 'lucide-react';
import { useEffect, useState } from 'react';
import { opportunities } from '../data/opportunities.ts';
import { categoryMeta, dateLine, freshness, matchLabel, placeLine, sortOpportunities } from '../lib/catalog.ts';
import { Cover } from './Artwork.tsx';
import { useChoice } from './Actions.tsx';
import { Details } from './Details.tsx';

export function ForYou() {
  const ranked = sortOpportunities(opportunities, 'best');
  const [index, setIndex] = useState(0);
  const [whyOpen, setWhyOpen] = useState(false);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const opportunity = ranked[Math.min(index, ranked.length - 1)]!;
  const choice = useChoice(opportunity.id);
  const meta = categoryMeta(opportunity.category);

  useEffect(() => {
    setWhyOpen(false);
    setDetailsOpen(false);
  }, [opportunity.id]);

  useEffect(() => {
    if (!whyOpen) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      if (document.querySelector('.dialog-scrim')) return;
      event.preventDefault();
      setWhyOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [whyOpen]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target && ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)) return;
      if (document.querySelector('[data-overlay]')) return;
      if (event.key === 'ArrowRight' || event.key === 'ArrowDown') {
        event.preventDefault();
        setIndex((current) => Math.min(ranked.length - 1, current + 1));
      } else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') {
        event.preventDefault();
        setIndex((current) => Math.max(0, current - 1));
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [ranked.length]);

  return (
    <div className="reel">
      <div className="reel-slide">
        <div className="reel-stage">
          <article className="reel-card" aria-labelledby="for-you-title">
            <Cover id={opportunity.art} title="" />
            <div className="reel-shade" aria-hidden="true" />
            <div className="reel-body">
              <ul className="chip-row">
                <li className="reel-chip reel-chip-solid">{meta.singular}</li>
                <li className="reel-chip">{matchLabel(opportunity.matchScore)}</li>
                <li className="reel-chip">{freshness(opportunity.lastCheckedAt)}</li>
                <li>
                  <button type="button" className="reel-chip" aria-expanded={whyOpen} onClick={() => setWhyOpen((open) => !open)}>
                    <Sparkles aria-hidden="true" />
                    Why this?
                  </button>
                </li>
              </ul>
              <h2 id="for-you-title" className="font-display">
                {opportunity.title}
              </h2>
              <p className="organizer">{opportunity.organizer}</p>
              <p className="fit">
                <Sparkles aria-hidden="true" />
                <span>{opportunity.fitExplanation}</span>
              </p>
              <div className="place-line">
                <span>
                  <MapPin aria-hidden="true" />
                  {placeLine(opportunity)}
                </span>
                {dateLine(opportunity).map((part) => (
                  <span key={part.text} className={part.unknown ? 'date-note unknown' : undefined}>
                    {part.text}
                  </span>
                ))}
              </div>
              {whyOpen && (
                <div className="why-panel" data-overlay="" role="region" aria-label="Why this matches">
                  <h3>Why this matches</h3>
                  <ol>
                    {opportunity.why.map((reason) => (
                      <li key={reason}>{reason}</li>
                    ))}
                  </ol>
                </div>
              )}
            </div>
          </article>

          <div className="reel-rail" aria-label="Actions">
            <button type="button" className="reel-action" aria-pressed={choice.saved} onClick={choice.toggleSaved}>
              <span className="reel-action-icon">
                <Bookmark aria-hidden="true" fill={choice.saved ? 'currentColor' : 'none'} />
              </span>
              <span className="reel-action-label">{choice.saved ? 'Saved' : 'Save'}</span>
            </button>
            <button type="button" className="reel-action" data-tone="like" aria-pressed={choice.reaction === 'like'} onClick={choice.like}>
              <span className="reel-action-icon">
                <Heart aria-hidden="true" fill={choice.reaction === 'like' ? 'currentColor' : 'none'} />
              </span>
              <span className="reel-action-label">{choice.reaction === 'like' ? 'Liked' : 'Like'}</span>
            </button>
            <button type="button" className="reel-action" data-tone="dislike" aria-pressed={choice.reaction === 'dislike'} onClick={choice.dislike}>
              <span className="reel-action-icon">
                <ThumbsDown aria-hidden="true" fill={choice.reaction === 'dislike' ? 'currentColor' : 'none'} />
              </span>
              <span className="reel-action-label">Dislike</span>
            </button>
            <button type="button" className="reel-action" aria-expanded={detailsOpen} onClick={() => setDetailsOpen(true)}>
              <span className="reel-action-icon">
                <Info aria-hidden="true" />
              </span>
              <span className="reel-action-label">Details</span>
            </button>
            {opportunity.organizerUrl ? (
              <a className="reel-action primary" href={opportunity.organizerUrl} target="_blank" rel="noreferrer">
                <span className="reel-action-icon">
                  <ArrowUpRight aria-hidden="true" />
                </span>
                <span className="reel-action-label">Open</span>
              </a>
            ) : (
              <button type="button" className="reel-action" disabled>
                <span className="reel-action-icon">
                  <ArrowUpRight aria-hidden="true" />
                </span>
                <span className="reel-action-label">Open</span>
              </button>
            )}
          </div>
        </div>

        <div className="reel-pager">
          <button type="button" aria-label="Previous opportunity" disabled={index === 0} onClick={() => setIndex((current) => Math.max(0, current - 1))}>
            <ChevronUp aria-hidden="true" />
          </button>
          <span aria-live="polite">
            {index + 1} / {ranked.length}
          </span>
          <button
            type="button"
            aria-label="Next opportunity"
            disabled={index >= ranked.length - 1}
            onClick={() => setIndex((current) => Math.min(ranked.length - 1, current + 1))}
          >
            <ChevronDown aria-hidden="true" />
          </button>
        </div>
      </div>
      {detailsOpen && <Details opportunity={opportunity} onClose={() => setDetailsOpen(false)} />}
    </div>
  );
}
