// Career guides for the Career discovery page: for any career a student types, the agents research
// four sections in the order a student needs them - the basics, what people in the job share on X,
// how to start, and what the interviews ask. A guide is researched once, kept, and shared by every
// student; "Search again" refreshes it, and "Add more" sends one section's researcher back for new
// items that are merged into what is there. Sections are saved as each one finishes, so the page
// fills in while the rest are still being researched.
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { z } from 'zod';
import { config, liveAvailable, provider } from '../config.ts';
import { grokJson, type GrokTool } from '../grok.ts';

export const SECTION_IDS = ['basics', 'voices', 'start', 'interview'] as const;
export type SectionId = (typeof SECTION_IDS)[number];

const Source = z.object({ title: z.string(), url: z.string() });

const Angles = z.object({ basics: z.string(), voices: z.string(), start: z.string(), interview: z.string() });
const PlanSchema = z.object({ title: z.string(), oneLine: z.string(), field: z.string(), angles: Angles });

export const BasicsSchema = z.object({
  summary: z.string(),
  dayInLife: z.array(z.string()),
  whatTheyDo: z.array(z.string()),
  whereTheyWork: z.array(z.string()),
  specialties: z.array(z.object({ name: z.string(), what: z.string() })),
  skills: z.array(z.string()),
  education: z.string().nullable(),
  pay: z.object({ figure: z.string(), url: z.string() }).nullable(),
  outlook: z.string().nullable(),
  sources: z.array(Source),
});

const Post = z.object({
  author: z.string(),
  role: z.string(),
  handle: z.string().nullable(),
  text: z.string(),
  takeaway: z.string(),
  topic: z.enum(['the work', 'getting in', 'advice', 'pay and life']),
  url: z.string().nullable(),
  date: z.string().nullable(),
});
export const VoicesSchema = z.object({ posts: z.array(Post) });

export const StartSchema = z.object({
  steps: z.array(z.object({ title: z.string(), detail: z.string(), when: z.string().nullable(), resource: Source.nullable() })),
  resources: z.array(
    z.object({
      title: z.string(),
      url: z.string(),
      kind: z.enum(['course', 'book', 'site', 'community', 'video', 'practice']),
      free: z.boolean().nullable(),
    }),
  ),
});

export const InterviewSchema = z.object({
  formats: z.array(z.object({ name: z.string(), tests: z.string(), howToPractice: z.string(), url: z.string().nullable() })),
  questions: z.array(z.object({ kind: z.string(), question: z.string(), tip: z.string().nullable() })),
  sources: z.array(Source),
});

export type SectionData = {
  basics: z.infer<typeof BasicsSchema>;
  voices: z.infer<typeof VoicesSchema>;
  start: z.infer<typeof StartSchema>;
  interview: z.infer<typeof InterviewSchema>;
};

export type SectionState<T> = {
  status: 'waiting' | 'working' | 'done' | 'failed';
  /** The last good answer. Kept while a refresh or "Add more" is researching, so the page never empties. */
  data: T | null;
  /** True when the content is an invented example, not something the agents found. */
  sample: boolean;
  error: string | null;
  /** How many items the last "Add more" added, and when; null before the first. */
  added: { count: number; at: string } | null;
};

export type Guide = {
  slug: string;
  query: string;
  title: string;
  oneLine: string | null;
  field: string | null;
  /** What each section's researcher looks for, from the plan; reused by "Add more". */
  angles: z.infer<typeof Angles> | null;
  status: 'planning' | 'researching' | 'ready' | 'failed';
  provider: 'grok' | 'claude' | 'simulated';
  startedAt: string;
  updatedAt: string;
  error: string | null;
  sections: { [K in SectionId]: SectionState<SectionData[K]> };
};

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

const today = () => new Date().toISOString().slice(0, 10);

