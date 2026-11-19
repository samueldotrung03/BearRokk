// The agent system for one student: holds profile, history and results, starts runs on its own,
// and runs the master -> search managers -> worker fleet -> validators -> presentation manager chain.
import { createHash } from 'node:crypto';
import { addToCalendarUrl, type DeadlineEvent } from '../calendar.ts';
import { resumeInfo, type Resume, type ResumeInfo } from '../resume.ts';
import { canonicalUrl } from '../validate.ts';
import type { Brain } from './brain.ts';
import { Fleet, pooled } from './fleet.ts';
import { allocateSlots, buildMemory, categoryWeights, noteSignals, rankFeed, summarize } from './scoring.ts';
import {
  CATEGORY_LABEL,
  CATEGORY_OF,
  REVIEWERS,
  type Action,
  type AgentNode,
  type Application,
  type ApplicationStatus,
  type Reminder,
  type Assignment,
  type Candidate,
  type Category,
  type FeedEntry,
  type Interaction,
  type LogEvent,
  type MemorySummary,
  type Opportunity,
  type Profile,
  type RunSnapshot,
  type ReviewFocus,
  type Trigger,
  type Unknown,
  type Validation,
  type Verdict,
} from './types.ts';

export interface SystemOptions {
  /** Search manager slots per run. */
  slots: number;
  /** Worker jobs per run (scouts and extractors). */
  maxJobs: number;
  concurrency: number;
  /** Save, like or dislike actions that start a run on their own. */
  feedbackThreshold: number;
  /** Pause between the master's commands to each manager, so they can be followed on screen. */
  managerStaggerMs: number;
  /** How long to wait after the last profile-page edit before running, since that page saves while typing. */
  typingPauseMs: number;
  /** Which model family a live brain talks to, for labelling. */
  provider?: 'grok' | 'claude';
  now: () => Date;
}

export const DEFAULT_OPTIONS: SystemOptions = {
  slots: 4,
  maxJobs: 30,
  concurrency: 8,
  feedbackThreshold: 5,
  managerStaggerMs: 0,
  typingPauseMs: 4000,
  now: () => new Date(),
};

export const DEMO_PROFILE: Profile = {
  name: 'Maya',
  school: 'UC Berkeley',
  year: 'Freshman',
  major: 'Computer Science',
  location: 'Berkeley, CA',
  remoteOk: true,
  interests: ['coding', 'data'],
  skills: ['Python'],
  categories: ['internship', 'event', 'club', 'program'],
  careerInterests: [],
  eventTypes: [],
  preferences: null,
};

export interface StudentState {
  profile: Profile;
  memory: MemorySummary;
  feed: FeedEntry[];
  /** Feedback actions since the last run, and how many start one. */
  feedbackSinceRun: number;
  feedbackThreshold: number;
  scheduleSeconds: number;
  runCount: number;
  mode: 'simulated' | 'live';
  /** Which model family the agents are on. "claude" is a temporary test set-up. */
  provider: 'grok' | 'claude' | 'simulated';
  applications: Application[];
  /** The uploaded résumé, without the file itself. */
  resume: ResumeInfo | null;
}

type Listener = (event: 'run' | 'student', data: unknown) => void;

const UNKNOWN_DEADLINE: Record<Category, string> = {
  internship: 'Application deadline unknown',
  event: 'Registration deadline unknown',
  club: 'Sign-up deadline unknown',
  program: 'Deadline unknown',
};

const DAY_MS = 86_400_000;

/** A week before, two days before, and the day of the deadline. Ones already in the past are left out. */
export function remindersFor(deadline: string, now: Date, days: number[] = [7, 2, 0]): Reminder[] {
  const due = Date.parse(deadline);
  const label = (d: number) => (d === 0 ? 'Due today' : d === 1 ? 'Due tomorrow' : d === 7 ? 'Due in one week' : d === 2 ? 'Due in two days' : `Due in ${d} days`);
  const plan: [number, string][] = [...new Set(days)].sort((a, b) => b - a).map((d) => [d, label(d)]);
  if (plan.length === 0) return [];
  return plan
    .map(([days, label]) => ({ at: new Date(due - days * DAY_MS).toISOString(), label }))
    .filter((r, i) => Date.parse(r.at) > now.getTime() || (i === plan.length - 1 && plan[i]![0] === 0 && due > now.getTime()));
}

