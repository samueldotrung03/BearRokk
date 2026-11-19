// The dashboard: one place to keep track of everything. What to do today, the week ahead, every
// application, the roadmap, new opportunities and the agents, each linking to the page that owns it. The rules that pick and order everything live in
// src/lib/today so a model can take their place later without touching this page.
import { Check } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import type { Undoable } from '../components/today/DoToday.tsx';
import { AgentsCard, NeedsCard, PipelineCard, ProfileCard, QuickActions, RoadmapCard, StatTiles, WeekCard } from '../components/today/Dashboard.tsx';
import { NewForYou } from '../components/today/Sections.tsx';
import { Details } from '../components/OpportunityCard.tsx';
import { Page } from '../components/Page.tsx';
import { opportunities as sampleOpportunities } from '../data/sample.ts';
import { calendarItems, dayKey } from '../lib/calendar.ts';
import { mergeItems, type PersonalItem } from '../lib/cal/items.ts';
import { goalNeeds, headline, pipeline, profileStrength, quickReminder, roadmapGlance, upcoming, weekStrip } from '../lib/today/dashboard.ts';
import { useLocal } from '../lib/useLocal.ts';
import { greeting } from '../lib/time.ts';
import { buildToday } from '../lib/today/today.ts';
import { useOpportunities } from '../state/live.tsx';
import { useStore } from '../state/StoreProvider.tsx';
import type { Opportunity } from '../types.ts';
import '../styles/today.css';
import '../styles/dashboard.css';

export function Today() {
  const { state, dispatch } = useStore();
  const list = useOpportunities();
  const [details, setDetails] = useState<Opportunity | null>(null);
  const [status, setStatus] = useState<Undoable | null>(null);

  // The student's own reminders are the calendar's: one list, shown and added in both places.
  const [personal, setPersonal] = useLocal<PersonalItem[]>('bearrok.calendar.personal', []);
  const today = useMemo(() => buildToday(state, list, Date.now()), [state, list]);
  // Tracked items can be sample cards even when the feed shows live ones, so both are searched.
  const byId = useMemo(() => new Map([...sampleOpportunities, ...list].map((o) => [o.id, o])), [list]);

  const board = useMemo(() => {
    const now = Date.now();
    const day = dayKey(new Date(now));
    const items = mergeItems(calendarItems(state, now), personal);
    return {
      week: weekStrip(items, day),
      upcoming: upcoming(items, day),
      headline: headline(state, items, day),
      stages: pipeline(state, byId, now),
      roadmap: roadmapGlance(state),
      needs: goalNeeds(state),
      profile: profileStrength(state),
    };
  }, [state, byId, personal]);

  useEffect(() => {
    if (!status) return;
    const timer = window.setTimeout(() => setStatus(null), 6000);
    return () => window.clearTimeout(timer);
  }, [status]);

  const open = (o: Opportunity) => {
    dispatch({ type: 'opened', id: o.id });
    setDetails(o);
  };

  const tick = (stepId: string, title?: string) => {
    dispatch({ type: 'toggleStep', id: stepId });
    setStatus({ text: title ? `Marked done: ${title}.` : 'Marked done.', undo: () => (dispatch({ type: 'toggleStep', id: stepId }), setStatus(null)) });
  };
  const addReminder = (title: string, day: string) => {
    const reminder = quickReminder(title, day, `own-${Date.now().toString(36)}`);
    setPersonal((items) => [...items, reminder]);
    setStatus({ text: `Added to your calendar: ${reminder.title}.`, undo: () => (setPersonal((items) => items.filter((p) => p.id !== reminder.id)), setStatus(null)) });
  };
  const tickOwn = (id: string) => {
    const flip = (done: boolean) => setPersonal((items) => items.map((p) => (p.id === id ? { ...p, done } : p)));
    flip(true);
    setStatus({ text: 'Marked done.', undo: () => (flip(false), setStatus(null)) });
  };
  const openById = (id: string) => {
    const o = byId.get(id);
    if (o) open(o);
  };

  const date = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
  const name = state.profile.name.trim();

  return (
    <Page title={name ? `${greeting()}, ${name}` : greeting()} subtitle={date} aside={<QuickActions />}>
      <div className="td db">
        <StatTiles headline={board.headline} week={board.week} roadmap={board.roadmap} saved={state.saved.length} fresh={today.newForYou.length} />
        <div className="db-grid">
          <div className="db-col db-wide">
            <PipelineCard stages={board.stages} onOpen={open} />
            <div className="db-pair">
              <NeedsCard {...board.needs} />
              <ProfileCard {...board.profile} />
            </div>
            <NewForYou items={today.newForYou} onOpen={open} />
          </div>
          <div className="db-col db-narrow">
            <WeekCard week={board.week} upcoming={board.upcoming} onOpen={openById} onTick={tick} onTickOwn={tickOwn} onAdd={addReminder} />
            <RoadmapCard roadmap={board.roadmap} onTick={tick} />
            <AgentsCard inFeed={list.length} />
          </div>
        </div>
        <p className="mt-6 text-xs text-ink-3">
          Your dashboard is built from your own saved items, applications and roadmap by simple rules. Grok will write it once the agents are connected.
        </p>
      </div>
      {status && (
        <div className="db-toast" role="status">
          <Check className="size-4" aria-hidden="true" />
          <span>{status.text}</span>
          <button type="button" onClick={status.undo}>
            Undo
          </button>
        </div>
      )}
      {details && <Details opportunity={details} onClose={() => setDetails(null)} />}
    </Page>
  );
}
