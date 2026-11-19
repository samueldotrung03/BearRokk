// The screen the app opens on: one place for what matters today, pulled from the calendar, the
// roadmap, the application manager and the feed. The rules that pick and order everything live in
// src/lib/today so a model can take their place later without touching this page.
import { useEffect, useMemo, useState } from 'react';
import { DoToday, type Undoable } from '../components/today/DoToday.tsx';
import { AskChips, ClosingThisWeek, NewForYou, ProgressStrip } from '../components/today/Sections.tsx';
import { Details } from '../components/OpportunityCard.tsx';
import { Page } from '../components/Page.tsx';
import { opportunities as sampleOpportunities } from '../data/sample.ts';
import { statusLabel } from '../lib/applications.ts';
import { greeting } from '../lib/time.ts';
import { buildToday, type TodayAction } from '../lib/today/today.ts';
import { useOpportunities } from '../state/live.tsx';
import { useStore } from '../state/StoreProvider.tsx';
import type { Opportunity } from '../types.ts';
import '../styles/today.css';

export function Today() {
  const { state, dispatch } = useStore();
  const list = useOpportunities();
  const [details, setDetails] = useState<Opportunity | null>(null);
  const [status, setStatus] = useState<Undoable | null>(null);

  const today = useMemo(() => buildToday(state, list, Date.now()), [state, list]);
  // Tracked items can be sample cards even when the feed shows live ones, so both are searched.
  const byId = useMemo(() => new Map([...sampleOpportunities, ...list].map((o) => [o.id, o])), [list]);

  useEffect(() => {
    if (!status) return;
    const timer = window.setTimeout(() => setStatus(null), 6000);
    return () => window.clearTimeout(timer);
  }, [status]);

  const open = (o: Opportunity) => {
    dispatch({ type: 'opened', id: o.id });
    setDetails(o);
  };

  const act = (action: TodayAction) => {
    const { cta } = action;
    if (cta.kind === 'tick') {
      dispatch({ type: 'toggleStep', id: cta.stepId });
      setStatus({ text: `Marked done: ${action.title}.`, undo: () => (dispatch({ type: 'toggleStep', id: cta.stepId }), setStatus(null)) });
    } else if (cta.kind === 'move') {
      const before = state.applications[cta.opportunityId]?.status ?? null;
      dispatch({ type: 'setApplication', id: cta.opportunityId, status: cta.status });
      setStatus({
        text: `Moved ${action.subject ?? 'it'} to ${statusLabel[cta.status]}. Reminders are on.`,
        undo: () => (dispatch({ type: 'setApplication', id: cta.opportunityId, status: before }), setStatus(null)),
      });
    } else if (cta.kind === 'open') {
      const o = byId.get(cta.opportunityId);
      if (o) open(o);
    }
  };

  const date = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
  const name = state.profile.name.trim();

  return (
    <Page title={name ? `${greeting()}, ${name}` : greeting()} subtitle={date}>
      <div className="td">
        <div className="td-grid">
          <div className="td-main">
            <DoToday
              brief={today.brief}
              actions={today.actions}
              fresh={today.fresh}
              status={status}
              onAct={act}
            />
            <NewForYou items={today.newForYou} onOpen={open} />
          </div>
          <div className="td-side">
            <ClosingThisWeek items={today.closing} onOpen={open} />
            <ProgressStrip progress={today.progress} />
            <AskChips questions={today.questions} />
          </div>
        </div>
        <p className="mt-6 text-xs text-ink-3">
          Today is built from your own saved items, applications and roadmap by simple rules. Grok will write it once the agents are connected.
        </p>
      </div>
      {details && <Details opportunity={details} onClose={() => setDetails(null)} />}
    </Page>
  );
}
