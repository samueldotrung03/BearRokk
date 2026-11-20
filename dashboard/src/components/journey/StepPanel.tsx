// The card beside the road: everything about the step in focus. What to do, what to master,
// where to learn it, why it is on the path, and the button that finishes it.
import { ArrowLeft, ArrowRight, BookOpen, MessageCircle, Check, Clock, ExternalLink, Flag, GraduationCap, RotateCcw, Sparkles, Users } from 'lucide-react';
import { dueWords, formatHours } from '../../lib/roadmapx/context.ts';
import { sourceLabel, type Journey, type JourneySkill } from '../../lib/roadmapx/journey.ts';
import { askAssistant } from '../Assistant.tsx';
import { stepMeta } from '../meta.ts';

export function SkillChips({ skills }: { skills: JourneySkill[] }) {
  return (
    <ul className="rm3-skills">
      {skills.map((skill) => (
        <li key={skill.label} className={`${skill.have ? 'is-have' : ''} ${skill.core ? 'is-core' : ''}`} title={skill.have ? 'You have this' : skill.core ? 'Most postings ask for this' : 'Helps, but asked for less often'}>
          {skill.have && <Check aria-hidden="true" />}
          {skill.label}
        </li>
      ))}
    </ul>
  );
}

export function StepPanel({
  journey,
  focus,
  onFocus,
  onToggle,
  onOpen,
  onSkip,
  picked = [],
  onPick,
  ticked = [],
  onTick,
  now,
}: {
  journey: Journey;
  focus: number;
  onFocus: (index: number) => void;
  onToggle: (stepId: string) => void;
  onOpen: (opportunityId: string) => void;
  /** Set a recommendation aside as not for this student. */
  onSkip: (stepId: string) => void;
  /** Options on the student's own path, and the way to add or remove one. Open journeys only. */
  picked?: string[];
  onPick?: (stepId: string) => void;
  /** Things-to-do the student ticked inside a step, as "<step id>#<position>". */
  ticked?: string[];
  onTick?: (id: string) => void;
  now: number;
}) {
  const count = journey.steps.length;
  const step = journey.steps[focus];
  const nav = (
    <div className="rm3-nav">
      <button type="button" onClick={() => onFocus(focus - 1)} disabled={focus <= 0} aria-label="Previous step">
        <ArrowLeft aria-hidden="true" />
      </button>
      <span>{step ? `${journey.open ? 'Option ' : ''}${focus + 1} of ${count}` : 'Goal'}</span>
      <button type="button" onClick={() => onFocus(focus + 1)} disabled={focus >= count} aria-label="Next step">
        <ArrowRight aria-hidden="true" />
      </button>
    </div>
  );

  if (!step) {
    const reached = journey.percent === 100;
    return (
      <aside className="rm3-panel" aria-live="polite">
        <div className="rm3-panel-top">
          <span className="rm3-kind is-goal">
            <Flag aria-hidden="true" /> {reached ? 'Reached' : 'Where this leads'}
          </span>
          {nav}
        </div>
        <h2 className="rm3-title">{journey.goal}</h2>
        <p className="rm3-detail">{journey.summary}</p>
        <div className="rm3-facts">
          <span>
            <Check aria-hidden="true" /> {journey.open ? `${journey.doneCount} of ${count} options done` : `${journey.doneCount} of ${count} steps done`}
          </span>
          {!reached && !journey.open && journey.hoursLeft > 0 && (
            <span>
              <Clock aria-hidden="true" /> About {formatHours(journey.hoursLeft)} left
            </span>
          )}
        </div>
        {journey.skills.length > 0 && (
          <section>
            <h3>
              <GraduationCap aria-hidden="true" /> {journey.open ? 'What people on this path tend to have' : 'What you will have mastered'}
            </h3>
            <SkillChips skills={journey.skills} />
          </section>
        )}
        {journey.open && count > 0 && <p className="rm3-note">Nothing here is required and there is no order. Add the options that sound like you to your path and leave the rest.</p>}
        {!reached && count > 0 && (
          <button type="button" className="rm3-primary" onClick={() => onFocus(journey.nextIndex)}>
            {journey.open ? 'Start with the most common option' : 'Go to your next step'} <ArrowRight aria-hidden="true" />
          </button>
        )}
      </aside>
    );
  }

  const meta = stepMeta[step.kind];
  const Kind = meta.icon;
  const phase = journey.phases.find((p) => p.id === step.phaseId);
  return (
    <aside className="rm3-panel" aria-live="polite" key={step.id}>
      <div className="rm3-panel-top">
        <span className={`rm3-kind ${step.done ? 'is-done' : ''}`}>
          <Kind aria-hidden="true" /> {step.done ? 'Done' : meta.label}
        </span>
        {nav}
      </div>
      <p className="rm3-phase-line">
        <b className={`is-${step.source}`}>{sourceLabel[step.source]}</b>
        {step.strength ? ` · ${step.strength}` : ''}
        {phase && phase.title !== sourceLabel[step.source] ? ` · ${phase.title}` : ''}
      </p>
      <h2 className="rm3-title">{step.title}</h2>
      <p className="rm3-detail">{step.detail}</p>

      <div className="rm3-facts">
        {step.hours > 0 && (
          <span>
            <Clock aria-hidden="true" /> About {formatHours(step.hours)}
          </span>
        )}
        {step.due && !step.done && !journey.open && (
          <span>
            <Flag aria-hidden="true" /> {dueWords(step.due, now).replace(/^./, (c) => c.toUpperCase())}
          </span>
        )}
        {step.evidence && (
          <span>
            <Users aria-hidden="true" /> {step.evidence.count} of {step.evidence.total} did this
          </span>
        )}
      </div>

      {step.skills.length > 0 && (
        <section>
          <h3>
            <GraduationCap aria-hidden="true" /> Master
          </h3>
          <SkillChips skills={step.skills} />
        </section>
      )}

      {(step.resources.length > 0 || (step.kind === 'learn' && step.skills.length > 0)) && (
        <section>
          <h3>
            <BookOpen aria-hidden="true" /> Courses and resources
          </h3>
          {step.resources.length > 0 ? (
            <ul className="rm3-links">
              {step.resources.map((resource) => (
                <li key={resource.url}>
                  <a href={resource.url} target="_blank" rel="noreferrer">
                    {resource.label} <ExternalLink aria-hidden="true" />
                  </a>
                </li>
              ))}
            </ul>
          ) : (
            <p className="rm3-note">
              No specific course is on file for this step. Look in your school's catalog for a class on {step.skills[0]!.label.toLowerCase()}, or ask an advisor which one students usually take.
            </p>
          )}
        </section>
      )}

      {step.actions && step.actions.length > 0 && (
        <section>
          <h3>
            <Check aria-hidden="true" /> What to do
          </h3>
          <ol className="rm3-todo">
            {step.actions.map((line, i) => {
              const id = `${step.id}#${i}`;
              const on = step.done || ticked.includes(id);
              return (
                <li key={id}>
                  <button type="button" role="checkbox" aria-checked={on} disabled={step.done} onClick={() => onTick?.(id)}>
                    <i>{on ? <Check aria-hidden="true" /> : i + 1}</i>
                    <span>{line}</span>
                  </button>
                </li>
              );
            })}
          </ol>
        </section>
      )}

      {step.why.length > 0 && (
        <section>
          <h3>
            <Sparkles aria-hidden="true" /> Why it is on your path
          </h3>
          {step.why.map((line) => (
            <p key={line} className="rm3-note">
              {line}
            </p>
          ))}
        </section>
      )}

      <div className="rm3-actions">
        {journey.open && onPick && !step.done && (
          <button type="button" className={picked.includes(step.id) ? 'rm3-quiet' : 'rm3-primary'} onClick={() => onPick(step.id)}>
            {picked.includes(step.id) ? 'On my path. Take it off' : 'Add to my path'}
          </button>
        )}
        <button type="button" className={step.done || journey.open ? 'rm3-quiet' : 'rm3-primary'} onClick={() => onToggle(step.id)}>
          {step.done ? (
            <>
              <RotateCcw aria-hidden="true" /> Mark not done
            </>
          ) : (
            <>
              <Check aria-hidden="true" /> {journey.open ? 'I have done this' : 'Mark done'}
            </>
          )}
        </button>
        {journey.plan && onPick && !step.done && (
          <button type="button" className="rm3-quiet" onClick={() => onPick(step.id)} title="Take this off your roadmap">
            Take it off my roadmap
          </button>
        )}
        {step.source === 'people' && !step.done && !journey.plan && (
          <button type="button" className="rm3-quiet" onClick={() => onSkip(step.id)} title="Take this recommendation off your roadmap">
            Not for me
          </button>
        )}
        <button type="button" className="rm3-quiet" onClick={() => askAssistant(`For my goal "${journey.goal}", tell me more about "${step.title}": how to start, how long it takes, and whether it suits me.`)} title="Ask the assistant about this">
          <MessageCircle aria-hidden="true" /> Ask about this
        </button>
        {step.opportunity && (
          <button type="button" className="rm3-quiet" onClick={() => onOpen(step.opportunity!.id)}>
            Open {step.opportunity.title.length > 26 ? 'the posting' : step.opportunity.title}
          </button>
        )}
      </div>
    </aside>
  );
}
