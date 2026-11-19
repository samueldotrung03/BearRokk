// Simulated agents. Same roles, inputs and outputs as the live ones, but every decision is made
// by plain rules over the sample catalog, with short pauses so a run can be watched.
import type { Brain, MasterInput } from './brain.ts';
import { CATALOG, findByUrl, officialUrl, repostUrl, toCandidate, type CatalogItem } from './catalog.ts';
import { CATEGORY_LABEL, yearPlural, type Assignment, type Brief, type Candidate, type Category, type Lens, type MemorySummary, type Opportunity, type ScoutSpec } from './types.ts';

const INTEREST_FIELDS: Record<string, string[]> = {
  coding: ['software'],
  'web development': ['software'],
  data: ['data'],
  ai: ['ai'],
  design: ['design'],
  security: ['security'],
  hardware: ['hardware'],
  biology: ['bio'],
  finance: ['finance'],
  product: ['product'],
};

export const fieldsOf = (interests: string[]) => [...new Set(interests.flatMap((i) => INTEREST_FIELDS[i.toLowerCase()] ?? [i.toLowerCase()]))];

const LENSES: Lens[] = ['field', 'employer', 'location', 'source'];
const LENS_NAME: Record<Lens, string> = { all: 'everything', field: 'by field', employer: 'by organization type', location: 'by location', source: 'by source' };

const lensValue = (item: CatalogItem, lens: Lens): string =>
  lens === 'field' ? item.field : lens === 'employer' ? item.orgKind : lens === 'location' ? item.locationKind : lens === 'source' ? item.sourceKind : 'all';

function hash(text: string): number {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 16777619);
  return ((h >>> 0) % 1000) / 1000;
}

export class SimBrain implements Brain {
  mode = 'simulated' as const;
  private speed: number;
  private now: () => Date;

  /** speed 0 removes the pauses (tests). */
  constructor(opts: { speed?: number; now?: () => Date } = {}) {
    this.speed = opts.speed ?? 1;
    this.now = opts.now ?? (() => new Date());
  }

  private pause(ms: number, key: string) {
    if (this.speed === 0) return Promise.resolve();
    return new Promise((r) => setTimeout(r, (ms * (0.7 + 0.6 * hash(key))) / this.speed));
  }

  private focusFor(category: Category, lens: Lens, input: MasterInput): string[] {
    const items = CATALOG.filter((i) => i.category === category);
    const present = (values: string[]) => values.filter((v) => items.some((i) => lensValue(i, lens) === v));
    if (lens === 'field') {
      const disliked = new Set(input.memory.avoidFields);
      const wanted = [...fieldsOf(input.profile.interests), ...input.memory.likes.map((l) => l.feature)];
      const fields = present([...new Set(wanted)]).filter((f) => !disliked.has(f));
      return fields.length ? fields.slice(0, 3) : present([...new Set(items.map((i) => i.field))]).slice(0, 3);
    }
    if (lens === 'location') return present(input.profile.remoteOk ? ['near campus', 'remote'] : ['near campus']);
    if (lens === 'employer') return present(['startup', 'large company', 'nonprofit', 'lab', 'student group', 'university']).slice(0, 3);
    if (lens === 'source') return present(['career page', 'program list', 'community post']);
    return ['all'];
  }

  async master(input: MasterInput) {
    await this.pause(3200, 'master');
    const { profile, memory } = input;
    const fields = fieldsOf(profile.interests);
    const wanted = [...new Set(input.assignments.map((a) => CATEGORY_LABEL[a.category].toLowerCase()))];
    const brief: Brief = {
      goal: `${wanted.join(', ')} for a ${profile.year.toLowerCase()} in ${profile.major} interested in ${fields.join(' and ')}`,
      hardCriteria: [
        `open to ${yearPlural(profile.year)}`,
        profile.remoteOk ? `near ${profile.location} or remote` : `near ${profile.location}`,
        'still open: deadline not passed',
      ],
      preferences: [...fields.map((f) => `${f} work`), ...memory.likes.slice(0, 3).map((l) => `more like what they liked: ${l.feature}`)],
      avoid: memory.avoidFields,
      interests: fields,
      year: profile.year,
      location: profile.location,
      remoteOk: profile.remoteOk,
    };

    // Managers sharing a category each take a different lens on it.
    const perCategory = new Map<Category, number>();
    const assignments = input.assignments.map((a) => {
      const index = perCategory.get(a.category) ?? 0;
      perCategory.set(a.category, index + 1);
      const alone = input.assignments.filter((x) => x.category === a.category).length === 1;
      const lens: Lens = alone ? 'field' : LENSES[index % LENSES.length]!;
      return { ...a, lens, focus: this.focusFor(a.category, lens, input) };
    });
    for (const a of assignments) {
      a.others = assignments.filter((x) => x.category === a.category && x.managerId !== a.managerId).map((x) => `${x.name} covers it ${LENS_NAME[x.lens]}`);
    }
    return { brief, assignments };
  }

  async planJobs(assignment: Assignment, _brief: Brief): Promise<ScoutSpec[]> {
    await this.pause(900, assignment.managerId);
    const noun = CATEGORY_LABEL[assignment.category].toLowerCase();
    return assignment.focus.map((value) => ({
      label: assignment.lens === 'all' ? `all ${noun}` : `${value} ${noun}`,
      query: `${noun} ${value}`,
      lensValue: value,
    }));
  }

