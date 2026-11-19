// The Experience tab of the profile: a résumé, links, and things the student has done.
// Every field is optional.
import { ArrowSquareOut, CaretDown, FileArrowUp, FilePdf, FileText, LinkedinLogo, PencilSimple, Plus, Trash, X } from '@phosphor-icons/react';
import { useEffect, useId, useRef, useState } from 'react';
import { useAuth } from '../auth/AuthProvider.tsx';
import { API_URL } from '../auth/firebase.ts';
import { experienceKinds, type Experience as ExperienceData, type ExperienceEntry, type Preferences } from '../data/preferences.ts';

const inputClass = 'block w-full rounded-xl border border-line bg-white px-3.5 text-[15px] text-ink outline-none transition placeholder:text-ink-3 focus:border-brand focus:ring-3 focus:ring-brand/15';
const labelClass = 'block text-sm font-semibold text-ink';
const quietButton = 'flex h-10 shrink-0 items-center gap-1.5 rounded-xl border border-line bg-white px-3.5 text-sm font-semibold text-ink transition hover:bg-slate-50 disabled:opacity-50';

const MAX_BYTES = 5 * 1024 * 1024;
const newId = () => (crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`);
const blankEntry = (): ExperienceEntry => ({ id: newId(), kind: '', role: '', organization: '', location: '', start: '', end: '', current: false, summary: '', skills: [], link: '' });
const isBlank = (e: ExperienceEntry) => !(e.kind || e.role || e.organization || e.location || e.start || e.end || e.summary.trim() || e.skills.length || e.link);

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const monthText = (value: string) => {
  const [y, m] = value.split('-');
  return y && m ? `${MONTHS[Number(m) - 1] ?? ''} ${y}`.trim() : '';
};
/** "Jun 2026 to Aug 2026", "Since Jun 2026", or nothing when no dates were given. */
export function dateRange(e: Pick<ExperienceEntry, 'start' | 'end' | 'current'>): string {
  const start = monthText(e.start);
  const end = e.current ? 'now' : monthText(e.end);
  if (start && end) return `${start} to ${end}`;
  if (start) return e.current ? `Since ${start}` : start;
  return e.current ? 'Ongoing' : end ? `Until ${end}` : '';
}
const fileSize = (bytes: number) => (bytes < 1024 * 1024 ? `${Math.max(1, Math.round(bytes / 1024))} KB` : `${(bytes / 1024 / 1024).toFixed(1)} MB`);
const withScheme = (url: string) => (/^https?:\/\//i.test(url) ? url : `https://${url}`);

interface ResumeInfo {
  name: string;
  type: string;
  size: number;
  uploadedAt: string;
  readable: boolean;
}

/** Several short answers, one per row, with a + to add another. */
function StringList({ label, values, onChange, placeholder, addLabel, max = 12 }: { label: string; values: string[]; onChange: (next: string[]) => void; placeholder?: string; addLabel: string; max?: number }) {
  const id = useId();
  const [rows, setRows] = useState<string[]>(() => (values.length ? values : ['']));
  const inputs = useRef<(HTMLInputElement | null)[]>([]);
  const focusNext = useRef<number | null>(null);
  useEffect(() => {
    if (focusNext.current === null) return;
    inputs.current[focusNext.current]?.focus();
    focusNext.current = null;
  }, [rows.length]);

  const commit = (next: string[], focus?: number) => {
    if (focus !== undefined) focusNext.current = focus;
    setRows(next.length ? next : ['']);
    onChange(next.map((v) => v.trim()).filter(Boolean));
  };
  const canAdd = rows.length < max && (rows[rows.length - 1] ?? '').trim() !== '';
  return (
    <div>
      <label htmlFor={id} className={labelClass}>
        {label}
      </label>
      <div className="mt-1.5 space-y-2">
        {rows.map((value, i) => (
          <div key={i} className="flex items-center gap-1">
            <input
              id={i === 0 ? id : undefined}
              ref={(el) => void (inputs.current[i] = el)}
              aria-label={i === 0 ? undefined : `${label} ${i + 1}`}
              value={value}
              maxLength={200}
              placeholder={placeholder}
              onChange={(e) => commit(rows.map((r, j) => (j === i ? e.target.value : r)))}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  if (i === rows.length - 1 && canAdd) commit([...rows, ''], rows.length);
                } else if (e.key === 'Backspace' && value === '' && i > 0) {
                  e.preventDefault();
                  commit(rows.filter((_, j) => j !== i), i - 1);
                }
              }}
              className={`${inputClass} h-11`}
            />
            {i > 0 && (
              <button type="button" aria-label={`Remove ${value.trim() || 'entry'}`} onClick={() => commit(rows.filter((_, j) => j !== i), i - 1)} className="grid size-10 shrink-0 place-items-center rounded-lg text-ink-3 hover:bg-slate-100 hover:text-ink">
                <X className="size-4" weight="bold" aria-hidden="true" />
              </button>
            )}
          </div>
        ))}
      </div>
      {rows.length < max && (
        <button type="button" disabled={!canAdd} onClick={() => commit([...rows, ''], rows.length)} className={`${quietButton} mt-2`}>
          <Plus className="size-4" weight="bold" aria-hidden="true" />
          {addLabel}
        </button>
      )}
    </div>
  );
}

