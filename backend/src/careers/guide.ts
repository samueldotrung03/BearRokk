// Career guides for the Career discovery page, run by the agent system's career discovery skill
// (src/agents/skills/careerDiscovery.ts). For any career a student types, the master plans the
// guide, one manager per part writes its researcher's job, the researchers run on the shared worker
// fleet, a validator per part checks what they found, and the presentation agent writes the summary
// over the posts. How to start is researched after the interviews, so every interview format gets a
// step that prepares for it. "Add more" runs the same levels for one part, starting from the
// master's reading of what the student asked. Guides are kept and shared by every student; each
// student sees only their own asks.
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import type { z } from 'zod';
import { config, liveAvailable, provider } from '../config.ts';
import { grokJson, type GrokTool } from '../grok.ts';
import { Fleet } from '../agents/fleet.ts';
import type { Job } from '../agents/types.ts';
import { managerBrief, master, presentation, researcher, validator, type AgentCall } from '../agents/skills/careerDiscovery.ts';
import type { StudentContext } from '../agents/skills/index.ts';
import {
  mergeSection,
  SECTION_IDS,
  SECTION_NAMES,
  summarize,
  unpreparedFormats,
  type Guide,
  type GuideAsk,
  type GuideEvent,
  type SectionData,
  type SectionId,
  type SectionState,
} from './schemas.ts';

export { mergeSection, SECTION_IDS, type Guide, type SectionId } from './schemas.ts';

/** One model call. The default goes through grok.ts (xAI API, Grok CLI, or Claude while testing). */
export type Ask = <S extends z.ZodType>(opts: { name: string; system: string; user: string; schema: S; tools?: GrokTool[]; model?: string }) => Promise<{ data: z.infer<S> }>;

export class CareerError extends Error {
  readonly status: 400 | 404 | 409 | 503;
  constructor(message: string, status: 400 | 404 | 409 | 503) {
    super(message);
    this.status = status;
  }
}

type Env = { live: () => boolean; provider: () => Guide['provider']; canSearchX: () => boolean };

export function slugFor(query: string): string {
  return query
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
}

const emptySection = <T>(): SectionState<T> => ({ status: 'waiting', data: null, sample: false, error: null, added: null });

/** The models behind each tier, for the transport in use. */
function tierModels(): { normal?: string; low?: string } {
  if (config.grokTransport === 'claude') return config.claudeCli.models;
  if (config.grokTransport === 'cli') return config.grokCli.models;
  return config.xaiModels;
}

const MAX_ACTIVITY = 80;
/** Two sentences of at most 25 words each, with a little room. */
const MAX_SUMMARY_WORDS = 60;
const SIMULATED = 'Your agents are simulated right now, so they cannot research careers. Connect Grok in Settings.';
/** What an "Add more" with no words of its own asks for. */
const DEFAULT_PROMPT = 'Find more of what this part covers.';

/** The fleet's job labels, as the activity log names each agent. */
const agentName = (section: SectionId, role: 'manager' | 'researcher' | 'validator') => `${SECTION_NAMES[section]} ${role}`;

export class CareerGuides {
  private guides = new Map<string, Guide>();
  private running = new Set<string>();
  private suggestions = new Map<string, string[]>();
  private readonly file: string | null;
  private readonly ask: Ask;
  private readonly env: Env;

  constructor(
    file: string | null = config.careerGuidesFile,
    ask: Ask = grokJson,
    env: Env = {
      live: liveAvailable,
      provider,
      // Only Grok can read X. While testing on Claude the stories are written as labelled samples.
      canSearchX: () => config.grokTransport !== 'claude',
    },
  ) {
    this.file = file;
    this.ask = ask;
    this.env = env;
    this.load();
  }

  list(limit = 12): Pick<Guide, 'slug' | 'title' | 'oneLine' | 'updatedAt' | 'status'>[] {
    return [...this.guides.values()]
      .filter((g) => g.status === 'ready' || g.status === 'researching')
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
      .slice(0, limit)
      .map(({ slug, title, oneLine, updatedAt, status }) => ({ slug, title, oneLine, updatedAt, status }));
  }

