import { useId } from 'react';
import type { ArtId } from '../data/opportunities.ts';

const scenes: Record<ArtId, { sky: [string, string]; land: string; accent: string; ink: string }> = {
  codepath: { sky: ['#7ec8ff', '#1d4e89'], land: '#123a63', accent: '#f6c453', ink: '#e8f4ff' },
  berkeley: { sky: ['#f4d35e', '#2f6fad'], land: '#1d4e89', accent: '#f2a65a', ink: '#fff7e6' },
  mlh: { sky: ['#2a2154', '#e85d75'], land: '#1b1638', accent: '#7cf0c6', ink: '#ffe8ef' },
  suli: { sky: ['#d7fff4', '#0f6e6e'], land: '#0c3d40', accent: '#f2d16b', ink: '#e7fffb' },
  club: { sky: ['#b7f0d8', '#1f7a5c'], land: '#14543f', accent: '#ffe08a', ink: '#f3fff8' },
  competition: { sky: ['#ffd29d', '#c4552b'], land: '#6d2b16', accent: '#fff4d6', ink: '#fff8ef' },
  scholarship: { sky: ['#ffd0dc', '#9d3458'], land: '#5c1d36', accent: '#ffe9a8', ink: '#fff5f7' },
  event: { sky: ['#c9d4ff', '#3d4c9a'], land: '#242c5c', accent: '#ffb4a2', ink: '#f4f6ff' },
  internship: { sky: ['#d5e8ff', '#245bd8'], land: '#16357a', accent: '#9ad0ff', ink: '#f5f9ff' },
  research: { sky: ['#e4e0ff', '#4c3d8f'], land: '#2c2458', accent: '#b8f2e6', ink: '#f7f5ff' },
};

export function Artwork({ id, title }: { id: ArtId; title: string }) {
  const uid = useId().replace(/:/g, '');
  const scene = scenes[id];
  return (
    <svg viewBox="0 0 1600 900" role="img" aria-label={title}>
      <defs>
        <linearGradient id={`${uid}-sky`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={scene.sky[0]} />
          <stop offset="100%" stopColor={scene.sky[1]} />
        </linearGradient>
      </defs>
      <rect width="1600" height="900" fill={`url(#${uid}-sky)`} />
      <circle cx="1280" cy="180" r="90" fill={scene.accent} opacity="0.9" />
      <path d="M0 640 C280 560 420 720 760 640 C1100 560 1280 700 1600 600 V900 H0 Z" fill={scene.land} />
      <g transform="translate(180 250)">
        <rect width="520" height="330" rx="28" fill={scene.ink} />
        <rect x="36" y="36" width="448" height="190" rx="16" fill={scene.sky[1]} opacity="0.85" />
        <rect x="70" y="70" width="150" height="14" rx="7" fill={scene.accent} />
        <rect x="70" y="104" width="280" height="10" rx="5" fill={scene.ink} opacity="0.8" />
        <rect x="70" y="128" width="220" height="10" rx="5" fill={scene.ink} opacity="0.55" />
        <rect x="36" y="250" width="120" height="44" rx="12" fill={scene.accent} />
      </g>
      <g transform="translate(820 300)">
        <rect width="460" height="280" rx="24" fill={scene.ink} opacity="0.92" />
        <rect x="40" y="48" width="70" height="150" rx="10" fill={scene.accent} />
        <rect x="140" y="90" width="70" height="108" rx="10" fill={scene.sky[0]} />
        <rect x="240" y="60" width="70" height="138" rx="10" fill={scene.sky[1]} />
        <rect x="340" y="110" width="70" height="88" rx="10" fill={scene.accent} opacity="0.75" />
      </g>
      <circle cx="250" cy="760" r="46" fill={scene.accent} />
      <circle cx="360" cy="770" r="46" fill={scene.ink} />
      <rect x="230" y="800" width="160" height="70" rx="20" fill={scene.land} />
    </svg>
  );
}

export function Cover({ id, title }: { id: ArtId; title: string }) {
  return (
    <div className="cover">
      <div className="cover-fill" aria-hidden="true">
        <Artwork id={id} title="" />
      </div>
      <div className="cover-whole">
        <Artwork id={id} title={title} />
      </div>
    </div>
  );
}
