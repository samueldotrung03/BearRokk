// The agent system for one student: holds profile, history and results, starts runs on its own,
// and runs the master -> search managers -> worker fleet -> validators -> presentation manager chain.
import { createHash, randomBytes } from 'node:crypto';
import { addToCalendarUrl, type DeadlineEvent } from '../calendar.ts';
import { resumeInfo, type Resume, type ResumeInfo } from '../resume.ts';
import { canonicalUrl } from '../validate.ts';
import type { Brain, DraftedApplication } from './brain.ts';
import { cleanDraft, cleanTabs, emptyPortal, mergeTabs, PORTAL_LIMITS, portalBytes, tabsFromDraft, tabsFromPosting } from './portal.ts';
import { Fleet, limiter } from './fleet.ts';
import { KIND_TITLE, lineupNames, planLineup } from './lineup.ts';
import { AUTO_GAP_MS, dueSlots, nextSlot } from './autoMode.ts';
import { isStopped, StoppedError, throwIfStopped, withSignal } from './stop.ts';
import type { FoundImage, ImageFinder } from './images.ts';
import type { CalendarEventInput } from './eventSorter.ts';
import type { TrackerItem } from '../sheets.ts';
import { buildMemory, categoryWeights, noteSignals, rankFeed, summarize } from './scoring.ts';
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
  type AgentSettings,
  type LogEvent,
  type MemorySummary,
  type PendingPosting,
  type Portal,
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
  /** Automode: on or off, the next scheduled time, and searches waiting to run. */
  auto?: { on: boolean; nextAt: string | null; waiting: number; startsAt: string | null };
  /** The search managers the next search will have. */
  nextManagers?: { name: string; role: string }[];
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
/** Settings saved before kinds were split: "program" becomes its three kinds. */
function upgradeSettings(s: AgentSettings | undefined): AgentSettings {
  if (!s) return { models: {}, minimums: {}, kinds: [] };
  const kinds = (s.kinds ?? []).flatMap((k) => ((k as string) === 'program' ? (['hackathon', 'research', 'scholarship'] as OppType[]) : [k]));
  return { ...s, kinds: [...new Set(kinds)] };
}

/** Searches in a row the agents may run to reach a minimum the student set, so it cannot run forever. */
const MINIMUM_RUNS = 12;
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

/** True when the student has written in or attached something to the portal, so it is worth keeping. */
const portalHasWork = (portal: Portal | undefined) => !!portal?.tabs.some((t) => t.body.trim() || t.files.length || t.source === 'student');

/** "2 questions", "1 upload": a count for a note to the student. */
const countOf = (n: number, kind: 'question' | 'upload') => `${n} ${kind}${n === 1 ? '' : 's'}`;
const tabsOf = (tabs: { kind: string }[], kind: 'question' | 'upload') => countOf(tabs.filter((t) => t.kind === kind).length, kind);