const idFor = (key: string) => `opp-${createHash('sha1').update(key).digest('hex').slice(0, 10)}`;
const errorText = (e: unknown) => (e instanceof Error ? e.message : String(e));

export class AgentSystem {
  private brain: Brain;
  private opts: SystemOptions;
  private initialProfile: Profile;
  private profile: Profile;
  private interactions: Interaction[] = [];
  private opportunities = new Map<string, Opportunity>();
  private reasons = new Map<string, string>();
  /** Postings a validator already turned down, so they are not checked again every run. */
  private rejected = new Map<string, string>();
  private rejectedUrls = new Set<string>();
  private applications = new Map<string, Application>();
  /** Days before a deadline to remind the student. Empty turns reminders off. */
  private reminderDays: number[] = [7, 2, 0];
  private resume: Resume | null = null;
  private newIds = new Set<string>();
  private run: RunSnapshot | null = null;
  private runCount = 0;
  private feedbackSinceRun = 0;
  private running: Promise<void> | null = null;
  private queued: Trigger | null = null;
  private listeners = new Set<Listener>();
  private profileTimer: NodeJS.Timeout | null = null;
  private scheduleTimer: NodeJS.Timeout | null = null;
  private scheduleSeconds = 0;
  private runDirty = false;
  private seq = 0;

  /** `profile` overrides the demo profile, for a student who signed in. */
  constructor(brain: Brain, opts: Partial<SystemOptions> = {}, profile: Partial<Profile> = {}) {
    this.brain = brain;
    this.opts = { ...DEFAULT_OPTIONS, ...opts };
    this.initialProfile = { ...structuredClone(DEMO_PROFILE), ...profile };
    this.profile = structuredClone(this.initialProfile);
  }

  // ---- reading ------------------------------------------------------------

  subscribe(listener: Listener) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private memory() {
    return buildMemory(this.interactions, this.opportunities);
  }

  student(): StudentState {
    const memory = this.memory();
    return {
      profile: this.profile,
      memory: summarize(memory),
      // Only the kinds of opportunity the student asked for.
      feed: rankFeed([...this.opportunities.values()].filter((o) => this.profile.categories.includes(CATEGORY_OF[o.type])), memory, {
        now: this.opts.now(),
        reasons: this.reasons,
        newIds: this.newIds,
        notes: noteSignals(this.profile.preferences?.notes ?? []),
      }),
      feedbackSinceRun: this.feedbackSinceRun,
      feedbackThreshold: this.opts.feedbackThreshold,
      scheduleSeconds: this.scheduleSeconds,
      runCount: this.runCount,
      mode: this.brain.mode,
      provider: this.brain.mode === 'live' ? (this.opts.provider ?? 'grok') : 'simulated',
      applications: this.listApplications(),
      resume: resumeInfo(this.resume),
    };
  }

  currentRun() {
    return this.run;
  }

  /** Resolves when no run is in flight or queued. */
  async idle() {
    while (this.running) await this.running;
  }

  private emitStudent() {
    const state = this.student();
    for (const l of this.listeners) l('student', state);
  }

  /** Run updates are frequent, so they are batched into one message per tick. */
  private emitRun() {
    if (this.runDirty) return;
    this.runDirty = true;
    setTimeout(() => {
      this.runDirty = false;
      for (const l of this.listeners) l('run', this.run);
    }, 60);
  }

  // ---- things that start a run -------------------------------------------

  setProfile(patch: Partial<Profile>) {
    this.profile = { ...this.profile, ...patch };
    this.emitStudent();
    this.runSoon(Object.keys(patch).every((k) => k === 'preferences') ? this.opts.typingPauseMs : 700);
    return this.student();
  }