  get(slug: string): Guide | null {
    return this.guides.get(slug) ?? null;
  }

  /** The guide as one student sees it: their own asks, and only the activity that is not someone else's ask. */
  view(slug: string, by: string | null): Guide | null {
    const guide = this.guides.get(slug);
    if (!guide) return null;
    this.backfillSummary(guide);
    const mine = guide.asks.filter((a) => by && a.by === by);
    const ids = new Set(mine.map((a) => a.id));
    return { ...guide, asks: mine, activity: guide.activity.filter((e) => e.ask === null || ids.has(e.ask)) };
  }

  /** Returns the kept guide, or starts researching one. A refresh keeps the old parts on screen until new ones arrive. */
  start(query: string, refresh = false): Guide {
    const clean = query.replace(/\s+/g, ' ').trim();
    if (clean.length < 2 || clean.length > 60) throw new CareerError('Type a career between 2 and 60 characters.', 400);
    const slug = slugFor(clean);
    if (!slug) throw new CareerError('Type a career using letters or numbers.', 400);

    const existing = this.guides.get(slug);
    if (existing && this.busy(slug)) return existing;
    if (existing && existing.status === 'ready' && !refresh) return existing;
    if (!this.env.live()) throw new CareerError(SIMULATED, 503);

    const now = new Date().toISOString();
    const guide: Guide = existing
      ? { ...existing, status: 'planning', startedAt: now, updatedAt: now, error: null, provider: this.env.provider(), activity: [] }
      : {
          slug,
          query: clean,
          title: clean,
          oneLine: null,
          field: null,
          angles: null,
          status: 'planning',
          provider: this.env.provider(),
          startedAt: now,
          updatedAt: now,
          error: null,
          sections: { basics: emptySection(), voices: emptySection(), interview: emptySection(), start: emptySection() },
          asks: [],
          activity: [],
        };
    for (const id of SECTION_IDS) Object.assign(guide.sections[id], { status: 'waiting', error: null, added: null });
    this.guides.set(slug, guide);
    this.running.add(slug);
    this.save();
    void this.research(guide).finally(() => this.running.delete(slug));
    return guide;
  }

  /**
   * "Add more" on one part, with what the student asked. It runs the same levels as a first search,
   * for this part only: the master reads the request, the part's manager writes the job, the
   * researcher looks, the validator checks, and the presentation agent merges it in.
   */
  more(slug: string, id: string, request: { prompt?: string; by?: string; student?: StudentContext | null } = {}): { guide: Guide; ask: GuideAsk } {
    const guide = this.guides.get(slug);
    if (!guide) throw new CareerError('No guide for this career yet.', 404);
    if (!(SECTION_IDS as readonly string[]).includes(id)) throw new CareerError('There is no such part of the guide.', 404);
    const section = id as SectionId;
    if (this.running.has(slug)) throw new CareerError('The guide is still being researched. Wait until it is ready.', 409);
    if (this.running.has(`${slug}/${section}`)) throw new CareerError('The agents are already finding more for this part. Wait until they finish.', 409);
    if (!guide.sections[section].data) throw new CareerError('This part has nothing yet. Search again first.', 409);
    if (!this.env.live()) throw new CareerError(SIMULATED, 503);

    const prompt = (request.prompt ?? '').replace(/\s+/g, ' ').trim().slice(0, 300) || DEFAULT_PROMPT;
    const ask: GuideAsk = { id: `ask-${Date.now().toString(36)}-${guide.asks.length + 1}`, section, by: request.by || 'guest', prompt, at: new Date().toISOString(), status: 'working', added: 0, note: null };
    guide.asks.push(ask);
    const task = `${slug}/${section}`;
    this.running.add(task);
    this.setSection(guide, section, { status: 'working', error: null });
    this.log(guide, 'Master', `Asked for more on ${SECTION_NAMES[section].toLowerCase()}: "${prompt}"`, 'info', ask.id);
    void this.askPart(guide, section, ask, request.student ?? null).finally(() => this.running.delete(task));
    return { guide: this.view(slug, ask.by)!, ask };
  }

