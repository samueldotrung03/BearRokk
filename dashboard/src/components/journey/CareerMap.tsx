// A career as a board to pick from, not a path to walk. Every option sits in the open, grouped
// by the kind of thing it is; the student adds the ones they want to their own path, and can
// see the different mixes real people got in with, to show that no one thing is required.
import { ArrowRight, Check, Compass, Pencil, Plus, X } from 'lucide-react';
import { useState, type CSSProperties } from 'react';
import type { Journey } from '../../lib/roadmapx/journey.ts';
import { stepMeta } from '../meta.ts';

export function CareerMap({
  journey,
  focus,
  onFocus,
  picked,
  onPick,
  onRename,
  onBuild,
}: {
  journey: Journey;
  focus: number;
  onFocus: (index: number) => void;
  /** Ids of the options the student added to their own path. */
  picked: string[];
  onPick: (id: string) => void;
  /** Saves the student's own wording of where this is headed; empty puts the usual wording back. */
  onRename: (goal: string) => void;
  /** Done choosing: turn the picks into a roadmap. */
  onBuild: () => void;
}) {
  const count = journey.steps.length;
  const [mixId, setMixId] = useState<string | null>(null);
  const [editing, setEditing] = useState<string | null>(null);
  const save = () => {
    if (editing !== null && editing.trim() !== journey.goal) onRename(editing.trim());
    setEditing(null);
  };
  const people = journey.analysis.stories.filter((story) => story.did && story.did.length > 0);
  const mix = people.find((story) => story.id === mixId) ?? null;
  const inMix = new Set(mix?.did ?? []);
  const mine = journey.steps.filter((step) => picked.includes(step.id));
  const skipped = mix ? journey.phases.filter((phase) => !journey.steps.slice(phase.from, phase.from + phase.count).some((s) => inMix.has(s.id))).map((phase) => phase.title.toLowerCase()) : [];

  return (
    <div className={`rm3-board ${mix ? 'is-mixing' : ''}`} role="group" aria-label={`Options toward ${journey.goal}. Pick any mix.`}>
      <header className="rm3-board-top">
        {editing === null ? (
          <div className={`rm3-board-goal ${focus === count ? 'is-focus' : ''}`}>
            <button type="button" onClick={() => onFocus(count)}>
              <Compass aria-hidden="true" />
              <span>
                <small>Toward</small>
                {journey.goal}
              </span>
            </button>
            <button type="button" className="rm3-board-edit" onClick={() => setEditing(journey.goal)} aria-label="Change what this is headed toward" title="Put it in your own words">
              <Pencil aria-hidden="true" />
            </button>
          </div>
        ) : (
          <form
            className="rm3-board-goal is-editing"
            onSubmit={(event) => {
              event.preventDefault();
              save();
            }}
          >
            <Compass aria-hidden="true" />
            <label>
              <small>Toward</small>
              <input
                ref={(input) => input?.focus({ preventScroll: true })}
                value={editing}
                maxLength={120}
                onChange={(event) => setEditing(event.target.value)}
                onBlur={save}
                onKeyDown={(event) => event.key === 'Escape' && setEditing(null)}
                placeholder="Where do you want this to lead?"
                aria-label="What this roadmap is headed toward"
              />
            </label>
            <button type="submit" className="rm3-board-edit" aria-label="Save" onMouseDown={(event) => event.preventDefault()}>
              <Check aria-hidden="true" />
            </button>
          </form>
        )}
        <p>
          There is no one way in. Pick any mix of these that suits you; nothing here is a must, and people got in having skipped whole sections.
        </p>
      </header>

      {people.length > 0 && (
        <div className="rm3-mixes">
          <p>See the mix that worked for someone</p>
          <div>
            {people.map((story, i) => (
              <button key={story.id} type="button" aria-pressed={story.id === mixId} onClick={() => setMixId(story.id === mixId ? null : story.id)}>
                <b>{i + 1}</b>
                {story.outcome}
              </button>
            ))}
          </div>
          {mix && (
            <p className="rm3-mix-note" role="status">
              This person did {inMix.size} of the {count} options here{skipped.length ? `, and none under ${skipped.join(' or ')}` : ''}. Theirs are lit up below.
            </p>
          )}
        </div>
      )}

      <div className="rm3-mine" aria-live="polite">
        <strong>
          My path <span>{mine.length}</span>
        </strong>
        {mine.length > 0 && (
          <button type="button" className="rm3-build" onClick={onBuild}>
            Build my roadmap <ArrowRight aria-hidden="true" />
          </button>
        )}
        {mine.length === 0 ? (
          <p>Empty for now. Press the plus on anything you want to do, in any order, and change your mind whenever you like.</p>
        ) : (
          <ul>
            {mine.map((step) => (
              <li key={step.id} className={step.done ? 'is-done' : ''}>
                <button type="button" onClick={() => onFocus(step.index)}>
                  {step.done && <Check aria-hidden="true" />}
                  {step.title}
                </button>
                <button type="button" onClick={() => onPick(step.id)} aria-label={`Take ${step.title} off my path`}>
                  <X aria-hidden="true" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="rm3-clusters">
        {journey.phases.map((phase, p) => (
          <section key={phase.id} style={{ '--p': p } as CSSProperties}>
            <h3>
              {phase.title} <span>{phase.count}</span>
              <em>pick any, or none</em>
            </h3>
            <ul>
              {journey.steps.slice(phase.from, phase.from + phase.count).map((step) => {
                const Icon = step.done ? Check : stepMeta[step.kind].icon;
                const on = picked.includes(step.id);
                return (
                  <li key={step.id} style={{ '--i': step.index - phase.from } as CSSProperties} className={`${on ? 'is-on' : ''} ${step.done ? 'is-done' : ''} ${step.index === focus ? 'is-focus' : ''} ${mix ? (inMix.has(step.id) ? 'is-lit' : 'is-dim') : ''}`}>
                    <button type="button" className="rm3-opt" onClick={() => onFocus(step.index)} aria-current={step.index === focus ? 'true' : undefined}>
                      <i>
                        <Icon aria-hidden="true" />
                      </i>
                      <span>
                        {step.title}
                        {step.strength && <small>{step.strength}</small>}
                      </span>
                    </button>
                    <button type="button" className="rm3-add" aria-pressed={on} aria-label={on ? `Take ${step.title} off my path` : `Add ${step.title} to my path`} onClick={() => onPick(step.id)}>
                      {on ? <Check aria-hidden="true" /> : <Plus aria-hidden="true" />}
                    </button>
                  </li>
                );
              })}
            </ul>
          </section>
        ))}
      </div>
      {count === 0 && <p className="rm3-board-empty">Nothing is mapped for this career yet.</p>}
    </div>
  );
}