const STYLE = `Write for a university student who is new to this career. Plain words, short sentences, no emoji, no hype. Never mention yourself, your search or the pages you opened in the text; the sources list does that. Today is ${today()}.`;
const SOURCED = `Use only pages you actually opened. Every URL must be a real page you visited. If you cannot find something, leave it out or return null; never guess a number, a name or a link.`;
const FRESH = (existing: string) =>
  `The section already holds the items below. Find NEW ones only: do not repeat or reword anything listed, and return empty lists where you find nothing new. For single facts (summary, education, pay, outlook) return null unless the existing one is missing.\nALREADY IN THE SECTION:\n${existing}`;

const emptySection = <T>(): SectionState<T> => ({ status: 'waiting', data: null, sample: false, error: null, added: null });

/** Which model each step runs on: planning on the normal tier, the four researchers on the low tier. */
function tierModels(): { normal?: string; low?: string } {
  if (config.grokTransport === 'claude') return config.claudeCli.models;
  if (config.grokTransport === 'cli') return config.grokCli.models;
  return config.xaiModels;
}

const key = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

/** Adds the items of `more` that `have` does not already hold, judged by `id`. */
function union<T>(have: T[] | undefined, more: T[] | undefined, id: (item: T) => string): { list: T[]; added: number } {
  const list = [...(have ?? [])];
  const seen = new Set(list.map(id));
  let added = 0;
  for (const item of more ?? []) {
    const k = id(item);
    if (!k || seen.has(k)) continue;
    seen.add(k);
    list.push(item);
    added++;
  }
  return { list, added };
}

/** Merges an "Add more" answer into a section. Returns the merged data and how many items were new. */
export function mergeSection<K extends SectionId>(id: K, have: SectionData[K], more: SectionData[K]): { data: SectionData[K]; added: number } {
  const byText = (s: string) => key(s);
  const byUrl = (s: { url: string }) => s.url;
  if (id === 'basics') {
    const h = have as SectionData['basics'];
    const m = more as SectionData['basics'];
    const parts = {
      dayInLife: union(h.dayInLife, m.dayInLife, byText),
      whatTheyDo: union(h.whatTheyDo, m.whatTheyDo, byText),
      whereTheyWork: union(h.whereTheyWork, m.whereTheyWork, byText),
      specialties: union(h.specialties, m.specialties, (s) => key(s.name)),
      skills: union(h.skills, m.skills, byText),
      sources: union(h.sources, m.sources, byUrl),
    };
    const filled = [!h.education && m.education, !h.pay && m.pay, !h.outlook && m.outlook].filter(Boolean).length;
    const data: SectionData['basics'] = {
      ...h,
      ...Object.fromEntries(Object.entries(parts).map(([k, v]) => [k, v.list])),
      education: h.education ?? m.education ?? null,
      pay: h.pay ?? m.pay ?? null,
      outlook: h.outlook ?? m.outlook ?? null,
    } as SectionData['basics'];
    // Sources back up the other items; they are not counted as new information on their own.
    const added = Object.entries(parts).reduce((n, [k, v]) => n + (k === 'sources' ? 0 : v.added), 0) + filled;
    return { data: data as SectionData[K], added };
  }
  if (id === 'voices') {
    const posts = union((have as SectionData['voices']).posts, (more as SectionData['voices']).posts, (p) => p.url ?? key(p.text).slice(0, 80));
    return { data: { posts: posts.list } as SectionData[K], added: posts.added };
  }
  if (id === 'start') {
    const h = have as SectionData['start'];
    const m = more as SectionData['start'];
    const steps = union(h.steps, m.steps, (s) => key(s.title));
    const resources = union(h.resources, m.resources, byUrl);
    return { data: { steps: steps.list, resources: resources.list } as SectionData[K], added: steps.added + resources.added };
  }
  const h = have as SectionData['interview'];
  const m = more as SectionData['interview'];
  const formats = union(h.formats, m.formats, (f) => key(f.name));
  const questions = union(h.questions, m.questions, (q) => key(q.question));
  const sources = union(h.sources, m.sources, byUrl);
  return { data: { formats: formats.list, questions: questions.list, sources: sources.list } as SectionData[K], added: formats.added + questions.added };
}

