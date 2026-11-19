import { X } from 'lucide-react';
import { useEffect, useId, useRef } from 'react';
import type { Opportunity } from '../data/opportunities.ts';
import { categoryMeta, dateLine, formatLabel, freshness } from '../lib/catalog.ts';
import { RowActions } from './Actions.tsx';

export function Details({ opportunity, onClose }: { opportunity: Opportunity; onClose: () => void }) {
  const titleId = useId();
  const closeRef = useRef<HTMLButtonElement>(null);
  const meta = categoryMeta(opportunity.category);
  const dates = dateLine(opportunity);

  useEffect(() => {
    closeRef.current?.focus();
  }, []);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      event.preventDefault();
      onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div className="dialog-scrim" data-overlay="" onMouseDown={onClose}>
      <article
        className="details"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header>
          <div>
            <span className="prepared">Prepared example</span>
            <h2 id={titleId} className="font-display">
              {opportunity.title}
            </h2>
            <p className="organizer" style={{ color: 'var(--color-ink-2)' }}>
              {opportunity.organizer} · {formatLabel(opportunity.format)} · {opportunity.location}
            </p>
          </div>
          <button ref={closeRef} type="button" className="close-x" aria-label="Close details" onClick={onClose}>
            <X aria-hidden="true" />
          </button>
        </header>

        <section className="detail-section">
          <h3>Why it fits</h3>
          <p>{opportunity.fitExplanation}</p>
        </section>
        <section className="detail-section">
          <h3>Eligibility</h3>
          <p>{opportunity.eligibility}</p>
        </section>
        <section className="detail-section">
          <h3>Timing</h3>
          <ul>
            <li>Category: {meta.singular}</li>
            {opportunity.term && <li>Term: {opportunity.term}</li>}
            {dates.map((part) => (
              <li key={part.text}>{part.text}</li>
            ))}
            <li>{freshness(opportunity.lastCheckedAt)}</li>
          </ul>
        </section>
        <section className="detail-section">
          <h3>Organizer</h3>
          <p>{opportunity.organizerNotes}</p>
          {opportunity.organizerUrl ? (
            <p style={{ marginTop: 8 }}>
              <a href={opportunity.organizerUrl} target="_blank" rel="noreferrer">
                {opportunity.organizerUrl}
              </a>
            </p>
          ) : (
            <p style={{ marginTop: 8 }}>No organizer link on this example.</p>
          )}
        </section>
        <footer>
          <RowActions opportunity={opportunity} />
          {opportunity.organizerUrl ? (
            <a className="btn-primary" href={opportunity.organizerUrl} target="_blank" rel="noreferrer">
              Open
            </a>
          ) : (
            <button type="button" className="btn-primary" disabled>
              Open
            </button>
          )}
        </footer>
      </article>
    </div>
  );
}
