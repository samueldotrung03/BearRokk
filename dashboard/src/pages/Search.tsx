// Search: one box for an internship the student already has in mind, a kind of opportunity, or
// anything else. Their own postings (feed, saved, applications) that match show at once; then the
// agents' model searches the web and ranks everything by how well it answers the query and fits
// this student, with a short answer on top that cites the results and a line on each result on
// why it fits. Without a model connected, only their own postings are searched, and the page says so.
// Client: src/lib/search.ts. Backend: backend/src/search.ts.
import { ArrowRight, ArrowUpRight, Briefcase, Clock, Copy, ExternalLink, Globe, MapPin, Search as SearchIcon, Sparkles, UserRound, X as XSmall } from 'lucide-react';
import { useEffect, useMemo, useRef, useState, type FormEvent, type KeyboardEvent } from 'react';
import { Link } from 'react-router';
import { useAuth } from '../auth/AuthProvider.tsx';
import { Card, Page } from '../components/Page.tsx';
import { logoUrl, suggest, type Company, type Suggestion } from '../data/searchSuggestions.ts';
import {
  addRecent,
  answerParts,
  clearRecent,
  DEFAULT_FILTERS,
  KINDS,
  ORIGIN_LABEL,
  recentSearches,
  searchOwn,
  searchWeb,
  SearchError,
  shortDate,
  TIMES,
  type Origin,
  type SearchAnswer,
  type SearchFilters,
  type SearchResult,
} from '../lib/search.ts';
import '../styles/search.css';

type Phase = 'idle' | 'own' | 'web' | 'done';
interface Run {
  q: string;
  phase: Phase;
  own: SearchResult[];
  answer: SearchAnswer | null;
  /** Why the web search did not run or failed, in plain words. Empty when it ran. */
  note: string;
  /** True when the backend has no model connected, so only the student's own postings were searched. */
  offline: boolean;
  contextParts: string[];
}
const EMPTY: Run = { q: '', phase: 'idle', own: [], answer: null, note: '', offline: false, contextParts: [] };

// The last search stays while the app is open, so going to another page and back keeps it.
let kept: { run: Run; filters: SearchFilters } = { run: EMPTY, filters: DEFAULT_FILTERS };

/** Leaving the page stops a search in progress, so it comes back finished with what it had. */
export function restoredRun(run: Run): Run {
  if (run.phase !== 'own' && run.phase !== 'web') return run;
  return { ...run, phase: 'done', note: 'The web search stopped when you left this page. Search again to finish it.' };
}

const statusLabel: Record<string, string> = { interested: 'Interested', to_apply: 'To apply', applying: 'Applying', applied: 'Applied' };
const goTo: Record<Exclude<Origin, 'web'>, [string, string]> = { feed: ['/', 'See in feed'], saved: ['/saved', 'Go to Saved'], application: ['/applications', 'Go to Applications'] };