  /** Requests to offer in the "Add more" window: from what the part holds, the student, and what they asked before. */
  async suggest(slug: string, id: string, request: { by?: string; student?: StudentContext | null } = {}): Promise<string[]> {
    const guide = this.guides.get(slug);
    if (!guide) throw new CareerError('No guide for this career yet.', 404);
    if (!(SECTION_IDS as readonly string[]).includes(id)) throw new CareerError('There is no such part of the guide.', 404);
    const section = id as SectionId;
    if (!guide.sections[section].data) return [];
    if (!this.env.live()) throw new CareerError(SIMULATED, 503);
    const holds = summarize(section, guide.sections[section].data);
    const pastAsks = guide.asks.filter((a) => a.section === section && a.by === (request.by || 'guest')).map((a) => a.prompt);
    const cacheKey = JSON.stringify([slug, section, holds.length, pastAsks, request.student ?? null]);
    const kept = this.suggestions.get(cacheKey);
    if (kept) return kept;
    const { prompts } = await this.call(presentation.suggest({ guide, section, holds, student: request.student ?? null, pastAsks }));
    const clean = prompts.map((p) => p.trim()).filter((p) => p.length > 3 && p.length <= 120).slice(0, 3);
    this.suggestions.set(cacheKey, clean);
    return clean;
  }

  /** Resolves when nothing is running for this guide: its research and any "Add more". For tests. */
  async settled(slug: string): Promise<Guide | null> {
    while (this.busy(slug)) await new Promise((r) => setTimeout(r, 5));
    return this.get(slug);
  }

  private busy(slug: string) {
    return [...this.running].some((t) => t === slug || t.startsWith(`${slug}/`));
  }

  private call<S extends z.ZodType>(c: AgentCall<S>): Promise<z.infer<S>> {
    const models = tierModels();
    return this.ask({ name: c.name, system: c.system, user: c.user, schema: c.schema, tools: c.tools, model: c.tier === 'normal' ? models.normal : models.low }).then((r) => r.data);
  }

  /** A fleet for one run of this guide. Its jobs are written to the guide's activity as they start and finish. */
  private fleet(guide: Guide, ask: string | null): Fleet {
    return new Fleet({
      concurrency: 4,
      maxJobs: 24,
      onUpdate: (job: Job) => {
        if (job.status === 'running' && job.attempts === 1) this.log(guide, job.label, 'Started', 'info', ask);
        if (job.status === 'running' && job.attempts > 1) this.log(guide, job.label, 'Trying once more', 'info', ask);
        if (job.status === 'done') this.log(guide, job.label, job.result ?? 'Done', 'good', ask);
        if (job.status === 'failed') this.log(guide, job.label, `Failed: ${job.result ?? 'no answer'}`, 'bad', ask);
      },
    });
  }

