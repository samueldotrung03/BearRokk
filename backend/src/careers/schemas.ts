// The shape of a career guide: its four parts, what each agent answers, and how an "Add more"
// answer is merged into what a part already holds.
import { z } from 'zod';

/** The parts in the order a student reads them. The interviews come before how to start, because
 * how to start is written to prepare for the interviews. */
export const SECTION_IDS = ['basics', 'voices', 'interview', 'start'] as const;
export type SectionId = (typeof SECTION_IDS)[number];

export const SECTION_NAMES: Record<SectionId, string> = {
  basics: 'The basics',
  voices: 'What people in the job say',
  interview: 'What the interviews ask',
  start: 'How to start',
};

const Source = z.object({ title: z.string(), url: z.string() });

export const Angles = z.object({ basics: z.string(), voices: z.string(), interview: z.string(), start: z.string() });
export const PlanSchema = z.object({ title: z.string(), oneLine: z.string(), field: z.string(), angles: Angles });

export const SKILL_KINDS = ['tool', 'method', 'knowledge', 'credential'] as const;
const Skill = z.object({ name: z.string(), kind: z.enum(SKILL_KINDS) });

export const BasicsSchema = z.object({
  summary: z.string(),
  dayInLife: z.array(z.string()),
  whatTheyDo: z.array(z.string()),
  whereTheyWork: z.array(z.string()),
  specialties: z.array(z.object({ name: z.string(), what: z.string() })),
  skills: z.array(Skill),
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
/** What the researcher brings back. The two-sentence summary is written afterwards, over every post. */
export const PostsSchema = z.object({ posts: z.array(Post) });
export const VoicesSchema = PostsSchema.extend({ summary: z.string().nullable() });
export const VoicesSummarySchema = z.object({ summary: z.string() });

export const InterviewSchema = z.object({
  formats: z.array(z.object({ name: z.string(), tests: z.string(), howToPractice: z.string(), url: z.string().nullable() })),
  questions: z.array(z.object({ kind: z.string(), question: z.string(), tip: z.string().nullable() })),
  sources: z.array(Source),
});

export const StartSchema = z.object({
  steps: z.array(
    z.object({
      title: z.string(),
      detail: z.string(),
      when: z.string().nullable(),
      resource: Source.nullable(),
      /** Names of the interview formats this step prepares for, exactly as the interviews part lists them. */
      prepares: z.array(z.string()),
    }),
  ),
  resources: z.array(
    z.object({
      title: z.string(),
      url: z.string(),
      kind: z.enum(['course', 'book', 'site', 'community', 'video', 'practice']),
      free: z.boolean().nullable(),
    }),
  ),
});

/** What a researcher answers for each part. The voices researcher answers posts only. */
export const WORKER_SCHEMAS = { basics: BasicsSchema, voices: PostsSchema, interview: InterviewSchema, start: StartSchema } as const;

/** A validator's answer: the part with every item that broke a rule taken out or corrected. */
export const reviewSchema = <S extends z.ZodType>(data: S) =>
  z.object({ data, removed: z.array(z.object({ item: z.string(), reason: z.string() })) });

/** The career discovery master's reading of a student's "Add more" request. */
export const AskPlanSchema = z.object({
  route: z.enum(['career-discovery', 'opportunity-search']),
  focus: z.string(),
  reply: z.string(),
});

export const SuggestSchema = z.object({ prompts: z.array(z.string()) });

export type SectionData = {
  basics: z.infer<typeof BasicsSchema>;
  voices: z.infer<typeof VoicesSchema>;
  interview: z.infer<typeof InterviewSchema>;
  start: z.infer<typeof StartSchema>;
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

/** One "Add more" a student asked for, kept so they can see their history. */
export type GuideAsk = {
  id: string;
  section: SectionId;
  /** Who asked: the student's account id, or a guest id kept in their browser. */
  by: string;
  prompt: string;
  at: string;
  status: 'working' | 'done' | 'failed' | 'redirected';
  /** How many new items it added. */
  added: number;
  /** What the agents said back: what they looked for, or why the request belongs elsewhere. */
  note: string | null;
};

/** One line of the guide's agent activity, newest last. */
export type GuideEvent = { at: string; agent: string; text: string; tone: 'info' | 'good' | 'bad'; ask: string | null };

export type Guide = {
  slug: string;
  query: string;
  title: string;
  oneLine: string | null;
  field: string | null;
  /** What each part's researcher looks for, from the master's plan; reused by "Add more". */
  angles: z.infer<typeof Angles> | null;
  status: 'planning' | 'researching' | 'ready' | 'failed';
  provider: 'grok' | 'simulated';
  startedAt: string;
  updatedAt: string;
  error: string | null;
  sections: { [K in SectionId]: SectionState<SectionData[K]> };
  asks: GuideAsk[];
  activity: GuideEvent[];
};

const key = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
export const sameName = (a: string, b: string) => key(a) === key(b);

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

/** Merges an "Add more" answer into a part. Returns the merged data and how many items were new. */
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
      skills: union(h.skills, m.skills, (s) => key(s.name)),
      sources: union(h.sources, m.sources, byUrl),
    };
    const filled = [!h.education && m.education, !h.pay && m.pay, !h.outlook && m.outlook].filter(Boolean).length;
    const data = {
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
    const h = have as SectionData['voices'];
    const posts = union(h.posts, (more as SectionData['voices']).posts, (p) => p.url ?? key(p.text).slice(0, 80));
    return { data: { summary: h.summary, posts: posts.list } as SectionData[K], added: posts.added };
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

/** A short list of what a part holds, for the "find new ones only" instruction. */
export function summarize(id: SectionId, data: unknown): string {
  const d = data as Record<string, unknown>;
  const lines: string[] = [];
  const list = (label: string, items: unknown[] | undefined, pick: (x: any) => string) => {
    if (items?.length) lines.push(`${label}: ${items.map(pick).join('; ')}`);
  };
  if (id === 'basics') {
    for (const k of ['dayInLife', 'whatTheyDo', 'whereTheyWork']) list(k, d[k] as string[], (x) => x);
    list('skills', d.skills as unknown[], (x) => (typeof x === 'string' ? x : x.name));
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

/** Interview formats no step of how to start prepares for yet. */
export function unpreparedFormats(guide: Pick<Guide, 'sections'>): string[] {
  const formats = guide.sections.interview.data?.formats.map((f) => f.name) ?? [];
  const steps = guide.sections.start.data?.steps ?? [];
  return formats.filter((f) => !steps.some((s) => (s.prepares ?? []).some((p) => sameName(p, f))));
}
