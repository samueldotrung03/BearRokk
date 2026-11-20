// Agent settings, from the top of the Agents page: start or stop a search, choose the kinds a
// search covers, how many of a kind it must find before it stops, and which Grok model each group
// of agents runs on. Everything here is saved with the student's account.
import { Play, Settings2, Square, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useLive } from '../../state/live.tsx';

type Group = { id: string; label: string; tier: string };
type Kind = 'internship' | 'event' | 'club' | 'hackathon' | 'research' | 'scholarship';

interface Auto {
  on: boolean;
  times: string[];
}

interface Settings {
  auto: Auto;
  models: Record<string, string>;
  /** Per kind, and "any": a total across every kind searched for, in any mix. */
  minimums: Partial<Record<Kind | 'any', number>>;
  kinds: Kind[];
}

/** Each kind of opportunity on its own; "plural" is how a number reads ("at least 3 scholarships"). */
const KINDS: { id: Kind; label: string; plural: string }[] = [
  { id: 'internship', label: 'Internships', plural: 'internships' },
  { id: 'event', label: 'Events and networking', plural: 'events' },
  { id: 'club', label: 'Clubs and communities', plural: 'clubs' },
  { id: 'hackathon', label: 'Hackathons', plural: 'hackathons' },
  { id: 'research', label: 'Research positions', plural: 'research positions' },
  { id: 'scholarship', label: 'Scholarships', plural: 'scholarships' },
];

/** Times spread over the day for a number of runs; the backend uses the same ones. */
export function defaultTimes(runs: number): string[] {
  const preset: Record<number, string[]> = {
    1: ['09:00'],
    2: ['09:00', '18:00'],
    3: ['09:00', '13:00', '18:00'],
    4: ['08:00', '12:00', '16:00', '20:00'],
    5: ['08:00', '11:00', '14:00', '17:00', '20:00'],
    6: ['08:00', '10:30', '13:00', '15:30', '18:00', '20:30'],
  };
  return preset[Math.max(1, Math.min(6, runs))]!;
}

/** "Today at 6:00 PM", "Tomorrow at 9:00 AM". */
export function whenLabel(iso: string, now = Date.now()): string {
  const at = new Date(iso);
  const day = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const diff = Math.round((day(at) - day(new Date(now))) / 86_400_000);
  const time = at.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  return `${diff === 0 ? 'Today' : diff === 1 ? 'Tomorrow' : at.toLocaleDateString('en-US', { weekday: 'long' })} at ${time}`;
}

export type AutoStatus = { on: boolean; nextAt: string | null; waiting: number; startsAt: string | null };

/** One line on where Automode stands. */
export function autoLine(status: AutoStatus | null | undefined, now = Date.now()): string | null {
  if (!status?.on) return null;
  if (status.waiting > 0) {
    const mins = status.startsAt ? Math.ceil((Date.parse(status.startsAt) - now) / 60_000) : 0;
    const what = status.waiting === 1 ? '1 search waiting' : `${status.waiting} searches waiting`;
    return mins > 0 ? `Automode: ${what}, the next starts in ${mins} ${mins === 1 ? 'minute' : 'minutes'}` : `Automode: ${what}, starting now`;
  }
  return status.nextAt ? `Automode: next search ${whenLabel(status.nextAt, now).replace(/^(Today|Tomorrow)/, (w) => w.toLowerCase())}` : 'Automode on';
}

/** The kinds a search covers: the ones ticked, or with none ticked, the profile's. */
export function searchedKinds(ticked: Kind[], profileKinds: Kind[]): Kind[] {
  return KINDS.map((k) => k.id).filter((id) => (ticked.length ? ticked : profileKinds).includes(id));
}

/** Ticking or unticking a kind; unticking one also clears its number, since it is no longer searched for. */
export function toggleKinds(s: Settings, id: Kind | 'all'): Settings {
  const all = KINDS.map((k) => k.id);
  const kinds = id === 'all' ? (s.kinds.length === all.length ? [] : all) : s.kinds.includes(id) ? s.kinds.filter((k) => k !== id) : [...s.kinds, id];
  const minimums = Object.fromEntries(Object.entries(s.minimums).filter(([k]) => k === 'any' || kinds.length === 0 || kinds.includes(k as Kind)));
  return { ...s, kinds, minimums };
}

export function AgentSettingsButton() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" className="ag-btn" onClick={() => setOpen(true)}>
        <Settings2 className="size-4" aria-hidden="true" />
        Agent settings
      </button>
      {open && <AgentSettingsDialog onClose={() => setOpen(false)} />}
    </>
  );
}

