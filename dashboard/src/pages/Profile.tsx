import { CaretDown, FilePlus, FileText, Plus, Trash, X } from '@phosphor-icons/react';
import { useEffect, useId, useRef, useState } from 'react';
import { useAuth } from '../auth/AuthProvider.tsx';
import { Card, Page } from '../components/Page.tsx';
import { careerSections, fieldGroups, opportunityKinds, restrictionSections, withDefaults, type Item, type Note, type Preferences, type Section } from '../data/preferences.ts';
import { goalForProfile } from '../lib/personalize.ts';
import { useStore } from '../state/StoreProvider.tsx';
import type { ClassYear } from '../types.ts';
import { Experience } from './ProfileExperience.tsx';

const tabs = [
  { id: 'experience', label: 'Experience', intro: 'What you have done so far. Your agents use it to judge how well an opportunity fits and what you would still need to learn for it.' },
  { id: 'career', label: 'Career interests', intro: 'This decides what your agents search for. They look in the fields you tick and rank results by how well they match the rest of this page.' },
  { id: 'restrictions', label: 'Restrictions', intro: 'These are rules. Your agents never recommend something that breaks one. When a posting does not say, for example it lists no pay, it is marked "not confirmed" instead of guessed.' },
  { id: 'notes', label: 'Custom notes', intro: 'Write anything you want your agents to know, in your own words, in as many notes as you like. They read these first, and a note wins over anything on the other tabs.' },
] as const;
type TabId = (typeof tabs)[number]['id'];
type Change = (next: Preferences) => void;

const inputClass = 'block w-full rounded-xl border border-line bg-white px-3.5 text-[15px] text-ink outline-none transition placeholder:text-ink-3 focus:border-brand focus:ring-3 focus:ring-brand/15';
const labelClass = 'block text-sm font-semibold text-ink';

/** One tick-box row. The whole row is the click target. */
function CheckRow({ checked, onChange, children }: { checked: boolean; onChange: (next: boolean) => void; children: React.ReactNode }) {
  const id = useId();
  return (
    <label htmlFor={id} className={`flex min-h-10 cursor-pointer items-center gap-3 rounded-lg px-2 text-[15px] transition hover:bg-brand-soft ${checked ? 'font-medium text-ink' : 'text-ink-2'}`}>
      <input id={id} type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="size-[18px] shrink-0 accent-[var(--color-brand)]" />
      <span className="min-w-0">{children}</span>
    </label>
  );
}

function Input({ item, prefs, change }: { item: Exclude<Item, { kind: 'check' | 'list' }>; prefs: Preferences; change: Change }) {
  const id = useId();
  const value = prefs.answers[item.id] ?? '';
  const set = (text: string) => change({ ...prefs, answers: { ...prefs.answers, [item.id]: text } });
  return (
    <div>
      <label htmlFor={id} className={labelClass}>
        {item.label}
      </label>
      {item.kind === 'select' ? (
        <div className="relative mt-1.5">
          <select id={id} value={value} onChange={(e) => set(e.target.value)} className={`${inputClass} h-11 appearance-none pr-10 ${value ? '' : 'text-ink-3'}`}>
            <option value="">Not set</option>
            {item.options.map((o) => (
              <option key={o}>{o}</option>
            ))}
          </select>
          <CaretDown className="pointer-events-none absolute top-1/2 right-3.5 size-4 -translate-y-1/2 text-ink-3" weight="bold" aria-hidden="true" />
        </div>
      ) : item.kind === 'text' && item.long ? (
        <textarea id={id} rows={4} value={value} onChange={(e) => set(e.target.value)} placeholder={item.placeholder} className={`${inputClass} mt-1.5 resize-y py-2.5 leading-relaxed`} />
      ) : item.kind === 'number' ? (
        <div className="mt-1.5 flex items-center gap-2">
          {item.prefix && <span className="text-[15px] text-ink-2">{item.prefix}</span>}
          <input id={id} type="number" min={0} inputMode="decimal" value={value} onChange={(e) => set(e.target.value)} placeholder={item.placeholder} className={`${inputClass} h-11 max-w-36`} />
          {item.suffix && <span className="text-[15px] text-ink-2">{item.suffix}</span>}
        </div>
      ) : (
        <input id={id} type={item.kind === 'date' ? 'date' : 'text'} value={value} onChange={(e) => set(e.target.value)} placeholder={item.kind === 'text' ? item.placeholder : undefined} className={`${inputClass} mt-1.5 h-11 ${item.kind === 'date' ? 'max-w-52' : ''}`} />
      )}
      {item.kind === 'text' && item.hint && <p className="mt-1.5 text-[13px] text-ink-3">{item.hint}</p>}
    </div>
  );
}

