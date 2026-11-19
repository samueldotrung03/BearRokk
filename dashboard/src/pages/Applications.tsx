// Everything the student is applying to: where each one stands, what it still needs, when it is
// due, and the reminders and calendar entry that go with the deadline. On top of that, a writing
// helper on every question, a readiness score with the single next step, and a ranked "what to
// do next" strip. The rules live in src/lib/applications.ts and src/lib/apps; this file wires
// them to the store and decides which application is open.
import { CalendarArrowDown } from 'lucide-react';
import { useCallback, useMemo, useState } from 'react';
import { Link } from 'react-router';
import { ApplicationRow } from '../components/applications/ApplicationRow.tsx';
import { Board } from '../components/applications/Board.tsx';
import { Funnel, NextUp, Toolbar, type View } from '../components/applications/Overview.tsx';
import { Sheet } from '../components/applications/Sheet.tsx';
import { focusAndFlash, materialDomId, promptDomId, useReducedMotion, type GoTo, type Intent, type Item } from '../components/applications/shared.tsx';
import { Suggestions } from '../components/applications/Suggestions.tsx';
import { Card, Page } from '../components/Page.tsx';
import { applicationInfo, opportunities } from '../data/sample.ts';
import { statusLabel } from '../lib/applications.ts';
import { funnelCounts, matchesQuery, sortItems, type SortKey } from '../lib/apps/board.ts';
import { allDeadlinesIcs, exportable } from '../lib/apps/export.ts';
import { readinessOf } from '../lib/apps/readiness.ts';
import { useLocal } from '../lib/useLocal.ts';
import { useStore } from '../state/StoreProvider.tsx';
import type { ApplicationStatus } from '../types.ts';
import '../styles/applications.css';

export function Applications() {
  const { state } = useStore();
  const reduced = useReducedMotion();
  const [filter, setFilter] = useState<ApplicationStatus | 'all'>('all');
  const [query, setQuery] = useState('');
  const [view, setView] = useLocal<View>('bearrok.applications.view', 'list');
  const [sort, setSort] = useLocal<SortKey>('bearrok.applications.sort', 'deadline');
  const [expanded, setExpanded] = useState<string[]>([]);
  const [sheetId, setSheetId] = useState<string | null>(null);
  const [intent, setIntent] = useState<{ id: string; intent: Intent } | null>(null);

  const tracked: Item[] = useMemo(
    () =>
      opportunities.flatMap((o) => {
        const application = state.applications[o.id];
        if (!application) return [];
        const info = applicationInfo[o.id];
        return [{ opportunity: o, application, info, readiness: readinessOf(o, application, info) }];
      }),
    [state.applications],
  );
  const counts = funnelCounts(tracked.map((i) => i.application.status));
  const searched = sortItems(
    tracked.filter((i) => matchesQuery(i.opportunity, query)).map((i) => ({ ...i, score: i.readiness.score })),
    sort,
  );
  // The board already splits by status, so the funnel filter only narrows the list view.
  const shown = view === 'board' ? searched : searched.filter((i) => filter === 'all' || i.application.status === filter);
  const toExport = exportable(tracked.map((i) => ({ opportunity: i.opportunity, status: i.application.status })));
  const ics = allDeadlinesIcs(toExport);

  /** Opens an application where the next step is: a question (maybe with the helper running) or a material. */
  const goTo: GoTo = useCallback(
    (id, target) => {
      if (view === 'board') setSheetId(id);
      else setExpanded((list) => (list.includes(id) ? list : [...list, id]));
      // Clear the filter and search if they would hide the application being opened.
      setFilter((current) => (current === 'all' || state.applications[id]?.status === current ? current : 'all'));
      const opened = opportunities.find((o) => o.id === id);
      setQuery((current) => (opened && !matchesQuery(opened, current) ? '' : current));
      if (target?.promptIndex !== undefined) {
        setIntent({ id, intent: { index: target.promptIndex, kind: target.helper ?? 'focus', nonce: Date.now() } });
        focusAndFlash(promptDomId(id, target.promptIndex), reduced);
      } else if (target?.material) {
        focusAndFlash(materialDomId(id, target.material), reduced);
      } else if (view === 'list') {
        focusAndFlash(`ap-row-${id}`, reduced);
      }
    },
    [view, reduced, state.applications],
  );

  const sheetItem = sheetId ? tracked.find((i) => i.opportunity.id === sheetId) : undefined;
  const intentFor = (id: string) => (intent?.id === id ? intent.intent : undefined);

  const exportButton = tracked.length > 0 && (
    <a
      href={ics ? `data:text/calendar;charset=utf-8,${encodeURIComponent(ics)}` : undefined}
      download={ics ? 'bearrok-deadlines.ics' : undefined}
      aria-disabled={!ics}
      className="ap-export"
      title={ics ? 'One calendar file with every deadline, with reminders for the ones you are applying to' : 'No tracked application has a deadline on its posting yet'}
    >
      <CalendarArrowDown className="size-4" aria-hidden="true" />
      Export all deadlines
      <span className="ap-export-count">{toExport.length}</span>
    </a>
  );

  return (
    <Page title="Applications" subtitle="Everything you are applying to: where each one stands, what it needs and when it is due." aside={exportButton}>
      {tracked.length === 0 ? (
        <Card className="p-10 text-center">
          <p className="text-lg font-semibold">Nothing tracked yet</p>
          <p className="mx-auto mt-2 max-w-sm text-sm leading-relaxed text-ink-2">
            Open a card's details in the feed and set a status, start from an Apply step on your roadmap, or track one of your agents' picks below.
          </p>
          <Link to="/" className="btn-primary mt-6 inline-flex h-10 items-center rounded-xl px-4 text-sm text-white">
            Go to the feed
          </Link>
        </Card>
      ) : (
        <>
          <Funnel
            counts={counts}
            filter={view === 'board' ? 'all' : filter}
            onFilter={(status) => {
              // The board already shows every status side by side, so a filter means the list.
              setFilter(status);
              if (view === 'board') setView('list');
            }}
          />
          <NextUp items={tracked} goTo={goTo} />
          <Toolbar
            query={query}
            onQuery={setQuery}
            sort={sort}
            onSort={setSort}
            view={view}
            onView={setView}
            filter={view === 'board' ? 'all' : filter}
            onClearFilter={() => setFilter('all')}
            shown={shown.length}
          />

          {shown.length === 0 ? (
            <Card className="p-8 text-center text-sm text-ink-2">
              {query ? `Nothing matches “${query}”.` : `Nothing is marked ${statusLabel[filter as ApplicationStatus]} right now.`}
            </Card>
          ) : view === 'board' ? (
            <Board items={shown} onOpen={(id) => goTo(id)} />
          ) : (
            <div className="space-y-4">
              {shown.map((item) => (
                <ApplicationRow
                  key={item.opportunity.id}
                  item={item}
                  open={expanded.includes(item.opportunity.id)}
                  onToggle={() =>
                    setExpanded((list) => (list.includes(item.opportunity.id) ? list.filter((id) => id !== item.opportunity.id) : [...list, item.opportunity.id]))
                  }
                  goTo={goTo}
                  intent={intentFor(item.opportunity.id)}
                />
              ))}
            </div>
          )}
        </>
      )}

      <Suggestions />

      {view === 'board' && sheetItem && <Sheet key={sheetItem.opportunity.id} item={sheetItem} onClose={() => setSheetId(null)} goTo={goTo} intent={intentFor(sheetItem.opportunity.id)} />}
    </Page>
  );
}