  /**
   * Start a run once the student stops editing. The profile page saves as they type, so its
   * answers wait longer than a single switch flipped elsewhere.
   */
  private runSoon(ms: number) {
    if (this.profileTimer) clearTimeout(this.profileTimer);
    this.profileTimer = setTimeout(() => void this.trigger('profile'), ms);
  }

  /** Store or remove the résumé. A new one is a reason for the agents to look again. */
  setResume(resume: Resume | null) {
    this.resume = resume;
    this.emitStudent();
    if (resume) this.runSoon(700);
    return resumeInfo(resume);
  }

  getResume() {
    return this.resume;
  }

  interact(opportunityId: string, action: Action) {
    if (!this.opportunities.has(opportunityId)) return null;
    this.interactions.push({ opportunityId, action, at: this.opts.now().toISOString() });
    if (action !== 'open') this.feedbackSinceRun++;
    this.emitStudent();
    if (this.feedbackSinceRun >= this.opts.feedbackThreshold) void this.trigger('feedback');
    return this.student();
  }

  /** Repeat runs every `seconds`; 0 turns the schedule off. */
  setSchedule(seconds: number) {
    if (this.scheduleTimer) clearInterval(this.scheduleTimer);
    this.scheduleTimer = null;
    this.scheduleSeconds = Math.max(0, Math.floor(seconds));
    if (this.scheduleSeconds > 0) {
      this.scheduleTimer = setInterval(() => void this.trigger('schedule'), this.scheduleSeconds * 1000);
      this.scheduleTimer.unref();
    }
    this.emitStudent();
  }

  reset() {
    this.interactions = [];
    this.opportunities.clear();
    this.reasons.clear();
    this.rejected.clear();
    this.rejectedUrls.clear();
    this.applications.clear();
    this.reminderDays = [7, 2, 0];
    this.resume = null;
    this.newIds.clear();
    this.profile = structuredClone(this.initialProfile);
    this.feedbackSinceRun = 0;
    this.runCount = 0;
    this.run = null;
    this.emitRun();
    this.emitStudent();
  }

  // ---- application manager ---------------------------------------------------

  listApplications(): Application[] {
    // Soonest deadline first; unknown deadlines last.
    return [...this.applications.values()].sort((a, b) => (a.deadline ?? '9999').localeCompare(b.deadline ?? '9999'));
  }

  getApplication(opportunityId: string) {
    return this.applications.get(opportunityId) ?? null;
  }

  /** What would go on the student's calendar for this application, or null without a deadline. */
  calendarEvent(app: Application): DeadlineEvent | null {
    if (!app.deadline) return null;
    const lines = [`Deadline for ${app.title} at ${app.organizer}.`];
    if (app.actionUrl) lines.push(`Apply: ${app.actionUrl}`);
    if (app.materials.length) lines.push(`Needs: ${app.materials.join(', ')}`);
    return { title: `Due: ${app.title} (${app.organizer})`, deadline: app.deadline, description: lines.join('\n') };
  }

  /**
   * Set or change the status of an application. Marking it to_apply or applying sets the
   * reminders automatically; any other status clears them.
   */
  setApplication(opportunityId: string, patch: { status?: ApplicationStatus; drafts?: Record<string, string>; deadline?: string }): Application | null {
    const opp = this.opportunities.get(opportunityId);
    const existing = this.applications.get(opportunityId);
    if (!opp && !existing) return null;
    const now = this.opts.now();
    const app: Application = existing ?? {
      opportunityId,
      title: opp!.title,
      organizer: opp!.organizer,
      status: 'interested',
      updatedAt: now.toISOString(),
      deadline: opp!.deadline,
      actionUrl: opp!.actionUrl ?? opp!.sourceUrl,
      prompts: opp!.application?.prompts ?? [],
      materials: opp!.application?.materials ?? [],
      drafts: {},
      reminders: [],
      needsDeadline: false,
      calendar: { state: 'none', eventId: null, htmlLink: null, addUrl: null, error: null },
    };
    if (opp?.application && app.prompts.length === 0) Object.assign(app, { prompts: opp.application.prompts, materials: opp.application.materials });
    const before = app.status;
    if (patch.status) app.status = patch.status;
    if (patch.drafts) app.drafts = { ...app.drafts, ...patch.drafts };
    // The student can supply a deadline the posting did not state.
    if (patch.deadline && !Number.isNaN(Date.parse(patch.deadline))) app.deadline = new Date(patch.deadline).toISOString();
    app.updatedAt = now.toISOString();

    const active = app.status === 'to_apply' || app.status === 'applying';
    app.reminders = active && app.deadline ? remindersFor(app.deadline, now, this.reminderDays) : [];
    app.needsDeadline = active && !app.deadline;
    const event = active ? this.calendarEvent(app) : null;
    app.calendar.addUrl = event ? addToCalendarUrl(event) : null;
    if (app.calendar.state !== 'synced') app.calendar.state = event ? 'link' : 'none';

    this.applications.set(opportunityId, app);
    // Applying is the strongest signal the ranking gets.
    if (app.status === 'applied' && before !== 'applied') this.interactions.push({ opportunityId, action: 'apply', at: now.toISOString() });
    this.emitStudent();
    return app;
  }