const MAX_ROWS = 12;
const MAX_ENTRY = 80;
const entriesOf = (rows: string[]) => rows.map((r) => r.trim().slice(0, MAX_ENTRY)).filter(Boolean).slice(0, MAX_ROWS);

/** An answer with several entries: one row each, added one at a time. */
function ListInput({ item, prefs, change }: { item: Extract<Item, { kind: 'list' }>; prefs: Preferences; change: Change }) {
  const id = useId();
  // Answers saved before lists existed were typed as one comma-separated line.
  const stored = entriesOf(prefs.lists[item.id] ?? (prefs.answers[item.id] ?? '').split(','));
  const [rows, setRows] = useState<string[]>(() => (stored.length ? stored : ['']));
  const inputs = useRef<(HTMLInputElement | null)[]>([]);
  const focusNext = useRef<number | null>(null);

  // Saved answers that changed elsewhere, for example once loaded, replace what is shown.
  if (entriesOf(rows).join('\n') !== stored.join('\n')) setRows(stored.length ? stored : ['']);

  useEffect(() => {
    if (focusNext.current === null) return;
    inputs.current[focusNext.current]?.focus();
    focusNext.current = null;
  }, [rows.length]);

  const commit = (next: string[], focus?: number) => {
    if (focus !== undefined) focusNext.current = focus;
    setRows(next);
    const entries = entriesOf(next);
    if (entries.join('\n') === stored.join('\n') && prefs.lists[item.id]) return;
    const { [item.id]: _old, ...answers } = prefs.answers;
    const { [item.id]: _list, ...lists } = prefs.lists;
    change({ ...prefs, answers, lists: entries.length ? { ...lists, [item.id]: entries } : lists });
  };
  const canAdd = rows.length < MAX_ROWS && (rows[rows.length - 1] ?? '').trim() !== '';
  const add = () => canAdd && commit([...rows, ''], rows.length);
  const remove = (index: number) => commit(rows.filter((_, i) => i !== index), Math.max(0, index - 1));

  return (
    <div>
      <label htmlFor={id} className={labelClass}>
        {item.label}
      </label>
      <div className="mt-1.5 space-y-2">
        {rows.map((row, i) => (
          <div key={i} className="flex items-center gap-1.5">
            <input
              id={i === 0 ? id : undefined}
              ref={(el) => void (inputs.current[i] = el)}
              type="text"
              value={row}
              maxLength={MAX_ENTRY}
              aria-label={i === 0 ? undefined : `${item.label} ${i + 1}`}
              placeholder={item.placeholder}
              onChange={(e) => commit(rows.map((r, j) => (j === i ? e.target.value : r)))}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && i === rows.length - 1 && canAdd) {
                  e.preventDefault();
                  add();
                } else if (e.key === 'Backspace' && i > 0 && row === '') {
                  e.preventDefault();
                  remove(i);
                }
              }}
              className={`${inputClass} h-11 min-w-0 flex-1`}
            />
            {i > 0 && (
              <button type="button" aria-label={`Remove ${row.trim() || 'entry'}`} onClick={() => remove(i)} className="grid size-10 shrink-0 place-items-center rounded-lg text-ink-3 transition hover:bg-slate-100 hover:text-ink">
                <X className="size-4" weight="bold" aria-hidden="true" />
              </button>
            )}
          </div>
        ))}
      </div>
      {rows.length < MAX_ROWS && (
        <button type="button" onClick={add} disabled={!canAdd} className="mt-2 flex h-10 items-center gap-1.5 rounded-xl border border-line bg-white px-3.5 text-sm font-semibold text-ink transition hover:bg-slate-50 disabled:opacity-50">
          <Plus className="size-4" weight="bold" aria-hidden="true" />
          {item.addLabel ?? 'Add another'}
        </button>
      )}
      {item.hint && <p className="mt-1.5 text-[13px] text-ink-3">{item.hint}</p>}
    </div>
  );
}