export function Search() {
  const auth = useAuth();
  const who = auth.status === 'signedIn' ? 'me' : 'demo';
  const [filters, setFilters] = useState<SearchFilters>(kept.filters);
  const [run, setRun] = useState<Run>(() => restoredRun(kept.run));
  const [text, setText] = useState(kept.run.q);
  const [recent, setRecent] = useState(recentSearches);
  const [tab, setTab] = useState<'all' | Origin>('all');
  const abort = useRef<AbortController | null>(null);
  const input = useRef<HTMLInputElement>(null);
  // The suggestion list under the box: open while the box has focus, with one row picked by the arrow keys.
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const suggestions = useMemo(() => suggest(text, recent), [text, recent]);

  useEffect(() => {
    kept = { run, filters };
  }, [run, filters]);
  useEffect(() => () => abort.current?.abort(), []);

  async function search(query: string, f: SearchFilters = filters) {
    const q = query.trim();
    if (q.length < 2) {
      input.current?.focus();
      return;
    }
    abort.current?.abort();
    const ctrl = new AbortController();
    abort.current = ctrl;
    setText(q);
    setTab('all');
    setRecent((list) => addRecent(list, q, f.kind));
    setRun({ ...EMPTY, q, phase: 'own' });
    const token = await auth.getToken().catch(() => null);
    let own: SearchResult[] = [];
    let contextParts: string[] = [];
    try {
      const local = await searchOwn(who, token, q, f, ctrl.signal);
      own = local.results;
      contextParts = local.contextParts;
      if (!local.ai) {
        setRun({ ...EMPTY, q, phase: 'done', own, contextParts, offline: true, note: 'Grok is not connected, so only your own postings were searched. Connect Grok in Settings to search the web.' });
        return;
      }
      setRun({ ...EMPTY, q, phase: 'web', own, contextParts });
      const answer = await searchWeb(who, token, q, f, ctrl.signal);
      setRun({ ...EMPTY, q, phase: 'done', own, contextParts, answer });
    } catch (error) {
      if (ctrl.signal.aborted) return;
      const message = error instanceof SearchError ? error.message : 'The search could not finish.';
      setRun({ ...EMPTY, q, phase: 'done', own, contextParts, offline: error instanceof SearchError && error.status === 503, note: message });
    }
  }

  const set = (patch: Partial<SearchFilters>, rerun = true) => {
    const next = { ...filters, ...patch };
    setFilters(next);
    if (rerun && run.q) void search(run.q, next);
  };
  const onSubmit = (event: FormEvent) => {
    event.preventDefault();
    setOpen(false);
    void search(text);
  };
  const pick = (s: Suggestion) => {
    setOpen(false);
    setActive(-1);
    const next = { ...filters, ...s.patch };
    setFilters(next);
    void search(s.query, next);
  };
  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Escape') {
      setOpen(false);
      return;
    }
    if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp' && event.key !== 'Enter') return;
    if (event.key === 'Enter') {
      const s = open ? suggestions[active] : undefined;
      if (s) {
        event.preventDefault();
        pick(s);
      }
      return;
    }
    event.preventDefault();
    setOpen(true);
    const n = suggestions.length;
    if (n) setActive((i) => (event.key === 'ArrowDown' ? (i + 1) % n : (i - 1 + n) % n));
  };
  const showList = open && suggestions.length > 0;

  const busy = run.phase === 'own' || run.phase === 'web';
  const list = run.answer ? run.answer.results : run.own;

  return (
    <Page title="Search" subtitle="Look up an internship you already have in mind, or anything else. Your agents search the web and rank what they find for you.">
      <Card className="srch-box">
        <form className="srch-form" role="search" onSubmit={onSubmit}>
          <div className="srch-combo">
            <label className="feed-search srch-input">
              <SearchIcon className="size-[18px] shrink-0 text-ink-3" aria-hidden="true" />
              <span className="sr-only">Search</span>
              <input
                ref={input}
                type="search"
                role="combobox"
                aria-expanded={showList}
                aria-controls="srch-suggest"
                aria-autocomplete="list"
                aria-activedescendant={showList && active >= 0 ? `srch-opt-${active}` : undefined}
                value={text}
                maxLength={400}
                autoComplete="off"
                onChange={(event) => {
                  setText(event.target.value);
                  setOpen(true);
                  setActive(-1);
                }}
                onFocus={() => setOpen(true)}
                onBlur={() => setOpen(false)}
                onKeyDown={onKeyDown}
                placeholder="A company, a role, a program, or a question"
              />
            </label>
            {showList && (
              <Suggestions
                list={suggestions}
                typed={text.trim()}
                active={active}
                onHover={setActive}
                onPick={pick}
                onClearRecent={() => setRecent(clearRecent())}
              />
            )}
          </div>
          <button type="submit" className="btn-primary srch-go" disabled={busy && run.q === text.trim()}>
            Search
          </button>
        </form>

        <div className="srch-kinds" role="radiogroup" aria-label="Looking for">
          {KINDS.map(([value, label]) => (
            <button key={value} type="button" role="radio" aria-checked={filters.kind === value} className="srch-kind" onClick={() => set({ kind: value })}>
              {label}
            </button>
          ))}
        </div>

        <div className="srch-row">
          <label className="srch-field">
            <Clock aria-hidden="true" />
            <span className="sr-only">Time</span>
            <select value={filters.time} onChange={(event) => set({ time: event.target.value as SearchFilters['time'] })}>
              {TIMES.map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <label className="srch-field">
            <MapPin aria-hidden="true" />
            <span className="sr-only">Place</span>
            <input
              type="text"
              maxLength={80}
              placeholder="Anywhere"
              defaultValue={filters.place}
              onBlur={(event) => event.target.value.trim() !== filters.place && set({ place: event.target.value.trim() })}
              onKeyDown={(event) => event.key === 'Enter' && (event.preventDefault(), event.currentTarget.blur())}
            />
          </label>
          <span className="srch-gap" />
          <Toggle on={filters.web} label="Search the web" icon={<Globe aria-hidden="true" />} onClick={() => set({ web: !filters.web })} />
          <Toggle on={filters.personal} label="Use my profile" icon={<UserRound aria-hidden="true" />} onClick={() => set({ personal: !filters.personal })} />
        </div>

        <p className="srch-context">
          {!filters.personal
            ? 'Your profile is off: results are ranked for the words you typed alone.'
            : run.answer
              ? run.answer.contextUsed.length
                ? <>Ranked using <b>{run.answer.contextUsed.join(' · ')}</b></>
                : 'Nothing on your profile applied to this search, so it is ranked for the query alone.'
              : run.contextParts.length
                ? <>Can draw on <b>{run.contextParts.join(' · ')}</b> when it helps</>
                : 'Results are ranked for you using your profile, notes and résumé.'}
        </p>
      </Card>

      {run.phase === 'idle' ? (
        <Start />
      ) : (
        <div className="srch-results">
          {busy && (
            <p className="srch-status" aria-live="polite">
              <span className="srch-dots" aria-hidden="true">
                <i />
                <i />
                <i />
              </span>
              {run.phase === 'own'
                ? 'Looking through your postings…'
                : `${run.own.length ? `${run.own.length} match${run.own.length === 1 ? '' : 'es'} in your postings. ` : ''}${filters.web ? 'Searching the web and ranking for you' : 'Ranking for you'}, usually one to three minutes.`}
            </p>
          )}
          {run.note && (
            <p className={`srch-note${run.offline ? '' : ' is-error'}`} role={run.offline ? 'status' : 'alert'}>
              {run.note}
            </p>
          )}

          {run.answer && (run.answer.answer || run.answer.intent) && (
            <Card className="srch-answer">
              <div className="srch-answer-head">
                <Sparkles aria-hidden="true" />
                <span>Overview</span>
                <span className="srch-writer">{run.answer.writer === 'claude' ? 'Searched by Claude, standing in for Grok during testing' : 'Searched by Grok'}</span>
              </div>
              {run.answer.intent && <p className="srch-intent">{run.answer.intent}</p>}
              <Answer text={run.answer.answer} count={run.answer.results.length} />
            </Card>
          )}

          {list.length > 0 && <ResultList list={list} ranked={Boolean(run.answer)} tab={tab} setTab={setTab} />}
          {list.length === 0 && run.phase === 'done' && !(run.note && !run.offline) && (
            <div className="srch-none">
              <h2 className="font-display text-3xl leading-tight">Nothing matched</h2>
              <p>Try other words, a wider time range, or another kind of opportunity.</p>
            </div>
          )}

          {run.answer && run.answer.related.length > 0 && (
            <section className="srch-related">
              <h2 className="srch-h2">Search next</h2>
              <div className="srch-chips">
                {run.answer.related.map((q) => (
                  <button key={q} type="button" className="srch-chip" onClick={() => void search(q)}>
                    {q} <ArrowRight aria-hidden="true" />
                  </button>
                ))}
              </div>
            </section>
          )}
          {!busy && (
            <button
              type="button"
              className="srch-reset"
              onClick={() => {
                abort.current?.abort();
                setRun(EMPTY);
                setText('');
                input.current?.focus();
              }}
            >
              <XSmall aria-hidden="true" /> New search
            </button>
          )}
        </div>
      )}
    </Page>
  );
}

