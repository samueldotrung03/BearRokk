// Agent settings, from the top of the Agents page: start or stop a search, choose the kinds a
// search covers, how many of a kind it must find before it stops, and which Grok model each group
// of agents runs on. Everything here is saved with the student's account.
import { Play, Settings2, Square, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useLive } from '../../state/live.tsx';

type Group = { id: string; label: string; tier: string };
type Category = 'internship' | 'event' | 'club' | 'program';
type Kind = 'internship' | 'event' | 'club' | 'hackathon' | 'research' | 'scholarship';

interface Settings {
  models: Record<string, string>;
  minimums: Partial<Record<Kind, number>>;
  kinds: Category[];
}

const KINDS: { id: Category; label: string }[] = [
  { id: 'internship', label: 'Internships' },
  { id: 'event', label: 'Events and networking' },
  { id: 'club', label: 'Clubs and communities' },
  { id: 'program', label: 'Programs: hackathons, research, scholarships' },
];

const MINIMUM_KINDS: { id: Kind; label: string }[] = [
  { id: 'internship', label: 'internships' },
  { id: 'event', label: 'events' },
  { id: 'club', label: 'clubs' },
  { id: 'hackathon', label: 'hackathons' },
  { id: 'research', label: 'research positions' },
  { id: 'scholarship', label: 'scholarships' },
];

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
  const [settings, setSettings] = useState<Settings>({ models: {}, minimums: {}, kinds: [] });
  const [state, setState] = useState<'loading' | 'ready' | 'saving' | 'saved' | 'error'>('loading');

  useEffect(() => {
    ref.current?.showModal();
    void live
      .request('/agent-settings')
      .then(async (res) => {
        if (!res.ok) throw new Error();
        const body = (await res.json()) as { settings: Partial<Settings>; groups: Group[]; models: string[]; applied: boolean };
        setGroups(body.groups);
        setModels(body.models);
        setApplied(body.applied);
        setSettings({ models: body.settings.models ?? {}, minimums: body.settings.minimums ?? {}, kinds: body.settings.kinds ?? [] });
        setState('ready');
      })
      .catch(() => setState('error'));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const save = async () => {
    setState('saving');
    const res = await live.request('/agent-settings', { method: 'PUT', body: JSON.stringify(settings) }).catch(() => null);
    setState(res?.ok ? 'saved' : 'error');
  };
  const toggleKind = (id: Category) =>
    setSettings((s) => ({ ...s, kinds: s.kinds.includes(id) ? s.kinds.filter((k) => k !== id) : [...s.kinds, id] }));
  const setMinimum = (id: Kind, value: string) =>
    setSettings((s) => {
      const n = Math.max(0, Math.min(50, Math.floor(Number(value) || 0)));
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
                disabled={state === 'saving' || state === 'loading'}
                onClick={async () => {
                  await save();
                  await live.runNow();
                }}
              >
                <Play className="size-4" aria-hidden="true" /> Save and run a search
              </button>
            )}
            {live.searching && <span className="text-sm text-ink-3">A search is running.</span>}
          </div>
        </section>

        {state === 'error' && <p className="mt-4 text-sm text-orange-700">The settings could not be loaded or saved. Check that the agents are reachable and try again.</p>}

        <section className="ags-section">
          <h3>Search for</h3>
          <p className="ags-note">Tick one or more. With none ticked, searches cover what your profile asks for.</p>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
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
            The agents keep searching until your feed has this many, up to 12 searches in a row. Leave at 0 for a normal search.
          </p>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            {MINIMUM_KINDS.map((k) => (
              <label key={k.id} className="ags-min">
                <input type="number" min={0} max={50} inputMode="numeric" value={settings.minimums[k.id] ?? 0} onChange={(e) => setMinimum(k.id, e.target.value)} aria-label={`At least how many ${k.label}`} />
                {k.label}
              </label>
            ))}
          </div>
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
          {state === 'saving' ? 'Saving…' : state === 'saved' ? 'Saved. Applies from the next search.' : ''}
        </span>
        <button type="button" className="ags-secondary" onClick={() => ref.current?.close()}>
          Close
        </button>
        <button type="button" className="ags-primary" disabled={state === 'loading' || state === 'saving'} onClick={() => void save()}>
          Save
        </button>
      </div>
    </dialog>
  );
}
