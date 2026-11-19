// The Command-/ launcher, modeled on macOS Spotlight: one large field in the middle of the
// screen, results grouped underneath, arrow keys to move, Return to act, Escape to close.
import { CalendarDays, CheckCircle2, CornerDownLeft, FileText, Search, Sparkles, Zap } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router';
import { opportunities } from '../data/sample.ts';
import { spotlight, type SpotlightItem, type SpotlightKind } from '../lib/spotlight.ts';
import { dueLabel } from '../lib/time.ts';
import { useStore } from '../state/StoreProvider.tsx';
import type { Opportunity } from '../types.ts';
import { askAssistant } from './Assistant.tsx';
import { typeMeta } from './meta.ts';
import { Details } from './OpportunityCard.tsx';

const kindIcon: Record<SpotlightKind, typeof Search> = {
  page: FileText,
  opportunity: CalendarDays,
  step: CheckCircle2,
  action: Zap,
  ask: Sparkles,
};

const returnHint: Record<SpotlightKind, string> = {
  page: 'Open',
  opportunity: 'Open details',
  step: 'Mark done',
  action: 'Run',
  ask: 'Ask',
};

export function Spotlight() {
  const { state, dispatch } = useStore();
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const [details, setDetails] = useState<Opportunity | null>(null);
  const input = useRef<HTMLInputElement>(null);
  const list = useRef<HTMLDivElement>(null);

  const groups = useMemo(() => (open ? spotlight(query, state) : []), [open, query, state]);
  const items = groups.flatMap((group) => group.items);
  const current = items[Math.min(active, items.length - 1)];
  const preview = current?.open ? opportunities.find((o) => o.id === current.open) : undefined;

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key === '/') {
        event.preventDefault();
        setOpen((value) => !value);
      }
    };
    const onOpen = () => setOpen(true);
    window.addEventListener('keydown', onKey);
    window.addEventListener('bearrok:spotlight', onOpen);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('bearrok:spotlight', onOpen);
    };
  }, []);

  useEffect(() => {
    if (!open) return;
    setQuery('');
    setActive(0);
    input.current?.focus();
  }, [open]);
  useEffect(() => setActive(0), [query]);
  useEffect(() => {
    list.current?.querySelector('[aria-selected="true"]')?.scrollIntoView({ block: 'nearest' });
  }, [active]);

  const run = (item: SpotlightItem | undefined) => {
    if (!item) return;
    setOpen(false);
    if (item.to) navigate(item.to);
    if (item.dispatch) dispatch(item.dispatch);
    if (item.open) setDetails(opportunities.find((o) => o.id === item.open) ?? null);
    if (item.ask) askAssistant(item.ask);
  };

  if (pathname === '/signin') return null;

  return (
    <>
      {open && (
        <div
          className="spotlight-scrim"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setOpen(false);
          }}
        >
          <div
            className="spotlight"
            role="dialog"
            aria-modal="true"
            aria-label="Search BearRok"
            onKeyDown={(event) => {
              if (event.key === 'ArrowDown') {
                event.preventDefault();
                setActive((value) => Math.min(items.length - 1, value + 1));
              } else if (event.key === 'ArrowUp') {
                event.preventDefault();
                setActive((value) => Math.max(0, value - 1));
              } else if (event.key === 'Enter') {
                event.preventDefault();
                run(current);
              } else if (event.key === 'Escape') {
                event.preventDefault();
                event.stopPropagation();
                setOpen(false);
              }
            }}
          >
            <div className="spotlight-field">
              <Search className="size-6 shrink-0" aria-hidden="true" />
              <input
                ref={input}
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search BearRok"
                aria-label="Search BearRok"
                role="combobox"
                aria-expanded="true"
                aria-controls="spotlight-results"
                aria-activedescendant={current ? `spotlight-${current.id}` : undefined}
                autoComplete="off"
                spellCheck={false}
              />
              <kbd>esc</kbd>
            </div>

            {items.length > 0 && (
              <div className="spotlight-body">
                <div ref={list} id="spotlight-results" className="spotlight-list" role="listbox" aria-label="Results">
                  {groups.map((group) => (
                    <div key={group.title} role="group" aria-label={group.title}>
                      <p className="spotlight-heading">{group.title}</p>
                      {group.items.map((item) => {
                        const index = items.indexOf(item);
                        const card = item.open ? opportunities.find((o) => o.id === item.open) : undefined;
                        const Icon = card ? typeMeta[card.type].icon : kindIcon[item.kind];
                        return (
                          <button
                            key={item.id}
                            id={`spotlight-${item.id}`}
                            type="button"
                            role="option"
                            aria-selected={index === active}
                            className="spotlight-row"
                            data-kind={item.kind}
                            onMouseMove={() => setActive(index)}
                            onClick={() => run(item)}
                          >
                            <span className="spotlight-icon">
                              {card?.image ? <img src={card.image} alt="" /> : <Icon className="size-4" aria-hidden="true" />}
                            </span>
                            <span className="min-w-0 flex-1 text-left">
                              <span className="block truncate">{item.title}</span>
                            </span>
                            <span className="spotlight-sub">{item.subtitle}</span>
                          </button>
                        );
                      })}
                    </div>
                  ))}
                </div>

                {preview && (
                  <div className="spotlight-preview" aria-hidden="true">
                    {preview.image && <img src={preview.image} alt="" />}
                    <p className="mt-3 text-[11px] font-semibold tracking-wide text-ink-3 uppercase">{typeMeta[preview.type].label}</p>
                    <p className="mt-0.5 leading-snug font-semibold">{preview.title}</p>
                    <p className="text-sm text-ink-2">{preview.organizer}</p>
                    <dl>
                      <div>
                        <dt>Fit</dt>
                        <dd>{Math.round(preview.baseScore * 100)} of 100</dd>
                      </div>
                      <div>
                        <dt>Deadline</dt>
                        <dd>{preview.deadline ? dueLabel(preview.deadline) : 'Not stated'}</dd>
                      </div>
                      <div>
                        <dt>Where</dt>
                        <dd>{preview.location ?? 'Not stated'}</dd>
                      </div>
                    </dl>
                    <p className="mt-3 line-clamp-4 text-sm leading-snug text-ink-2">{preview.fitExplanation}</p>
                  </div>
                )}
              </div>
            )}

            <div className="spotlight-foot">
              <span>
                <kbd>↑</kbd>
                <kbd>↓</kbd> to move
              </span>
              {current && (
                <span>
                  <kbd>
                    <CornerDownLeft className="size-3" aria-hidden="true" />
                  </kbd>
                  {returnHint[current.kind]}
                </span>
              )}
              <span className="ml-auto">
                <kbd>⌘</kbd>
                <kbd>/</kbd> to open anywhere
              </span>
            </div>
          </div>
        </div>
      )}
      {details && <Details opportunity={details} onClose={() => setDetails(null)} />}
    </>
  );
}