function Toggle({ on, label, icon, onClick }: { on: boolean; label: string; icon: React.ReactNode; onClick: () => void }) {
  return (
    <button type="button" role="switch" aria-checked={on} className="srch-toggle" onClick={onClick}>
      {icon}
      {label}
      <span className="srch-switch" aria-hidden="true">
        <i />
      </span>
    </button>
  );
}

/** A company's logo, or its first letter in its brand colour when the logo cannot load (offline, say). */
function CompanyLogo({ company }: { company: Company }) {
  const [failed, setFailed] = useState(false);
  return failed ? (
    <span className="srch-logo is-letter" style={{ background: company.color }} aria-hidden="true">
      {company.name.charAt(0)}
    </span>
  ) : (
    <img
      className="srch-logo"
      src={logoUrl(company.domain)}
      alt=""
      loading="lazy"
      referrerPolicy="no-referrer"
      onError={() => setFailed(true)}
      // The service answers a tiny icon (or a generic globe) when it has no real logo; a letter reads better.
      onLoad={(event) => event.currentTarget.naturalWidth < 32 && setFailed(true)}
    />
  );
}

const TAG: Record<Suggestion['type'], string> = { recent: 'Recent', company: 'Company', keyword: 'Search', role: 'Role', search: 'Suggested' };

