// The selected day: its items grouped into have-to and should, each with why it is there, plus
// the plan's suggestions for that day, a warning when commitments clash, and the student's own items.
import { ArrowUpRight, CalendarPlus, Check, Pencil, Plus, Trash, TriangleExclamationPoint, X } from 'lucide-react';
import { useId, useState, type FormEvent } from 'react';
import { Link } from 'react-router';
import { opportunities } from '../../data/sample.ts';
import type { Priority } from '../../lib/calendar.ts';
import { dayLabel, hoursLabel, longDay } from '../../lib/cal/days.ts';
import { googleUrlFor } from '../../lib/cal/export.ts';
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
}) {
  const [editing, setEditing] = useState<string | 'new' | null>(null);
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
            const list = items.filter((item) => item.priority === priority);
            if (list.length === 0) return null;
            return (
              <section key={priority}>
                <h3 className="cal-group" data-priority={priority}>
                  {priorityLabel[priority]}
                  <span>{list.length}</span>
                </h3>
                <ul className="mt-2 grid gap-2">
                  {list.map((item) => (
                    <Item key={item.id} item={item} today={today} onOpen={onOpen} actions={actions} onEdit={setEditing} />
                  ))}
                </ul>
              </section>
            );
          })}
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

      {editing ? (
        <PersonalForm
          key={editing}
          initial={editItem}
          onCancel={() => setEditing(null)}
          onSave={(fields) => {
            if (editItem) actions.update(editItem.id, fields);
            else actions.add({ ...fields, day });
            setEditing(null);
          }}
        />
      ) : (
        <button type="button" onClick={() => setEditing('new')} className="cx-add mt-4">
          <Plus className="size-4" aria-hidden="true" /> Add your own to {label === 'Today' ? 'today' : 'this day'}
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
}: {
  item: CxItem;
  today: string;
  onOpen: (o: Opportunity) => void;
  actions: PersonalActions;
  onEdit: (id: string) => void;
}) {
  const { dispatch } = useStore();
  const opportunity = item.opportunityId ? opportunities.find((o) => o.id === item.opportunityId) : undefined;
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
          {item.hours ? `Work block · ${hoursLabel(item.hours)}` : cxKindLabel[item.kind]}
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
          <a
            href={googleUrlFor(item, opportunity)}
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-1 text-ink-3 hover:text-brand"
            aria-label={`Add "${item.title}" to Google Calendar`}
          >
            <CalendarPlus className="size-3.5" aria-hidden="true" /> Google
          </a>
        </div>
        {item.hours !== null && item.day < today && !item.done && (
          <p className="mt-1 text-xs text-ink-3">This block went by unticked, so the plan counts it as not done and finds new time.</p>
        )}
      </div>
    </li>
  );
}

function PersonalForm({
  initial,
  onSave,
  onCancel,
}: {
  initial: PersonalItem | undefined;
  onSave: (fields: { title: string; priority: Priority; note: string }) => void;
  onCancel: () => void;
}) {
  const id = useId();
  const [title, setTitle] = useState(initial?.title ?? '');
  const [priority, setPriority] = useState<Priority>(initial?.priority ?? 'should');
  const [note, setNote] = useState(initial?.note ?? '');
  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!title.trim()) return;
    onSave({ title: title.trim(), priority, note: note.trim() });
  };
  return (
    <form onSubmit={submit} className="cx-form cx-fade mt-4" onKeyDown={(event) => event.key === 'Escape' && onCancel()}>
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold">{initial ? 'Edit your item' : 'Add your own'}</p>
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
      <button type="submit" disabled={!title.trim()} className="btn-primary px-4 py-2 text-sm text-white disabled:opacity-50">
        {initial ? 'Save changes' : 'Add to calendar'}
      </button>
    </form>
  );
}
