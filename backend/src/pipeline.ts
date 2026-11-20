// Runs one student search end to end: scope, discover, validate, store.
import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { z } from 'zod';
import { config, liveAvailable } from './config.ts';
import { scopeWithGrok, scopeWithRules, type ScopeInput, type Scoping } from './coordinator.ts';
import type { Store } from './store/index.ts';
import { Candidate, type Brief, type Opportunity, type Origin, type Search, type WorkerBrief, type WorkerState } from './types.ts';
import { checkDates, checkLink, dropUnsupported, mergeDuplicates, toOpportunity, type LinkStatus, type Merged } from './validate.ts';
import { discover, verify } from './workers.ts';

export type Mode = 'auto' | 'prepared' | 'live';

/** The pieces that talk to the outside world, swappable in tests. */
export type Deps = {
  scopeLive: (input: ScopeInput) => Promise<Scoping>;
  discover: typeof discover;
  verify: typeof verify;
  checkLink: (url: string) => Promise<LinkStatus>;
  liveAvailable: () => boolean;
  now: () => Date;
  preparedStepMs: number;
};

export const defaultDeps: Deps = {
  scopeLive: scopeWithGrok,
  discover,
  verify,
  checkLink,
  liveAvailable,
  now: () => new Date(),
  preparedStepMs: config.preparedStepMs,
};

export class UserError extends Error {
  status: number;
  constructor(message: string, status = 400) {
    super(message);
    this.status = status;
  }
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const errorText = (e: unknown) => (e instanceof Error ? e.message : String(e));

export function loadPrepared(): Candidate[] {
  const file = new URL('../fixtures/prepared.json', import.meta.url);
  return z.array(Candidate).parse(JSON.parse(readFileSync(file, 'utf8')).candidates);
}

export class Engine {
  private store: Store;
  private deps: Deps;
  /** In-flight runs, so tests and shutdown can wait for them. */
  private running = new Map<string, Promise<void>>();

  constructor(store: Store, deps: Partial<Deps> = {}) {
    this.store = store;
    this.deps = { ...defaultDeps, ...deps };
  }

  idle(id: string) {
    return this.running.get(id) ?? Promise.resolve();
  }

  async start(request: string, mode: Mode = 'auto'): Promise<Search> {
    const text = request.trim();
    if (!text) throw new UserError('request is required');
    if (mode === 'live' && !this.deps.liveAvailable()) throw new UserError('Live search is not configured (XAI_API_KEY is missing).', 409);
    const origin: Origin = mode === 'prepared' || !this.deps.liveAvailable() ? 'prepared' : 'live';
    const now = this.deps.now().toISOString();
    const search: Search = {
      id: randomUUID(),
      request: text,
      status: 'scoping',
      origin,
      summary: null,
      followUp: null,
      brief: null,
      workers: [],
      resultCount: 0,
      error: null,
      createdAt: now,
      updatedAt: now,
      durationMs: null,
    };
    await this.store.createSearch(search);
    return this.scope(search, null);
  }

  /** Pass an empty answer to skip the question and search with what is known. */
  async answer(id: string, answer: string): Promise<Search> {
    const search = await this.store.getSearch(id);
    if (!search) throw new UserError('search not found', 404);
    if (search.status !== 'needs_follow_up' || !search.followUp) throw new UserError('this search is not waiting for an answer', 409);
    const followUp = { question: search.followUp.question, answer: answer.trim() };
    await this.store.updateSearch(id, { followUp, status: 'scoping' });
    return this.scope({ ...search, followUp }, followUp.answer ? followUp : { ...followUp, answer: 'No preference.' });
  }

  private async scope(search: Search, followUp: { question: string; answer: string } | null): Promise<Search> {
    const input: ScopeInput = { request: search.request, followUp, today: this.deps.now() };
    let scoping: Scoping;
    try {
      scoping = search.origin === 'live' ? await this.deps.scopeLive(input) : scopeWithRules(input);
    } catch (e) {
      return this.store.updateSearch(search.id, { status: 'failed', error: `Could not read the request: ${errorText(e)}` });
    }
    if (scoping.brief.workers.length === 0) {
      return this.store.updateSearch(search.id, {
        status: 'failed',
        summary: scoping.summary,
        error: 'This version searches for clubs and events. Try asking for one of those.',
      });
    }
    const workers: WorkerState[] = scoping.brief.workers.map((w) => ({ type: w.type, status: 'pending', candidateCount: 0, error: null }));
    if (scoping.followUpQuestion && !followUp) {
      return this.store.updateSearch(search.id, {
        status: 'needs_follow_up',
        summary: scoping.summary,
        brief: scoping.brief,
        workers,
        followUp: { question: scoping.followUpQuestion, answer: null },
      });
    }
    const updated = await this.store.updateSearch(search.id, { status: 'searching', summary: scoping.summary, brief: scoping.brief, workers });
    const run = this.run(updated).finally(() => this.running.delete(search.id));
    this.running.set(search.id, run);
    return updated;
  }

