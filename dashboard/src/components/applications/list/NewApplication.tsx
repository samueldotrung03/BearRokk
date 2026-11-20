// "New application": a window with two ways to start one. Either from a posting the student saved,
// or blank, for something the agents never found (a title is all it needs). Once the account has
// made it, the window closes and the application's portal opens.
import { Plus, Search, X } from 'lucide-react';
import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router';
import { statusLabel } from '../../../lib/applications.ts';
import { dateInputToIso, matchesPosting, startablePostings } from '../../../lib/portal/list.ts';
import { dueLabel } from '../../../lib/time.ts';
import { useLive } from '../../../state/live.tsx';
import { useStore } from '../../../state/StoreProvider.tsx';
import { typeMeta } from '../../meta.ts';
import { portalPath } from './ApplicationListRow.tsx';

export function NewApplicationButton({ disabled = false, variant = 'header' }: { disabled?: boolean; variant?: 'header' | 'solid' }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        className={variant === 'header' ? 'apl-new' : 'btn-primary inline-flex h-10 items-center gap-1.5 rounded-xl px-4 text-sm font-medium text-white'}
        onClick={() => setOpen(true)}
        disabled={disabled}
        title={disabled ? 'Your account cannot be reached right now' : undefined}
      >
        <Plus className="size-4" aria-hidden="true" />
        New application
      </button>
      {open && <NewApplicationDialog onClose={() => setOpen(false)} />}
    </>
  );
}

type Mode = 'posting' | 'blank';

function NewApplicationDialog({ onClose }: { onClose: () => void }) {
  const live = useLive();
  const { state } = useStore();
  const navigate = useNavigate();
  const ref = useRef<HTMLDialogElement>(null);
  const [mode, setMode] = useState<Mode>('posting');
  const [query, setQuery] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({ title: '', organizer: '', deadline: '', actionUrl: '' });

  useEffect(() => {
    ref.current?.showModal();
  }, []);

  const postings = useMemo(
    () => startablePostings([...live.savedCards, ...live.opportunities], state.saved, live.applications),
    [live.savedCards, live.opportunities, state.saved, live.applications],
  );
  const shown = postings.filter((o) => matchesPosting(o, query));

  /** Asks the account to make the application, then opens its portal. */
  const start = async (key: string, body: Record<string, string>) => {
    setBusy(key);
    setError(null);
    try {
      const res = await live.request('/applications', { method: 'POST', body: JSON.stringify(body) });
      const data = (await res.json().catch(() => ({}))) as { application?: { opportunityId?: string }; error?: string };
      const id = data.application?.opportunityId;
      if (!res.ok || !id) throw new Error(data.error);
      ref.current?.close();
      navigate(portalPath(id));
    } catch {
      setError('The application could not be started. Check that the app can reach your account and try again.');
      setBusy(null);
    }
  };

  const submitBlank = (event: FormEvent) => {
    event.preventDefault();
    const title = form.title.trim();
    if (!title) return;
    const body: Record<string, string> = { title };
    if (form.organizer.trim()) body.organizer = form.organizer.trim();
    const deadline = dateInputToIso(form.deadline);
    if (deadline) body.deadline = deadline;
    if (form.actionUrl.trim()) body.actionUrl = form.actionUrl.trim();
    void start('blank', body);
  };

  return (
    <dialog
      ref={ref}
      className="apl-dialog"
      aria-labelledby="apl-new-title"
      onClose={onClose}
      onClick={(event) => {
        if (event.target === ref.current) ref.current.close();
      }}
    >
      <div className="apl-dialog-head">
        <h2 id="apl-new-title" className="font-display text-3xl leading-tight">
          New application
        </h2>
        <button type="button" onClick={() => ref.current?.close()} aria-label="Close" className="grid size-9 place-items-center rounded-lg text-ink-3 hover:bg-slate-100">
          <X className="size-5" aria-hidden="true" />
        </button>
      </div>

      <div className="apl-dialog-body">
        <div className="apl-modes" role="tablist" aria-label="How to start">
          <button type="button" role="tab" aria-selected={mode === 'posting'} className="apl-mode" onClick={() => setMode('posting')}>
            <span className="font-semibold">From a saved posting</span>
            <span className="apl-mode-note">The questions and uploads are looked up for you.</span>
          </button>
          <button type="button" role="tab" aria-selected={mode === 'blank'} className="apl-mode" onClick={() => setMode('blank')}>
            <span className="font-semibold">Start a blank one</span>
            <span className="apl-mode-note">For anything not in your saved list.</span>
          </button>
        </div>

        {error && (
          <p className="mt-4 text-sm text-orange-700" role="alert">
            {error}
          </p>
        )}

        {mode === 'posting' ? (
          <div className="mt-4">
            <label className="feed-search">
              <Search className="size-[18px] shrink-0 text-ink-3" aria-hidden="true" />
              <span className="sr-only">Search your saved postings</span>
              <input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search by title or organizer" autoFocus />
            </label>
            {postings.length === 0 ? (
              <p className="mt-4 text-sm leading-relaxed text-ink-2">
                Nothing saved that you have not applied to yet. Save a posting in the feed, or start a blank application instead.
              </p>
            ) : shown.length === 0 ? (
              <p className="mt-4 text-sm text-ink-2">Nothing you saved matches that search.</p>
            ) : (
              <ul className="apl-pick-list">
                {shown.map((o) => {
                  const status = live.applications[o.id]?.status;
                  return (
                    <li key={o.id}>
                      <button type="button" className="apl-pick" disabled={busy !== null} onClick={() => void start(o.id, { opportunityId: o.id })}>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate font-semibold text-ink">{o.title}</span>
                          <span className="block truncate text-sm text-ink-2">
                            {o.organizer} · {typeMeta[o.type].label}
                            {o.deadline ? ` · ${dueLabel(o.deadline)}` : ''}
                          </span>
                        </span>
                        <span className="apl-pick-action">
                          {busy === o.id ? 'Starting…' : status === 'to_apply' || status === 'applying' ? `Open (${statusLabel[status]})` : 'Start'}
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        ) : (
          <form id="apl-blank-form" className="mt-4 grid gap-3" onSubmit={submitBlank}>
            <label className="apl-field">
              <span>
                Title <span className="text-ink-3">(needed)</span>
              </span>
              <input required value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="e.g. Summer research program" autoFocus />
            </label>
            <label className="apl-field">
              <span>Organizer</span>
              <input value={form.organizer} onChange={(e) => setForm({ ...form, organizer: e.target.value })} placeholder="Who runs it" />
            </label>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="apl-field">
                <span>Deadline</span>
                <input type="date" value={form.deadline} onChange={(e) => setForm({ ...form, deadline: e.target.value })} />
              </label>
              <label className="apl-field">
                <span>Link</span>
                <input type="url" value={form.actionUrl} onChange={(e) => setForm({ ...form, actionUrl: e.target.value })} placeholder="https://" />
              </label>
            </div>
          </form>
        )}
      </div>

      <div className="apl-dialog-foot">
        <span className="text-sm text-ink-3" aria-live="polite">
          {busy ? 'Starting…' : ''}
        </span>
        <button type="button" className="apl-secondary" onClick={() => ref.current?.close()}>
          Cancel
        </button>
        {mode === 'blank' && (
          <button type="submit" form="apl-blank-form" className="apl-primary" disabled={busy !== null || !form.title.trim()}>
            Start application
          </button>
        )}
      </div>
    </dialog>
  );
}