function SectionBlock({ section, prefs, change }: { section: Section; prefs: Preferences; change: Change }) {
  const checks = section.items.filter((i) => i.kind === 'check');
  const inputs = section.items.filter((i): i is Exclude<Item, { kind: 'check' }> => i.kind !== 'check');
  const wide = inputs.some((i) => i.kind === 'text' && i.long) || inputs.length === 1;
  return (
    <section className="py-7 first:pt-0 last:pb-0">
      <h3 className="text-[17px] font-semibold tracking-tight">{section.title}</h3>
      {section.hint && <p className="mt-1 max-w-2xl text-sm leading-relaxed text-ink-2">{section.hint}</p>}
      {checks.length > 0 && (
        <fieldset className="mt-4">
          {section.checksLabel && <legend className={labelClass}>{section.checksLabel}</legend>}
          <div className="mt-1.5 grid gap-x-6 sm:grid-cols-2 lg:grid-cols-3">
            {checks.map((item) => (
              <CheckRow key={item.id} checked={prefs.checks[item.id] === true} onChange={(on) => change({ ...prefs, checks: { ...prefs.checks, [item.id]: on } })}>
                {item.label}
              </CheckRow>
            ))}
          </div>
        </fieldset>
      )}
      {inputs.length > 0 && (
        <div className={`mt-4 grid gap-4 ${wide ? '' : 'md:grid-cols-2'}`}>
          {inputs.map((item) => (item.kind === 'list' ? <ListInput key={item.id} item={item} prefs={prefs} change={change} /> : <Input key={item.id} item={item} prefs={prefs} change={change} />))}
        </div>
      )}
    </section>
  );
}

