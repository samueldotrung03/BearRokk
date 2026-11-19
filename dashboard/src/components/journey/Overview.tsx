// The whole roadmap on one quiet screen: each phase a column, each step a dot on its thread.
// For seeing the scope at a glance; the 3D journey is for travelling it.
import { Check, Flag } from 'lucide-react';
import type { CSSProperties } from 'react';
import { formatHours } from '../../lib/roadmapx/context.ts';
import { sourceLabel, type Journey } from '../../lib/roadmapx/journey.ts';

export function Overview({ journey, focus, onFocus }: { journey: Journey; focus: number; onFocus: (index: number) => void }) {
  const count = journey.steps.length;
  return (
    <div className="rm3-over">
      <ol className="rm3-over-phases">
        {journey.phases.map((phase, p) => {
          const steps = journey.steps.slice(phase.from, phase.from + phase.count);
          return (
            <li key={phase.id} style={{ '--p': p } as CSSProperties}>
              <header>
                <span>{phase.window}</span>
                <h3>{phase.title}</h3>
                <em>
                  {steps.filter((s) => s.done).length} of {steps.length}
                </em>
              </header>
              <ul>
                {steps.map((step) => (
                  <li key={step.id}>
                    <button
                      type="button"
                      className={`${step.done ? 'is-done' : ''} ${!journey.open && step.index === journey.nextIndex ? 'is-next' : ''} ${step.index === focus ? 'is-focus' : ''}`}
                      aria-current={step.index === focus ? 'step' : undefined}
                      onClick={() => onFocus(step.index)}
                    >
                      <i aria-hidden="true">{step.done && <Check />}</i>
                      <span>{step.title}</span>
                      <small>
                        {step.strength ?? sourceLabel[step.source]}
                        {step.hours > 0 && ` · ${formatHours(step.hours)}`}
                      </small>
                    </button>
                  </li>
                ))}
              </ul>
            </li>
          );
        })}
      </ol>
      <button type="button" className={`rm3-over-goal ${focus === count ? 'is-focus' : ''}`} onClick={() => onFocus(count)}>
        <Flag aria-hidden="true" />
        <span>
          <small>{journey.percent === 100 ? 'Reached' : 'Where it leads'}</small>
          {journey.goal}
        </span>
      </button>
    </div>
  );
}
