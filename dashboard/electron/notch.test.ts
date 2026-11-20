import { createRequire } from 'node:module';
import { describe, expect, it } from 'vitest';

type Rect = { x: number; y: number; width: number; height: number };
type Display = { bounds: Rect; workArea?: Rect };
type Action = { type: string; path?: string };

// notch.cjs only loads Electron inside mount, so its helpers load in plain Node.
const notch = createRequire(import.meta.url)('./notch.cjs') as {
  inNotch: (point: { x: number; y: number }, display: Display) => boolean;
  panelBounds: (display: Display, size: { width: number; height: number }) => Rect;
  cleanAction: (action: unknown) => Action | null;
  clampHeight: (height: unknown) => number | null;
  within: (point: { x: number; y: number }, rect: Rect, margin?: number) => boolean;
};

const laptop: Display = {
  bounds: { x: 0, y: 0, width: 1512, height: 982 },
  workArea: { x: 0, y: 38, width: 1512, height: 944 },
};
// A second screen placed to the left of and above the laptop's.
const secondary: Display = {
  bounds: { x: -1920, y: -200, width: 1920, height: 1080 },
  workArea: { x: -1920, y: -175, width: 1920, height: 1055 },
};

describe('inNotch', () => {
  it('is true at the top centre of the screen', () => {
    expect(notch.inNotch({ x: 756, y: 0 }, laptop)).toBe(true);
    expect(notch.inNotch({ x: 756 + 130, y: 5 }, laptop)).toBe(true);
    expect(notch.inNotch({ x: 756 - 130, y: 2 }, laptop)).toBe(true);
  });

  it('is false off to the side of the notch', () => {
    expect(notch.inNotch({ x: 756 + 131, y: 0 }, laptop)).toBe(false);
    expect(notch.inNotch({ x: 100, y: 0 }, laptop)).toBe(false);
  });

  it('is false below the top strip', () => {
    expect(notch.inNotch({ x: 756, y: 6 }, laptop)).toBe(false);
    expect(notch.inNotch({ x: 756, y: 300 }, laptop)).toBe(false);
  });

  it('works on a display whose bounds do not start at zero', () => {
    expect(notch.inNotch({ x: -960, y: -200 }, secondary)).toBe(true);
    expect(notch.inNotch({ x: -960, y: -194 }, secondary)).toBe(false);
    expect(notch.inNotch({ x: 960, y: -200 }, secondary)).toBe(false);
    // The laptop's own notch is not the other screen's hot zone.
    expect(notch.inNotch({ x: 756, y: 0 }, secondary)).toBe(false);
  });

  it('is false for missing input', () => {
    expect(notch.inNotch(undefined as never, laptop)).toBe(false);
    expect(notch.inNotch({ x: 756, y: 0 }, undefined as never)).toBe(false);
  });
});

describe('panelBounds', () => {
  it('centres the panel under the menu bar', () => {
    expect(notch.panelBounds(laptop, { width: 420, height: 600 })).toEqual({ x: 546, y: 38, width: 420, height: 600 });
  });

  it('uses the display offset', () => {
    expect(notch.panelBounds(secondary, { width: 420, height: 300 })).toEqual({ x: -1170, y: -175, width: 420, height: 300 });
  });

  it('falls back to a standard menu bar height without a usable work area', () => {
    expect(notch.panelBounds({ bounds: laptop.bounds }, { width: 420, height: 600 }).y).toBe(38);
    const hiddenMenuBar = { bounds: laptop.bounds, workArea: { ...laptop.bounds } };
    expect(notch.panelBounds(hiddenMenuBar, { width: 420, height: 600 }).y).toBe(38);
  });
});

describe('cleanAction', () => {
  it('passes run, stop and in-app paths', () => {
    expect(notch.cleanAction({ type: 'run', extra: 1 })).toEqual({ type: 'run' });
    expect(notch.cleanAction({ type: 'stop' })).toEqual({ type: 'stop' });
    expect(notch.cleanAction({ type: 'open', path: '/saved' })).toEqual({ type: 'open', path: '/saved' });
  });

  it('rejects anything else', () => {
    expect(notch.cleanAction({ type: 'open', path: '//evil.example' })).toBeNull();
    expect(notch.cleanAction({ type: 'open', path: 'https://evil.example' })).toBeNull();
    expect(notch.cleanAction({ type: 'open' })).toBeNull();
    expect(notch.cleanAction({ type: 'quit' })).toBeNull();
    expect(notch.cleanAction(null)).toBeNull();
    expect(notch.cleanAction('run')).toBeNull();
  });
});

describe('clampHeight and within', () => {
  it('keeps the height between 200 and 640', () => {
    expect(notch.clampHeight(100)).toBe(200);
    expect(notch.clampHeight(450.4)).toBe(450);
    expect(notch.clampHeight(9000)).toBe(640);
    expect(notch.clampHeight(Number.NaN)).toBeNull();
    expect(notch.clampHeight('500')).toBeNull();
  });

  it('counts the margin around the panel as inside', () => {
    const rect = { x: 546, y: 38, width: 420, height: 600 };
    expect(notch.within({ x: 540, y: 300 }, rect, 12)).toBe(true);
    expect(notch.within({ x: 530, y: 300 }, rect, 12)).toBe(false);
    expect(notch.within({ x: 700, y: 650 }, rect, 12)).toBe(true);
    expect(notch.within({ x: 700, y: 651 }, rect, 12)).toBe(false);
  });
});