/** A short list of what a section holds, for the "find new ones only" instruction. */
function summarize(id: SectionId, data: unknown): string {
  const d = data as Record<string, unknown>;
  const lines: string[] = [];
  const list = (label: string, items: unknown[] | undefined, pick: (x: any) => string) => {
    if (items?.length) lines.push(`${label}: ${items.map(pick).join('; ')}`);
  };
  if (id === 'basics') {
    for (const k of ['dayInLife', 'whatTheyDo', 'whereTheyWork', 'skills']) list(k, d[k] as string[], (x) => x);
    list('specialties', d.specialties as unknown[], (x) => x.name);
    lines.push(`education: ${d.education ? 'known' : 'missing'}; pay: ${d.pay ? 'known' : 'missing'}; outlook: ${d.outlook ? 'known' : 'missing'}`);
  }
  if (id === 'voices') list('posts', d.posts as unknown[], (x) => `${x.author}: ${String(x.text).slice(0, 60)}`);
  if (id === 'start') {
    list('steps', d.steps as unknown[], (x) => x.title);
    list('resources', d.resources as unknown[], (x) => x.url);
  }
  if (id === 'interview') {
    list('formats', d.formats as unknown[], (x) => x.name);
    list('questions', d.questions as unknown[], (x) => x.question);
  }
  return lines.join('\n') || 'nothing yet';
}

const fallbackAngles = (title: string): z.infer<typeof Angles> => ({
  basics: `What a ${title} does, where they work, the skills, pay and outlook.`,
  voices: `People working as ${title} at different levels.`,
  start: `How a student with no experience starts toward becoming a ${title}.`,
  interview: `How employers hire and assess candidates for ${title} roles.`,
});

export class CareerGuides {
  private guides = new Map<string, Guide>();
  private running = new Set<string>();
  private readonly file: string | null;
  private readonly ask: Ask;
  private readonly env: Env;
  /** Wait before a section's one retry. */
  retryMs = 2000;

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

