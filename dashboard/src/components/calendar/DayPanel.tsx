// The selected day: its items grouped into have-to and should, each with why it is there, plus
// the plan's suggestions for that day, a warning when commitments clash, and the student's own items.
import { ArrowUpRight, CalendarPlus, Check, Pencil, Plus, Trash, TriangleExclamationPoint, X } from 'lucide-react';
import { useEffect, useId, useRef, useState, type FormEvent } from 'react';
import { Link } from 'react-router';
import { opportunities } from '../../data/sample.ts';
import type { Priority } from '../../lib/calendar.ts';
import { dayLabel, hoursLabel, longDay } from '../../lib/cal/days.ts';
import { cxKindLabel, type Conflict, type CxItem, type PersonalItem } from '../../lib/cal/items.ts';
import type { PlanBlock } from '../../lib/cal/planner.ts';
import { useStore } from '../../state/StoreProvider.tsx';
import type { Opportunity } from '../../types.ts';

const priorityLabel: Record<Priority, string> = { must: 'Have to do', should: 'Should do' };

export interface PersonalActions {
  add: (item: Omit<PersonalItem, 'id' | 'done' | 'block'>) => void;
  update: (id: string, patch: Partial<PersonalItem>) => void;
  remove: (id: string) => void;
}

export function DayPanel({
  day,
  today,
  items,
  hiddenCount,
  blocks,
  conflict,
  conflictAdvice,
  personal,
  actions,
  onOpen,
  onAccept,
  found = opportunities,
  addRequest = 0,
  googleConnected = false,
}: {
  day: string;
  today: string;
  items: CxItem[];
  hiddenCount: number;
  blocks: PlanBlock[];
  conflict: Conflict | undefined;
  conflictAdvice: string | null;
  personal: PersonalItem[];
  actions: PersonalActions;
  onOpen: (o: Opportunity) => void;
  onAccept: (block: PlanBlock) => void;
  /** What the agents found and the student saved, for "Open details". The sample set without it. */
  found?: Opportunity[];
  /** Changes when the page's "Add event" button is pressed, to open the form. */
  addRequest?: number;
  /** Google Calendar is connected, so what is added here goes there too. */
  googleConnected?: boolean;
}) {
  const [editing, setEditing] = useState<string | 'new' | null>(null);
  useEffect(() => {
    if (addRequest > 0) setEditing('new');
  }, [addRequest]);
  const label = dayLabel(day, today);
  const editItem = editing && editing !== 'new' ? personal.find((p) => p.id === editing) : undefined;

  return (
    <div className="cx-fade" key={day}>
      <p className="text-sm font-semibold text-brand">{label === 'Today' || label === 'Tomorrow' ? label : longDay(day).split(',')[0]}</p>
      <h2 className="font-display text-3xl leading-tight">{longDay(day).split(', ').slice(1).join(', ')}</h2>

      {conflict && (
        <div className="cx-clash-banner" role="status">
          <TriangleExclamationPoint className="mt-0.5 size-4 shrink-0" strokeWidth={2.5} aria-hidden="true" />
          <div>
            <p className="font-semibold">{conflict.items.length} things you committed to land on this day</p>
            <p className="mt-0.5 text-[13px] leading-snug">{conflictAdvice}</p>
          </div>
        </div>
      )}

      {items.length === 0 && blocks.length === 0 ? (
        <p className="mt-3 text-sm leading-relaxed text-ink-2">
          {hiddenCount > 0 ? `${hiddenCount} ${hiddenCount === 1 ? 'item is' : 'items are'} hidden by your filters.` : 'Nothing on this day. Pick a day with a colored bar, or add something of your own.'}
        </p>
      ) : (
        <div className="mt-4 grid gap-5">
          {(['must', 'should'] as const).map((priority) => {
            const list = items.filter((item) => item.priority === priority && item.kind !== 'google');
            if (list.length === 0) return null;
            return (
              <section key={priority}>
                <h3 className="cal-group" data-priority={priority}>
                  {priorityLabel[priority]}
                  <span>{list.length}</span>
                </h3>
                <ul className="mt-2 grid gap-2">
                  {list.map((item) => (
                    <Item key={item.id} item={item} today={today} onOpen={onOpen} actions={actions} onEdit={setEditing} found={found} googleConnected={googleConnected} />
                  ))}
                </ul>
              </section>
            );
          })}
          {items.some((item) => item.kind === 'google') && (
            <section>
              <h3 className="cal-group" data-kind="google">
                On your Google Calendar
                <span>{items.filter((item) => item.kind === 'google').length}</span>
              </h3>
              <ul className="mt-2 grid gap-2">
                {items
                  .filter((item) => item.kind === 'google')
                  .map((item) => (
                    <li key={item.id} className="cal-item cx-item min-w-0" data-kind="google">
                      <span className="cal-dot mt-1.5" aria-hidden="true" />
                      <div className="min-w-0 flex-1">
                        <p className="leading-snug font-semibold">{item.title}</p>
                        <p className="mt-0.5 text-sm break-words text-ink-2">{item.why}</p>
                        {item.link && (
                          <a href={item.link} target="_blank" rel="noreferrer" className="mt-1.5 inline-flex items-center gap-1 text-sm font-semibold text-brand">
                            Open in Google Calendar <ArrowUpRight className="size-3.5" aria-hidden="true" />
                          </a>
                        )}
                      </div>
                    </li>
                  ))}
              </ul>
            </section>
          )}
          {blocks.length > 0 && (
            <section>
              <h3 className="cx-group-plan">
                Suggested by your plan <span>{blocks.length}</span>
              </h3>
              <ul className="mt-2 grid gap-2">
                {blocks.map((block) => (
                  <li key={block.id} className="cx-ghost cx-ghost-wide" data-priority={block.priority}>
                    <div className="flex items-start gap-3">
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-semibold tracking-wide text-ink-3 uppercase">Work block · {hoursLabel(block.hours)}</p>
                        <p className="leading-snug font-semibold">{block.title}</p>
                      </div>
                      <button type="button" className="cx-accept" onClick={() => onAccept(block)}>
                        <Check className="size-3.5" strokeWidth={3} aria-hidden="true" /> Accept
                      </button>
                    </div>
                    <p className="mt-1.5 text-sm leading-snug text-ink-2">
                      <span className="font-medium text-ink">Why here. </span>
                      {block.why}
                    </p>
                  </li>
                ))}
              </ul>
            </section>
          )}
          {hiddenCount > 0 && <p className="text-xs text-ink-3">{hiddenCount} more hidden by your filters.</p>}
        </div>
      )}

      {editing && (
        <EventDialog onClose={() => setEditing(null)}>
        <PersonalForm
          key={editing}
          initial={editItem}
          onCancel={() => setEditing(null)}
          day={day}
          googleConnected={googleConnected}
          onSave={(fields) => {
            if (editItem) actions.update(editItem.id, fields);
            else actions.add(fields);
            setEditing(null);
          }}
        />
        </EventDialog>
      )}
      {(
        <button type="button" onClick={() => setEditing('new')} className="cx-add mt-4">
          <Plus className="size-4" aria-hidden="true" /> Add an event {label === 'Today' ? 'today' : 'on this day'}
        </button>
      )}
    </div>
  );
}

