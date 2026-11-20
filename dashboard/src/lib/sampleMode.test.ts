// The public showcase (VITE_SAMPLE_FEED=1) shows sample content where other builds would be empty.
import { afterEach, describe, expect, it, vi } from 'vitest';
import { opportunities } from '../data/sample.ts';
import { DEFAULT_FILTERS, sampleSearch } from './search.ts';

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.resetModules();
});

describe('sample mode', () => {
  it('matches sample postings by their words and filters', () => {
    const found = sampleSearch(opportunities, 'software internship', DEFAULT_FILTERS);
    expect(found.results.length).toBeGreaterThan(0);
    expect(found.writer).toBe('sample');
    expect(found.results.every((r) => r.source === 'Sample posting')).toBe(true);
    expect(sampleSearch(opportunities, 'software', { ...DEFAULT_FILTERS, kind: 'scholarship' }).results.every((r) => r.type === 'scholarship')).toBe(true);
    expect(sampleSearch(opportunities, 'zzqx qqvv', DEFAULT_FILTERS).results).toEqual([]);
  });

  it('searches the sample postings when the flag is on and no backend answers', async () => {
    vi.stubEnv('VITE_SAMPLE_FEED', '1');
    vi.stubGlobal('fetch', () => Promise.reject(new TypeError('offline')));
    const { searchOwn } = await import('./search.ts');
    const answer = await searchOwn('demo', null, 'research', DEFAULT_FILTERS);
    expect(answer.writer).toBe('sample');
    expect(answer.results.length).toBeGreaterThan(0);
  });

  it('says the agents cannot be reached when the flag is off', async () => {
    vi.stubEnv('VITE_SAMPLE_FEED', '');
    vi.stubGlobal('fetch', () => Promise.reject(new TypeError('offline')));
    const { searchOwn } = await import('./search.ts');
    await expect(searchOwn('demo', null, 'research', DEFAULT_FILTERS)).rejects.toThrow(/cannot reach your agents/);
  });

  it('opens a sample career guide only when the flag is on', async () => {
    vi.stubEnv('VITE_SAMPLE_FEED', '1');
    const { sampleGuideFor } = await import('./discover/guide.ts');
    const guide = sampleGuideFor('Software engineering');
    expect(guide?.status).toBe('ready');
    expect(guide?.sections.voices.sample).toBe(true);
    expect(sampleGuideFor('Underwater basket weaving')).toBeNull();
  });
});
