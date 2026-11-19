// The worker fleet: a shared job queue with a concurrency cap, per-run and per-manager budgets,
// one retry per job, and link dedupe across every manager.
import type { Job, JobKind } from './types.ts';

export interface FleetOptions {
  concurrency: number;
  maxJobs: number;
  onUpdate: (job: Job) => void;
}

export class Fleet {
  readonly jobs: Job[] = [];
  private opts: FleetOptions;
  private active = 0;
  private waiting: (() => void)[] = [];
  private claimed = new Set<string>();
  private budget = new Map<string, number>();
  private used = new Map<string, number>();

  constructor(opts: FleetOptions) {
    this.opts = opts;
  }

  setBudget(managerId: string, jobs: number) {
    this.budget.set(managerId, jobs);
  }

  /** True the first time a link is offered. Later offers are duplicates, whoever makes them. */
  claim(key: string): boolean {
    if (this.claimed.has(key)) return false;
    this.claimed.add(key);
    return true;
  }

  get started() {
    return this.jobs.filter((j) => j.status !== 'skipped').length;
  }

  private async slot() {
    if (this.active >= this.opts.concurrency) await new Promise<void>((resolve) => this.waiting.push(resolve));
    this.active++;
  }

  private release() {
    this.active--;
    this.waiting.shift()?.();
  }

  /** Run one worker job. Returns null if it was skipped for budget or failed twice. */
  async run<T>(
    spec: { kind: JobKind; managerId: string; label: string; exempt?: boolean },
    work: () => Promise<{ value: T; summary: string }>,
  ): Promise<T | null> {
    const job: Job = {
      id: `job-${this.jobs.length + 1}`,
      kind: spec.kind,
      managerId: spec.managerId,
      label: spec.label,
      status: 'queued',
      result: null,
      attempts: 0,
    };
    this.jobs.push(job);

    const usedByManager = this.used.get(spec.managerId) ?? 0;
    const overRun = this.started > this.opts.maxJobs;
    const overManager = usedByManager >= (this.budget.get(spec.managerId) ?? Infinity);
    if (!spec.exempt && (overRun || overManager)) {
      job.status = 'skipped';
      job.result = overRun ? 'run budget reached' : 'manager budget reached';
      this.opts.onUpdate(job);
      return null;
    }
    this.used.set(spec.managerId, usedByManager + 1);
    this.opts.onUpdate(job);

    await this.slot();
    try {
      for (;;) {
        job.attempts++;
        job.status = 'running';
        this.opts.onUpdate(job);
        try {
          const { value, summary } = await work();
          job.status = 'done';
          job.result = summary;
          this.opts.onUpdate(job);
          return value;
        } catch (e) {
          if (job.attempts >= 2) {
            job.status = 'failed';
            job.result = e instanceof Error ? e.message : String(e);
            this.opts.onUpdate(job);
            return null;
          }
        }
      }
    } finally {
      this.release();
    }
  }
}

/** Run tasks with at most `limit` in flight. */
export async function pooled<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let next = 0;
  const lane = async () => {
    while (next < items.length) {
      const i = next++;
      out[i] = await fn(items[i]!);
    }
  };
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, lane));
  return out;
}
