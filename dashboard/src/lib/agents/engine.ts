// The simulated agent run behind the Agents page. A run is planned up front as a list of beats
// (one beat is one moment in which several agents act in parallel), and a reducer plays them back
// one tick at a time. Everything is a pure function of the input and a seed, so a run can be
// replayed, paused and tested; the page only decides how fast ticks arrive.
//
// The roles and the order follow backend/AGENT_SYSTEM.md: master -> search managers -> scouts and
// extractors -> validators -> presentation manager -> feed. Only what a worker found can reach a
// validator, and only what a validator kept can reach the feed.
import { candidates as defaultCatalog, categoryLabels, type Candidate, type Category } from '../../data/agents-extra.ts';
import { opportunities } from '../../data/sample.ts';
import type { Profile } from '../../types.ts';
import { assignSlots, buildBrief, slotBrief, termLabel, type Brief, type Memory, type Slot } from './brief.ts';

export type Level = 'master' | 'manager' | 'worker' | 'validator' | 'presenter';
export type NodeStatus = 'idle' | 'working' | 'waiting' | 'done';
export type RunStatus = 'idle' | 'running' | 'paused' | 'done';

export interface GraphNode {
  id: string;
  level: Level;
  /** Full name for the detail panel and screen readers. */
  name: string;
  /** Short name drawn on the node. */
  title: string;
  sub: string;
  /** Which manager's lane it sits in, for workers and validators. */
  lane: number | null;
  /** Position in an evenly spaced row, for rows that are not split into manager lanes. */
  col?: { index: number; of: number };
}

export interface AgentLive {
  status: NodeStatus;
  now: string;
  told: string;
  returned: string;
  sources: string[];
  found: number;
  kept: number;
  rejected: number;
  /** Simulated time spent working, in milliseconds. */
  ms: number;
  tokens: number;
  calls: number;
}

export type TransferKind = 'brief' | 'job' | 'result' | 'keep' | 'reject' | 'feed';

export interface Transfer {
  from: string;
  to: string;
  kind: TransferKind;
  label?: string;
}

export type Reason = 'duplicate' | 'unverified' | 'closed' | 'wrong_level' | 'wrong_format' | 'too_far' | 'excluded' | 'disliked';

export interface CandidateState {
  id: string;
  title: string;
  organizer: string;
  category: Category;
  source: string;
  lane: number;
  foundBy: string;
  judgedBy: string | null;
  judged: boolean;
  /** How many funnel checks it passed: 1 not a duplicate, 2 real and open, 3 matches the brief, 4 shown. */
  stage: number;
  reason: Reason | null;
  note: string;
  fit: number | null;
  opportunityId: string | null;
}

export type Tone = 'info' | 'brief' | 'keep' | 'reject' | 'done';

export interface LogEntry {
  id: string;
  /** Simulated time since the run started, in milliseconds. */
  t: number;
  /** Real time of the event, for a backend run. Shown instead of t when present. */
  at?: string;
  agent: string;
  text: string;
  tone: Tone;
}

interface AgentPatch {
  id: string;
  status?: NodeStatus;
  now?: string;
  told?: string;
  returned?: string;
  addSources?: string[];
  found?: number;
  kept?: number;
  rejected?: number;
  tokens?: number;
  calls?: number;
}

export interface Beat {
  dt: number;
  agents: AgentPatch[];
  transfers: Transfer[];
  log: { agent: string; text: string; tone: Tone }[];
  add: CandidateState[];
  update: (Partial<CandidateState> & { id: string })[];
  pages: number;
}

export interface RunInput {
  profile: Profile;
  memory: Memory;
  instructions: string[];
  /** Opportunities the student disliked; the presentation manager never shows them again. */
  dismissed: string[];
  trigger: string;
  catalog?: Candidate[];
}