/** The part of a suggestion that matches what was typed, in bold. */
function Marked({ label, typed }: { label: string; typed: string }) {
  const at = typed ? label.toLowerCase().indexOf(typed.toLowerCase()) : -1;
  if (at < 0) return <>{label}</>;
  return (
    <>
      {label.slice(0, at)}
      <b>{label.slice(at, at + typed.length)}</b>
      {label.slice(at + typed.length)}
    </>
  );
}

/** The list under the search box: recent and suggested searches when it is empty, matches while typing. */
function Suggestions({
  list,
  typed,
  active,
  onHover,
  onPick,
  onClearRecent,
}: {
  list: Suggestion[];
  typed: string;
  active: number;
  onHover: (i: number) => void;
  onPick: (s: Suggestion) => void;
  onClearRecent: () => void;
}) {
  const hasRecent = list.some((s) => s.type === 'recent');
  return (
    // Pressing on the list must not blur the box first, or the list closes before the click lands.
    <div className="srch-suggest" onMouseDown={(event) => event.preventDefault()}>
      {!typed && hasRecent && (
        <div className="srch-suggest-head">
          <span>Recent</span>
          <button type="button" onClick={onClearRecent}>
            Clear
          </button>
        </div>
      )}
      <ul id="srch-suggest" role="listbox" aria-label="Suggestions">
        {list.map((s, i) => (
          <li key={`${s.type}:${s.query}`} role="presentation">
            {!typed && s.type === 'search' && list[i - 1]?.type !== 'search' && (
              <div className="srch-suggest-head" role="presentation">
                <span>Suggested searches</span>
              </div>
            )}
            <div
              id={`srch-opt-${i}`}
              role="option"
              aria-selected={i === active}
              className={`srch-opt is-${s.type}`}
              onMouseEnter={() => onHover(i)}
              onClick={() => onPick(s)}
            >
              <span className="srch-opt-icon">
                {s.type === 'company' ? (
                  <CompanyLogo company={s.company} />
                ) : s.type === 'recent' ? (
                  <Clock aria-hidden="true" />
                ) : s.type === 'role' ? (
                  <Briefcase aria-hidden="true" />
                ) : s.type === 'keyword' ? (
                  <SearchIcon aria-hidden="true" />
                ) : (
                  <Sparkles aria-hidden="true" />
                )}
              </span>
              <span className="srch-opt-text">
                <span className="srch-opt-label">
                  <Marked label={s.label} typed={typed} />
                </span>
                {s.type === 'company' && <small>Internships for college students</small>}
                {s.type === 'search' && <small>{s.note}</small>}
              </span>
              {typed && <em className="srch-opt-tag">{TAG[s.type]}</em>}
              <ArrowUpRight className="srch-opt-go" aria-hidden="true" />
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

function Start() {
  return (
    <div className="srch-start">
      <Card className="srch-panel srch-how">
        <h2 className="srch-h2">How Search works</h2>
        <p>
          Type a company, a role or anything you are looking for, and pick a suggestion or press Search. It looks through your feed, saved list and applications at once, then searches
          the web and ranks everything by how well it fits you: your notes first, your restrictions as rules, then your profile and résumé. Each result says why it was picked.
        </p>
        <p className="srch-fine">Your details stay with your agents and are never put into web searches. Dates no source states are left blank, never guessed.</p>
      </Card>
    </div>
  );
}

function Answer({ text, count }: { text: string; count: number }) {
  const jump = (n: number) => {
    const el = document.querySelector<HTMLElement>(`[data-rank="${n}"]`);
    if (!el) return;
    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    el.classList.remove('is-flash');
    void el.offsetWidth;
    el.classList.add('is-flash');
  };
  return (
    <div className="srch-md">
      {answerParts(text, count).map((para, i) => (
        <p key={i}>
          {para.map((part, j) =>
            part.kind === 'cite' ? (
              <button key={j} type="button" className="srch-cite" aria-label={`Go to result ${part.n}`} onClick={() => jump(part.n)}>
                {part.n}
              </button>
            ) : part.bold ? (
              <b key={j}>{part.text}</b>
            ) : (
              <span key={j}>{part.text}</span>
            ),
          )}
        </p>
      ))}
    </div>
  );
}

function ResultList({ list, ranked, tab, setTab }: { list: SearchResult[]; ranked: boolean; tab: 'all' | Origin; setTab: (t: 'all' | Origin) => void }) {
  const counts: Partial<Record<Origin, number>> = {};
  for (const r of list) counts[r.origin] = (counts[r.origin] ?? 0) + 1;
  const tabs = (['all', 'web', 'application', 'saved', 'feed'] as const).filter((t) => t === 'all' || counts[t]);
  const current = tabs.includes(tab as never) ? tab : 'all';
  const shown = list.map((r, i) => ({ r, n: i + 1 })).filter(({ r }) => current === 'all' || r.origin === current);
  return (
    <>
      {tabs.length > 2 && (
        <div className="srch-tabs" role="tablist" aria-label="Where results come from">
          {tabs.map((t) => (
            <button key={t} type="button" role="tab" aria-selected={current === t} className="srch-tab" onClick={() => setTab(t)}>
              {t === 'all' ? 'All' : ORIGIN_LABEL[t]}
              <span>{t === 'all' ? list.length : counts[t]}</span>
            </button>
          ))}
        </div>
      )}
      {!ranked && <h2 className="srch-h2 srch-sub">From your postings, while the web search runs</h2>}
      <ol className="srch-list">
        {shown.map(({ r, n }) => (
          <ResultItem key={r.id} r={r} n={n} ranked={ranked} />
        ))}
      </ol>
    </>
  );
}

function ResultItem({ r, n, ranked }: { r: SearchResult; n: number; ranked: boolean }) {
  const [copied, setCopied] = useState(false);
  const deadline = shortDate(r.deadline);
  const copy = () =>
    navigator.clipboard.writeText(r.url).then(
      () => {
        setCopied(true);
        setTimeout(() => setCopied(false), 1600);
      },
      () => undefined,
    );
  return (
    <li className={`srch-item is-${r.origin}`} data-rank={n}>
      <div className="srch-side">
        <span className="srch-n">{n}</span>
        {ranked && r.score > 0 && (
          <span className="srch-score" title={`Relevance ${r.score} of 100`} style={{ ['--s' as string]: Math.max(4, Math.min(100, r.score)) }}>
            <i />
          </span>
        )}
      </div>
      <div className="srch-main">
        <div className="srch-meta">
          <span className={`srch-origin is-${r.origin}`}>{r.origin === 'web' ? <Globe aria-hidden="true" /> : null}{ORIGIN_LABEL[r.origin]}</span>
          <span className="srch-source">{r.source}</span>
          {r.status && <span className="srch-status-tag">{statusLabel[r.status] ?? r.status}</span>}
        </div>
        {r.url ? (
          <a className="srch-title" href={r.url} target="_blank" rel="noreferrer">
            {r.title}
          </a>
        ) : (
          <span className="srch-title">{r.title}</span>
        )}
        {(r.organizer || deadline || r.location) && (
          <p className="srch-facts">
            {r.organizer && <span>{r.organizer}</span>}
            {r.location && <span>{r.location}</span>}
            {deadline ? <span>Deadline {deadline}</span> : (r.type === 'internship' || r.type === 'scholarship') && <span className="is-unknown">Deadline unknown</span>}
          </p>
        )}
        {r.snippet && <p className="srch-snippet">{r.snippet}</p>}
        {r.why && (
          <p className="srch-why">
            <Sparkles aria-hidden="true" />
            <span>{r.why}</span>
          </p>
        )}
        <div className="srch-actions">
          {r.url && (
            <a className="srch-act" href={r.url} target="_blank" rel="noreferrer">
              <ExternalLink aria-hidden="true" /> Open
            </a>
          )}
          {r.origin !== 'web' && (
            <Link className="srch-act" to={goTo[r.origin][0]}>
              <ArrowRight aria-hidden="true" /> {goTo[r.origin][1]}
            </Link>
          )}
          {r.url && (
            <button type="button" className="srch-act" onClick={() => void copy()}>
              <Copy aria-hidden="true" /> {copied ? 'Link copied' : 'Copy link'}
            </button>
          )}
        </div>
      </div>
    </li>
  );
}