  /** Change when the student is reminded, and redo the reminders on applications already tracked. */
  setReminderDays(days: number[]) {
    this.reminderDays = [...new Set(days.filter((d) => Number.isInteger(d) && d >= 0 && d <= 60))].slice(0, 6);
    const now = this.opts.now();
    for (const app of this.applications.values()) {
      const active = app.status === 'to_apply' || app.status === 'applying';
      app.reminders = active && app.deadline ? remindersFor(app.deadline, now, this.reminderDays) : [];
    }
    this.emitStudent();
    return this.reminderDays;
  }

  getReminderDays() {
    return this.reminderDays;
  }

  /** Record what happened on the student's Google Calendar. */
  setCalendar(opportunityId: string, patch: Partial<Application['calendar']>) {
    const app = this.applications.get(opportunityId);
    if (!app) return null;
    app.calendar = { ...app.calendar, ...patch };
    this.emitStudent();
    return app;
  }

  removeApplication(opportunityId: string) {
    const app = this.applications.get(opportunityId) ?? null;
    this.applications.delete(opportunityId);
    this.emitStudent();
    return app;
  }

  /** Start a run, or queue one if a run is already going. */
  trigger(trigger: Trigger): Promise<void> {
    if (this.running) {
      this.queued ??= trigger;
      return this.running;
    }
    this.running = this.runOnce(trigger)
      .catch((e) => console.error('run crashed:', e))
      .then(() => {
        this.running = null;
        const next = this.queued;
        this.queued = null;
        if (next) return this.trigger(next);
      });
    return this.running;
  }

  // ---- one run -------------------------------------------------------------