export interface RunState {
  status: RunStatus;
  run: number;
  seed: number;
  trigger: string;
  brief: Brief;
  slots: Slot[];
  nodes: GraphNode[];
  beats: Beat[];
  cursor: number;
  clock: number;
  agents: Record<string, AgentLive>;
  candidates: CandidateState[];
  log: LogEntry[];
  /** What moved along the edges in the latest beat. The graph draws these as pulses. */
  transfers: Transfer[];
  pages: number;
}

export const FEED_ID = 'feed';
export const ids = {
  master: 'master',
  manager: (i: number) => `manager-${i}`,
  scout: (i: number) => `scout-${i}`,
  extractor: (i: number) => `extractor-${i}`,
  validator: (i: number) => `validator-${i}`,
  presenter: 'presenter',
};

const shortCategory: Record<Category, string> = { internships: 'Internships', events: 'Events', clubs: 'Clubs', programs: 'Programs' };

export function buildNodes(slots: Slot[]): GraphNode[] {
  const nodes: GraphNode[] = [{ id: ids.master, level: 'master', name: 'Master agent', title: 'Master agent', sub: 'reads you, writes the brief', lane: null }];
  for (const slot of slots) {
    nodes.push({ id: ids.manager(slot.index), level: 'manager', name: `Search manager ${slot.index + 1}`, title: shortCategory[slot.category], sub: slot.label, lane: slot.index });
  }
  for (const slot of slots) {
    const n = slot.index + 1;
    nodes.push({ id: ids.scout(slot.index), level: 'worker', name: `Scout ${n}`, title: 'Scout', sub: 'finds leads', lane: slot.index });
    nodes.push({ id: ids.extractor(slot.index), level: 'worker', name: `Extractor ${n}`, title: 'Reader', sub: 'reads each page', lane: slot.index });
  }
  for (const slot of slots) {
    nodes.push({ id: ids.validator(slot.index), level: 'validator', name: `Validator ${slot.index + 1}`, title: 'Validator', sub: 'checks each find', lane: slot.index });
  }
  nodes.push({ id: ids.presenter, level: 'presenter', name: 'Presentation manager', title: 'Presentation', sub: 'scores your feed', lane: null });
  return nodes;
}

/** The connectors drawn on the map. Results travel back along the same lines. */
export function edgesFor(nodes: GraphNode[]): { from: string; to: string }[] {
  const edges: { from: string; to: string }[] = [];
  for (const node of nodes) {
    if (node.level !== 'manager' || node.lane === null) continue;
    const i = node.lane;
    edges.push({ from: ids.master, to: node.id });
    edges.push({ from: node.id, to: ids.scout(i) });
    edges.push({ from: node.id, to: ids.extractor(i) });
    edges.push({ from: ids.extractor(i), to: ids.validator(i) });
    edges.push({ from: ids.validator(i), to: ids.presenter });
  }
  edges.push({ from: ids.presenter, to: FEED_ID });
  return edges;
}

export const REASONS: Record<Reason, { label: string; stage: number }> = {
  duplicate: { label: 'Duplicate or repost', stage: 1 },
  unverified: { label: 'No official page', stage: 2 },
  closed: { label: 'Closed or already over', stage: 2 },
  wrong_level: { label: 'Wrong class year or level', stage: 3 },
  wrong_format: { label: 'Wrong format for you', stage: 3 },
  too_far: { label: 'In person and too far', stage: 3 },
  excluded: { label: 'You asked for less of this', stage: 3 },
  disliked: { label: 'You disliked it before', stage: 4 },
};

export const FUNNEL_STAGES = [
  { key: 'found', label: 'Found by workers' },
  { key: 'unique', label: 'Duplicates removed' },
  { key: 'verified', label: 'Real and still open' },
  { key: 'matched', label: 'Matched to your brief' },
  { key: 'shown', label: 'Shown in your feed' },
] as const;

const baseScores = new Map(opportunities.map((o) => [o.id, o.baseScore]));
const formatWord = { remote: 'Remote', in_person: 'In person', hybrid: 'Hybrid' } as const;
const city = (location: string) => location.split(',')[0] ?? location;