function Resume() {
  const auth = useAuth();
  const [info, setInfo] = useState<ResumeInfo | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [over, setOver] = useState(false);
  const picker = useRef<HTMLInputElement>(null);
  const signedIn = auth.status === 'signedIn';

  // What the backend already holds for this student.
  useEffect(() => {
    if (!signedIn) return;
    let cancelled = false;
    void (async () => {
      try {
        const token = await auth.getToken();
        const res = await fetch(`${API_URL}/api/students/me/state`, { headers: { Authorization: `Bearer ${token}` } });
        if (res.ok && !cancelled) setInfo(((await res.json()) as { student: { resume: ResumeInfo | null } }).student.resume);
      } catch {
        // Backend not reachable: nothing to show yet.
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signedIn]);

  const upload = async (file: File | undefined) => {
    if (!file) return;
    setError(null);
    const type = file.type || (file.name.toLowerCase().endsWith('.pdf') ? 'application/pdf' : file.name.toLowerCase().endsWith('.txt') ? 'text/plain' : '');
    if (type !== 'application/pdf' && type !== 'text/plain') return setError('Choose a PDF or a plain text file.');
    if (file.size > MAX_BYTES) return setError('That file is larger than 5 MB.');
    if (file.size === 0) return setError('That file is empty.');
    setBusy(true);
    try {
      const token = await auth.getToken();
      const res = await fetch(`${API_URL}/api/students/me/resume`, {
        method: 'PUT',
        headers: { 'content-type': type, 'x-file-name': encodeURIComponent(file.name), Authorization: `Bearer ${token}` },
        body: file,
      });
      const body = (await res.json()) as { resume?: ResumeInfo; error?: string };
      if (res.ok && body.resume) setInfo(body.resume);
      else setError(res.status === 413 ? 'That file is larger than 5 MB.' : res.status === 415 ? 'Choose a PDF or a plain text file.' : 'The upload did not go through. Try again.');
    } catch {
      setError('The agent backend is not reachable, so the file was not uploaded.');
    } finally {
      setBusy(false);
      if (picker.current) picker.current.value = '';
    }
  };

  const remove = async () => {
    setError(null);
    try {
      const token = await auth.getToken();
      const res = await fetch(`${API_URL}/api/students/me/resume`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } });
      if (res.ok) setInfo(null);
      else setError('The résumé could not be removed. Try again.');
    } catch {
      setError('The agent backend is not reachable right now.');
    }
  };

  const download = async () => {
    try {
      const token = await auth.getToken();
      const res = await fetch(`${API_URL}/api/students/me/resume`, { headers: { Authorization: `Bearer ${token}` } });
      if (!res.ok) throw new Error();
      const url = URL.createObjectURL(await res.blob());
      Object.assign(document.createElement('a'), { href: url, download: info?.name ?? 'resume' }).click();
      URL.revokeObjectURL(url);
    } catch {
      setError('The file could not be downloaded right now.');
    }
  };

  return (
    <section className="pb-7">
      <h3 className="text-[17px] font-semibold tracking-tight">Résumé</h3>
      <p className="mt-1 max-w-2xl text-sm leading-relaxed text-ink-2">Your agents read it to judge fit and to see which skills a posting asks for that you already have. Optional.</p>
      <input ref={picker} type="file" accept=".pdf,.txt,application/pdf,text/plain" className="sr-only" tabIndex={-1} aria-hidden="true" onChange={(e) => void upload(e.target.files?.[0])} />

      {!signedIn ? (
        <p className="mt-4 rounded-2xl border border-dashed border-slate-300 px-5 py-6 text-sm text-ink-2">Sign in to upload a résumé. It is kept with your account and only your agents read it.</p>
      ) : info ? (
        <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-3 rounded-2xl border border-line bg-white/70 p-4">
          <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-brand-soft text-brand" aria-hidden="true">
            {info.type === 'application/pdf' ? <FilePdf className="size-[22px]" /> : <FileText className="size-[22px]" />}
          </span>
          <div className="min-w-0 flex-1 basis-52">
            <p className="truncate font-semibold text-ink">{info.name}</p>
            <p className="text-sm text-ink-2">
              {fileSize(info.size)}, added {new Date(info.uploadedAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
            </p>
            <p className={`mt-0.5 text-sm ${info.readable ? 'text-emerald-700' : 'text-amber-700'}`}>
              {info.readable ? 'Your agents can read it.' : 'No text could be read from this file. If it is a scan, upload a PDF with selectable text.'}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => void download()} className={quietButton}>
              Download
            </button>
            <button type="button" disabled={busy} onClick={() => picker.current?.click()} className={quietButton}>
              {busy ? 'Uploading…' : 'Replace'}
            </button>
            <button type="button" onClick={() => void remove()} className={quietButton}>
              <Trash className="size-4" aria-hidden="true" />
              Remove
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          disabled={busy}
          onClick={() => picker.current?.click()}
          onDragOver={(e) => {
            e.preventDefault();
            setOver(true);
          }}
          onDragLeave={() => setOver(false)}
          onDrop={(e) => {
            e.preventDefault();
            setOver(false);
            void upload(e.dataTransfer.files[0]);
          }}
          className={`mt-4 flex w-full flex-col items-center rounded-2xl border border-dashed px-5 py-8 text-center transition ${over ? 'border-brand bg-brand-soft' : 'border-slate-300 hover:border-brand hover:bg-brand-soft/60'}`}
        >
          <FileArrowUp className="size-8 text-brand" aria-hidden="true" />
          <span className="mt-2 text-[15px] font-semibold text-ink">{busy ? 'Uploading…' : 'Upload your résumé'}</span>
          <span className="mt-0.5 text-sm text-ink-2">Click to choose a file, or drop it here. PDF or plain text, up to 5 MB.</span>
        </button>
      )}
      <div className="mt-3" aria-live="polite">
        {error && <p className="rounded-xl bg-red-50 px-3.5 py-2.5 text-sm font-medium text-red-700">{error}</p>}
      </div>
    </section>
  );
}

function EntryEditor({ entry, onChange, onDone, onDelete }: { entry: ExperienceEntry; onChange: (next: ExperienceEntry) => void; onDone: () => void; onDelete: () => void }) {
  const id = useId();
  const set = (patch: Partial<ExperienceEntry>) => onChange({ ...entry, ...patch });
  return (
    <div className="rounded-2xl border border-brand/40 bg-white p-5 shadow-card">
      <div className="grid gap-4 md:grid-cols-2">
        <div>
          <label htmlFor={`${id}-kind`} className={labelClass}>
            Type
          </label>
          <div className="relative mt-1.5">
            <select id={`${id}-kind`} value={entry.kind} onChange={(e) => set({ kind: e.target.value })} className={`${inputClass} h-11 appearance-none pr-10 ${entry.kind ? '' : 'text-ink-3'}`}>
              <option value="">Not set</option>
              {experienceKinds.map((k) => (
                <option key={k}>{k}</option>
              ))}
            </select>
            <CaretDown className="pointer-events-none absolute top-1/2 right-3.5 size-4 -translate-y-1/2 text-ink-3" weight="bold" aria-hidden="true" />
          </div>
        </div>
        <div>
          <label htmlFor={`${id}-role`} className={labelClass}>
            Role or title
          </label>
          <input id={`${id}-role`} autoFocus value={entry.role} maxLength={100} onChange={(e) => set({ role: e.target.value })} placeholder="Research assistant" className={`${inputClass} mt-1.5 h-11`} />
        </div>
        <div>
          <label htmlFor={`${id}-org`} className={labelClass}>
            Organization
          </label>
          <input id={`${id}-org`} value={entry.organization} maxLength={100} onChange={(e) => set({ organization: e.target.value })} placeholder="Company, lab, club or class" className={`${inputClass} mt-1.5 h-11`} />
        </div>
        <div>
          <label htmlFor={`${id}-loc`} className={labelClass}>
            Location
          </label>
          <input id={`${id}-loc`} value={entry.location} maxLength={100} onChange={(e) => set({ location: e.target.value })} placeholder="City, or Remote" className={`${inputClass} mt-1.5 h-11`} />
        </div>
        <div>
          <label htmlFor={`${id}-start`} className={labelClass}>
            Started
          </label>
          <input id={`${id}-start`} type="month" value={entry.start} onChange={(e) => set({ start: e.target.value })} className={`${inputClass} mt-1.5 h-11`} />
        </div>
        <div>
          <label htmlFor={`${id}-end`} className={labelClass}>
            Ended
          </label>
          <input id={`${id}-end`} type="month" value={entry.current ? '' : entry.end} disabled={entry.current} min={entry.start || undefined} onChange={(e) => set({ end: e.target.value })} className={`${inputClass} mt-1.5 h-11 disabled:bg-slate-50 disabled:text-ink-3`} />
          <label htmlFor={`${id}-current`} className="mt-1 flex min-h-10 cursor-pointer items-center gap-2.5 text-sm text-ink-2">
            <input id={`${id}-current`} type="checkbox" checked={entry.current} onChange={(e) => set({ current: e.target.checked, end: e.target.checked ? '' : entry.end })} className="size-[18px] accent-[var(--color-brand)]" />
            I am still doing this
          </label>
        </div>
      </div>
      <div className="mt-4">
        <label htmlFor={`${id}-summary`} className={labelClass}>
          What I did
        </label>
        <textarea id={`${id}-summary`} rows={4} value={entry.summary} maxLength={1500} onChange={(e) => set({ summary: e.target.value })} placeholder="What you worked on, what you were responsible for, and anything it led to." className={`${inputClass} mt-1.5 resize-y py-2.5 leading-relaxed`} />
      </div>
      <div className="mt-4 grid gap-4 md:grid-cols-2">
        <StringList label="Skills I used" values={entry.skills} onChange={(skills) => set({ skills })} placeholder="A skill or tool" addLabel="Add another skill" />
        <div>
          <label htmlFor={`${id}-link`} className={labelClass}>
            Link
          </label>
          <input id={`${id}-link`} type="url" inputMode="url" value={entry.link} maxLength={200} onChange={(e) => set({ link: e.target.value })} placeholder="A project page, repository or write-up" className={`${inputClass} mt-1.5 h-11`} />
        </div>
      </div>
      <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-line pt-4">
        <p className="text-[13px] text-ink-3">Every field is optional. Fill in only what applies.</p>
        <div className="flex gap-2">
          <button type="button" onClick={onDelete} className={quietButton}>
            <Trash className="size-4" aria-hidden="true" />
            Delete
          </button>
          <button type="button" onClick={onDone} className="btn-primary h-10 px-5 text-sm text-white">
            Done
          </button>
        </div>
      </div>
    </div>
  );
}

function EntryCard({ entry, onEdit }: { entry: ExperienceEntry; onEdit: () => void }) {
  const title = entry.role || entry.organization || entry.kind || 'Untitled experience';
  const sub = [entry.role ? entry.organization : '', entry.location].filter(Boolean).join(' · ');
  const dates = dateRange(entry);
  return (
    <div className="flex items-start gap-4 rounded-2xl border border-line bg-white/70 p-4">
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
          <h4 className="font-semibold tracking-tight text-ink">{title}</h4>
          {entry.kind && entry.kind !== title && <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-ink-2">{entry.kind}</span>}
        </div>
        {(sub || dates) && <p className="mt-0.5 text-sm text-ink-2">{[sub, dates].filter(Boolean).join(' · ')}</p>}
        {entry.summary.trim() && <p className="mt-2 line-clamp-3 text-sm leading-relaxed whitespace-pre-line text-ink-2">{entry.summary.trim()}</p>}
        {entry.skills.length > 0 && (
          <ul className="mt-2.5 flex flex-wrap gap-1.5" aria-label="Skills used">
            {entry.skills.map((s) => (
              <li key={s} className="rounded-md bg-brand-soft px-2 py-0.5 text-[13px] font-medium text-ink-2">
                {s}
              </li>
            ))}
          </ul>
        )}
        {entry.link && (
          <a href={withScheme(entry.link)} target="_blank" rel="noreferrer" className="mt-2 inline-flex min-h-8 items-center gap-1 text-sm font-semibold break-all text-brand">
            {entry.link.replace(/^https?:\/\//i, '')}
            <ArrowSquareOut className="size-3.5 shrink-0" aria-hidden="true" />
          </a>
        )}
      </div>
      <button type="button" onClick={onEdit} aria-label={`Edit ${title}`} className={quietButton}>
        <PencilSimple className="size-4" aria-hidden="true" />
        Edit
      </button>
    </div>
  );
}

export function Experience({ prefs, change }: { prefs: Preferences; change: (next: Preferences) => void }) {
  const exp = prefs.experience;
  const [editing, setEditing] = useState<string | null>(null);
  const linkedinId = useId();
  const setExp = (patch: Partial<ExperienceData>) => change({ ...prefs, experience: { ...exp, ...patch } });

  const add = () => {
    const entry = blankEntry();
    // Newest first, the way a résumé reads.
    setExp({ entries: [entry, ...exp.entries] });
    setEditing(entry.id);
  };
  const update = (next: ExperienceEntry) => setExp({ entries: exp.entries.map((e) => (e.id === next.id ? next : e)) });
  const remove = (id: string) => {
    setExp({ entries: exp.entries.filter((e) => e.id !== id) });
    setEditing(null);
  };
  /** Closing the editor on an entry with nothing in it discards the entry. */
  const done = (id: string) => {
    const entry = exp.entries.find((e) => e.id === id);
    if (entry && isBlank(entry)) setExp({ entries: exp.entries.filter((e) => e.id !== id) });
    setEditing(null);
  };

  const linkedin = exp.linkedin.trim();
  const linkedinOdd = linkedin !== '' && !/linkedin\.com\//i.test(linkedin);

  return (
    <>
      <Resume />

      <section className="py-7">
        <h3 className="text-[17px] font-semibold tracking-tight">Links</h3>
        <p className="mt-1 max-w-2xl text-sm leading-relaxed text-ink-2">Where your work and background can be seen. Optional.</p>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <div>
            <label htmlFor={linkedinId} className={labelClass}>
              LinkedIn
            </label>
            <div className="relative mt-1.5">
              <LinkedinLogo className="pointer-events-none absolute top-1/2 left-3.5 size-[18px] -translate-y-1/2 text-ink-3" aria-hidden="true" />
              <input
                id={linkedinId}
                type="url"
                inputMode="url"
                autoComplete="url"
                value={exp.linkedin}
                maxLength={200}
                onChange={(e) => setExp({ linkedin: e.target.value })}
                placeholder="linkedin.com/in/your-name"
                aria-describedby={linkedinOdd ? `${linkedinId}-note` : undefined}
                className={`${inputClass} h-11 pl-10`}
              />
            </div>
            {linkedinOdd && (
              <p id={`${linkedinId}-note`} className="mt-1.5 text-[13px] text-amber-700">
                This does not look like a LinkedIn address. It is saved as typed.
              </p>
            )}
          </div>
          <StringList label="Other links" values={exp.links} onChange={(links) => setExp({ links })} placeholder="GitHub, a portfolio or a personal site" addLabel="Add another link" max={8} />
        </div>
      </section>

      <section className="pt-7">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h3 className="text-[17px] font-semibold tracking-tight">Experiences</h3>
            <p className="mt-1 max-w-2xl text-sm leading-relaxed text-ink-2">Anything you have done that shows what you can do: internships, jobs, research, projects, clubs, volunteering. Class projects count.</p>
          </div>
          {exp.entries.length > 0 && (
            <button type="button" onClick={add} disabled={editing !== null} className={quietButton}>
              <Plus className="size-4" weight="bold" aria-hidden="true" />
              Add an experience
            </button>
          )}
        </div>

        {exp.entries.length === 0 ? (
          <div className="mt-4 rounded-2xl border border-dashed border-slate-300 px-6 py-10 text-center">
            <p className="text-[15px] font-semibold text-ink">Nothing added yet</p>
            <p className="mx-auto mt-1 max-w-md text-sm leading-relaxed text-ink-2">Add one at a time. Each has a role, an organization, dates, what you did and the skills you used, and you can leave any of them blank.</p>
            <button type="button" onClick={add} className="btn-primary mt-5 inline-flex h-11 items-center gap-2 px-5 text-[15px] text-white">
              <Plus className="size-[18px]" weight="bold" aria-hidden="true" />
              Add an experience
            </button>
          </div>
        ) : (
          <ul className="mt-4 space-y-3">
            {exp.entries.map((entry) => (
              <li key={entry.id}>
                {editing === entry.id ? (
                  <EntryEditor entry={entry} onChange={update} onDone={() => done(entry.id)} onDelete={() => remove(entry.id)} />
                ) : (
                  <EntryCard entry={entry} onEdit={() => setEditing(entry.id)} />
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}