/** What the posting says about itself, for the application drafter. */
function postingSummary(o: Opportunity): string | null {
  const parts = [
    o.eligibility ? `Who can apply: ${o.eligibility}` : '',
    o.field ? `Field: ${o.field}` : '',
    o.tags.length ? `Tags: ${o.tags.join(', ')}` : '',
    o.location ? `Location: ${o.location}` : '',
    o.deadline ? `Deadline: ${o.deadline}` : '',
  ].filter(Boolean);
  return parts.length ? parts.join('. ') : null;
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
  /** Models per agent group and minimums per kind, from the Agents page. */
  private agentSettings: AgentSettings = { models: {}, minimums: {}, kinds: [] };
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
  /** Automode: scheduled times already run (ISO), the check timer, and when the last search ended. */
  private autoDone: string[] = [];
  private autoTimer: NodeJS.Timeout | null = null;
  private lastRunEnded = 0;
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
      // Only the kinds of opportunity the student asked for, in their profile or their agent settings.
      feed: rankFeed([...this.opportunities.values()].filter((o) => this.profile.categories.includes(CATEGORY_OF[o.type]) || (this.agentSettings.kinds ?? []).includes(o.type)), memory, {
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
      nextManagers: this.nextManagers(memory),
      auto: this.autoStatus(),
    };
  }

  /** The search managers the next search will have, for the Agents page to show before it runs. */
  private nextManagers(memory: ReturnType<AgentSystem['memory']>): { name: string; role: string }[] {
    const kinds = this.searchKinds();
    const lineup = planLineup(kinds.length ? kinds : (Object.keys(CATEGORY_OF) as OppType[]), categoryWeights(memory), this.opts.slots);
    const names = lineupNames(lineup);
    return lineup.map((s, i) => ({ name: names[i]!, role: [MORE_OF[s.kind], ...s.also.map((t) => MORE_OF[t])].join(', ') }));
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
    if (this.run?.status === 'failed' || this.run?.status === 'stopped') return false;
    // A minimum the student set keeps the agents going, up to MINIMUM_RUNS searches in a row.
    if (this.unmetMinimum() && this.fillRuns < MINIMUM_RUNS) return true;
    if (this.opts.feedTarget <= 0) return false;
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

  /** An event from the student's own words, for the calendar's chat box. */
  draftCalendarEvent(text: string, today: string, timeZone: string) {
    return this.brain.draftEvent(text, today, timeZone);
  }

  /** Sort the student's own calendar events into career-related and personal, with the agents' model. */
  sortCalendarEvents(events: CalendarEventInput[]) {
    return this.brain.sortEvents(events);
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
        agentSettings: this.agentSettings,
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
        autoDone: this.autoDone,
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
    this.agentSettings = upgradeSettings(p?.agentSettings);
    this.autoDone = [...(memory.learned?.autoDone ?? [])];
    this.brain.setModels?.(this.agentSettings.models);
    this.interactions = structuredClone(l.interactions ?? []);
    this.opportunities = new Map((l.opportunities ?? []).map((o) => [o.id, structuredClone(o)]));
    this.reasons = new Map(Object.entries(l.reasons ?? {}));
    this.rejected = new Map((l.rejected ?? []).map((r) => [r.url, r.reason]));
    this.rejectedUrls = new Set(l.rejectedUrls ?? []);
    this.searches = structuredClone(l.searches ?? []);
    this.pending = new Map((l.pending ?? []).map((p) => [p.key, structuredClone(p)]));
    this.runs = structuredClone(l.runs ?? []);
    // Applications saved before the portal existed get an empty one.
    this.applications = new Map((l.applications ?? []).map((a) => [a.opportunityId, { ...structuredClone(a), custom: a.custom ?? false, portal: a.portal ? structuredClone(a.portal) : emptyPortal() }]));
    this.runCount = l.runCount ?? this.runs.length;
    this.newIds = new Set();
    // setSchedule announces the restored state; it must not be saved straight back.
    const saver = this.saver;
    this.saver = null;
    this.setSchedule(p?.scheduleSeconds ?? 0);
    this.saver = saver;
    this.syncAutoTimer();
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
      else if (!nowSaved && app?.status === 'interested' && Object.keys(app.drafts).length === 0 && !portalHasWork(app.portal)) this.removeApplication(opportunityId);
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
    const lines = [app.organizer ? `Deadline for ${app.title} at ${app.organizer}.` : `Deadline for ${app.title}.`];
    if (app.actionUrl) lines.push(`Apply: ${app.actionUrl}`);
    if (app.materials.length) lines.push(`Needs: ${app.materials.join(', ')}`);
    return { title: app.organizer ? `Due: ${app.title} (${app.organizer})` : `Due: ${app.title}`, deadline: app.deadline, description: lines.join('\n') };
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
      custom: false,
      portal: emptyPortal(),
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
    // Applying is the strongest signal the ranking gets. A custom application has no posting to rank.
    if (app.status === 'applied' && before !== 'applied' && !app.custom) this.interactions.push({ opportunityId, action: 'apply', at: now.toISOString() });
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

  getAgentSettings() {
    return this.agentSettings;
  }

  /** Saved with the account; a minimum applies from the next search. */
  setAgentSettings(settings: AgentSettings) {
    const kinds = settings.kinds ?? [];
    // A minimum only counts for a kind being searched for.
    const searched = new Set(kinds.length ? kinds : this.profileKinds());
    const minimums = Object.fromEntries(Object.entries(settings.minimums).filter(([t]) => t === 'any' || searched.has(t as OppType)));
    // Turning Automode on starts from now: times earlier today do not all run at once.
    const before = this.agentSettings.auto;
    const auto = settings.auto ? { ...settings.auto, since: settings.auto.on ? (before?.on ? (before.since ?? this.opts.now().toISOString()) : this.opts.now().toISOString()) : null } : before;
    this.agentSettings = { ...settings, kinds, minimums, ...(auto ? { auto } : {}) };
    this.brain.setModels?.(settings.models);
    this.syncAutoTimer();
    this.emitStudent();
  }

  /** Check every half minute while Automode is on; a laptop waking from sleep is caught by the next check. */
  private syncAutoTimer() {
    const on = this.agentSettings.auto?.on === true;
    if (on && !this.autoTimer) {
      this.autoTimer = setInterval(() => this.checkAuto(), 30_000);
      this.autoTimer.unref();
    } else if (!on && this.autoTimer) {
      clearInterval(this.autoTimer);
      this.autoTimer = null;
    }
  }

  /** BearRok is open when its window is connected to this student's agents. */
  private appOpen() {
    return this.listeners.size > 0;
  }

  /**
   * Start the oldest waiting Automode search, when BearRok is open, no search is running, and the
   * last one ended at least 10 minutes ago. True when one started.
   */
  checkAuto(): boolean {
    const auto = this.agentSettings.auto;
    if (!auto?.on || !this.appOpen() || this.running) return false;
    const now = this.opts.now();
    if (this.lastRunEnded && now.getTime() - this.lastRunEnded < AUTO_GAP_MS) return false;
    const due = dueSlots(now, auto.times, auto.timeZone, auto.since, this.autoDone);
    if (!due.length) return false;
    this.autoDone = [...this.autoDone, due[0]!].slice(-30);
    void this.trigger('auto');
    return true;
  }

  /** What the Agents page shows about Automode. */
  autoStatus(): { on: boolean; nextAt: string | null; waiting: number; startsAt: string | null } {
    const auto = this.agentSettings.auto;
    if (!auto?.on) return { on: false, nextAt: null, waiting: 0, startsAt: null };
    const now = this.opts.now();
    const waiting = dueSlots(now, auto.times, auto.timeZone, auto.since, this.autoDone).length;
    const startsAt = waiting ? new Date(Math.max(now.getTime(), this.lastRunEnded ? this.lastRunEnded + AUTO_GAP_MS : 0)).toISOString() : null;
    return { on: true, nextAt: nextSlot(now, auto.times, auto.timeZone), waiting, startsAt };
  }

  /** The kinds of opportunity the student's profile asks for. */
  profileKinds(): OppType[] {
    return (Object.keys(CATEGORY_OF) as OppType[]).filter((t) => this.profile.categories.includes(CATEGORY_OF[t]));
  }

  /** The kinds searches cover: the ones ticked in the agent settings, or else the profile's. */
  searchKinds(): OppType[] {
    return this.agentSettings.kinds?.length ? this.agentSettings.kinds : this.profileKinds();
  }

  /**
   * The first minimum the feed does not reach yet, with how many it has: a kind's own number first,
   * then the total across every kind searched for (type null: any of them counts).
   */
  private unmetMinimum(): { type: OppType | null; have: number; want: number } | null {
    const now = this.opts.now().getTime();
    const searched = new Set(this.searchKinds());
    const feed = this.student().feed.filter((e) => searched.has(e.opportunity.type) && (!e.opportunity.deadline || Date.parse(e.opportunity.deadline) >= now));
    for (const [type, want] of Object.entries(this.agentSettings.minimums) as [OppType | 'any', number][]) {
      if (type === 'any' || !want || want <= 0 || !searched.has(type)) continue;
      const have = feed.filter((e) => e.opportunity.type === type).length;
      if (have < want) return { type, have, want };
    }
    const total = this.agentSettings.minimums.any ?? 0;
    if (total > 0 && feed.length < total) return { type: null, have: feed.length, want: total };
    return null;
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

  // ---- the application portal: the application written inside the app ------------------------

  /**
   * Start an application, as To apply. With a posting's id it tracks that posting; one already
   * tracked comes back as it is. Without one it is the student's own, with no posting behind it.
   * Null for a posting that does not exist. Nothing is drafted here: the page asks for that.
   */
  createApplication(
    input: { opportunityId: string } | { title: string; organizer: string; deadline: string | null; actionUrl: string | null },
  ): { application: Application; created: boolean } | null {
    if ('opportunityId' in input) {
      const existing = this.applications.get(input.opportunityId);
      if (existing) return { application: existing, created: false };
      const application = this.setApplication(input.opportunityId, { status: 'to_apply' });
      return application ? { application, created: true } : null;
    }
    let id = `custom-${randomBytes(6).toString('hex')}`;
    while (this.applications.has(id)) id = `custom-${randomBytes(6).toString('hex')}`;
    this.applications.set(id, {
      opportunityId: id,
      title: input.title,
      organizer: input.organizer,
      status: 'to_apply',
      updatedAt: this.opts.now().toISOString(),
      deadline: input.deadline,
      actionUrl: input.actionUrl,
      prompts: [],
      materials: [],
      drafts: {},
      reminders: [],
      needsDeadline: false,
      calendar: { state: 'none', eventId: null, htmlLink: null, addUrl: null, error: null },
      custom: true,
      portal: emptyPortal(),
    });
    // Goes through the usual path so reminders and the calendar link are set the same way.
    return { application: this.setApplication(id, { status: 'to_apply' })!, created: true };
  }

  getPortal(opportunityId: string): { application: Application; portal: Portal } | null {
    const application = this.applications.get(opportunityId);
    if (!application) return null;
    application.portal ??= emptyPortal();
    return { application, portal: application.portal };
  }

  /**
   * Save the portal's tabs as the page sent them, in order, after making them safe to store.
   * Refused when it would make this application, or every portal on the account together, too
   * big to store; a save that makes it smaller always goes through.
   */
  savePortal(opportunityId: string, rawTabs: unknown[]): { ok: true; portal: Portal } | { ok: false; reason: 'not found' | 'too large' } {
    const app = this.applications.get(opportunityId);
    if (!app) return { ok: false, reason: 'not found' };
    const before = app.portal ?? emptyPortal();
    const now = this.opts.now().toISOString();
    const portal: Portal = { tabs: cleanTabs(rawTabs, before.tabs, now), drafted: before.drafted };
    const size = portalBytes(portal);
    const others = [...this.applications.values()].reduce((sum, a) => (a === app || !a.portal ? sum : sum + portalBytes(a.portal)), 0);
    if ((size > PORTAL_LIMITS.portalBytes || others + size > PORTAL_LIMITS.accountBytes) && size > portalBytes(before)) return { ok: false, reason: 'too large' };
    const changed = JSON.stringify(portal.tabs) !== JSON.stringify(before.tabs);
    app.portal = portal;
    if (changed) {
      app.updatedAt = now;
      this.emitStudent();
    }
    return { ok: true, portal };
  }

  /**
   * Look for the application's questions and uploads and add them as tabs. What the posting's
   * own application reader found comes first (source "posting"), then what the drafter found on
   * the web (source "agents"). Tabs already there are never replaced or removed, and a question
   * already on a tab is not added twice. Null when the application does not exist.
   */
  async draftPortal(opportunityId: string): Promise<Portal | null> {
    const app = this.applications.get(opportunityId);
    if (!app) return null;
    const opp = app.custom ? null : (this.opportunities.get(opportunityId) ?? null);
    const known = opp?.application ?? (app.prompts.length || app.materials.length ? { prompts: app.prompts, materials: app.materials } : null);
    const link = app.actionUrl ?? opp?.actionUrl ?? opp?.sourceUrl ?? null;

    let draft: DraftedApplication | null = null;
    // Why the search found nothing, when it never ran or failed.
    let missed: string | null = null;
    if (!opp && !link) missed = "There is no posting or link to look for this application's questions on. Add its questions and uploads yourself as tabs.";
    else if (!this.brain.draftApplication) missed = "The agents cannot look for this application's questions right now. Add them yourself as tabs.";
    else {
      try {
        draft = cleanDraft(
          await this.brain.draftApplication({
            title: app.title,
            organizer: app.organizer,
            type: opp?.type ?? null,
            sourceUrl: opp?.sourceUrl ?? null,
            actionUrl: link,
            summary: opp ? postingSummary(opp) : null,
            known,
          }),
        );
      } catch (e) {
        console.error('application drafter failed:', errorText(e));
        missed = 'The agents could not look for the questions this time. Try again in a moment, or add them yourself as tabs.';
      }
    }

    // The application may have been removed while the agents looked.
    const current = this.applications.get(opportunityId);
    if (!current) return null;
    const now = this.opts.now().toISOString();
    const fromPosting = tabsFromPosting(known, now);
    const before = current.portal ?? emptyPortal();
    const { tabs, added } = mergeTabs(before.tabs, [...fromPosting, ...(draft?.found ? tabsFromDraft(draft, now) : [])]);
    const found = fromPosting.length > 0 || !!draft?.found;
    let note: string;
    if (draft?.found) note = draft.note || `Found ${countOf(draft.questions.length, 'question')} and ${countOf(draft.uploads.length, 'upload')}.`;
    else if (fromPosting.length) note = `Taken from the posting's application page: ${tabsOf(fromPosting, 'question')} and ${tabsOf(fromPosting, 'upload')}.${missed ? ` ${missed}` : ''}`;
    else note = draft?.note || missed || "This application's questions could not be found. Add them yourself as tabs.";
    if (found && added.length === 0) note += ' Your tabs already cover all of it, so nothing new was added.';

    current.portal = { tabs, drafted: { at: now, found, note } };
    if (added.length) current.updatedAt = now;
    this.emitStudent();
    return current.portal;
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
        this.lastRunEnded = this.opts.now().getTime();
        // Something the student did comes first; otherwise search again while the feed is short.
        const next = this.queued ?? (this.shouldFill() ? 'fill' : null);
        // A follow-up for an unmet minimum searches for that kind only.
        if (next === 'fill') {
          const unmet = this.unmetMinimum();
          // A total searches every kind again; a kind's own number searches that kind.
          if (unmet?.type) this.focus = unmet.type;
        }
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
      auto: 'Automode: a scheduled daily search',
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
      // The kinds chosen in the agent settings, when any, or else the ones the profile asks for.
      const searchKinds = this.searchKinds();
      // One kind per manager (see lineup.ts); with no kinds at all, every category once.
      const lineup = planLineup(searchKinds.length ? searchKinds : (Object.keys(CATEGORY_OF) as OppType[]), categoryWeights(memory), this.opts.slots, focus);
      const names = lineupNames(lineup);
      const perManager = Math.floor(this.opts.maxJobs / this.opts.slots);
      const skeleton: Assignment[] = lineup.map((slot, i) => ({
        managerId: `manager-${i + 1}`,
        name: names[i]!,
        category: CATEGORY_OF[slot.kind],
        kind: slot.kind,
        also: slot.also,
        lens: 'all',
        focus: [],
        budget: perManager,
        others: [],
      }));
      const split = Object.fromEntries(CATEGORIES.map((c) => [c, skeleton.filter((a) => a.category === c).length])) as Record<Category, number>;
      const { brief, assignments } = await this.brain.master({
        profile: this.profile,
        memory: summary,
        resumeText: this.resume?.text ?? null,
        assignments: skeleton,
        pastSearches: this.searches.map((s) => s.query),
      });
      // The master chooses lenses and focus; the kind and name stay the ones planned here.
      for (const a of assignments) {
        const planned = skeleton.find((x) => x.managerId === a.managerId);
        if (planned) Object.assign(a, { kind: planned.kind, also: planned.also, name: planned.name, category: planned.category });
      }
      // Programs cover hackathons, research and scholarships: each program manager is told its own kind.
      for (const a of assignments) {
        const kind = a.kind ?? skeleton.find((s) => s.managerId === a.managerId)?.kind;
        if (!kind || CATEGORY_OF[kind] !== 'program') continue;
        const covers = [kind, ...(a.also ?? [])];
        // A manager covering every program kind needs no narrowing.
        if (covers.length >= 3) continue;
        const words = covers.map((t) => MORE_OF[t]);
        // The master's own focus values stay first: the search plans are built from them.
        a.focus = [...a.focus.filter((f) => !words.includes(f)).slice(0, 3 - words.length), ...words];
      }
      const programs = searchKinds.filter((t) => CATEGORY_OF[t] === 'program');
      if (!focus && programs.length > 0 && programs.length < 3) brief.preferences.push(`Programs: look only for ${programs.map((t) => MORE_OF[t]).join(' and ')}.`);
      if (focus) {
        // The kind goes after the managers' own focus values, which the search plans are built from.
        for (const a of assignments) a.focus = [...a.focus.filter((f) => f !== MORE_OF[focus]).slice(0, 2), MORE_OF[focus]];
        brief.preferences.push(`Find more ${MORE_OF[focus]}: the student asked for more of these just now.`);
        log('Master agent', `The student asked for more ${MORE_OF[focus]}, so every search manager is on them this time`, 'good');
      }
      run.brief = brief;
      run.assignments = assignments;
      const mix = [...new Set(lineup.map((s) => s.kind))].map((k) => `${lineup.filter((s) => s.kind === k).length} on ${MORE_OF[k]}`);
      void split;
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
          const manager = node({ id: a.managerId, level: 'manager', name: a.name, role: `${a.kind ? [MORE_OF[a.kind], ...(a.also ?? []).map((t) => MORE_OF[t])].join(', ').replace(/^./, (c) => c.toUpperCase()) : CATEGORY_LABEL[a.category]}, ${lens}`, status: 'running', detail: 'Planning the search…' });
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
      const unmet = this.unmetMinimum();
      if (unmet) {
        const what = unmet.type ? MORE_OF[unmet.type] : 'opportunities';
        log('System', this.fillRuns + 1 < MINIMUM_RUNS ? `${unmet.have} of the ${unmet.want} ${what} you asked for so far. Searching again for more.` : `${unmet.have} of the ${unmet.want} ${what} you asked for after ${this.fillRuns + 1} searches in a row. Stopping here; the next search tries again.`);
      } else if (shown < this.opts.feedTarget) {
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