  private async runOnce(trigger: Trigger) {
    const now = this.opts.now;
    const run: RunSnapshot = {
      id: `run-${++this.runCount}`,
      number: this.runCount,
      trigger,
      mode: this.brain.mode,
      status: 'running',
      startedAt: now().toISOString(),
      finishedAt: null,
      brief: null,
      agents: [],
      assignments: [],
      jobs: [],
      validations: [],
      log: [],
      stats: { jobs: 0, skipped: 0, candidates: 0, merged: 0, kept: 0, rejected: 0, added: 0 },
      error: null,
    };
    this.run = run;
    this.feedbackSinceRun = 0;
    this.newIds = new Set();

    const log = (agent: string, text: string, tone: LogEvent['tone'] = 'info') => {
      run.log.push({ seq: ++this.seq, at: now().toISOString(), agent, text, tone });
      this.emitRun();
    };
    const node = (n: AgentNode) => {
      run.agents.push(n);
      this.emitRun();
      return n;
    };
    const set = (n: AgentNode, patch: Partial<AgentNode>) => {
      Object.assign(n, patch);
      this.emitRun();
    };

    const TRIGGER_TEXT: Record<Trigger, string> = {
      first: 'First run for this student',
      manual: 'Run requested by hand',
      profile: 'The profile changed, so the agents started on their own',
      feedback: `${this.opts.feedbackThreshold} new reactions, so the agents started on their own`,
      schedule: 'Scheduled run',
    };
    log('System', TRIGGER_TEXT[trigger]);
    this.emitStudent();

    try {
      // 1. Master agent ---------------------------------------------------------------
      const master = node({ id: 'master', level: 'master', name: 'Master agent', role: 'Reads the profile, background and memory', status: 'running', detail: 'Reading the student…' });
      const memory = this.memory();
      const summary = summarize(memory);
      const split = allocateSlots(this.profile.categories, categoryWeights(memory), this.opts.slots);
      const perManager = Math.floor(this.opts.maxJobs / this.opts.slots);
      const skeleton: Assignment[] = [];
      for (const category of Object.keys(split) as Category[]) {
        for (let i = 0; i < split[category]; i++) {
          const n = skeleton.length + 1;
          skeleton.push({
            managerId: `manager-${n}`,
            name: `${CATEGORY_LABEL[category].split(' ')[0]} manager ${split[category] > 1 ? i + 1 : ''}`.trim(),
            category,
            lens: 'all',
            focus: [],
            budget: perManager,
            others: [],
          });
        }
      }
      const { brief, assignments } = await this.brain.master({ profile: this.profile, memory: summary, resumeText: this.resume?.text ?? null, assignments: skeleton });
      run.brief = brief;
      run.assignments = assignments;
      const mix = (Object.keys(split) as Category[]).filter((c) => split[c] > 0).map((c) => `${split[c]} on ${CATEGORY_LABEL[c].toLowerCase()}`);
      set(master, { status: 'done', detail: `Brief: ${brief.goal}. Search managers: ${mix.join(', ')}.` });
      log('Master agent', `Wants: ${brief.goal}`);
      if (brief.avoid.length) log('Master agent', `Told the managers to avoid: ${brief.avoid.join(', ')}`);
      log('Master agent', `Split ${this.opts.slots} search managers: ${mix.join(', ')}`, 'good');

      // 2. Search managers and the worker fleet --------------------------------------
      const fleet = new Fleet({
        concurrency: this.opts.concurrency,
        maxJobs: this.opts.maxJobs,
        onUpdate: () => {
          run.jobs = fleet.jobs.map((j) => ({ ...j }));
          this.emitRun();
        },
      });
      const known = new Set([...[...this.opportunities.values()].map((o) => o.sourceUrl), ...this.rejectedUrls]);
      let alreadyRejected = 0;
      const found = new Map<string, { candidate: Candidate; managerId: string; alsoSeenAt: string[] }>();

      await Promise.all(
        assignments.map(async (a, index) => {
          fleet.setBudget(a.managerId, a.budget);
          const lens = a.lens === 'all' ? 'everything' : `by ${a.lens === 'employer' ? 'organization type' : a.lens}`;
          if (this.opts.managerStaggerMs) await new Promise((r) => setTimeout(r, index * this.opts.managerStaggerMs));
          log('Master agent', `Command to ${a.name}: cover ${CATEGORY_LABEL[a.category].toLowerCase()} ${lens} (${a.focus.join(', ')})`);
          const manager = node({ id: a.managerId, level: 'manager', name: a.name, role: `${CATEGORY_LABEL[a.category]}, ${lens}`, status: 'running', detail: 'Planning the search…' });
          try {
            // A scout only finds leads; reading them is what produces results. Keep most of the
            // manager's budget for readers, or a small run spends everything on searching.
            const planned = await this.brain.planJobs(a, brief);
            const specs = planned.slice(0, Math.max(1, Math.floor(a.budget / 3)));
            set(manager, { detail: `Covering: ${a.focus.join(', ')}` });
            log(a.name, `Sent ${specs.length} scouts: ${specs.map((s) => s.label).join(' / ')}`);
            let mine = 0;
            let duplicates = 0;
            await Promise.all(
              specs.map(async (spec) => {
                const leads = await fleet.run({ kind: 'scout', managerId: a.managerId, label: `Search: ${spec.label}` }, async () => {
                  const value = await this.brain.scout(spec, a, brief, known);
                  return { value, summary: `${value.length} leads` };
                });
                await Promise.all(
                  (leads ?? []).map(async (lead) => {
                    const key = canonicalUrl(lead.url) ?? lead.url;
                    if (!fleet.claim(key)) {
                      run.stats.merged++;
                      duplicates++;
                      return;
                    }
                    const candidate = await fleet.run({ kind: 'extract', managerId: a.managerId, label: `Read: ${lead.title}` }, async () => {
                      const value = await this.brain.extract(lead, a);
                      return { value, summary: value ? `${value.organizer}` : 'page could not be read' };
                    });
                    if (!candidate) return;
                    const official = canonicalUrl(candidate.sourceUrl) ?? candidate.sourceUrl;
                    if (this.rejected.has(official)) {
                      alreadyRejected++;
                      return;
                    }
                    const existing = found.get(official);
                    if (existing) {
                      run.stats.merged++;
                      existing.alsoSeenAt.push(lead.url);
                      log(a.name, `Merged a repost of "${candidate.title}" into the record already found`);
                      return;
                    }
                    found.set(official, { candidate, managerId: a.managerId, alsoSeenAt: key === official ? [] : [lead.url] });
                    mine++;
                  }),
                );
              }),
            );
            if (duplicates) log(a.name, `Skipped ${duplicates} leads another worker already had`);
            set(manager, { status: 'done', detail: `Covered ${a.focus.join(', ')}. Brought back ${mine} postings${duplicates ? `, skipped ${duplicates} duplicates` : ''}.` });
          } catch (e) {
            set(manager, { status: 'failed', detail: errorText(e) });
            log(a.name, `Failed: ${errorText(e)}`, 'bad');
          }
        }),
      );
      if (alreadyRejected) log('Worker fleet', `${alreadyRejected} postings were turned down in an earlier run and were not checked again`);
      run.stats.candidates = found.size;
      run.stats.jobs = fleet.started;
      run.stats.skipped = fleet.jobs.filter((j) => j.status === 'skipped').length;
      if (run.stats.skipped) log('Worker fleet', `${run.stats.skipped} jobs were not run: the run's budget was reached`);

      // 3. Validation agents ----------------------------------------------------------
      // Every posting the workers brought back is reviewed, with none left out, and each one
      // gets a separate review from every validation agent. It is kept only if all of them keep it.
      const queue = [...found.entries()];
      run.validations = queue.map(([key, f]): Validation => ({
        id: idFor(key),
        title: f.candidate.title,
        managerId: f.managerId,
        status: 'checking',
        reason: null,
        fit: null,
        reviews: REVIEWERS.map((r) => ({ focus: r.focus, reviewer: r.name, status: 'checking', reason: null, fit: null })),
      }));
      this.emitRun();

      const verdicts = new Map<string, Partial<Record<ReviewFocus, Verdict>>>();
      const tasks = queue.flatMap(([key, f]) => REVIEWERS.map((reviewer) => ({ key, f, reviewer })));
      await pooled(tasks, Math.max(2, Math.min(this.opts.concurrency, 6)), async ({ key, f, reviewer }) => {
        const review = run.validations.find((x) => x.id === idFor(key))!.reviews.find((r) => r.focus === reviewer.focus)!;
        try {
          const verdict = await this.brain.validate(f.candidate, brief, summary, reviewer.focus);
          verdicts.set(key, { ...verdicts.get(key), [reviewer.focus]: verdict });
          review.status = verdict.keep ? 'kept' : 'rejected';
          review.reason = verdict.reason;
          review.fit = verdict.keep ? verdict.fit : null;
        } catch (e) {
          // A review that could not be done is not a pass.
          review.status = 'rejected';
          review.reason = `Could not be reviewed: ${errorText(e)}`;
        }
        this.emitRun();
      });

      const kept: Opportunity[] = [];
      for (const [key, f] of queue) {
        const v = run.validations.find((x) => x.id === idFor(key))!;
        const against = v.reviews.filter((r) => r.status !== 'kept');
        if (against.length > 0) {
          v.status = 'rejected';
          v.reason = against.map((r) => `${r.reviewer}: ${r.reason}`).join(' ');
          run.stats.rejected++;
          this.opportunities.delete(v.id);
          // Remembered so it is not re-checked every run, unless a review simply failed to run.
          if (against.every((r) => !r.reason?.startsWith('Could not be reviewed'))) {
            this.rejected.set(key, v.reason);
            this.rejectedUrls.add(f.candidate.sourceUrl);
          }
          log('Validation agents', `Rejected "${f.candidate.title}". ${against.map((r) => `${r.reviewer}: ${r.reason}`).join(' ')}`.replace(/\.?$/, '.'), 'bad');
          continue;
        }
        const both = verdicts.get(key)!;
        // The status reviewer read the official page, so its version of the facts is the one kept;
        // the criteria reviewer's words are why it fits.
        const c = (both.status ?? both.criteria)!.record;
        const fits = v.reviews.map((r) => r.fit ?? 0);
        const fit = Number((fits.reduce((x, y) => x + y, 0) / fits.length).toFixed(2));
        v.status = 'kept';
        v.fit = fit;
        v.reason = (both.criteria ?? both.status)!.reason;
        const id = v.id;
        const previous = this.opportunities.get(id);
        const unknowns: Unknown[] = c.deadline ? [] : [{ field: 'deadline', label: UNKNOWN_DEADLINE[CATEGORY_OF[c.type]] }];
        kept.push({
          ...c,
          id,
          origin: this.brain.mode === 'live' ? 'live' : 'prepared',
          fitExplanation: v.reason,
          unknowns,
          foundAt: previous?.foundAt ?? now().toISOString(),
          lastCheckedAt: now().toISOString(),
          baseScore: fit,
          foundBy: assignments.find((a) => a.managerId === f.managerId)?.name ?? f.managerId,
          alsoSeenAt: f.alsoSeenAt,
          application: previous?.application ?? null,
        });
        if (!previous) this.newIds.add(id);
      }
      this.emitRun();
      run.stats.kept = kept.length;
      run.stats.added = this.newIds.size;
      log('Validation agents', `Reviewed all ${queue.length} postings, ${REVIEWERS.length} reviews each (${tasks.length} in total): kept ${kept.length}, rejected ${run.stats.rejected}`, 'good');

      // 4. Application readers (from the fleet) for the strongest new results ----------
      const toRead = kept.filter((o) => !o.application).sort((a, b) => b.baseScore - a.baseScore).slice(0, 4);
      await Promise.all(
        toRead.map(async (o) => {
          o.application = await fleet.run({ kind: 'application', managerId: o.foundBy, label: `Application: ${o.title}`, exempt: true }, async () => {
            const value = await this.brain.readApplication(o);
            return { value, summary: `${value.prompts.length} prompts` };
          });
        }),
      );

      // 5. Presentation manager -------------------------------------------------------
      const presenter = node({ id: 'presentation', level: 'presentation', name: 'Presentation manager', role: 'Orders the feed and writes the reasons', status: 'running', detail: 'Writing why each card fits…' });
      const reasons = await this.brain.present(kept, brief, summary);
      for (const o of kept) {
        this.opportunities.set(o.id, o);
        const reason = reasons.get(o.id);
        if (reason) this.reasons.set(o.id, reason);
      }
      const shown = this.student().feed.length;
      set(presenter, { status: 'done', detail: `Feed updated: ${this.newIds.size} new, ${shown} in the feed.` });
      log('Presentation manager', `Feed updated: ${this.newIds.size} new opportunities, ${shown} in the feed`, 'good');

      run.status = 'complete';
    } catch (e) {
      run.status = 'failed';
      run.error = errorText(e);
      for (const a of run.agents) if (a.status === 'running') a.status = 'failed';
      log('System', `Run failed: ${run.error}`, 'bad');
    }
    run.finishedAt = now().toISOString();
    this.emitRun();
    this.emitStudent();
  }
}