function Item({
  item,
  today,
  onOpen,
  actions,
  onEdit,
  found,
  googleConnected,
}: {
  item: CxItem;
  today: string;
  onOpen: (o: Opportunity) => void;
  actions: PersonalActions;
  onEdit: (id: string) => void;
  found: Opportunity[];
  googleConnected: boolean;
}) {
  const { dispatch } = useStore();
  const opportunity = item.opportunityId ? found.find((o) => o.id === item.opportunityId) : undefined;
  const tickable = item.stepId !== null || item.personalId !== null;
  const toggle = () => {
    if (item.stepId) dispatch({ type: 'toggleStep', id: item.stepId });
    else if (item.personalId) actions.update(item.personalId, { done: !item.done });
  };
  return (
    <li className="cal-item cx-item" data-priority={item.priority} data-done={item.done}>
      {tickable ? (
        <button
          type="button"
          role="checkbox"
          aria-checked={item.done}
          aria-label={`Mark "${item.title}" as done`}
          onClick={toggle}
          className={`cx-tick mt-0.5 grid size-5 shrink-0 place-items-center rounded-full border-2 transition ${
            item.done ? 'border-brand bg-brand text-white' : 'border-slate-300 bg-white hover:border-brand'
          }`}
        >
          {item.done && <Check className="size-3" strokeWidth={3} aria-hidden="true" />}
        </button>
      ) : (
        <span className="cal-dot mt-1.5" aria-hidden="true" />
      )}
      <div className="min-w-0 flex-1">
        <p className="text-xs font-semibold tracking-wide text-ink-3 uppercase">
          {item.kind === 'google' ? null : item.hours ? `Work block · ${hoursLabel(item.hours)}` : cxKindLabel[item.kind]}
        </p>
        <p className={`leading-snug font-semibold ${item.done ? 'line-through opacity-60' : ''}`}>{item.title}</p>
        <p className="mt-1 text-sm leading-snug text-ink-2">
          <span className="font-medium text-ink">Why. </span>
          {item.why}
        </p>
        <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm font-semibold text-brand">
          {opportunity && (
            <button type="button" onClick={() => onOpen(opportunity)} className="flex items-center gap-1">
              Open details <ArrowUpRight className="size-3.5" aria-hidden="true" />
            </button>
          )}
          {item.kind === 'step' && <Link to="/roadmap">See on roadmap</Link>}
          {(item.kind === 'deadline' || item.kind === 'reminder') && <Link to="/applications">Applications</Link>}
          {item.personalId && item.hours === null && (
            <button type="button" onClick={() => onEdit(item.personalId!)} className="flex items-center gap-1">
              <Pencil className="size-3.5" aria-hidden="true" /> Edit
            </button>
          )}
          {item.personalId && (
            <button type="button" onClick={() => actions.remove(item.personalId!)} className="flex items-center gap-1 text-ink-3 hover:text-orange-700">
              <Trash className="size-3.5" aria-hidden="true" /> {item.hours ? 'Remove block' : 'Delete'}
            </button>
          )}
        </div>
        {item.personalId && (
          <p className="mt-1.5 text-xs">
            {item.link ? (
              <a href={item.link} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 font-semibold text-emerald-700">
                On your Google Calendar <ArrowUpRight className="size-3" aria-hidden="true" />
              </a>
            ) : googleConnected ? (
              <span className="text-ink-3">Adding to your Google Calendar…</span>
            ) : (
              <span className="text-ink-3">In BearRok only. Connect Google Calendar and it goes there too.</span>
            )}
          </p>
        )}
        {item.hours !== null && item.day < today && !item.done && (
          <p className="mt-1 text-xs text-ink-3">This block went by unticked, so the plan counts it as not done and finds new time.</p>
        )}
      </div>
    </li>
  );
}

