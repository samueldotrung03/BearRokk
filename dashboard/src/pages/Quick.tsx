// The quick panel: a small window that drops down from the camera notch in the desktop app. It
// shows the search state, the next deadline and the top pick, opens the Search page with a query,
// and holds a short chat with the assistant. Everything it opens goes to the main window through
// the desktop shell; in a plain browser it acts on this window instead, so it can be tried there.
import { ArrowUp, CalendarClock, LayoutGrid, Play, Search as SearchIcon, Sparkles, Square, Star } from 'lucide-react';
import { useEffect, useLayoutEffect, useRef, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router';
import { useAuth } from '../auth/AuthProvider.tsx';
import { respond, type AssistantReply } from '../lib/assistant.ts';
import { desktopBridge, type MenuBarAction } from '../lib/desktopBridge.ts';
import { dueDay, searchPath } from '../lib/quick.ts';
import { useTheme } from '../lib/theme.ts';
import { useGlance } from '../state/glance.ts';
import { useLive } from '../state/live.tsx';
import { useStore } from '../state/StoreProvider.tsx';
import '../styles/quick.css';

type Turn = { from: 'student'; text: string } | { from: 'assistant'; reply: AssistantReply };

export function Quick() {
  useTheme();
  const auth = useAuth();
  const live = useLive();
  const { state } = useStore();
  const navigate = useNavigate();
  const g = useGlance();
  const bridge = desktopBridge?.quick;
  const card = useRef<HTMLDivElement>(null);
  const end = useRef<HTMLDivElement>(null);
  const timer = useRef<number | undefined>(undefined);
  const [query, setQuery] = useState('');
  const [draft, setDraft] = useState('');
  const [thread, setThread] = useState<Turn[]>([]);
  const [thinking, setThinking] = useState(false);

  // The page under the card is see-through, so only the card shows in the window.
  useLayoutEffect(() => {
    document.documentElement.classList.add('is-quick');
    return () => document.documentElement.classList.remove('is-quick');
  }, []);

  // The window takes the card's height, up to the panel's limit.
  useEffect(() => {
    const el = card.current;
    if (!el || !bridge) return;
    const send = () => bridge.resize(Math.ceil(el.getBoundingClientRect().height));
    send();
    const observer = new ResizeObserver(send);
    observer.observe(el);
    return () => observer.disconnect();
  }, [bridge]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') bridge?.hide();
    };
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.clearTimeout(timer.current);
    };
  }, [bridge]);

  useEffect(() => {
    end.current?.scrollIntoView({ block: 'end' });
  }, [thread, thinking]);

  const act = (action: MenuBarAction) => {
    if (bridge) return bridge.action(action);
    if (action.type === 'run') void live.runNow();
    else if (action.type === 'stop') void live.stopRun();
    else navigate(action.path);
  };

  const ask = (question: string) => {
    const text = question.trim();
    if (!text || thinking) return;
    setDraft('');
    setThread((current) => [...current, { from: 'student', text }]);
    setThinking(true);
    // The same short pause as the assistant in the app, so the answer reads as a reply.
    timer.current = window.setTimeout(() => {
      setThread((current) => [...current, { from: 'assistant', reply: respond(text, state) }]);
      setThinking(false);
    }, 450);
  };

  const onSearch = (event: FormEvent) => {
    event.preventDefault();
    if (query.trim().length < 2) return;
    act({ type: 'open', path: searchPath(query) });
    setQuery('');
  };

  // One card element in every state, so the size observer keeps watching the same box.
  if (auth.status === 'loading') return <div ref={card} className="qk" aria-busy="true" />;
  if (!g.signedIn) {
    return (
      <div ref={card} className="qk">
        <Brand />
        <div className="qk-signin">
          <p className="qk-signin-title">Sign in to BearRok</p>
          <p className="qk-muted">Your deadlines, top pick and assistant show here once you are signed in.</p>
          <button type="button" className="qk-btn qk-btn-primary" onClick={() => act({ type: 'open', path: '/signin' })}>
            Open BearRok to sign in
          </button>
        </div>
      </div>
    );
  }

  const next = g.deadlines[0];
  const top = g.top;

  return (
    <div ref={card} className="qk">
      <Brand searching={g.searching} offline={live.status === 'offline'} />

      <div className="qk-actions">
        {g.searching ? (
          <button type="button" className="qk-btn qk-btn-busy" onClick={() => act({ type: 'stop' })} aria-label="Searching. Stop the search">
            <span className="qk-spinner" aria-hidden="true" />
            <span>Searching…</span>
            <span className="qk-stop">
              <Square className="size-3" aria-hidden="true" />
              Stop
            </span>
          </button>
        ) : (
          <button type="button" className="qk-btn qk-btn-primary" onClick={() => act({ type: 'run' })}>
            <Play className="size-3.5" aria-hidden="true" />
            Run search
          </button>
        )}
        <button type="button" className="qk-btn" onClick={() => act({ type: 'open', path: '/' })}>
          <LayoutGrid className="size-3.5" aria-hidden="true" />
          Open feed
        </button>
      </div>

      <section className="qk-section" aria-label="Next deadline">
        <h2 className="qk-label">
          <CalendarClock className="size-3.5" aria-hidden="true" />
          Next deadline
        </h2>
        {next ? (
          <button type="button" className="qk-item" onClick={() => act({ type: 'open', path: next.path })}>
            <span className="qk-item-title">{next.title}</span>
            <span className="qk-item-sub">
              {dueDay(next.at)} <span className="qk-when">{next.when}</span>
            </span>
          </button>
        ) : (
          <p className="qk-empty">Nothing due soon</p>
        )}
      </section>

      <section className="qk-section" aria-label="Top pick">
        <h2 className="qk-label">
          <Star className="size-3.5" aria-hidden="true" />
          Top pick
        </h2>
        {top ? (
          <button type="button" className="qk-item" onClick={() => act({ type: 'open', path: top.path })}>
            <span className="qk-item-title">{top.opportunity.title}</span>
            <span className="qk-item-sub">{top.opportunity.organizer}</span>
            {top.opportunity.fitExplanation && <span className="qk-item-why">{top.opportunity.fitExplanation}</span>}
          </button>
        ) : (
          <p className="qk-empty">Nothing in your feed yet</p>
        )}
      </section>

      <form className="qk-search" role="search" onSubmit={onSearch}>
        <SearchIcon className="size-4 shrink-0" aria-hidden="true" />
        <label className="sr-only" htmlFor="qk-search">
          Search
        </label>
        <input id="qk-search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search internships, events, anything" autoComplete="off" />
        <kbd>Return</kbd>
      </form>

      <section className="qk-chat" aria-label="Ask BearRok">
        <h2 className="qk-label">
          <Sparkles className="size-3.5" aria-hidden="true" />
          Ask BearRok
        </h2>
        {(thread.length > 0 || thinking) && (
          <div className="qk-thread" aria-live="polite">
            {thread.map((turn, index) =>
              turn.from === 'student' ? (
                <p key={index} className="qk-q">
                  {turn.text}
                </p>
              ) : (
                <div key={index} className="qk-a">
                  <p>{turn.reply.text}</p>
                  {turn.reply.points && turn.reply.points.length > 0 && (
                    <ul>
                      {turn.reply.points.map((point) => (
                        <li key={point}>
                          {thread.length - 1 === index && turn.reply.actions === undefined ? (
                            <button type="button" onClick={() => ask(point)}>
                              {point}
                            </button>
                          ) : (
                            point
                          )}
                        </li>
                      ))}
                    </ul>
                  )}
                  {turn.reply.actions?.some((a) => a.to) && (
                    <div className="qk-a-actions">
                      {turn.reply.actions
                        .filter((a) => a.to)
                        .map((a) => (
                          <button key={a.label} type="button" onClick={() => act({ type: 'open', path: a.to! })}>
                            {a.label}
                          </button>
                        ))}
                    </div>
                  )}
                </div>
              ),
            )}
            {thinking && (
              <div className="qk-a qk-thinking" aria-label="Thinking">
                <span />
                <span />
                <span />
              </div>
            )}
            <div ref={end} />
          </div>
        )}
        <form
          className="qk-ask"
          onSubmit={(event: FormEvent) => {
            event.preventDefault();
            ask(draft);
          }}
        >
          <label className="sr-only" htmlFor="qk-ask">
            Ask BearRok
          </label>
          <input id="qk-ask" value={draft} onChange={(event) => setDraft(event.target.value)} placeholder="Ask, or say what to do" autoComplete="off" />
          <button type="submit" disabled={!draft.trim() || thinking} aria-label="Send">
            <ArrowUp className="size-4" aria-hidden="true" />
          </button>
        </form>
      </section>
    </div>
  );
}

function Brand({ searching = false, offline = false }: { searching?: boolean; offline?: boolean }) {
  return (
    <header className="qk-head">
      <span className="qk-mark" aria-hidden="true">
        <Sparkles className="size-3.5" />
      </span>
      <span className="qk-name">BearRok</span>
      {searching && <span className="qk-status qk-status-live">Agents searching</span>}
      {!searching && offline && <span className="qk-status">Agents not reachable</span>}
    </header>
  );
}