  /** Returns the kept guide, or starts researching one. A refresh keeps the old sections on screen until new ones arrive. */
  start(query: string, refresh = false): Guide {
    const clean = query.replace(/\s+/g, ' ').trim();
    if (clean.length < 2 || clean.length > 60) throw new CareerError('Type a career between 2 and 60 characters.', 400);
    const slug = slugFor(clean);
    if (!slug) throw new CareerError('Type a career using letters or numbers.', 400);

    const existing = this.guides.get(slug);
    if (existing && this.busy(slug)) return existing;
    if (existing && existing.status === 'ready' && !refresh) return existing;
    if (!this.env.live()) throw new CareerError('Your agents are simulated right now, so they cannot research careers. Connect Grok in Settings.', 503);

    const now = new Date().toISOString();
    const guide: Guide = existing
      ? { ...existing, status: 'planning', startedAt: now, updatedAt: now, error: null, provider: this.env.provider() }
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
          sections: { basics: emptySection(), voices: emptySection(), start: emptySection(), interview: emptySection() },
        };
    for (const id of SECTION_IDS) Object.assign(guide.sections[id], { status: 'waiting', error: null, added: null });
    this.guides.set(slug, guide);
    this.running.add(slug);
    this.save();
    void this.research(guide).finally(() => this.running.delete(slug));
    return guide;
  }

  /** Sends one section's researcher back for new items and merges them in. The rest of the guide stays as it is. */
  more(slug: string, id: string): Guide {
    const guide = this.guides.get(slug);
    if (!guide) throw new CareerError('No guide for this career yet.', 404);
    if (!(SECTION_IDS as readonly string[]).includes(id)) throw new CareerError('There is no such part of the guide.', 404);
    const section = id as SectionId;
    if (this.running.has(slug)) throw new CareerError('The guide is still being researched. Wait until it is ready.', 409);
    if (this.running.has(`${slug}/${section}`)) return guide;
    if (!guide.sections[section].data) throw new CareerError('This part has nothing yet. Search again first.', 409);
    if (!this.env.live()) throw new CareerError('Your agents are simulated right now, so they cannot research careers. Connect Grok in Settings.', 503);

    const task = `${slug}/${section}`;
    this.running.add(task);
    this.setSection(guide, section, { status: 'working', error: null });
    void (async () => {
      try {
        const more = await this.withRetry(() => this.researchSection(guide, section, guide.sections[section].data));
        const merged = mergeSection(section, guide.sections[section].data as never, more as never);
        this.setSection(guide, section, { status: 'done', data: merged.data as never, error: null, added: { count: merged.added, at: new Date().toISOString() } });
      } catch (e) {
        // The old items stay; the section is only marked so the page can say this try found nothing.
        this.setSection(guide, section, { status: 'done', error: `Could not find more: ${message(e)}` });
      } finally {
        this.running.delete(task);
      }
    })();
    return guide;
  }

  /** Resolves when nothing is running for this guide: its research and any "Add more". For tests. */
  async settled(slug: string): Promise<Guide | null> {
    while (this.busy(slug)) await new Promise((r) => setTimeout(r, 5));
    return this.get(slug);
  }

  private busy(slug: string) {
    return [...this.running].some((t) => t === slug || t.startsWith(`${slug}/`));
  }

  private async withRetry<T>(job: () => Promise<T>): Promise<T> {
    // One retry: several calls at once through a CLI sometimes lose one to a passing error.
    return job().catch(async () => {
      await new Promise((r) => setTimeout(r, this.retryMs));
      return job();
    });
  }

  private async research(guide: Guide) {
    try {
      const { data: plan } = await this.ask({
        name: 'career_plan',
        model: tierModels().normal,
        schema: PlanSchema,
        system: `You plan a four-part career guide for a student. ${STYLE}
Name the career the way people in it say it (for example "Economist" for "economic"). oneLine is what the job is in at most 16 words. field is one lowercase word for the area. angles gives each researcher one sentence on what to look for:
- basics: what the job is, a typical day, where people work, the specialties inside it, the skills, education, pay and outlook.
- voices: the kinds of people in this career whose posts on X would help a student (roles, seniority, topics).
- start: how a student with no experience starts learning and gets a first foot in.
- interview: how this career hires and assesses people (for example coding interviews for software, case interviews and online assessments for consulting) and the kinds of questions asked.`,
        user: `The student typed: "${guide.query}"`,
      });
      this.update(guide, { title: plan.title, oneLine: plan.oneLine, field: plan.field, angles: plan.angles, status: 'researching' });
    } catch (e) {
      this.update(guide, { status: 'failed', error: `Could not plan the guide: ${message(e)}` });
      return;
    }

    await Promise.all(
      SECTION_IDS.map(async (id) => {
        this.setSection(guide, id, { status: 'working' });
        try {
          const data = await this.withRetry(() => this.researchSection(guide, id, null));
          this.setSection(guide, id, { status: 'done', data: data as never, sample: id === 'voices' && !this.env.canSearchX(), error: null });
        } catch (e) {
          this.setSection(guide, id, { status: 'failed', error: message(e) });
        }
      }),
    );

    const failed = SECTION_IDS.filter((id) => guide.sections[id].status === 'failed');
    this.update(guide, failed.length === SECTION_IDS.length ? { status: 'failed', error: 'None of the four sections could be researched.' } : { status: 'ready' });
  }

  /** One section's researcher. With `existing` it is asked for new items only. */
  private async researchSection(guide: Guide, id: SectionId, existing: unknown): Promise<SectionData[SectionId]> {
    const model = tierModels().low;
    const angles = guide.angles ?? fallbackAngles(guide.title);
    const fresh = existing ? `\n\n${FRESH(summarize(id, existing))}` : '';
    const user = `Career: ${guide.title}\nFocus: ${angles[id]}${fresh}`;
    const web: GrokTool[] = [{ type: 'web_search' }];

    if (id === 'basics') {
      return (
        await this.ask({
          name: 'career_basics',
          model,
          schema: BasicsSchema,
          tools: web,
          system: `You research the basics of a career. ${STYLE} ${SOURCED}
summary: 2-3 sentences on what the job is. dayInLife: 4-6 short lines that walk through a typical working day in order. whatTheyDo: 4-6 everyday tasks. whereTheyWork: 3-5 kinds of employer. specialties: 3-5 areas people specialise in, each with one line on what it is. skills: 5-8 skills that matter most. education: one sentence on the usual degree or training, or null. pay: a typical pay figure as one short phrase of at most 12 words (for example "$124,720 median a year in the US, 2025") with the page that states it, or null. outlook: one sentence of at most 25 words on demand, with its page in sources, or null. sources: up to 6 pages you used. Every list item is at most 20 words.`,
          user,
        })
      ).data;
    }
    if (id === 'voices') {
      if (!this.env.canSearchX()) {
        return (
          await this.ask({
            name: 'career_voices_sample',
            model,
            schema: VoicesSchema,
            system: `You write sample stories that show the layout of a page before real posts from X are available. ${STYLE}
Write 4 short first-person stories, each from a different kind of person in this career (different seniority and employer), about what the work is really like, how they got in, advice, or pay and life. topic says which. Every person is fictional: an invented first name and last initial, a generic role and employer type ("analyst at a mid-size bank"), never a real person, company or @handle. handle, url and date are null. text is at most 280 characters. takeaway is one line on what a student learns from it.`,
            user,
          })
        ).data;
      }
      return (
        await this.ask({
          name: 'career_voices',
          model,
          schema: VoicesSchema,
          tools: [{ type: 'x_search' }, { type: 'web_search' }],
          system: `You find what people who work in a career share on X. ${STYLE} ${SOURCED}
Search X for 4-6 recent posts where people in this career say what the job is really like, how they got in, what they wish they had known, or what pay and life are like; topic says which. Prefer people at different levels. Use only real posts you found. author is the name shown on the post, role is what they do as their profile or post says, handle is the @handle, url is the post's link, date is ISO 8601. text keeps the post's words, shortened to at most 280 characters without changing the meaning. takeaway is one line on what a student learns from it. If you find none, return an empty list.`,
          user,
        })
      ).data;
    }
    if (id === 'start') {
      return (
        await this.ask({
          name: 'career_start',
          model,
          schema: StartSchema,
          tools: web,
          system: `You map how a student starts in a career. ${STYLE} ${SOURCED}
steps: 5-7 steps in order, from today, for a student with no experience. Each has a short title (a verb first), one or two sentences of detail (at most 35 words), when (a short time like "First semester" or "Summer after year two", or null), and one resource page that helps with that step, or null. resources: 4-8 of the best pages to learn from, free ones first, with their kind and whether they are free (null if unclear).`,
          user,
        })
      ).data;
    }
    return (
      await this.ask({
        name: 'career_interview',
        model,
        schema: InterviewSchema,
        tools: web,
        system: `You explain how a career hires. ${STYLE} ${SOURCED}
formats: 2-5 ways candidates are assessed (for example a coding interview with LeetCode-style problems, a case interview, an online game-based or aptitude assessment, a technical exam, a portfolio review), each with what it tests (at most 15 words, starting with a noun, not "Tests"), how to practise it (at most 25 words), and a page about it or null. questions: 6-10 example questions of the kinds asked, written as the question itself, each tagged with its format name in kind, and tip: one line on what a strong answer shows, or null. Never say a question comes from a named company unless a source says so. sources: up to 5 pages you used.`,
        user,
      })
    ).data;
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
      for (const g of saved.guides ?? []) {
        g.angles ??= null;
        // Work that was running when the backend stopped cannot finish now.
        if (g.status === 'planning' || g.status === 'researching') {
          g.status = g.oneLine ? 'ready' : 'failed';
          g.error = g.status === 'failed' ? 'The research stopped before it finished. Search again.' : null;
        }
        for (const id of SECTION_IDS) {
          const s = g.sections[id];
          s.added ??= null;
          if (s.status === 'working' || s.status === 'waiting') {
            s.status = s.data ? 'done' : 'failed';
            if (!s.data) s.error = 'The research stopped before it finished. Search again.';
          }
        }
        this.guides.set(g.slug, g);
      }
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

function message(e: unknown): string {
  return (e instanceof Error ? e.message : String(e)).slice(0, 300);
}