export interface Verdict {
  stage: number;
  reason: Reason | null;
  note: string;
  fit: number | null;
}

/**
 * One validator's judgment on one candidate, in the order section 2 of AGENT_SYSTEM.md lists the
 * checks: not a repost, real and open, then the brief's criteria and the student's intent.
 * `seen` holds the listings already accepted as originals in this run.
 */
export function judge(c: Candidate, brief: Brief, seen: ReadonlySet<string>): Verdict {
  if (seen.has(c.repostOf ?? c.id)) return { stage: 0, reason: 'duplicate', note: 'A repost of a listing another worker already found', fit: null };
  if (!c.official) return { stage: 1, reason: 'unverified', note: `Only ${withArticle(c.source)} mentions it; no official page confirms it`, fit: null };
  if (!c.open) return { stage: 1, reason: 'closed', note: c.closedNote ?? 'No longer open', fit: null };
  if (c.years !== 'any' && !c.years.includes(brief.year)) {
    return { stage: 2, reason: 'wrong_level', note: c.levelNote ?? `Not open to ${brief.year.toLowerCase()}s`, fit: null };
  }
  if (brief.format === 'remote' && c.format !== 'remote') return { stage: 2, reason: 'wrong_format', note: `${formatWord[c.format]}, and you asked for remote only`, fit: null };
  if (brief.format === 'in_person' && c.format === 'remote') return { stage: 2, reason: 'wrong_format', note: 'Remote, and you asked for in person', fit: null };
  if (c.format !== 'remote' && !c.near) return { stage: 2, reason: 'too_far', note: `In person, too far from ${city(brief.location)}`, fit: null };
  const avoided = c.tags.filter((t) => brief.avoidTags.includes(t));
  if (avoided.length) return { stage: 2, reason: 'excluded', note: `${capitalize(termLabel(avoided[0]!))}, which you asked for less of`, fit: null };

  const focus = c.tags.filter((t) => brief.focusTags.includes(t));
  const interests = c.tags.filter((t) => brief.interestTags.includes(t));
  const base = (c.opportunityId && baseScores.get(c.opportunityId)) || c.fit;
  const preferred = brief.preferFormat !== 'any' && (brief.preferFormat === 'remote') === (c.format === 'remote');
  const fit = Math.min(0.98, Math.round((base + 0.06 * focus.length + 0.03 * interests.length + (preferred ? 0.03 : 0)) * 100) / 100);
  const where = c.format === 'remote' ? 'remote' : `in reach of ${city(brief.location)}`;
  const why = focus.length
    ? `, and it is ${termLabel(focus[0]!)}, which you asked for`
    : interests.length
      ? `, and it fits your interest in ${termLabel(interests[0]!)}`
      : '';
  return { stage: 3, reason: null, note: `Open to ${brief.year.toLowerCase()}s, ${where}${why}. Details quoted from the official page.`, fit };
}

/** "a company career page", "an online event listing". */
export const withArticle = (noun: string) => `${/^[aeiou]/i.test(noun) ? 'an' : 'a'} ${noun}`;