function AgentSettingsDialog({ onClose }: { onClose: () => void }) {
  const live = useLive();
  const ref = useRef<HTMLDialogElement>(null);
  const [groups, setGroups] = useState<Group[]>([]);
  const [models, setModels] = useState<string[]>([]);
  const [applied, setApplied] = useState(false);
  const [profileKinds, setProfileKinds] = useState<Kind[]>([]);
  const [settings, setSettings] = useState<Settings>({ auto: { on: false, times: defaultTimes(1) }, models: {}, minimums: {}, kinds: [] });
  const [autoStatus, setAutoStatus] = useState<AutoStatus | null>(null);
  // Saving is only offered once the saved settings have loaded, so defaults never overwrite them.
  const [loaded, setLoaded] = useState(false);
  const [state, setState] = useState<'loading' | 'ready' | 'saving' | 'saved' | 'error'>('loading');

  useEffect(() => {
    ref.current?.showModal();
    void live
      .request('/agent-settings')
      .then(async (res) => {
        if (!res.ok) throw new Error();
        const body = (await res.json()) as { settings: Partial<Settings>; groups: Group[]; models: string[]; applied: boolean; profileKinds?: Kind[]; auto?: AutoStatus };
        setAutoStatus(body.auto ?? null);
        setProfileKinds(body.profileKinds ?? []);
        setGroups(body.groups);
        setModels(body.models);
        setApplied(body.applied);
        setSettings({
          auto: { on: body.settings.auto?.on === true, times: body.settings.auto?.times?.length ? body.settings.auto.times : defaultTimes(1) },
          models: body.settings.models ?? {},
          minimums: body.settings.minimums ?? {},
          kinds: body.settings.kinds ?? [],
        });
        setLoaded(true);
        setState('ready');
      })
      .catch(() => setState('error'));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /** Saves; the window closes once the settings are kept, and stays open with a note if not. */
  const save = async () => {
    if (!loaded) return false;
    setState('saving');
    const body = { ...settings, auto: { ...settings.auto, timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone } };
    const res = await live.request('/agent-settings', { method: 'PUT', body: JSON.stringify(body) }).catch(() => null);
    setState(res?.ok ? 'saved' : 'error');
    if (res?.ok) ref.current?.close();
    return Boolean(res?.ok);
  };
  const toggleKind = (id: Kind | 'all') => setSettings((s) => toggleKinds(s, id));
  const searched = searchedKinds(settings.kinds, profileKinds);
  const allTicked = settings.kinds.length === KINDS.length;
  const nameList = (ids: Kind[]) => ids.map((id) => KINDS.find((k) => k.id === id)!.plural).join(', ');
  const setMinimum = (id: Kind | 'any', value: string) =>
    setSettings((s) => {
      const n = Math.max(0, Math.min(id === 'any' ? 100 : 50, Math.floor(Number(value) || 0)));
      const minimums = { ...s.minimums };
      if (n > 0) minimums[id] = n;
      else delete minimums[id];
      return { ...s, minimums };
    });

  return (
    <dialog
      ref={ref}
      className="ags-dialog"
      aria-labelledby="ags-title"
      onClose={onClose}
      onClick={(event) => {
        if (event.target === ref.current) ref.current.close();
      }}
    >
      <div className="ags-head">
        <h2 id="ags-title" className="font-display text-3xl leading-tight">
          Agent settings
        </h2>
        <button type="button" onClick={() => ref.current?.close()} aria-label="Close" className="grid size-9 place-items-center rounded-lg text-ink-3 hover:bg-slate-100">
          <X className="size-5" aria-hidden="true" />
        </button>
      </div>

      <div className="ags-body">
        <section className="ags-section">
          <h3>Run</h3>
          <p className="ags-note">Start a search now with the settings below, or stop the one that is running. What it already checked stays.</p>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            {live.searching ? (
              <button type="button" className="ags-primary" onClick={() => void live.stopRun()}>
                <Square className="size-4" fill="currentColor" aria-hidden="true" /> Stop the search
              </button>
            ) : (
              <button
                type="button"
                className="ags-primary"
                disabled={!loaded || state === 'saving' || state === 'loading'}
                onClick={async () => {
                  if (await save()) await live.runNow();
                }}
              >
                <Play className="size-4" aria-hidden="true" /> Save and run a search
              </button>
            )}
            {live.searching && <span className="text-sm text-ink-3">A search is running.</span>}
          </div>
        </section>

        <section className="ags-section">
          <div className="flex items-center justify-between gap-3">
            <h3 id="ags-auto">Automode</h3>
            <button
              type="button"
              role="switch"
              aria-checked={settings.auto.on}
              aria-labelledby="ags-auto"
              className="ags-switch"
              onClick={() => setSettings((s) => ({ ...s, auto: { ...s.auto, on: !s.auto.on } }))}
            >
              <span />
            </button>
          </div>
          <p className="ags-note">
            Your agents search on their own at these times every day while BearRok is open. A search whose time passes while your computer is off or BearRok is
            closed starts when you open it again. Searches waiting to run go one after another, 10 minutes apart.
          </p>
          {settings.auto.on && (
            <>
              <label className="ags-model mt-3">
                <span>Searches a day</span>
                <select
                  value={settings.auto.times.length}
                  onChange={(e) => setSettings((s) => ({ ...s, auto: { ...s.auto, times: defaultTimes(Number(e.target.value)) } }))}
                >
                  {[1, 2, 3, 4, 5, 6].map((n) => (
                    <option key={n} value={n}>
                      {n}
                    </option>
                  ))}
                </select>
              </label>
              <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3">
                {settings.auto.times.map((t, i) => (
                  <label key={i} className="ags-min">
                    <span className="text-ink-3">{i + 1}</span>
                    <input
                      type="time"
                      className="ags-time"
                      value={t}
                      aria-label={`Time of search ${i + 1}`}
                      onChange={(e) => setSettings((s) => ({ ...s, auto: { ...s.auto, times: s.auto.times.map((x, j) => (j === i ? e.target.value : x)) } }))}
                    />
                  </label>
                ))}
              </div>
              {autoLine(autoStatus) && <p className="mt-2 text-sm text-ink-2">{autoLine(autoStatus)}</p>}
            </>
          )}
        </section>

        {state === 'error' && <p className="mt-4 text-sm text-orange-700">The settings could not be loaded or saved. Check that the agents are reachable and try again.</p>}

        <section className="ags-section">
          <h3>Search for</h3>
          <p className="ags-note">
            {settings.kinds.length
              ? 'Searches cover only the kinds ticked here.'
              : profileKinds.length
                ? `Nothing ticked, so searches cover what your profile asks for: ${nameList(profileKinds)}.`
                : 'Nothing ticked, so searches cover what your profile asks for.'}
          </p>
          <label className="ags-check ags-check-all mt-3">
            <input
              type="checkbox"
              checked={allTicked}
              ref={(el) => {
                if (el) el.indeterminate = settings.kinds.length > 0 && !allTicked;
              }}
              onChange={() => toggleKind('all')}
            />
            All
          </label>
          <div className="mt-2 grid gap-2 sm:grid-cols-2">
            {KINDS.map((k) => (
              <label key={k.id} className="ags-check">
                <input type="checkbox" checked={settings.kinds.includes(k.id)} onChange={() => toggleKind(k.id)} />
                {k.label}
              </label>
            ))}
          </div>
        </section>

        <section className="ags-section">
          <h3>Find at least</h3>
          <p className="ags-note">
            Only for the kinds being searched for. The agents keep searching until your feed has this many, up to 12 searches in a row. Leave at 0 for a
            normal search.
          </p>
          {searched.length > 0 && (
            <label className="ags-min ags-min-total mt-3">
              <input type="number" min={0} max={100} inputMode="numeric" value={settings.minimums.any ?? 0} onChange={(e) => setMinimum('any', e.target.value)} aria-label="At least how many in total" />
              <span>
                in total, any mix of {searched.length === 1 ? nameList(searched) : 'the kinds above'}
                {searched.length > 1 && <span className="ags-min-sub">{nameList(searched)}</span>}
              </span>
            </label>
          )}
          {searched.length > 1 && <p className="mt-3 text-xs font-semibold uppercase tracking-[0.12em] text-ink-3">Or for each kind</p>}
          {searched.length ? (
            <div className="mt-2 grid gap-2 sm:grid-cols-2">
              {searched.map((id) => {
                const k = KINDS.find((x) => x.id === id)!;
                return (
                  <label key={id} className="ags-min">
                    <input type="number" min={0} max={50} inputMode="numeric" value={settings.minimums[id] ?? 0} onChange={(e) => setMinimum(id, e.target.value)} aria-label={`At least how many ${k.plural}`} />
                    {k.plural}
                  </label>
                );
              })}
            </div>
          ) : (
            <p className="mt-3 text-sm text-ink-3">Tick a kind above to set how many to find.</p>
          )}
        </section>

        <section className="ags-section">
          <h3>Models</h3>
          <p className="ags-note">
            {applied
              ? 'The Grok model each group of agents runs on.'
              : 'The Grok model each group of agents will run on. The agents run on Claude for testing right now, so these take effect once Grok is connected.'}
          </p>
          <div className="mt-3 grid gap-2">
            {groups.map((g) => (
              <label key={g.id} className="ags-model">
                <span>{g.label}</span>
                <select value={settings.models[g.id] ?? ''} onChange={(e) => setSettings((s) => ({ ...s, models: { ...s.models, [g.id]: e.target.value } }))}>
                  <option value="">Default ({g.tier})</option>
                  {models.map((m) => (
                    <option key={m} value={m}>
                      {m}
                    </option>
                  ))}
                </select>
              </label>
            ))}
          </div>
        </section>
      </div>

      <div className="ags-foot">
        <span className="text-sm text-ink-3" aria-live="polite">
          {state === 'saving' ? 'Saving…' : ''}
        </span>
        <button type="button" className="ags-secondary" onClick={() => ref.current?.close()}>
          Close
        </button>
        <button type="button" className="ags-primary" disabled={!loaded || state === 'loading' || state === 'saving'} onClick={() => void save()}>
          Save
        </button>
      </div>
    </dialog>
  );
}