  /**
   * One part, from its manager to its validator. `holds` is set for an "Add more", so the
   * researcher looks for new items only. Throws when the researcher brought nothing back.
   */
  private async runPart<K extends SectionId>(
    guide: Guide,
    section: K,
    ctx: { fleet: Fleet; focus: string | null; holds: string | null; formats: string[]; student: StudentContext | null; ask: string | null },
  ): Promise<SectionData[K]> {
    const sample = section === 'voices' && !this.env.canSearchX();
    const brief = managerBrief({ guide, section, focus: ctx.focus, holds: ctx.holds, formats: ctx.formats, student: ctx.student });
    this.log(guide, agentName(section, 'manager'), ctx.holds === null ? 'Handed the researcher its job' : 'Handed the researcher a job for new items only', 'info', ctx.ask);

    const found = await ctx.fleet.run({ kind: 'guide-research', managerId: section, label: agentName(section, 'researcher') }, async () => {
      const value = await this.call(researcher(section, brief, { canSearchX: this.env.canSearchX() }));
      return { value, summary: `Brought back ${countItems(section, value)} items` };
    });
    if (!found) throw new Error(`The ${SECTION_NAMES[section].toLowerCase()} researcher brought nothing back.`);

    // The validator is exempt from the budget: a part is never saved unchecked because the run was busy.
    const reviewed = await ctx.fleet.run({ kind: 'guide-review', managerId: section, label: agentName(section, 'validator'), exempt: true }, async () => {
      const value = await this.call(validator(section, found, { sample, formats: ctx.formats }));
      return { value, summary: value.removed.length ? `Took out ${value.removed.length}: ${value.removed.map((r) => r.reason).slice(0, 2).join('; ')}` : 'Every item follows the rules' };
    });
    // Without a review the researcher's answer is kept as it came, and the log says so.
    if (!reviewed) this.log(guide, agentName(section, 'validator'), 'Could not check this part; kept as the researcher wrote it', 'bad', ctx.ask);
    const data = (reviewed?.data ?? found) as Record<string, unknown>;
    return (section === 'voices' ? { summary: null, ...data } : data) as SectionData[K];
  }

  /**
   * Guides researched before the summary existed, or whose summary is longer than two short
   * sentences, get one written the first time they are opened. Runs once at a time per guide.
   */
  private backfillSummary(guide: Guide) {
    const s = guide.sections.voices;
    const words = s.data?.summary?.split(/\s+/).length ?? 0;
    const task = `${guide.slug}/voices-summary`;
    if (!s.data?.posts.length || (s.data.summary && words <= MAX_SUMMARY_WORDS) || !this.env.live()) return;
    if (this.running.has(task) || this.running.has(guide.slug) || this.running.has(`${guide.slug}/voices`)) return;
    this.running.add(task);
    void this.summarizeVoices(guide, null).finally(() => this.running.delete(task));
  }

  /** The presentation agent's two sentences over every post. Keeps the old summary if it cannot write one. */
  private async summarizeVoices(guide: Guide, ask: string | null) {
    const s = guide.sections.voices;
    if (!s.data?.posts.length) return;
    try {
      const { summary } = await this.call(presentation.voicesSummary(guide.title, s.data.posts, s.sample));
      this.setSection(guide, 'voices', { data: { ...s.data, summary } });
      this.log(guide, 'Presentation', 'Wrote the summary of what people say', 'good', ask);
    } catch (e) {
      this.log(guide, 'Presentation', `Could not write the summary: ${message(e)}`, 'bad', ask);
    }
  }

  private async research(guide: Guide) {
    try {
      this.log(guide, 'Master', `Routed "${guide.query}" to career discovery and is planning the guide`, 'info', null);
      const plan = await this.call(master.plan(guide.query));
      this.update(guide, { title: plan.title, oneLine: plan.oneLine, field: plan.field, angles: plan.angles, status: 'researching' });
      this.log(guide, 'Master', `Planned the guide to ${plan.title}`, 'good', null);
    } catch (e) {
      this.update(guide, { status: 'failed', error: `Could not plan the guide: ${message(e)}` });
      this.log(guide, 'Master', `Could not plan the guide: ${message(e)}`, 'bad', null);
      return;
    }

    const fleet = this.fleet(guide, null);
    const part = async (id: SectionId, formats: string[] = []) => {
      this.setSection(guide, id, { status: 'working' });
      try {
        const data = await this.runPart(guide, id, { fleet, focus: null, holds: null, formats, student: null, ask: null });
        this.setSection(guide, id, { status: 'done', data: data as never, sample: id === 'voices' && !this.env.canSearchX(), error: null });
        if (id === 'voices') await this.summarizeVoices(guide, null);
      } catch (e) {
        this.setSection(guide, id, { status: 'failed', error: message(e) });
      }
    };

    // How to start waits for the interviews, so its steps can be written to prepare for each format.
    await Promise.all([
      part('basics'),
      part('voices'),
      part('interview').then(() => part('start', guide.sections.interview.data?.formats.map((f) => f.name) ?? [])),
    ]);

    const failed = SECTION_IDS.filter((id) => guide.sections[id].status === 'failed');
    this.update(guide, failed.length === SECTION_IDS.length ? { status: 'failed', error: 'None of the four parts could be researched.' } : { status: 'ready' });
    this.log(guide, 'Master', failed.length ? `Finished; ${failed.length} part(s) could not be researched` : 'Finished the guide', failed.length ? 'bad' : 'good', null);
  }