/** The add and edit form, over the whole screen. Escape or a click outside closes it. */
export function EventDialog({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    ref.current?.showModal();
  }, []);
  return (
    <dialog
      ref={ref}
      className="cx-event-dialog"
      aria-label="Event"
      onClose={onClose}
      onClick={(event) => {
        if (event.target === ref.current) ref.current.close();
      }}
    >
      {children}
    </dialog>
  );
}

export function PersonalForm({
  initial,
  day,
  googleConnected,
  onSave,
  onCancel,
}: {
  initial: PersonalItem | undefined;
  day: string;
  googleConnected: boolean;
  onSave: (fields: { title: string; priority: Priority; note: string; day: string; time: string | null; endTime: string | null }) => void;
  onCancel: () => void;
}) {
  const id = useId();
  const [title, setTitle] = useState(initial?.title ?? '');
  const [priority, setPriority] = useState<Priority>(initial?.priority ?? 'should');
  const [note, setNote] = useState(initial?.note ?? '');
  const [date, setDate] = useState(initial?.day ?? day);
  const [time, setTime] = useState(initial?.time ?? '');
  const [endTime, setEndTime] = useState(initial?.endTime ?? '');
  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!title.trim() || !date) return;
    onSave({ title: title.trim(), priority, note: note.trim(), day: date, time: time || null, endTime: time && endTime ? endTime : null });
  };
  return (
    <form onSubmit={submit} className="cx-form cx-event-form" onKeyDown={(event) => event.key === 'Escape' && onCancel()}>
      <div className="flex items-center justify-between">
        <h2 className="font-display text-3xl leading-tight">{initial ? 'Edit event' : 'Add an event'}</h2>
        <button type="button" onClick={onCancel} aria-label="Cancel" className="grid size-7 place-items-center rounded-lg text-ink-3 hover:bg-slate-100">
          <X className="size-4" aria-hidden="true" />
        </button>
      </div>
      <label htmlFor={`${id}-title`} className="sr-only">
        Title
      </label>
      <input
        id={`${id}-title`}
        autoFocus
        required
        maxLength={120}
        value={title}
        onChange={(event) => setTitle(event.target.value)}
        placeholder="What is it? e.g. CS 61A midterm"
        className="cx-input"
      />
      <div className="grid grid-cols-[1.3fr_1fr_1fr] gap-2">
        <label className="grid gap-1 text-xs font-semibold text-ink-3">
          Date
          <input type="date" required value={date} onChange={(event) => setDate(event.target.value)} className="cx-input" />
        </label>
        <label className="grid gap-1 text-xs font-semibold text-ink-3">
          Starts
          <input type="time" value={time} onChange={(event) => setTime(event.target.value)} className="cx-input" />
        </label>
        <label className="grid gap-1 text-xs font-semibold text-ink-3">
          Ends
          <input type="time" value={endTime} disabled={!time} min={time || undefined} onChange={(event) => setEndTime(event.target.value)} className="cx-input disabled:opacity-50" />
        </label>
      </div>
      <p className="-mt-1 text-xs text-ink-3">Leave the time empty for an all-day event.</p>
      <fieldset className="cx-seg" aria-label="Priority">
        {(['must', 'should'] as const).map((p) => (
          <label key={p} data-priority={p} data-on={priority === p}>
            <input type="radio" name={`${id}-priority`} value={p} checked={priority === p} onChange={() => setPriority(p)} className="sr-only" />
            {priorityLabel[p]}
          </label>
        ))}
      </fieldset>
      <label htmlFor={`${id}-note`} className="sr-only">
        Note (optional)
      </label>
      <textarea
        id={`${id}-note`}
        rows={2}
        maxLength={400}
        value={note}
        onChange={(event) => setNote(event.target.value)}
        placeholder="Note (optional)"
        className="cx-input resize-none"
      />
      <p className="text-xs text-ink-3">
        {googleConnected ? 'This also goes on your Google Calendar.' : 'Saved in BearRok. Connect Google Calendar and it goes there too.'}
      </p>
      <button type="submit" disabled={!title.trim() || !date} className="btn-primary px-4 py-2 text-sm text-white disabled:opacity-50">
        {initial ? 'Save changes' : googleConnected ? 'Add to calendar and Google Calendar' : 'Add to calendar'}
      </button>
    </form>
  );
}