function capitalize(text: string) {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/** A small seeded random generator (mulberry32), so token counts and timings vary by run but replay exactly. */
export function seeded(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Which leads each manager's scout brings back: its slices of the category, best first, up to its budget. */
export function leadsFor(slots: Slot[], brief: Brief, catalog: Candidate[]): Candidate[][] {
  const priority = (c: Candidate) =>
    3 * c.tags.filter((t) => brief.focusTags.includes(t)).length +
    (brief.preferFormat === 'remote' && c.format === 'remote' ? 2 : 0) +
    (brief.preferFormat === 'in_person' && c.format !== 'remote' ? 2 : 0);
  return slots.map((slot) =>
    catalog
      .map((c, index) => ({ c, index }))
      .filter(({ c }) => c.category === slot.category && slot.slices.includes(c.slice % 4))
      .sort((a, b) => priority(b.c) - priority(a.c) || a.index - b.index)
      .slice(0, slot.budget)
      .map(({ c }) => c),
  );
}

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;

export interface Plan {
  brief: Brief;
  slots: Slot[];
  nodes: GraphNode[];
  beats: Beat[];
}

export function planRun(input: RunInput, seed: number): Plan {
  const brief = buildBrief(input.profile, input.memory, input.instructions);
  const slots = assignSlots(brief);
  const nodes = buildNodes(slots);
  const rnd = seeded(seed);
  const between = (lo: number, hi: number) => Math.round((lo + rnd() * (hi - lo)) / 10) * 10;
  const count = (lo: number, hi: number) => lo + Math.floor(rnd() * (hi - lo + 1));
  const lanes = leadsFor(slots, brief, input.catalog ?? defaultCatalog);
  const beats: Beat[] = [];
  const beat = (dt: number): Beat => {
    const b: Beat = { dt, agents: [], transfers: [], log: [], add: [], update: [], pages: 0 };
    beats.push(b);
    return b;
  };
  const m = input.memory;
  const lastInstruction = input.instructions.at(-1);

  // 1. The master reads the student.
  let b = beat(between(1800, 2600));
  b.agents.push({
    id: ids.master,
    status: 'working',
    now: 'Reading your profile, memory and instructions',
    told: input.trigger,
    addSources: ['student profile', 'memory summary', ...(input.instructions.length ? [`your instructions (${input.instructions.length})`] : [])],
    calls: 1,
    tokens: between(2400, 3200),
  });
  b.log.push({ agent: ids.master, text: `Run started. ${input.trigger}`, tone: 'info' });
  b.log.push({ agent: ids.master, text: `Read memory: ${plural(m.saves, 'save')}, ${plural(m.likes, 'like')}, ${plural(m.dislikes, 'dislike')}.`, tone: 'info' });

  // 2. It writes the brief.
  b = beat(between(1600, 2400));
  b.agents.push({ id: ids.master, now: 'Writing the student brief', returned: `Brief: ${brief.summary}.`, tokens: between(700, 1100) });
  b.log.push({ agent: ids.master, text: `Brief: ${brief.summary}.`, tone: 'brief' });
  if (lastInstruction) b.log.push({ agent: ids.master, text: `Turned "${lastInstruction}" into search rules for the managers.`, tone: 'brief' });

  // 3. It fills the manager slots and hands each one its part of the brief.
  b = beat(between(900, 1400));
  const mix = Object.entries(
    slots.reduce<Record<string, number>>((acc, s) => ({ ...acc, [shortCategory[s.category]]: (acc[shortCategory[s.category]] ?? 0) + 1 }), {}),
  )
    .map(([name, n]) => `${name} ×${n}`)
    .join(', ');
  b.agents.push({ id: ids.master, status: 'waiting', now: `Waiting on ${slots.length} search managers`, returned: `Brief: ${brief.summary}. Slots: ${mix}.` });
  b.log.push({ agent: ids.master, text: `Filled ${slots.length} manager slots: ${mix}.`, tone: 'brief' });
  for (const slot of slots) {
    b.transfers.push({ from: ids.master, to: ids.manager(slot.index), kind: 'brief', label: 'brief' });
    b.agents.push({ id: ids.manager(slot.index), status: 'working', now: 'Planning search jobs', told: slotBrief(slot, brief), calls: 1, tokens: between(1100, 1700) });
  }

  // 4. Managers put one search job each on the shared queue.
  b = beat(between(1200, 1800));
  for (const slot of slots) {
    const i = slot.index;
    b.agents.push({ id: ids.manager(i), status: 'waiting', now: 'Waiting on its scout', returned: `Queued 1 search job across ${slot.sources.join(', ')}` });
    b.transfers.push({ from: ids.manager(i), to: ids.scout(i), kind: 'job', label: 'job' });
    b.agents.push({
      id: ids.scout(i),
      status: 'working',
      now: `Searching ${slot.sources[0]}`,
      told: `Find ${categoryLabels[slot.category].toLowerCase()} (${slot.label}) for a ${brief.year.toLowerCase()} on ${slot.sources.join(', ')}.`,
      addSources: slot.sources.slice(0, 1),
      calls: 1,
      tokens: between(900, 1400),
    });
    b.pages += count(2, 4);
  }
  b.log.push({ agent: ids.manager(0), text: `Managers queued ${plural(slots.length, 'search job')} for the worker fleet.`, tone: 'info' });

  // 5. Scouts keep searching, then 6. hand their leads back.
  b = beat(between(2400, 3600));
  for (const slot of slots) {
    b.agents.push({ id: ids.scout(slot.index), now: `Searching ${slot.sources.at(-1)}`, addSources: slot.sources.slice(1), tokens: between(600, 900) });
    b.pages += count(3, 6);
  }
  b = beat(between(900, 1400));
  for (const slot of slots) {
    const n = lanes[slot.index]!.length;
    b.agents.push({ id: ids.scout(slot.index), status: 'done', now: 'Finished', returned: n ? `${plural(n, 'lead')}: a title and a link each` : 'No leads in this slice', found: n });
    if (n) b.transfers.push({ from: ids.scout(slot.index), to: ids.manager(slot.index), kind: 'result', label: `${n} leads` });
  }
  const totalLeads = lanes.reduce((sum, lane) => sum + lane.length, 0);
  b.log.push({ agent: ids.scout(0), text: `Scouts returned ${plural(totalLeads, 'lead')}. The queue checked every link so no page is read twice.`, tone: 'info' });

  // 7. Managers send the leads to their extractors.
  b = beat(between(800, 1200));
  for (const slot of slots) {
    const i = slot.index;
    const n = lanes[i]!.length;
    if (n) {
      b.agents.push({ id: ids.manager(i), now: `Waiting on ${plural(n, 'page read')}` });
      b.transfers.push({ from: ids.manager(i), to: ids.extractor(i), kind: 'job', label: `${n} reads` });
      b.agents.push({ id: ids.extractor(i), status: 'working', now: 'Opening the first page', told: `Read ${plural(n, 'page')} and pull the details, with a quote and link for each fact.` });
    } else {
      b.agents.push({ id: ids.extractor(i), status: 'done', now: 'Nothing to read', returned: 'No leads in this slice' });
      b.agents.push({ id: ids.validator(i), status: 'done', now: 'Nothing to check', returned: 'No candidates in this lane' });
    }
  }

  // 8. The pipeline: in each beat an extractor reads its next page while the validator checks the
  // page read in the beat before, so every lane has two agents busy at once.
  const seen = new Set<string>();
  const longest = Math.max(0, ...lanes.map((lane) => lane.length));
  const keptOrder: { c: Candidate; fit: number }[] = [];
  for (let t = 0; t <= longest; t++) {
    b = beat(between(2200, 3400));
    for (const slot of slots) {
      const i = slot.index;
      const lane = lanes[i]!;
      const reading = lane[t];
      if (reading) {
        b.agents.push({ id: ids.extractor(i), now: `Reading "${reading.title}" on ${withArticle(reading.source)}`, addSources: [reading.source], found: 1, calls: 1, tokens: between(1500, 2600) });
        b.pages += 1;
        b.add.push({
          id: reading.id,
          title: reading.title,
          organizer: reading.organizer,
          category: reading.category,
          source: reading.source,
          lane: i,
          foundBy: ids.extractor(i),
          judgedBy: null,
          judged: false,
          stage: 0,
          reason: null,
          note: '',
          fit: null,
          opportunityId: reading.opportunityId ?? null,
        });
        b.transfers.push({ from: ids.extractor(i), to: ids.validator(i), kind: 'result', label: 'details' });
      } else if (t === lane.length && lane.length) {
        b.agents.push({ id: ids.extractor(i), status: 'done', now: 'Finished', returned: `Read ${plural(lane.length, 'page')} and sent ${plural(lane.length, 'candidate')} to validation` });
      }

      const checking = t > 0 ? lane[t - 1] : undefined;
      if (!checking) continue;
      const verdict = judge(checking, brief, seen);
      if (verdict.stage >= 1) seen.add(checking.repostOf ?? checking.id);
      const kept = verdict.reason === null;
      const isLast = t === lane.length;
      const validator = ids.validator(i);
      b.agents.push({
        id: validator,
        status: isLast ? 'done' : 'working',
        now: isLast ? 'Finished' : `Checking "${checking.title}"`,
        told: 'Check each candidate against the brief: criteria, intent, real and open, and a quote behind every date.',
        calls: 1,
        tokens: between(700, 1200),
        kept: kept ? 1 : 0,
        rejected: kept ? 0 : 1,
      });
      b.update.push({ id: checking.id, judged: true, judgedBy: validator, stage: verdict.stage, reason: verdict.reason, note: verdict.note, fit: verdict.fit });
      if (kept) {
        keptOrder.push({ c: checking, fit: verdict.fit ?? 0 });
        b.transfers.push({ from: validator, to: ids.presenter, kind: 'keep', label: 'kept' });
        b.log.push({ agent: validator, text: `Kept "${checking.title}". ${verdict.note}`, tone: 'keep' });
      } else {
        b.transfers.push({ from: validator, to: ids.extractor(i), kind: 'reject', label: 'dropped' });
        b.log.push({ agent: validator, text: `Dropped "${checking.title}": ${verdict.note}.`, tone: 'reject' });
      }
    }
  }
  // The validators' summaries, now that every lane is checked.
  const lastPipe = beats.at(-1)!;
  for (const slot of slots) {
    const lane = lanes[slot.index]!;
    if (!lane.length) continue;
    const keptHere = keptOrder.filter((k) => lane.includes(k.c)).length;
    lastPipe.agents.push({ id: ids.validator(slot.index), returned: `Checked ${lane.length}: kept ${keptHere}, dropped ${lane.length - keptHere}` });
  }

  // 9. Results go back up: extractors report to managers, managers to the master.
  b = beat(between(900, 1400));
  for (const slot of slots) {
    const lane = lanes[slot.index]!;
    if (!lane.length) continue;
    const keptHere = keptOrder.filter((k) => lane.includes(k.c)).length;
    b.transfers.push({ from: ids.extractor(slot.index), to: ids.manager(slot.index), kind: 'result', label: 'report' });
    b.agents.push({ id: ids.manager(slot.index), status: 'working', now: 'Merging results for its slice', returned: `${plural(lane.length, 'candidate')} checked, ${keptHere} kept` });
  }
  b = beat(between(900, 1400));
  for (const slot of slots) {
    b.transfers.push({ from: ids.manager(slot.index), to: ids.master, kind: 'result', label: 'summary' });
    b.agents.push({ id: ids.manager(slot.index), status: 'done', now: 'Finished' });
  }
  b.agents.push({ id: ids.master, status: 'working', now: "Reading the managers' reports" });
  b.log.push({ agent: ids.master, text: `Managers reported back: ${plural(keptOrder.length, 'candidate')} passed validation.`, tone: 'info' });

  // 10. The presentation manager scores what was kept and publishes the feed.
  const shown = keptOrder.filter((k) => !(k.c.opportunityId && input.dismissed.includes(k.c.opportunityId))).sort((a, b) => b.fit - a.fit);
  const hidden = keptOrder.filter((k) => !shown.includes(k));
  b = beat(between(2200, 3000));
  b.agents.push({
    id: ids.presenter,
    status: 'working',
    now: `Scoring ${plural(keptOrder.length, 'validated record')} and writing a reason for each`,
    told: 'Score the validated records for this student, write the "why you are seeing this" line, and update the roadmap.',
    addSources: ['validated records', 'memory summary', 'roadmap'],
    calls: 1,
    tokens: between(2200, 3000),
  });
  b.agents.push({ id: ids.master, status: 'waiting', now: 'Waiting on the presentation manager' });
  for (const k of hidden) {
    b.update.push({ id: k.c.id, reason: 'disliked', note: 'You disliked this card before, so it stays out of your feed' });
    b.log.push({ agent: ids.presenter, text: `Left out "${k.c.title}": you disliked it before.`, tone: 'reject' });
  }

  b = beat(between(1000, 1500));
  for (const k of shown) b.update.push({ id: k.c.id, stage: 4 });
  const top = shown[0];
  b.agents.push({
    id: ids.presenter,
    status: 'done',
    now: 'Finished',
    returned: shown.length ? `Ranked ${plural(shown.length, 'card')}. Top: "${top!.c.title}" at ${Math.round(top!.fit * 100)}% fit.` : 'Nothing new passed validation this run',
    kept: shown.length,
    rejected: hidden.length,
  });
  if (shown.length) b.transfers.push({ from: ids.presenter, to: FEED_ID, kind: 'feed', label: `${shown.length} cards` });
  b.log.push({ agent: ids.presenter, text: `Published ${plural(shown.length, 'card')} to your feed, each with the reason it was picked.`, tone: 'keep' });

  // 11. The master saves the run to memory.
  b = beat(between(800, 1200));
  b.agents.push({ id: ids.master, status: 'done', now: 'Finished', returned: `Run complete: ${totalLeads} found, ${shown.length} shown. Saved to memory for the next run.`, tokens: between(300, 500) });
  b.log.push({ agent: ids.master, text: `Run complete. ${totalLeads} found, ${shown.length} shown. Next scheduled run in 3 hours.`, tone: 'done' });

  return { brief, slots, nodes, beats };
}

const blankAgent = (): AgentLive => ({ status: 'idle', now: 'Waiting for the next run', told: '', returned: '', sources: [], found: 0, kept: 0, rejected: 0, ms: 0, tokens: 0, calls: 0 });

/** A run that has not started: the map shows the slots the current brief would fill. */
export function idleRun(input: RunInput, run = 0): RunState {
  const plan = planRun(input, run + 1);
  return {
    status: 'idle',
    run,
    seed: run + 1,
    trigger: input.trigger,
    brief: plan.brief,
    slots: plan.slots,
    nodes: plan.nodes,
    beats: [],
    cursor: 0,
    clock: 0,
    agents: Object.fromEntries(plan.nodes.map((n) => [n.id, blankAgent()])),
    candidates: [],
    log: [],
    transfers: [],
    pages: 0,
  };
}

function applyBeat(state: RunState, beat: Beat): RunState {
  const agents = { ...state.agents };
  for (const p of beat.agents) {
    const cur = agents[p.id];
    if (!cur) continue;
    agents[p.id] = {
      ...cur,
      status: p.status ?? cur.status,
      now: p.now ?? cur.now,
      told: p.told ?? cur.told,
      returned: p.returned ?? cur.returned,
      sources: p.addSources ? [...new Set([...cur.sources, ...p.addSources])] : cur.sources,
      found: cur.found + (p.found ?? 0),
      kept: cur.kept + (p.kept ?? 0),
      rejected: cur.rejected + (p.rejected ?? 0),
      tokens: cur.tokens + (p.tokens ?? 0),
      calls: cur.calls + (p.calls ?? 0),
    };
  }
  // Time is charged to every agent busy during the beat, so parallel work shows as parallel.
  for (const [id, agent] of Object.entries(agents)) {
    if (agent.status === 'working') agents[id] = { ...agent, ms: agent.ms + beat.dt };
  }
  const byId = new Map(beat.update.map((u) => [u.id, u]));
  const candidates = [...state.candidates, ...beat.add].map((c) => {
    const u = byId.get(c.id);
    return u ? { ...c, ...u } : c;
  });
  const clock = state.clock + beat.dt;
  const log = [...state.log, ...beat.log.map((entry, i) => ({ ...entry, id: `${state.run}-${state.cursor}-${i}`, t: clock }))];
  const cursor = state.cursor + 1;
  return {
    ...state,
    agents,
    candidates,
    clock,
    log,
    cursor,
    transfers: beat.transfers,
    pages: state.pages + beat.pages,
    status: cursor >= state.beats.length ? 'done' : state.status,
  };
}

export type RunAction =
  | { type: 'start'; input: RunInput }
  | { type: 'tick' }
  | { type: 'pause' }
  | { type: 'resume' }
  | { type: 'finish' }
  | { type: 'reset'; input: RunInput };

export function runReducer(state: RunState, action: RunAction): RunState {
  switch (action.type) {
    case 'start': {
      const run = state.run + 1;
      const plan = planRun(action.input, run);
      return { ...idleRun(action.input, state.run), ...plan, run, seed: run, status: plan.beats.length ? 'running' : 'done' };
    }
    case 'tick': {
      const beat = state.beats[state.cursor];
      return state.status === 'running' && beat ? applyBeat(state, beat) : state;
    }
    case 'pause':
      return state.status === 'running' ? { ...state, status: 'paused' } : state;
    case 'resume':
      return state.status === 'paused' ? { ...state, status: 'running' } : state;
    case 'finish': {
      let next: RunState = state.status === 'paused' ? { ...state, status: 'running' } : state;
      while (next.status === 'running') next = applyBeat(next, next.beats[next.cursor]!);
      return { ...next, transfers: [] };
    }
    case 'reset':
      return idleRun(action.input, state.run);
  }
}

export interface FunnelReason {
  reason: Reason;
  label: string;
  stage: number;
  items: CandidateState[];
}

/** Counts for each funnel stage and the reasons items left it. Each stage counts a subset of the one above. */
export function funnel(candidates: CandidateState[]) {
  const counts = FUNNEL_STAGES.map((_, k) => candidates.filter((c) => (k === 0 ? true : c.judged && c.stage >= k)).length);
  const reasons: FunnelReason[] = (Object.keys(REASONS) as Reason[])
    .map((reason) => ({ reason, ...REASONS[reason], items: candidates.filter((c) => c.reason === reason) }))
    .filter((r) => r.items.length > 0);
  const pending = candidates.filter((c) => !c.judged).length;
  return { counts, reasons, pending };
}

const levelOrder: Level[] = ['master', 'manager', 'worker', 'validator', 'presenter'];

/** Grok calls and tokens per level of the hierarchy. */
export function usageByLevel(state: RunState) {
  return levelOrder.map((level) => {
    const nodes = state.nodes.filter((n) => n.level === level);
    const calls = nodes.reduce((sum, n) => sum + (state.agents[n.id]?.calls ?? 0), 0);
    const tokens = nodes.reduce((sum, n) => sum + (state.agents[n.id]?.tokens ?? 0), 0);
    return { level, agents: nodes.length, calls, tokens };
  });
}

export function totals(state: RunState) {
  const all = Object.values(state.agents);
  const workerJobs = state.nodes.filter((n) => n.level === 'worker').reduce((sum, n) => sum + (state.agents[n.id]?.calls ?? 0), 0);
  return {
    calls: all.reduce((sum, a) => sum + a.calls, 0),
    tokens: all.reduce((sum, a) => sum + a.tokens, 0),
    working: all.filter((a) => a.status === 'working').length,
    agents: all.length,
    workerJobs,
  };
}