  private async askPart(guide: Guide, section: SectionId, ask: GuideAsk, student: StudentContext | null) {
    const done = (patch: Partial<GuideAsk>) => {
      Object.assign(ask, patch);
      this.update(guide, {});
    };
    try {
      const holds = summarize(section, guide.sections[section].data);
      const pastAsks = guide.asks.filter((a) => a.section === section && a.by === ask.by && a.id !== ask.id);
      let focus = ask.prompt;
      try {
        const plan = await this.call(master.readAsk({ guide, section, prompt: ask.prompt, student, holds, pastAsks }));
        if (plan.route === 'opportunity-search') {
          this.log(guide, 'Master', 'Routed this request to the opportunity search', 'info', ask.id);
          this.setSection(guide, section, { status: 'done' });
          done({ status: 'redirected', note: plan.reply });
          return;
        }
        focus = plan.focus || ask.prompt;
        ask.note = plan.reply || null;
        this.log(guide, 'Master', plan.reply || 'Planned what to look for', 'info', ask.id);
      } catch (e) {
        // Without the master's reading, the researcher works from the student's own words.
        this.log(guide, 'Master', `Could not read the request, so the researcher works from it as written: ${message(e)}`, 'bad', ask.id);
      }

      const fleet = this.fleet(guide, ask.id);
      const formats = guide.sections.interview.data?.formats.map((f) => f.name) ?? [];
      const more = await this.runPart(guide, section, { fleet, focus, holds, formats, student, ask: ask.id });
      const merged = mergeSection(section, guide.sections[section].data as never, more as never);
      this.setSection(guide, section, { status: 'done', data: merged.data as never, error: null, added: { count: merged.added, at: new Date().toISOString() } });
      this.log(guide, 'Presentation', merged.added ? `Added ${merged.added} new items` : 'Found nothing new this time', merged.added ? 'good' : 'info', ask.id);
      if (section === 'voices' && merged.added) await this.summarizeVoices(guide, ask.id);
      let added = merged.added;

      // New interview formats get steps in how to start that prepare for them.
      if (section === 'interview' && guide.sections.start.data) {
        const missing = unpreparedFormats(guide);
        if (missing.length) added += await this.prepareFormats(guide, missing, fleet, student, ask.id);
      }
      done({ status: 'done', added });
    } catch (e) {
      // The old items stay; the part is only marked so the page can say this try found nothing.
      this.setSection(guide, section, { status: 'done', error: `Could not find more: ${message(e)}` });
      done({ status: 'failed', note: `Could not find more: ${message(e)}` });
    }
  }

  /** Writes steps in how to start for interview formats nothing prepares for yet. Returns how many items it added. */
  private async prepareFormats(guide: Guide, formats: string[], fleet: Fleet, student: StudentContext | null, ask: string | null): Promise<number> {
    const task = `${guide.slug}/start`;
    if (this.running.has(task)) return 0;
    this.running.add(task);
    this.setSection(guide, 'start', { status: 'working' });
    this.log(guide, 'Master', `Asked how to start for steps that prepare for: ${formats.join(', ')}`, 'info', ask);
    try {
      const focus = `Steps that get a student ready for these interview formats: ${formats.join('; ')}. Every step's prepares names the formats it covers.`;
      const more = await this.runPart(guide, 'start', { fleet, focus, holds: summarize('start', guide.sections.start.data), formats, student, ask });
      const merged = mergeSection('start', guide.sections.start.data!, more);
      this.setSection(guide, 'start', { status: 'done', data: merged.data, error: null, added: { count: merged.added, at: new Date().toISOString() } });
      return merged.added;
    } catch (e) {
      this.setSection(guide, 'start', { status: 'done', error: `Could not add steps for the new formats: ${message(e)}` });
      return 0;
    } finally {
      this.running.delete(task);
    }
  }

