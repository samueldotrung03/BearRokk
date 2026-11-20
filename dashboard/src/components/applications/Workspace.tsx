// The open application: its questions with the writing helper, what to gather, private notes,
// and, once it is sent, a follow-up checklist and practice questions from the posting.
import { ArrowUpRight, Lock, MessageCircleQuestion, NotebookPen, Send } from 'lucide-react';
import { followUpSteps, interviewQuestions } from '../../lib/apps/followup.ts';
import { useLocal } from '../../lib/useLocal.ts';
import { useStore } from '../../state/StoreProvider.tsx';
import { PromptEditor } from './PromptEditor.tsx';
import { ReadinessRing, materialDomId, type Intent, type Item } from './shared.tsx';

export function Workspace({ item, intent }: { item: Item; intent?: Intent }) {
  const { dispatch } = useStore();
  const { opportunity: o, application, info, readiness } = item;
  const [notes, setNotes] = useLocal<string>(`bearrok.applications.notes.${o.id}`, '');
  const applied = application.status === 'applied';

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_288px]">
      <div className="min-w-0 space-y-4">
        {applied && <AfterApplying item={item} />}

        <h3 className="font-semibold tracking-tight">Questions</h3>
        {info?.requiresLogin && (
          <p className="flex gap-2 rounded-xl bg-white p-3 text-sm leading-relaxed text-ink-2">
            <Lock className="mt-0.5 size-4 shrink-0 text-ink-3" aria-hidden="true" />
            The questions are behind a sign-in on the organizer's site, so the agents could not read them. Sign in there to see them.
          </p>
        )}
        {info && info.prompts.length === 0 && !info.requiresLogin && <p className="text-sm text-ink-2">This one has no written questions.</p>}
        {!info && <p className="text-sm text-ink-2">The agents have not read this application page yet.</p>}
        {info?.prompts.map((prompt, index) => (
          <PromptEditor key={prompt} opportunity={o} prompt={prompt} index={index} draft={application.drafts[index] ?? ''} intent={intent} />
        ))}
      </div>

      <aside className="space-y-4">
        <div className="ap-panel">
          <div className="flex items-center gap-3">
            <ReadinessRing score={readiness.score} size={56} />
            <div className="min-w-0 text-sm">
              <p className="font-semibold text-ink">Readiness</p>
              <p className="text-ink-3">
                {readiness.drafts.ready}/{readiness.drafts.total} answers · {readiness.materials.done}/{readiness.materials.total} materials
              </p>
            </div>
          </div>
          <p className="mt-3 text-xs font-semibold tracking-wide text-ink-3 uppercase">Next</p>
          <p className="mt-0.5 text-sm font-semibold text-ink">{readiness.next.label}</p>
          <p className="text-[13px] leading-relaxed text-ink-2">{readiness.next.detail}</p>
        </div>

        <div className="ap-panel">
          <h3 className="font-semibold tracking-tight">What to gather</h3>
          {info && info.materials.length > 0 ? (
            <ul className="mt-2 space-y-0.5">
              {info.materials.map((name) => (
                <li key={name} data-flash className="rounded-lg">
                  <label className="flex min-h-9 cursor-pointer items-center gap-2.5 px-1 text-sm text-ink-2">
                    <input
                      id={materialDomId(o.id, name)}
                      type="checkbox"
                      checked={application.materialsDone.includes(name)}
                      onChange={() => dispatch({ type: 'toggleMaterial', id: o.id, name })}
                      className="size-4 accent-[var(--color-brand)]"
                    />
                    <span className={application.materialsDone.includes(name) ? 'text-ink-3 line-through decoration-ink-3/40' : ''}>{name}</span>
                  </label>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-2 text-sm text-ink-3">Nothing listed on the posting.</p>
          )}
          <a
            href={o.actionUrl ?? o.sourceUrl}
            target="_blank"
            rel="noreferrer"
            onClick={() => dispatch({ type: 'opened', id: o.id })}
            className="btn-primary mt-4 inline-flex h-10 items-center gap-1.5 rounded-xl px-4 text-sm text-white"
          >
            Open the official application
            <ArrowUpRight className="size-4" aria-hidden="true" />
          </a>
          <p className="mt-2 text-xs leading-relaxed text-ink-3">You submit on the organizer's own page. Mark it Applied here once it is sent.</p>
          {!applied && readiness.next.kind === 'submit' && (
            <button
              type="button"
              onClick={() => dispatch({ type: 'setApplication', id: o.id, status: 'applied' })}
              className="mt-3 inline-flex h-9 items-center gap-1.5 rounded-xl border border-line bg-white px-3 text-sm font-semibold text-brand hover:border-brand"
            >
              <Send className="size-4" aria-hidden="true" />
              I sent it, mark Applied
            </button>
          )}
        </div>

        <div className="ap-panel">
          <label htmlFor={`ap-notes-${o.id}`} className="flex items-center gap-2 font-semibold tracking-tight">
            <NotebookPen className="size-4 text-ink-3" aria-hidden="true" />
            Private notes
          </label>
          <textarea
            id={`ap-notes-${o.id}`}
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            rows={3}
            placeholder="Contacts, a referral, what you want to ask. Only on this device."
            className="ap-textarea mt-2 text-sm"
          />
        </div>

        <button
          type="button"
          onClick={() => dispatch({ type: 'setApplication', id: o.id, status: null })}
          className="text-sm font-medium text-ink-3 hover:text-ink"
          aria-label={`Stop tracking ${o.title}`}
        >
          Stop tracking
        </button>
      </aside>
    </div>
  );
}

function AfterApplying({ item }: { item: Item }) {
  const { state } = useStore();
  const { opportunity: o, info } = item;
  const steps = followUpSteps(o, info);
  const questions = interviewQuestions(o, info, state.profile);
  const [ticked, setTicked] = useLocal<string[]>(`bearrok.applications.followups.${o.id}`, []);
  const done = steps.filter((s) => ticked.includes(s.id)).length;

  return (
    <div className="ap-after">
      <div className="flex items-baseline justify-between gap-3">
        <h3 className="font-semibold tracking-tight">After you applied</h3>
        <span className="text-xs text-ink-3 tabular-nums">
          {done} of {steps.length} done
        </span>
      </div>
      <ul className="mt-2 grid gap-0.5 sm:grid-cols-2">
        {steps.map((step) => (
          <li key={step.id}>
            <label className="flex min-h-9 cursor-pointer items-start gap-2.5 py-1 text-sm text-ink-2">
              <input
                type="checkbox"
                checked={ticked.includes(step.id)}
                onChange={() => setTicked((list) => (list.includes(step.id) ? list.filter((id) => id !== step.id) : [...list, step.id]))}
                className="mt-0.5 size-4 shrink-0 accent-[var(--color-brand)]"
              />
              <span className={ticked.includes(step.id) ? 'text-ink-3 line-through decoration-ink-3/40' : ''}>{step.label}</span>
            </label>
          </li>
        ))}
      </ul>
      {questions.length > 0 && (
        <>
          <h4 className="mt-4 flex items-center gap-2 text-sm font-semibold">
            <MessageCircleQuestion className="size-4 text-brand" aria-hidden="true" />
            Practice questions from this posting
          </h4>
          <ol className="mt-2 space-y-2">
            {questions.map((q, i) => (
              <li key={q.question} className="flex gap-3 text-sm">
                <span className="font-display text-lg leading-none text-ink-3">{i + 1}</span>
                <div>
                  <p className="font-medium text-ink">{q.question}</p>
                  <p className="text-xs text-ink-3">{q.from}</p>
                </div>
              </li>
            ))}
          </ol>
        </>
      )}
    </div>
  );
}