/** What to look for, then the fields as tidy tick-lists, one group at a time. */
function Fields({ prefs, change }: { prefs: Preferences; change: Change }) {
  const [adding, setAdding] = useState('');
  const topId = useId();
  const toggle = (field: string, on: boolean) =>
    change({ ...prefs, fields: on ? [...prefs.fields, field] : prefs.fields.filter((f) => f !== field), topField: !on && prefs.topField === field ? null : prefs.topField });
  const add = () => {
    const name = adding.trim().slice(0, 60);
    const known = [...fieldGroups.flatMap((g) => g.fields), ...prefs.customFields].some((f) => f.toLowerCase() === name.toLowerCase());
    setAdding('');
    if (name && !known) change({ ...prefs, customFields: [...prefs.customFields, name], fields: [...prefs.fields, name] });
  };
  const remove = (field: string) =>
    change({ ...prefs, customFields: prefs.customFields.filter((f) => f !== field), fields: prefs.fields.filter((f) => f !== field), topField: prefs.topField === field ? null : prefs.topField });
  const allKinds = prefs.kinds.length === 0;

  return (
    <>
      <section className="pb-7">
        <h3 className="text-[17px] font-semibold tracking-tight">What to look for</h3>
        <p className="mt-1 max-w-2xl text-sm leading-relaxed text-ink-2">Your agents are split across the kinds you tick. Leave one out and its agents move to the others.</p>
        <div className="mt-3 grid gap-x-6 sm:grid-cols-2">
          {opportunityKinds.map((k) => (
            <CheckRow
              key={k.id}
              checked={allKinds || prefs.kinds.includes(k.id)}
              onChange={(on) => {
                const current = allKinds ? opportunityKinds.map((x) => x.id) : prefs.kinds;
                const next = on ? [...current, k.id] : current.filter((x) => x !== k.id);
                // At least one kind stays ticked; all four ticked is stored as "everything".
                if (next.length > 0) change({ ...prefs, kinds: next.length === opportunityKinds.length ? [] : next });
              }}
            >
              {k.label}
            </CheckRow>
          ))}
        </div>
      </section>

      <section className="py-7">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h3 className="text-[17px] font-semibold tracking-tight">Fields</h3>
            <p className="mt-1 max-w-2xl text-sm leading-relaxed text-ink-2">Tick every field you want, in any group. {prefs.fields.length > 0 ? `${prefs.fields.length} ticked.` : 'None ticked yet.'}</p>
          </div>
          <div className="w-full max-w-xs">
            <label htmlFor={topId} className={labelClass}>
              My top field
            </label>
            <div className="relative mt-1.5">
              <select
                id={topId}
                value={prefs.topField ?? ''}
                disabled={prefs.fields.length === 0}
                onChange={(e) => change({ ...prefs, topField: e.target.value || null })}
                className={`${inputClass} h-11 appearance-none pr-10 disabled:bg-slate-50 disabled:text-ink-3`}
              >
                <option value="">{prefs.fields.length ? 'No single top field' : 'Tick a field first'}</option>
                {prefs.fields.map((f) => (
                  <option key={f}>{f}</option>
                ))}
              </select>
              <CaretDown className="pointer-events-none absolute top-1/2 right-3.5 size-4 -translate-y-1/2 text-ink-3" weight="bold" aria-hidden="true" />
            </div>
          </div>
        </div>

        <div className="mt-5 grid gap-4 lg:grid-cols-2">
          {fieldGroups.map((group, i) => {
            const last = i === fieldGroups.length - 1;
            const count = group.fields.filter((f) => prefs.fields.includes(f)).length + (last ? prefs.customFields.length : 0);
            return (
              <fieldset key={group.title} className="rounded-2xl border border-line bg-white/70 p-4">
                <legend className="float-left mb-1 flex w-full items-center justify-between px-2 text-sm font-semibold text-ink">
                  {group.title}
                  {count > 0 && <span className="text-xs font-medium text-ink-3">{count} selected</span>}
                </legend>
                <div className="clear-both grid sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
                  {group.fields.map((f) => (
                    <CheckRow key={f} checked={prefs.fields.includes(f)} onChange={(on) => toggle(f, on)}>
                      {f}
                    </CheckRow>
                  ))}
                  {last &&
                    prefs.customFields.map((f) => (
                      <div key={f} className="flex items-center">
                        <div className="min-w-0 flex-1">
                          <CheckRow checked={prefs.fields.includes(f)} onChange={(on) => toggle(f, on)}>
                            {f}
                          </CheckRow>
                        </div>
                        <button type="button" aria-label={`Remove ${f}`} onClick={() => remove(f)} className="grid size-9 shrink-0 place-items-center rounded-lg text-ink-3 hover:bg-slate-100 hover:text-ink">
                          <X className="size-4" weight="bold" aria-hidden="true" />
                        </button>
                      </div>
                    ))}
                </div>
                {last && (
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      add();
                    }}
                    className="mt-3 flex items-end gap-2 px-2"
                  >
                    <div className="min-w-0 flex-1">
                      <label htmlFor="add-field" className={labelClass}>
                        Add your own
                      </label>
                      <input id="add-field" value={adding} onChange={(e) => setAdding(e.target.value)} maxLength={60} className={`${inputClass} mt-1.5 h-10`} />
                    </div>
                    <button type="submit" disabled={!adding.trim()} className="flex h-10 shrink-0 items-center gap-1.5 rounded-xl border border-line bg-white px-3.5 text-sm font-semibold text-ink transition hover:bg-slate-50 disabled:opacity-50">
                      <Plus className="size-4" weight="bold" aria-hidden="true" />
                      Add
                    </button>
                  </form>
                )}
              </fieldset>
            );
          })}
        </div>
      </section>
    </>
  );
}