  private async run(search: Search): Promise<void> {
    const started = Date.now();
    const brief = search.brief!;
    const workers = search.workers.map((w) => ({ ...w }));
    const setWorker = async (type: WorkerBrief['type'], patch: Partial<WorkerState>) => {
      Object.assign(workers.find((w) => w.type === type)!, patch);
      await this.store.updateSearch(search.id, { workers: workers.map((w) => ({ ...w })) });
    };

    try {
      // 1. Discovery: one worker per opportunity type, in parallel. One failing does not sink the other.
      const found = await Promise.all(
        brief.workers.map(async (wb) => {
          await setWorker(wb.type, { status: 'running' });
          try {
            const candidates = search.origin === 'live' ? await this.deps.discover(wb, brief, this.deps.now()) : await this.prepared(wb);
            await setWorker(wb.type, { status: 'done', candidateCount: candidates.length });
            return candidates;
          } catch (e) {
            await setWorker(wb.type, { status: 'failed', error: errorText(e) });
            return [];
          }
        }),
      );
      if (workers.every((w) => w.status === 'failed')) throw new Error(workers.map((w) => `${w.type}: ${w.error}`).join(' | '));

      // 2. Validation.
      await this.store.updateSearch(search.id, { status: 'validating' });
      if (search.origin === 'prepared') await sleep(this.deps.preparedStepMs);
      const opportunities = await this.validate(search, brief, found.flat());

      await this.store.saveOpportunities(search.id, opportunities);
      await this.store.updateSearch(search.id, {
        status: opportunities.length ? 'complete' : 'empty',
        resultCount: opportunities.length,
        durationMs: Date.now() - started,
      });
    } catch (e) {
      await this.store.updateSearch(search.id, { status: 'failed', error: errorText(e), durationMs: Date.now() - started });
    }
  }

  private async prepared(worker: WorkerBrief): Promise<Candidate[]> {
    await sleep(this.deps.preparedStepMs);
    return loadPrepared().filter((c) => c.type === worker.type);
  }

  private async validate(search: Search, brief: Brief, candidates: Candidate[]): Promise<Opportunity[]> {
    const today = this.deps.now();
    const live = search.origin === 'live';
    const perType = new Map<string, number>();

    // Merge repeat announcements first so each opportunity is checked once.
    let merged: Merged[] = mergeDuplicates(candidates.map(dropUnsupported));

    if (live) {
      // Cheap rejections before spending a model call, then keep the first few of each type.
      merged = merged.filter((m) => checkDates(m.candidate, brief, today).keep);
      merged = merged.filter((m) => {
        const n = perType.get(m.candidate.type) ?? 0;
        perType.set(m.candidate.type, n + 1);
        return n < config.maxResultsPerType;
      });
      const verified = await Promise.all(
        merged.map(async (m): Promise<Merged | null> => {
          const worker = brief.workers.find((w) => w.type === m.candidate.type)!;
          try {
            const verdict = await this.deps.verify(m.candidate, worker, brief, today);
            if (!verdict.keep) return null;
            const alsoSeenAt = new Set(m.alsoSeenAt);
            if (verdict.record.sourceUrl !== m.candidate.sourceUrl) alsoSeenAt.add(m.candidate.sourceUrl);
            return { candidate: dropUnsupported(verdict.record), alsoSeenAt: [...alsoSeenAt] };
          } catch (e) {
            // Keep the lead but say plainly that the second check did not run.
            m.candidate.uncertainties.push('These details came from one search pass and were not re-checked against the organizer page.');
            console.error(`verify failed for "${m.candidate.title}":`, errorText(e));
            return m;
          }
        }),
      );
      // Validation can reveal that two leads were the same thing.
      merged = mergeDuplicates(verified.filter((m) => m !== null));
    }

    const out: Opportunity[] = [];
    for (const m of merged) {
      const dates = checkDates(m.candidate, brief, today);
      if (!dates.keep) continue;
      const linkCheck: LinkStatus = live ? await this.deps.checkLink(m.candidate.actionUrl ?? m.candidate.sourceUrl) : 'skipped';
      if (linkCheck === 'unreachable') {
        // A dead sign-up link is dropped; fall back to the organizer page if that one works.
        if (!m.candidate.actionUrl || (await this.deps.checkLink(m.candidate.sourceUrl)) !== 'ok') continue;
        m.candidate.actionUrl = null;
      }
      out.push(
        toOpportunity(m, {
          searchId: search.id,
          origin: search.origin,
          linkCheck: linkCheck === 'unreachable' ? 'ok' : linkCheck,
          checkedAt: today,
          extraUncertainties: dates.uncertainties,
        }),
      );
    }
    return out;
  }
}