  async scout(spec: ScoutSpec, assignment: Assignment, brief: Brief, known: Set<string>) {
    await this.pause(1500, spec.label + assignment.managerId);
    const avoid = new Set(brief.avoid);
    const matches = CATALOG.filter((i) => i.category === assignment.category)
      .filter((i) => assignment.lens === 'all' || lensValue(i, assignment.lens) === spec.lensValue)
      .filter((i) => !avoid.has(i.field))
      // New postings first, so every run brings something the student has not seen.
      .sort((a, b) => Number(known.has(officialUrl(a))) - Number(known.has(officialUrl(b))) || hash(a.slug + assignment.managerId) - hash(b.slug + assignment.managerId))
      .slice(0, 4);
    // A scout searching community posts lands on the repost, not the official page.
    return matches.map((i) => ({
      title: i.title,
      url: i.reposted && (i.sourceKind === 'community post' || assignment.lens === 'source' || assignment.lens === 'location') ? repostUrl(i) : officialUrl(i),
    }));
  }

  async extract(lead: { title: string; url: string }, _assignment: Assignment): Promise<Candidate | null> {
    await this.pause(1700, lead.url);
    const item = findByUrl(lead.url);
    return item ? toCandidate(item, this.now()) : null;
  }

  async readApplication(candidate: Candidate) {
    await this.pause(1200, candidate.sourceUrl + 'app');
    const byType: Record<string, { prompts: string[]; materials: string[] }> = {
      internship: {
        prompts: [`Why do you want to work at ${candidate.organizer}?`, 'Describe a project you built and what you learned from it.'],
        materials: ['Résumé', 'Unofficial transcript'],
      },
      event: { prompts: ['What do you hope to get out of this event?'], materials: [] },
      club: { prompts: ['Why do you want to join?', 'What would you like to build or learn this term?'], materials: [] },
      hackathon: { prompts: ['Do you have a team, or should we match you?'], materials: [] },
      research: { prompts: ['Describe your research interests in 200 words.'], materials: ['Résumé', 'One reference'] },
      scholarship: { prompts: ['Tell us about a challenge you overcame (500 words).'], materials: ['Transcript', 'One recommendation letter'] },
    };
    return byType[candidate.type]!;
  }

  async validate(candidate: Candidate, brief: Brief, memory: MemorySummary) {
    await this.pause(1300, candidate.sourceUrl + 'v');
    const reject = (reason: string) => ({ keep: false, reason, fit: 0, record: candidate });
    const now = this.now().getTime();

    if (candidate.deadline && Date.parse(candidate.deadline) < now) return reject(`Closed: the deadline passed on ${candidate.deadline.slice(0, 10)}`);
    if (candidate.eligibleYears && !candidate.eligibleYears.includes(brief.year)) return reject(`Not open to ${yearPlural(brief.year)}: ${candidate.eligibility?.toLowerCase()}`);
    const item = findByUrl(candidate.sourceUrl);
    if (candidate.format === 'in_person' && item?.locationKind === 'other city') return reject(`In person in ${candidate.location}, and the student wants near ${brief.location}${brief.remoteOk ? ' or remote' : ''}`);
    if (candidate.format === 'online' && !brief.remoteOk) return reject('Remote only, and the student wants in person');
    if (candidate.field && memory.avoidFields.includes(candidate.field)) return reject(`Not what the student is looking for: they keep disliking ${candidate.field} opportunities`);

    let fit = 0.38;
    if (candidate.field && brief.interests.includes(candidate.field)) fit += 0.26;
    if (candidate.tags.includes('first-year friendly') && (brief.year === 'Freshman' || brief.year === 'Sophomore')) fit += 0.12;
    if (candidate.tags.some((t) => /python|sql|react|figma/i.test(t))) fit += 0.06;
    fit += hash(candidate.sourceUrl) * 0.14;
    return { keep: true, reason: 'Meets every hard criterion', fit: Math.min(0.96, Number(fit.toFixed(2))), record: candidate };
  }

  async present(kept: Opportunity[], brief: Brief, memory: MemorySummary) {
    await this.pause(1500, 'present');
    const liked = new Set(memory.likes.map((l) => l.feature));
    const out = new Map<string, string>();
    for (const o of kept) {
      const bits: string[] = [];
      if (o.field && liked.has(o.field)) bits.push(`You have been liking ${o.field} opportunities`);
      else if (o.field && brief.interests.includes(o.field)) bits.push(`Matches your interest in ${o.field}`);
      else bits.push(`Something outside your usual picks, in ${o.field}`);
      const likedTag = o.tags.find((t) => liked.has(t));
      if (likedTag) bits.push(`has "${likedTag}", which you have liked before`);
      if (o.eligibleYears?.length === 4 || o.tags.includes('first-year friendly')) bits.push(`open to ${yearPlural(brief.year)}`);
      bits.push(o.format === 'online' ? 'remote' : `in ${o.location}`);
      out.set(o.id, `${bits.join(', ')}.`);
    }
    return out;
  }
}
