// The agent system for one student: holds profile, history and results, starts runs on its own,
// and runs the master -> search managers -> worker fleet -> validators -> presentation manager chain.
import { createHash } from 'node:crypto';
import { addToCalendarUrl, type DeadlineEvent } from '../calendar.ts';
import { resumeInfo, type Resume, type ResumeInfo } from '../resume.ts';
import { canonicalUrl } from '../validate.ts';
import type { Brain } from './brain.ts';
import { Fleet, limiter } from './fleet.ts';
import { isStopped, StoppedError, throwIfStopped, withSignal } from './stop.ts';
import type { FoundImage, ImageFinder } from './images.ts';
import type { TrackerItem } from '../sheets.ts';
import { allocateSlots, buildMemory, categoryWeights, noteSignals, rankFeed, summarize } from './scoring.ts';
import {
  CATEGORIES,
  CATEGORY_LABEL,
  CATEGORY_OF,
  type OppType,
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
  type LearnedMemory,
  type LinkedSheet,
  type ProfileMemory,
  type LogEvent,
  type MemorySummary,
  type PendingPosting,
  type Opportunity,
  type Profile,
  type RunRecord,
  type RunSnapshot,
  type SearchRecord,
  type StudentMemory,
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
  /** Cards the feed should hold. While it has fewer, the agents search again on their own. */
  feedTarget: number;
  /** Searches in a row the agents may start to fill the feed before they stop and wait for the student. */
  maxFillRuns: number;
  /** Finds each posting's picture. Without it postings keep whatever picture the reader gave, unchecked. */
  images?: ImageFinder | null;
  /** Stored postings without a picture that one run looks for pictures for, on top of its own finds. */
  imageBackfill?: number;
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
  feedTarget: 12,
  maxFillRuns: 4,
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
  /** Cards the feed should hold; the agents keep searching while it has fewer. */
  feedTarget: number;
  /** What the student has saved and liked now, kept with their account so every device shows the same. */
  saved: string[];
  liked: string[];
  /**
   * The saved postings themselves, whatever kinds the feed is set to show, so a saved card stays on
   * the Saved page after the profile changes. Ones disliked since, or ruled out by a note, are left out.
   */
  savedItems: FeedEntry[];
  /** The Google Sheet the saved list is written to, or null for the app's own sheet only. */
  sheet: LinkedSheet | null;
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

/** How a kind of opportunity is named when the student asks for more of it. */
const MORE_OF: Record<OppType, string> = {
  internship: 'internships',
  event: 'events',
  club: 'clubs',
  hackathon: 'hackathons',
  research: 'research positions',
  scholarship: 'scholarships',
};

const PICTURE_RETRY_MS = 86_400_000;
/** True for a posting nobody has looked for a picture for, or one nothing was found for a day ago. */
const needsPicture = (o: Opportunity, now: Date) =>
  o.imageKind === undefined || (o.imageKind === null && (!o.imageTriedAt || now.getTime() - Date.parse(o.imageTriedAt) > PICTURE_RETRY_MS));

/** Record what the image finder found on the posting. Looked for once either way. */
function applyPicture(o: Opportunity, found: FoundImage | null, now: Date) {
  o.imageTriedAt = now.toISOString();
  o.imageKind = found?.kind ?? null;
  o.image = found?.url ?? null;
  o.imageCredit = found?.credit ?? null;
  o.imageCreditUrl = found?.creditUrl ?? null;
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
  /** Searches in a row started only to fill the feed. */
  private fillRuns = 0;
  /** Postings read but not yet decided by the validation agents, kept so a stop does not lose them. */
  private pending = new Map<string, PendingPosting>();
  /** Searches the scouts have run, newest last, and the outline of each finished run. */
  private searches: SearchRecord[] = [];
  private runs: RunRecord[] = [];
  /** A kind of opportunity the student asked for more of; the next run searches only for it. */
  private focus: OppType | null = null;
  /** The Google Sheet the saved list is kept in, once the student links one. */
  private sheet: LinkedSheet | null = null;
  /** The student's lasting Google connection. Kept with their account; never put in student(). */
  private google: ProfileMemory['google'] = null;
  /** Postings a picture is being looked for right now, so two passes do not look for the same one. */
  private picturing = new Set<string>();
  /** Called after anything worth saving changed. */
  private saver: (() => void) | null = null;
  private running: Promise<void> | null = null;
  /** Stops the run in flight. */
  private abort: AbortController | null = null;
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
    const rank = (list: Opportunity[]) =>
      rankFeed(list, memory, {
        now: this.opts.now(),
        reasons: this.reasons,
        newIds: this.newIds,
        notes: noteSignals(this.profile.preferences?.notes ?? []),
      });
    // A card disliked after it was saved is not shown as saved, as the app does when you dislike it.
    const saved = [...memory.saved].filter((id) => this.opportunities.has(id) && memory.reaction.get(id) !== 'dislike');
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
      feedTarget: this.opts.feedTarget,
      saved,
      liked: [...memory.reaction].filter(([id, r]) => r === 'like' && this.opportunities.has(id)).map(([id]) => id),
      savedItems: rank(saved.map((id) => this.opportunities.get(id)!)),
      sheet: this.sheet,
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

  /** Cards in the feed the student can still act on: a passed deadline does not count. */
  private openCards() {
    const now = this.opts.now().getTime();
    return this.student().feed.filter((e) => !e.opportunity.deadline || Date.parse(e.opportunity.deadline) >= now).length;
  }

  /**
   * True while the feed is short of its target and the agents may still search again on their own.
   * A failed run is not repeated, and the count of searches in a row is capped, so a thin field
   * cannot keep the agents running without end.
   */
  private shouldFill() {
    // A run that failed, or that the student stopped, is not followed by another on its own.
    if (this.opts.feedTarget <= 0 || this.run?.status === 'failed' || this.run?.status === 'stopped') return false;
    return this.fillRuns < this.opts.maxFillRuns && this.openCards() < this.opts.feedTarget;
  }

  /**
   * Look for pictures for stored postings that have none, straight away and without a search.
   * Called when a student's memory is loaded, so cards found before pictures existed get them.
   */
  fillPictures(limit = 30): Promise<void> {
    const finder = this.opts.images;
    if (!finder) return Promise.resolve();
    const now = this.opts.now();
    const todo = [...this.opportunities.values()].filter((o) => needsPicture(o, now) && !this.picturing.has(o.id)).slice(0, limit);
    const slot = limiter(4);
    return Promise.all(
      todo.map((o) =>
        slot(async () => {
          this.picturing.add(o.id);
          try {
            const found = await finder.find(o, () => this.brain.illustrate(o));
            // Still in the feed (not rejected or reset meanwhile): record it.
            if (this.opportunities.get(o.id) === o) {
              applyPicture(o, found, this.opts.now());
              this.emitStudent();
            }
          } catch (e) {
            console.error(`picture finder failed for "${o.title}": ${errorText(e)}`);
          } finally {
            this.picturing.delete(o.id);
          }
        }),
      ),
    ).then(() => {});
  }

  /**
   * The student asked for more of one kind of opportunity: the next run puts every search manager
   * on it. Asking for a kind their profile leaves out adds it, since asking says they want it.
   */
  searchFor(type: OppType) {
    const category = CATEGORY_OF[type];
    if (!this.profile.categories.includes(category)) this.profile = { ...this.profile, categories: [...this.profile.categories, category] };
    this.focus = type;
    this.emitStudent();
    return this.trigger(this.runCount === 0 ? 'first' : 'manual');
  }

  /** Start a search if the feed is short of its target and nothing is running. */
  fillIfShort() {
    if (!this.running && this.shouldFill()) void this.trigger('fill');
  }

  /** Resolves when no run is in flight or queued. */
  async idle() {
    while (this.running) await this.running;
  }

  // ---- the memory that is saved ------------------------------------------------

  /** Have `save` called whenever the student's memory changed. */
  onChange(save: () => void) {
    this.saver = save;
  }

  /**
   * Everything worth keeping, in its two sections: what the student told the app, and what the
   * app learned from their reactions and from the agents' searches.
   */
  memorySnapshot(): StudentMemory {
    const r = this.resume;
    return {
      version: 1,
      updatedAt: this.opts.now().toISOString(),
      profile: {
        profile: this.profile,
        resume: r ? { name: r.name, type: r.type, size: r.size, uploadedAt: r.uploadedAt, text: r.text, bytes: Buffer.from(r.bytes).toString('base64') } : null,
        reminderDays: this.reminderDays,
        scheduleSeconds: this.scheduleSeconds,
        sheet: this.sheet,
        google: this.google,
      },
      learned: {
        interactions: this.interactions,
        opportunities: [...this.opportunities.values()],
        reasons: Object.fromEntries(this.reasons),
        rejected: [...this.rejected].map(([url, reason]) => ({ url, reason })),
        rejectedUrls: [...this.rejectedUrls],
        searches: this.searches,
        pending: [...this.pending.values()],
        runs: this.runs,
        applications: [...this.applications.values()],
        runCount: this.runCount,
      },
    };
  }

  /** Put a saved memory back, as when the backend starts again or the student signs in on a new day. */
  restore(memory: StudentMemory) {
    const p = memory.profile;
    const l: Partial<LearnedMemory> = memory.learned ?? {};
    if (p?.profile) this.profile = { ...this.initialProfile, ...structuredClone(p.profile) };
    this.resume = p?.resume ? { ...p.resume, bytes: new Uint8Array(Buffer.from(p.resume.bytes, 'base64')) } : null;
    if (Array.isArray(p?.reminderDays)) this.reminderDays = p.reminderDays;
    this.sheet = p?.sheet ?? null;
    this.google = p?.google ?? null;
    this.interactions = structuredClone(l.interactions ?? []);
    this.opportunities = new Map((l.opportunities ?? []).map((o) => [o.id, structuredClone(o)]));
    this.reasons = new Map(Object.entries(l.reasons ?? {}));
    this.rejected = new Map((l.rejected ?? []).map((r) => [r.url, r.reason]));
    this.rejectedUrls = new Set(l.rejectedUrls ?? []);
    this.searches = structuredClone(l.searches ?? []);
    this.pending = new Map((l.pending ?? []).map((p) => [p.key, structuredClone(p)]));
    this.runs = structuredClone(l.runs ?? []);
    this.applications = new Map((l.applications ?? []).map((a) => [a.opportunityId, structuredClone(a)]));
    this.runCount = l.runCount ?? this.runs.length;
    this.newIds = new Set();
    // setSchedule announces the restored state; it must not be saved straight back.
    const saver = this.saver;
    this.saver = null;
    this.setSchedule(p?.scheduleSeconds ?? 0);
    this.saver = saver;
  }

  /** What the app has learned, in numbers and recent entries, for a page that shows it. */
  searchHistory() {
    return { searches: this.searches, runs: this.runs };
  }

  private emitStudent() {
    this.saver?.();
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
    // Saving starts tracking it as Interested. Unsaving one that never got further stops tracking it.
    if (action === 'save') {
      const nowSaved = this.memory().saved.has(opportunityId);
      const app = this.applications.get(opportunityId);
      if (nowSaved && !app) this.setApplication(opportunityId, { status: 'interested' });
      else if (!nowSaved && app?.status === 'interested' && Object.keys(app.drafts).length === 0) this.removeApplication(opportunityId);
    }
    this.emitStudent();
    if (this.feedbackSinceRun >= this.opts.feedbackThreshold) void this.trigger('feedback');
    // A dislike takes a card out of the feed; if that leaves it short, the agents go and find more.
    else if (action === 'dislike' && !this.running && this.runCount > 0 && this.shouldFill()) void this.trigger('fill');
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
    this.fillRuns = 0;
    this.searches = [];
    this.pending.clear();
    this.runs = [];
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

  // ---- the saved tracker ------------------------------------------------------------------

  /**
   * Everything saved, and anything with an application status, one entry each: soonest deadline
   * first, with no deadline after, as the tracker sheet lists them.
   */
  trackerItems(): TrackerItem[] {
    const memory = this.memory();
    const savedAt = new Map<string, string>();
    for (const i of this.interactions) if (i.action === 'save') savedAt.set(i.opportunityId, i.at);
    const ids = [...new Set([...this.student().saved, ...this.applications.keys()])];
    return ids
      .filter((id) => memory.reaction.get(id) !== 'dislike' || this.applications.has(id))
      .map((id) => ({ opportunity: this.opportunities.get(id) ?? null, application: this.applications.get(id) ?? null, savedAt: memory.saved.has(id) ? (savedAt.get(id) ?? null) : null }))
      .filter((item) => item.opportunity || item.application)
      .sort((a, b) => {
        const due = (x: TrackerItem) => Date.parse(x.application?.deadline ?? x.opportunity?.deadline ?? '') || Infinity;
        return due(a) - due(b);
      });
  }

  getSheet() {
    return this.sheet;
  }

  getGoogle() {
    return this.google;
  }

  /** Saved straight away: it is what lets the student skip connecting next time. */
  setGoogle(google: ProfileMemory['google']) {
    this.google = google;
    this.saver?.();
  }

  setSheet(sheet: LinkedSheet | null) {
    this.sheet = sheet;
    this.emitStudent();
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
    const controller = new AbortController();
    this.abort = controller;
    this.running = withSignal(controller.signal, () => this.runOnce(trigger))
      .catch((e) => console.error('run crashed:', e))
      .then(() => {
        this.running = null;
        this.abort = null;
        // Something the student did comes first; otherwise search again while the feed is short.
        const next = this.queued ?? (this.shouldFill() ? 'fill' : null);
        this.queued = null;
        if (next) return this.trigger(next);
      });
    return this.running;
  }

  /**
   * Stop the search in flight. Calls still running are ended, queued jobs are skipped, and no
   * search follows on its own. Postings already checked stay in the feed; ones read but not yet
   * decided are kept as pending and reviewed first by the next search. False when none is running.
   */
  stop(): boolean {
    if (!this.running || !this.abort || this.abort.signal.aborted) return false;
    this.queued = null;
    this.focus = null;
    this.abort.abort();
    return true;
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
    this.fillRuns = trigger === 'fill' ? this.fillRuns + 1 : 0;
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
      fill: `The feed has fewer than ${this.opts.feedTarget} opportunities, so the agents are searching again`,
    };
    log('System', TRIGGER_TEXT[trigger]);
    this.emitStudent();

    try {
      // 1. Master agent ---------------------------------------------------------------
      const master = node({ id: 'master', level: 'master', name: 'Master agent', role: 'Reads the profile, background and memory', status: 'running', detail: 'Reading the student…' });
      const memory = this.memory();
      const summary = summarize(memory);
      // A run the student started for one kind of opportunity puts every manager on that kind.
      const focus = this.focus;
      this.focus = null;
      const split = focus
        ? (Object.fromEntries(CATEGORIES.map((c) => [c, c === CATEGORY_OF[focus] ? this.opts.slots : 0])) as Record<Category, number>)
        : allocateSlots(this.profile.categories, categoryWeights(memory), this.opts.slots);
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
      const { brief, assignments } = await this.brain.master({
        profile: this.profile,
        memory: summary,
        resumeText: this.resume?.text ?? null,
        assignments: skeleton,
        pastSearches: this.searches.map((s) => s.query),
      });
      if (focus) {
        for (const a of assignments) a.focus = [MORE_OF[focus], ...a.focus.filter((f) => f !== MORE_OF[focus])].slice(0, 3);
        brief.preferences.push(`Find more ${MORE_OF[focus]}: the student asked for more of these just now.`);
        log('Master agent', `The student asked for more ${MORE_OF[focus]}, so every search manager is on them this time`, 'good');
      }
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
      const known = new Set([
        ...[...this.opportunities.values()].map((o) => o.sourceUrl),
        ...this.rejectedUrls,
        ...[...this.pending.values()].map((p) => p.candidate.sourceUrl),
      ]);
      let alreadyRejected = 0;
      type Found = { candidate: Candidate; managerId: string; alsoSeenAt: string[] };
      const found = new Map<string, Found>();

      // ---- validation, deadline finding and storing, posting by posting ------------------
      // Each posting is handed to the validation agents the moment a reader brings it back, while
      // the other workers keep searching. It is stored as pending as soon as it is read, and as a
      // feed result as soon as its reviews keep it, so nothing found waits for the end of the run.
      const verdicts = new Map<string, Partial<Record<ReviewFocus, Verdict>>>();
      const kept: Opportunity[] = [];
      const working: Promise<void>[] = [];
      const reviewSlot = limiter(Math.max(2, Math.min(this.opts.concurrency, 6)));
      let undated = 0;
      let filled = 0;

      // A posting whose own pages state no deadline is looked up on other public listings.
      // A date is only taken with the page and the words it was read from, and never one that has passed.
      const findDeadline = async (o: Opportunity) => {
        undated++;
        const hit = await fleet.run({ kind: 'deadline', managerId: o.foundBy, label: `Deadline: ${o.title}`, exempt: true }, async () => {
          const value = await this.brain.findDeadline(o);
          const due = value ? Date.parse(value.deadline) : NaN;
          const usable = value !== null && !Number.isNaN(due) && due >= now().getTime();
          return { value: usable ? value : null, summary: usable ? `${value.deadline.slice(0, 10)} on another listing` : value ? 'only a date that cannot be used' : 'no listing states one' };
        });
        if (!hit) return;
        o.deadline = new Date(hit.deadline).toISOString();
        o.deadlineSource = 'listing';
        o.unknowns = o.unknowns.filter((u) => u.field !== 'deadline');
        o.evidence = [...o.evidence.filter((e) => e.field !== 'deadline'), { field: 'deadline', quote: hit.quote, url: hit.url }];
        filled++;
        this.emitStudent();
      };

      /** Decide one posting once its last review is in. */
      const settle = (key: string, f: Found) => {
        const v = run.validations.find((x) => x.id === idFor(key))!;
        const against = v.reviews.filter((r) => r.status !== 'kept');
        if (against.length > 0) {
          v.status = 'rejected';
          v.reason = against.map((r) => `${r.reviewer}: ${r.reason}`).join(' ');
          run.stats.rejected++;
          const failedOnly = against.every((r) => r.reason?.startsWith('Could not be reviewed'));
          // A review that only failed to run says nothing about the posting: one found earlier
          // stays, and a new one is kept as pending to be reviewed again on the next run.
          if (!failedOnly) {
            this.pending.delete(key);
            this.opportunities.delete(v.id);
            this.rejected.set(key, v.reason);
            this.rejectedUrls.add(f.candidate.sourceUrl);
          }
          log('Validation agents', `Rejected "${f.candidate.title}". ${against.map((r) => `${r.reviewer}: ${r.reason}`).join(' ')}`.replace(/\.?$/, '.'), 'bad');
          this.emitStudent();
          return;
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
        const o: Opportunity = {
          ...c,
          id,
          origin: this.brain.mode === 'live' ? 'live' : 'prepared',
          fitExplanation: v.reason,
          unknowns,
          deadlineSource: c.deadline ? (c.deadlineSource ?? 'official') : null,
          foundAt: previous?.foundAt ?? now().toISOString(),
          lastCheckedAt: now().toISOString(),
          baseScore: fit,
          foundBy: assignments.find((a) => a.managerId === f.managerId)?.name ?? f.managerId,
          alsoSeenAt: f.alsoSeenAt,
          application: previous?.application ?? null,
        };
        kept.push(o);
        if (!previous) this.newIds.add(id);
        // Into the feed and the stored memory now. Later steps improve this same record.
        this.pending.delete(key);
        this.opportunities.set(id, o);
        run.stats.kept = kept.length;
        run.stats.added = this.newIds.size;
        this.emitStudent();
        if (!o.deadline) working.push(findDeadline(o).catch((e) => log('Worker fleet', `Deadline finder failed for "${o.title}": ${errorText(e)}`, 'bad')));
        // A re-found posting keeps the picture it already has.
        if (previous?.imageKind && previous.image) Object.assign(o, { image: previous.image, imageKind: previous.imageKind, imageCredit: previous.imageCredit, imageCreditUrl: previous.imageCreditUrl, imageTriedAt: previous.imageTriedAt });
        else if (finder) working.push(findImage(o).catch((e) => log('Worker fleet', `Picture finder failed for "${o.title}": ${errorText(e)}`, 'bad')));
      };

      /** Store a posting the moment it is read, and send it to every validation agent. */
      const review = (key: string, f: Found) => {
        this.pending.set(key, { key, candidate: f.candidate, managerId: f.managerId, alsoSeenAt: f.alsoSeenAt, foundAt: now().toISOString() });
        const v: Validation = {
          id: idFor(key),
          title: f.candidate.title,
          managerId: f.managerId,
          status: 'checking',
          reason: null,
          fit: null,
          reviews: REVIEWERS.map((r) => ({ focus: r.focus, reviewer: r.name, status: 'checking', reason: null, fit: null })),
        };
        run.validations.push(v);
        this.emitStudent();
        this.emitRun();
        const reviews = REVIEWERS.map((reviewer) =>
          reviewSlot(async () => {
            // Reviews still waiting for a free slot when the search is stopped never start.
            if (isStopped()) return;
            const r = v.reviews.find((x) => x.focus === reviewer.focus)!;
            try {
              const verdict = await this.brain.validate(f.candidate, brief, summary, reviewer.focus);
              verdicts.set(key, { ...verdicts.get(key), [reviewer.focus]: verdict });
              r.status = verdict.keep ? 'kept' : 'rejected';
              r.reason = verdict.reason;
              r.fit = verdict.keep ? verdict.fit : null;
            } catch (e) {
              // A review that could not be done is not a pass.
              r.status = 'rejected';
              r.reason = `Could not be reviewed: ${errorText(e)}`;
            }
            this.emitRun();
          }),
        );
        // A posting whose reviews a stop cut short is not decided: it stays pending for the next run.
        working.push(Promise.all(reviews).then(() => (isStopped() ? undefined : settle(key, f))));
      };

      // A picture for each posting: its event's own, else the organizer's logo, else a free stock
      // photo, else an illustration the agents draw. Fetching pages costs nothing; only drawing is a model call.
      const finder = this.opts.images;
      let pictured = 0;
      const findImage = async (o: Opportunity) => {
        if (!finder) return;
        if (this.picturing.has(o.id)) return;
        this.picturing.add(o.id);
        try {
          const found = await fleet.run({ kind: 'image', managerId: o.foundBy, label: `Picture: ${o.title}`, exempt: true }, async () => {
            const value = await finder.find(o, () => this.brain.illustrate(o));
            const label = { event: 'its own picture', logo: "the organizer's logo", stock: 'a free stock photo', generated: 'an AI-generated illustration' };
            return { value, summary: value ? label[value.kind] : 'no picture found' };
          });
          applyPicture(o, found, now());
          if (found) pictured++;
          this.emitStudent();
        } finally {
          this.picturing.delete(o.id);
        }
      };
      // Stored postings still without a picture are looked at alongside the search.
      void this.fillPictures(this.opts.imageBackfill ?? 30);

      // Postings an earlier run read but stopped before reviewing go first.
      const carried = [...this.pending.values()].filter((p) => !this.opportunities.has(idFor(p.key)) && !this.rejected.has(p.key));
      if (carried.length) {
        log('Validation agents', `${carried.length} postings read in an earlier search were not reviewed before it stopped. Reviewing them now.`);
        for (const p of carried) {
          const f: Found = { candidate: p.candidate, managerId: p.managerId, alsoSeenAt: p.alsoSeenAt };
          found.set(p.key, f);
          review(p.key, f);
        }
      }

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
            const planned = await this.brain.planJobs(a, brief, this.searches.filter((s) => s.category === a.category).map((s) => s.query));
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
                // Remembered, so later runs search somewhere else. The newest 400 are kept.
                if (leads) {
                  this.searches.push({ query: spec.query, label: spec.label, category: a.category, manager: a.name, at: now().toISOString(), run: run.number, leads });
                  if (this.searches.length > 400) this.searches.splice(0, this.searches.length - 400);
                }
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
                    const posting: Found = { candidate, managerId: a.managerId, alsoSeenAt: key === official ? [] : [lead.url] };
                    found.set(official, posting);
                    mine++;
                    review(official, posting);
                  }),
                );
              }),
            );
            if (duplicates) log(a.name, `Skipped ${duplicates} leads another worker already had`);
            set(manager, { status: 'done', detail: `Covered ${a.focus.join(', ')}. Brought back ${mine} postings${duplicates ? `, skipped ${duplicates} duplicates` : ''}.` });
          } catch (e) {
            if (isStopped()) set(manager, { status: 'done', detail: 'Stopped.' });
            else {
              set(manager, { status: 'failed', detail: errorText(e) });
              log(a.name, `Failed: ${errorText(e)}`, 'bad');
            }
          }
        }),
      );
      if (alreadyRejected) log('Worker fleet', `${alreadyRejected} postings were turned down in an earlier run and were not checked again`);
      run.stats.candidates = found.size;
      run.stats.jobs = fleet.started;
      run.stats.skipped = fleet.jobs.filter((j) => j.status === 'skipped').length;
      if (run.stats.skipped) log('Worker fleet', `${run.stats.skipped} jobs were not run: the run's budget was reached`);

      // 3. Waiting for the reviews and deadline finders still running -------------------
      while (working.length) await Promise.all(working.splice(0));
      throwIfStopped();
      run.stats.kept = kept.length;
      run.stats.added = this.newIds.size;
      this.emitRun();
      log('Validation agents', `Reviewed all ${run.validations.length} postings, ${REVIEWERS.length} reviews each, as they came in: kept ${kept.length}, rejected ${run.stats.rejected}`, 'good');
      if (finder && pictured) log('Worker fleet', `Found pictures for ${pictured} postings.`, 'good');
      if (undated) log('Worker fleet', `${undated} postings stated no deadline on the organizer's pages. Other listings gave one for ${filled}; the rest stay marked unknown.`, filled ? 'good' : 'info');

      throwIfStopped();
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

      throwIfStopped();
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
      if (shown < this.opts.feedTarget) {
        log('System', this.shouldFill() ? `${shown} of ${this.opts.feedTarget} opportunities found so far. Searching again for more.` : `${shown} of ${this.opts.feedTarget} opportunities found after ${this.fillRuns + 1} searches in a row. The agents will look again on the next run.`);
      }
    } catch (e) {
      if (e instanceof StoppedError || isStopped()) {
        run.status = 'stopped';
        for (const a of run.agents) if (a.status === 'running') Object.assign(a, { status: 'done', detail: 'Stopped.' });
        for (const v of run.validations) if (v.status === 'checking') v.reason = 'Stopped before the review finished. Reviewed first next time.';
        const pending = run.validations.filter((v) => v.status === 'checking').length;
        log('System', `Stopped by you. ${run.stats.kept} postings already checked stay in your feed${pending ? `; ${pending} still being reviewed are reviewed first next time` : ''}.`);
      } else {
        run.status = 'failed';
        run.error = errorText(e);
        for (const a of run.agents) if (a.status === 'running') a.status = 'failed';
        log('System', `Run failed: ${run.error}`, 'bad');
      }
    }
    run.finishedAt = now().toISOString();
    this.runs.push({ number: run.number, trigger: run.trigger, status: run.status, startedAt: run.startedAt, finishedAt: run.finishedAt, stats: { ...run.stats } });
    if (this.runs.length > 100) this.runs.splice(0, this.runs.length - 100);
    this.emitRun();
    this.emitStudent();
  }
}
