// The roadmap drawn as a road in space: the ground is tilted away from the viewer, the steps
// stand on it as markers, and the view travels along the road to whichever step is in focus.
// Everything is CSS 3D transforms, so there is no extra library and it stays sharp at any size.
import { Check, Flag, Trophy } from 'lucide-react';
import { useMemo, useRef, type CSSProperties, type KeyboardEvent, type PointerEvent } from 'react';
import { curveThrough, layoutPath, type Journey } from '../../lib/roadmapx/journey.ts';
import { stepMeta } from '../meta.ts';

const WIDTH = 1000;
const SPACING = 230;
/** How far up from the near edge the step in focus sits. */
const NEAR = 170;
/** Pixels of drag that move the view by one step. */
const DRAG_STEP = 64;

export function Scene({
  journey,
  focus,
  onFocus,
  burst,
}: {
  journey: Journey;
  /** Step index in focus; steps.length means the goal. */
  focus: number;
  onFocus: (index: number) => void;
  /** A step that was just finished, to play its celebration once. */
  burst: string | null;
}) {
  const { steps } = journey;
  const count = steps.length;
  const { points, length } = useMemo(() => layoutPath(count, WIDTH, SPACING), [count]);
  const road = useMemo(() => curveThrough(points), [points]);
  const tilt = useRef<HTMLDivElement>(null);
  const drag = useRef<{ y: number; from: number; moved: boolean } | null>(null);

  const at = points[Math.min(focus, count)]!;
  const world: CSSProperties = {
    width: WIDTH,
    height: length,
    transform: `translateX(-50%) rotateX(var(--rm3-tilt)) translate3d(${Math.round((WIDTH / 2 - at.x) * 0.75)}px, ${length - NEAR - at.y}px, 0)`,
  };
  const go = (index: number) => onFocus(Math.max(0, Math.min(count, index)));

  const onKey = (event: KeyboardEvent) => {
    if (event.key === 'ArrowUp' || event.key === 'ArrowRight') go(focus + 1);
    else if (event.key === 'ArrowDown' || event.key === 'ArrowLeft') go(focus - 1);
    else if (event.key === 'Home') go(0);
    else if (event.key === 'End') go(count);
    else return;
    event.preventDefault();
  };
  const onMove = (event: PointerEvent<HTMLDivElement>) => {
    const box = event.currentTarget.getBoundingClientRect();
    // The ground leans a little toward the pointer, which is what makes it read as a space.
    tilt.current?.style.setProperty('--px', (((event.clientX - box.left) / box.width) * 2 - 1).toFixed(3));
    tilt.current?.style.setProperty('--py', (((event.clientY - box.top) / box.height) * 2 - 1).toFixed(3));
    if (!drag.current) return;
    const steps = Math.round((event.clientY - drag.current.y) / DRAG_STEP);
    if (steps !== 0) drag.current.moved = true;
    go(drag.current.from + steps);
  };

  return (
    <div
      className="rm3-scene"
      tabIndex={0}
      role="group"
      aria-label={`Your path to ${journey.goal}. Use the arrow keys to move along it.`}
      onKeyDown={onKey}
      onPointerMove={onMove}
      onPointerDown={(event) => (drag.current = { y: event.clientY, from: focus, moved: false })}
      onPointerUp={() => (drag.current = null)}
      onPointerLeave={() => {
        drag.current = null;
        tilt.current?.style.setProperty('--px', '0');
        tilt.current?.style.setProperty('--py', '0');
      }}
    >
      <div className="rm3-sky" aria-hidden="true" />
      <div className="rm3-tilt" ref={tilt}>
        <div className="rm3-world" style={world}>
          <div className="rm3-ground" aria-hidden="true" />
          <svg className="rm3-road" width={WIDTH} height={length} viewBox={`0 0 ${WIDTH} ${length}`} aria-hidden="true">
            <defs>
              <linearGradient id="rm3-walked" x1="0" y1="1" x2="0" y2="0">
                <stop offset="0%" style={{ stopColor: 'var(--rm3-accent)' }} />
                <stop offset="45%" stopColor="#4aa8ff" />
                <stop offset="100%" stopColor="#37d6a0" />
              </linearGradient>
            </defs>
            <path className="rm3-road-edge" d={road} />
            <path className="rm3-road-base" d={road} />
            <path className="rm3-road-dash" d={road} />
            <path className="rm3-road-walked" d={road} pathLength={100} strokeDasharray={`${count ? (Math.min(journey.nextIndex, count) / count) * 100 : 0} 100`} />
          </svg>

          {journey.phases.map((phase) => {
            const p = points[phase.from]!;
            const left = p.x < WIDTH / 2;
            return (
              <div key={phase.id} className={`rm3-phase ${left ? 'is-right' : 'is-left'}`} style={{ left: p.x + (left ? 230 : -230), top: p.y - 30 }} aria-hidden="true">
                <span>{phase.window}</span>
                {phase.title}
              </div>
            );
          })}

          {points.map((p, i) => {
            const step = steps[i];
            const state = !step ? 'goal' : step.done ? 'done' : i === journey.nextIndex ? 'next' : 'todo';
            return <div key={`disc-${i}`} className={`rm3-disc is-${state} ${i === focus ? 'is-focus' : ''}`} style={{ left: p.x, top: p.y }} aria-hidden="true" />;
          })}

          {points.map((p, i) => {
            const step = steps[i];
            const away = i - focus;
            // Markers behind the viewer are gone; far ones thin out into the distance.
            const hidden = away < -1;
            const opacity = hidden ? 0 : away === -1 ? 0.35 : Math.max(0.25, 1 - Math.max(0, away - 2) * 0.16);
            const state = !step ? 'goal' : step.done ? 'done' : i === journey.nextIndex ? 'next' : 'todo';
            const Icon = !step ? (journey.percent === 100 ? Trophy : Flag) : step.done ? Check : stepMeta[step.kind].icon;
            return (
              <button
                key={step?.id ?? 'goal'}
                type="button"
                className={`rm3-pin is-${state} ${i === focus ? 'is-focus' : ''} ${step && burst === step.id ? 'is-burst' : ''}`}
                style={{ left: p.x, top: p.y, opacity, pointerEvents: hidden ? 'none' : undefined, '--i': i } as CSSProperties}
                tabIndex={hidden ? -1 : 0}
                aria-current={i === focus ? 'step' : undefined}
                aria-label={step ? `Step ${i + 1} of ${count}: ${step.title}${step.done ? ', done' : ''}` : `Goal: ${journey.goal}`}
                onClick={(event) => {
                  // A drag that ends on a marker is travel, not a choice.
                  if (drag.current?.moved) return;
                  event.stopPropagation();
                  go(i);
                }}
              >
                <span className="rm3-label">
                  <small>{step ? `Step ${i + 1}` : journey.percent === 100 ? 'Reached' : 'Your goal'}</small>
                  {step ? step.title : journey.goal}
                </span>
                <span className="rm3-orb">
                  <Icon aria-hidden="true" />
                </span>
                <span className="rm3-stem" aria-hidden="true" />
              </button>
            );
          })}
        </div>
      </div>
      <div className="rm3-fog" aria-hidden="true" />
      <p className="rm3-hint" aria-hidden="true">
        Drag, use the arrow keys, or click a marker
      </p>
    </div>
  );
}
