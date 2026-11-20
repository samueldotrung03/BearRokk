// Grok-style bots for the agent map, after Grok's own agent icons: a flat coloured shape with two
// small slanted eyes, labelled with the agent's name under it. Each level of the agent system has
// its own shape and colour. A bot shows its agent's state with a small animation (blinking when
// idle, bouncing and glancing while working, dimmed while waiting, a hop when done). Styles and
// keyframes are in src/styles/agents.css under 'Grok bots'.
import type { CSSProperties, ReactNode } from 'react';
import type { Level, NodeStatus } from '../../lib/agents/engine.ts';

/** A stable delay per bot, so a row of bots does not blink in step. */
function delayFor(seed: string) {
  let h = 0;
  for (const ch of seed) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return `${-((h % 4000) / 1000)}s`;
}

/** Shape, colour and where the eyes sit, per level. */
const BOTS: Record<
  Level,
  { color: string; shape: ReactNode; eyes: [number, number] }
> = {
  // Orange circle.
  master: {
    color: '#f2702a',
    shape: <circle cx='20' cy='20' r='17' />,
    eyes: [21, 11.5],
  },
  // Blue cloud of three lobes.
  manager: {
    color: '#3f7bf5',
    shape: (
      <g>
        <circle cx='13' cy='23' r='10' />
        <circle cx='24' cy='14.5' r='10' />
        <circle cx='27' cy='25.5' r='9.5' />
        <circle cx='20' cy='22' r='9' />
      </g>
    ),
    eyes: [22.5, 11],
  },
  // Blue rounded square, tipped over.
  worker: {
    color: '#2f6ff0',
    shape: (
      <rect
        x='6'
        y='6'
        width='28'
        height='28'
        rx='8'
        transform='rotate(-14 20 20)'
      />
    ),
    eyes: [21, 11.5],
  },
  // Green rounded triangle.
  validator: {
    color: '#3cbf6a',
    shape: (
      <path
        d='M10.5 8.5 33 20.5 10.5 32.5Z'
        strokeWidth='9'
        strokeLinejoin='round'
      />
    ),
    eyes: [17.5, 13.5],
  },
  // Pink flower of four lobes.
  presenter: {
    color: '#ea4c97',
    shape: (
      <g>
        <circle cx='13.5' cy='14' r='8.6' />
        <circle cx='26' cy='13' r='8.6' />
        <circle cx='13' cy='26.5' r='8.6' />
        <circle cx='26.5' cy='26' r='8.6' />
        <circle cx='20' cy='20' r='9' />
      </g>
    ),
    eyes: [19.5, 12.5],
  },
};

export function GrokBot({
  level,
  status = 'idle',
  size = 32,
  seed = level,
  label,
}: {
  level: Level;
  status?: NodeStatus;
  size?: number;
  seed?: string;
  label?: string;
}) {
  const bot = BOTS[level];
  const [x, y] = bot.eyes;
  const style = {
    '--gk-delay': delayFor(seed),
    color: bot.color,
  } as CSSProperties;
  return (
    <svg
      className='gk-bot'
      data-level={level}
      data-status={status}
      width={size}
      height={size}
      viewBox='0 0 40 40'
      style={style}
      role={label ? 'img' : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
    >
      <g className='gk-bot-body'>
        <g
          className='gk-shape'
          fill='currentColor'
          stroke='currentColor'
          strokeWidth='0'
        >
          {bot.shape}
        </g>
        <g className='gk-eyes'>
          <path className='gk-eye' d={`M${x} ${y}l-0.9 4.2`} />
          <path className='gk-eye' d={`M${x + 4.6} ${y}l-0.9 4.2`} />
        </g>
      </g>
    </svg>
  );
}