  private log(guide: Guide, agent: string, text: string, tone: GuideEvent['tone'], ask: string | null) {
    guide.activity.push({ at: new Date().toISOString(), agent, text: text.slice(0, 200), tone, ask });
    if (guide.activity.length > MAX_ACTIVITY) guide.activity.splice(0, guide.activity.length - MAX_ACTIVITY);
    this.update(guide, {});
  }

  private setSection<K extends SectionId>(guide: Guide, id: K, patch: Partial<SectionState<SectionData[K]>>) {
    guide.sections[id] = { ...guide.sections[id], ...patch };
    this.update(guide, {});
  }

  private update(guide: Guide, patch: Partial<Guide>) {
    Object.assign(guide, patch, { updatedAt: new Date().toISOString() });
    this.save();
  }

  private load() {
    if (!this.file) return;
    try {
      const saved = JSON.parse(readFileSync(this.file, 'utf8')) as { guides?: Guide[] };
      for (const g of saved.guides ?? []) this.guides.set(g.slug, upgrade(g));
    } catch {
      // No file yet, or unreadable: start empty.
    }
  }

  private save() {
    if (!this.file) return;
    try {
      mkdirSync(dirname(this.file), { recursive: true });
      writeFileSync(this.file, JSON.stringify({ guides: [...this.guides.values()] }, null, 1));
    } catch (e) {
      console.error('could not save career guides:', message(e));
    }
  }
}

/** Brings a guide saved by an older version up to the current shape, and marks work a restart cut off. */
function upgrade(g: Guide): Guide {
  g.angles ??= null;
  g.asks ??= [];
  g.activity ??= [];
  const basics = g.sections.basics.data as (SectionData['basics'] & { skills: unknown[] }) | null;
  // Older guides kept skills as plain words; they are kept, filed as knowledge.
  if (basics) basics.skills = basics.skills.map((s) => (typeof s === 'string' ? { name: s, kind: 'knowledge' as const } : s)) as SectionData['basics']['skills'];
  if (g.sections.voices.data) g.sections.voices.data.summary ??= null;
  for (const step of g.sections.start.data?.steps ?? []) step.prepares ??= [];
  const cut = 'The research stopped before it finished. Search again.';
  if (g.status === 'planning' || g.status === 'researching') {
    g.status = g.oneLine ? 'ready' : 'failed';
    g.error = g.status === 'failed' ? cut : null;
  }
  for (const id of SECTION_IDS) {
    const s = g.sections[id];
    s.added ??= null;
    if (s.status === 'working' || s.status === 'waiting') {
      s.status = s.data ? 'done' : 'failed';
      if (!s.data) s.error = cut;
    }
  }
  for (const a of g.asks) if (a.status === 'working') Object.assign(a, { status: 'failed', note: cut });
  return g;
}

function countItems(section: SectionId, data: unknown): number {
  const d = data as Record<string, unknown[] | undefined>;
  const n = (k: string) => d[k]?.length ?? 0;
  if (section === 'basics') return n('dayInLife') + n('whatTheyDo') + n('whereTheyWork') + n('specialties') + n('skills');
  if (section === 'voices') return n('posts');
  if (section === 'start') return n('steps') + n('resources');
  return n('formats') + n('questions');
}

function message(e: unknown): string {
  return (e instanceof Error ? e.message : String(e)).slice(0, 300);
}