const newId = () => (crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`);

/** Custom notes: files the student creates, titles and writes in. */
function Notes({ prefs, change }: { prefs: Preferences; change: Change }) {
  const [openId, setOpenId] = useState<string | null>(prefs.notes[0]?.id ?? null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const titleRef = useRef<HTMLInputElement>(null);
  const open = prefs.notes.find((n) => n.id === openId) ?? null;

  const create = () => {
    const note: Note = { id: newId(), title: '', body: '', updatedAt: new Date().toISOString() };
    change({ ...prefs, notes: [note, ...prefs.notes] });
    setOpenId(note.id);
    setConfirmDelete(false);
    // Start typing the title straight away.
    setTimeout(() => titleRef.current?.focus(), 0);
  };
  const update = (patch: Partial<Note>) => open && change({ ...prefs, notes: prefs.notes.map((n) => (n.id === open.id ? { ...n, ...patch, updatedAt: new Date().toISOString() } : n)) });
  const remove = () => {
    if (!open) return;
    const rest = prefs.notes.filter((n) => n.id !== open.id);
    change({ ...prefs, notes: rest });
    setOpenId(rest[0]?.id ?? null);
    setConfirmDelete(false);
  };

  if (prefs.notes.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-slate-300 px-6 py-12 text-center">
        <FileText className="mx-auto size-9 text-ink-3" aria-hidden="true" />
        <h3 className="mt-3 text-[17px] font-semibold tracking-tight">No notes yet</h3>
        <p className="mx-auto mt-1 max-w-md text-sm leading-relaxed text-ink-2">
          For example: "A paid summer internship where I build real software with a small team. I care more about learning than the company name." Or: "I already applied to one company, do not show it again."
        </p>
        <button type="button" onClick={create} className="btn-primary mt-5 inline-flex h-11 items-center gap-2 px-5 text-[15px] text-white">
          <FilePlus className="size-[18px]" weight="bold" aria-hidden="true" />
          Write a note
        </button>
      </div>
    );
  }

  return (
    <div className="grid gap-5 md:grid-cols-[240px_minmax(0,1fr)]">
      <div>
        <button type="button" onClick={create} className="flex h-11 w-full items-center justify-center gap-2 rounded-xl border border-line bg-white text-sm font-semibold text-ink transition hover:bg-slate-50">
          <FilePlus className="size-[18px]" aria-hidden="true" />
          New note
        </button>
        <ul className="mt-3 space-y-1" aria-label="Your notes">
          {prefs.notes.map((n) => (
            <li key={n.id}>
              <button
                type="button"
                aria-current={n.id === openId ? 'true' : undefined}
                onClick={() => {
                  setOpenId(n.id);
                  setConfirmDelete(false);
                }}
                className={`flex w-full items-start gap-2.5 rounded-xl px-3 py-2.5 text-left transition ${n.id === openId ? 'bg-brand-soft' : 'hover:bg-slate-50'}`}
              >
                <FileText className={`mt-0.5 size-[18px] shrink-0 ${n.id === openId ? 'text-brand' : 'text-ink-3'}`} weight={n.id === openId ? 'fill' : 'regular'} aria-hidden="true" />
                <span className="min-w-0">
                  <span className={`block truncate text-sm font-semibold ${n.title.trim() ? 'text-ink' : 'text-ink-3'}`}>{n.title.trim() || 'Untitled note'}</span>
                  <span className="block truncate text-[13px] text-ink-3">{n.body.trim().split('\n')[0] || 'Nothing written yet'}</span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      </div>

      {open && (
        <div className="min-w-0">
          <label htmlFor="note-title" className="sr-only">
            Note title
          </label>
          <input
            id="note-title"
            ref={titleRef}
            value={open.title}
            onChange={(e) => update({ title: e.target.value })}
            maxLength={80}
            placeholder="Title"
            className="block w-full border-0 border-b border-line bg-transparent px-0 pb-2.5 text-xl font-semibold tracking-tight text-ink outline-none placeholder:text-ink-3 focus:border-brand"
          />
          <label htmlFor="note-body" className="sr-only">
            Note
          </label>
          <textarea
            id="note-body"
            value={open.body}
            onChange={(e) => update({ body: e.target.value })}
            maxLength={4000}
            rows={12}
            placeholder="Write whatever you want your agents to know."
            className={`${inputClass} mt-4 min-h-64 resize-y py-3 leading-relaxed`}
          />
          <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
            <p className="text-[13px] text-ink-3">{open.body.length} of 4000 characters</p>
            {confirmDelete ? (
              <div className="flex items-center gap-2">
                <span className="text-sm text-ink-2">Delete this note?</span>
                <button type="button" onClick={remove} className="h-9 rounded-lg bg-red-600 px-3 text-sm font-semibold text-white hover:bg-red-700">
                  Delete
                </button>
                <button type="button" onClick={() => setConfirmDelete(false)} className="h-9 rounded-lg border border-line bg-white px-3 text-sm font-semibold text-ink hover:bg-slate-50">
                  Keep
                </button>
              </div>
            ) : (
              <button type="button" onClick={() => setConfirmDelete(true)} className="flex h-9 items-center gap-1.5 rounded-lg px-2.5 text-sm font-semibold text-ink-2 hover:bg-slate-100 hover:text-ink">
                <Trash className="size-4" aria-hidden="true" />
                Delete note
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export function Profile() {
  const { state, dispatch } = useStore();
  const auth = useAuth();
  const prefs = withDefaults(state.preferences);
  const [tab, setTab] = useState<TabId>('experience');
  const [saved, setSaved] = useState<'idle' | 'saving' | 'saved' | 'local'>('idle');
  const timer = useRef<number | null>(null);
  const tabRefs = useRef<Record<string, HTMLButtonElement | null>>({});

  // Everything saves by itself: in the app at once, and to the agents a moment after the last change.
  const change: Change = (next) => {
    dispatch({ type: 'setPreferences', preferences: next });
    // The roadmap follows the fields the student cares about, unless they picked a goal themselves.
    if (next.topField !== prefs.topField || next.fields.join('\n') !== prefs.fields.join('\n')) {
      const { major, careerInterests } = state.profile;
      dispatch({ type: 'suggestGoal', id: goalForProfile({ major, careerInterests, topField: next.topField, fields: next.fields }) });
    }
    const nextYear = next.answers.classYear;
    if (nextYear && nextYear !== prefs.answers.classYear && nextYear !== 'Graduate student') dispatch({ type: 'setYear', year: nextYear as ClassYear });
    setSaved('saving');
    if (timer.current) clearTimeout(timer.current);
    timer.current = window.setTimeout(() => {
      const year = next.answers.classYear;
      void auth
        .saveProfile({
          preferences: next,
          ...(next.kinds.length ? { categories: next.kinds } : { categories: ['internship', 'event', 'club', 'program'] }),
          ...(year && year !== 'Graduate student' ? { year } : {}),
        })
        .then((ok) => setSaved(ok ? 'saved' : 'local'));
    }, 800);
  };
  useEffect(() => () => void (timer.current && clearTimeout(timer.current)), []);

  // Arrow keys move between tabs, as tab lists do everywhere else.
  const onTabKey = (event: React.KeyboardEvent) => {
    const index = tabs.findIndex((t) => t.id === tab);
    const next = event.key === 'ArrowRight' ? tabs[(index + 1) % tabs.length] : event.key === 'ArrowLeft' ? tabs[(index + tabs.length - 1) % tabs.length] : null;
    if (!next) return;
    event.preventDefault();
    setTab(next.id);
    tabRefs.current[next.id]?.focus();
  };

  const current = tabs.find((t) => t.id === tab)!;

  return (
    <Page title="Your profile" subtitle="What you tell your agents here decides what they look for and what they leave out.">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div role="tablist" aria-label="Profile sections" onKeyDown={onTabKey} className="inline-flex flex-wrap gap-1 rounded-2xl bg-white/80 p-1 shadow-card backdrop-blur">
          {tabs.map((t) => (
            <button
              key={t.id}
              ref={(el) => void (tabRefs.current[t.id] = el)}
              type="button"
              role="tab"
              id={`tab-${t.id}`}
              aria-selected={tab === t.id}
              aria-controls={`panel-${t.id}`}
              tabIndex={tab === t.id ? 0 : -1}
              onClick={() => setTab(t.id)}
              className={`flex min-h-10 items-center gap-2 rounded-xl px-4 text-[15px] font-semibold transition ${tab === t.id ? 'bg-brand text-white' : 'text-ink-2 hover:bg-white'}`}
            >
              {t.label}
            </button>
          ))}
        </div>
        <p className="min-h-5 text-sm text-ink-2" aria-live="polite">
          {saved === 'saving' ? 'Saving…' : saved === 'saved' ? 'Saved. Your agents have it.' : saved === 'local' ? 'Saved on this device.' : 'Everything saves by itself.'}
        </p>
      </div>

      <Card className="mt-4 p-7">
        <div role="tabpanel" id={`panel-${current.id}`} aria-labelledby={`tab-${current.id}`}>
          <p className="max-w-3xl rounded-2xl bg-brand-soft px-4 py-3 text-[15px] leading-relaxed text-ink-2">
            {current.intro}
            {tab === 'experience' ? ' Everything here is optional.' : tab !== 'notes' ? ' Leave anything blank that does not apply.' : ''}
          </p>
          <div className={`mt-7 ${tab === 'notes' ? '' : 'divide-y divide-line'}`}>
            {tab === 'experience' && <Experience prefs={prefs} change={change} />}
            {tab === 'career' && <Fields prefs={prefs} change={change} />}
            {tab === 'career' && careerSections.map((s) => <SectionBlock key={s.title} section={s} prefs={prefs} change={change} />)}
            {tab === 'restrictions' && restrictionSections.map((s) => <SectionBlock key={s.title} section={s} prefs={prefs} change={change} />)}
            {tab === 'notes' && <Notes prefs={prefs} change={change} />}
          </div>
        </div>
      </Card>
    </Page>
  );
}
