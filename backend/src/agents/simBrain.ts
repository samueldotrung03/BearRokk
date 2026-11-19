// Simulated agents. Same roles, inputs and outputs as the live ones, but every decision is made
// by plain rules over the sample catalog, with short pauses so a run can be watched.
import type { Brain, MasterInput } from './brain.ts';
import { CATALOG, findByUrl, officialUrl, repostUrl, toCandidate, type CatalogItem } from './catalog.ts';
import { noteMatch, noteSignals } from './scoring.ts';
import { CATEGORY_LABEL, yearPlural, type ReviewFocus, type Assignment, type Brief, type Candidate, type Category, type Lens, type MemorySummary, type Opportunity, type ScoutSpec } from './types.ts';

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
  // The dashboard's wording for the same areas.
  'backend systems': ['software'],
  'ai and machine learning': ['ai'],
  'cloud infrastructure': ['software'],
  robotics: ['hardware'],
  research: ['ai', 'bio'],
  // Career paths asked at set-up.
  'software engineering': ['software'],
  'data science': ['data'],
  'product management': ['product'],
  'design and ux': ['design'],
  cybersecurity: ['security'],
  'hardware and robotics': ['hardware'],
  consulting: ['finance'],
  // Wider, non-tech areas, only where a field fits.
  'business and entrepreneurship': ['product', 'finance'],
  entrepreneurship: ['product'],
  marketing: ['product'],
  economics: ['finance'],
  'healthcare and medicine': ['bio'],
  healthcare: ['bio'],
  'biology and life sciences': ['bio'],
  'biotech and life sciences': ['bio'],
  'visual art and design': ['design'],
  fashion: ['design'],
  architecture: ['design'],
  'mechanical and civil engineering': ['hardware'],
};

/** Words in a ticked field's name that point at one of the areas the sample postings cover. */
const FIELD_WORDS: [RegExp, string][] = [
  [/software|cloud|devops|game|it \//i, 'software'],
  [/data|analytics/i, 'data'],
  [/\bai\b|machine learning|academic research/i, 'ai'],
  [/design|ux|visual/i, 'design'],
  [/security/i, 'security'],
  [/hardware|robot|electrical|embedded|mechanical|aerospace|civil/i, 'hardware'],
  [/bio|pharma|health|medicine|chemistry/i, 'bio'],
  [/quant|bank|asset|venture|trading|finance|fintech|insurance|accounting|consulting|economics/i, 'finance'],
  [/product|marketing|startups|operations|business development/i, 'product'],
];

/** The profile page's ticked fields, as areas the simulated search understands. Top field first. */
export function areasOf(fields: string[], topField: string | null): string[] {
  const ordered = topField ? [topField, ...fields.filter((f) => f !== topField)] : fields;
  return [...new Set(ordered.flatMap((f) => FIELD_WORDS.filter(([re]) => re.test(f)).map(([, area]) => area).slice(0, 1)))];
}

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
    // Careers the student is considering count as interests too.
    const prefs = profile.preferences;
    // The profile page's ticked fields come first; what was said at sign-up fills in behind them.
    // Notes are read first. Areas a note names lead the search; areas it rules out are dropped.
    const notes = prefs?.notes ?? [];
    const signals = noteSignals(notes);
    const fromNotes = areasOf(signals.want, null);
    const ruledOut = new Set(areasOf(signals.avoid, null));
    // Background comes last: what the student has already done hints at fit, but what they say they want leads.
    const entries = prefs?.experience?.entries ?? [];
    const background = [...entries.flatMap((e) => [e.role, e.organization, e.kind, e.summary, ...e.skills]), input.resumeText ?? ''].filter(Boolean);
    const fromBackground = areasOf(background.join('. ').split(/[.,;\n]/), null).slice(0, 3);
    const fields = [...new Set([...fromNotes, ...areasOf(prefs?.fields ?? [], prefs?.topField ?? null), ...fieldsOf([...profile.interests, ...profile.careerInterests.filter((c) => c !== 'Not sure yet')]), ...fromBackground])].filter((f) => !ruledOut.has(f));
    const rule = (id: string) => prefs?.checks[id] === true;
    // Answers with several entries read as one comma-separated line; older saves only have the typed answer.
    const said = (id: string) => {
      const list = prefs?.lists?.[id]?.map((x) => x.trim()).filter(Boolean) ?? [];
      return list.length ? list.join(', ') : prefs?.answers[id]?.trim() || null;
    };
    const anyWay = rule('inPerson') || rule('hybrid') || rule('remote');
    const onlyRemote = (rule('remote') && !rule('inPerson') && !rule('hybrid')) || (signals.want.includes('remote') && /\bonly remote|remote only|fully remote\b/i.test(notes.map((n) => n.body).join(' ')));
    const remoteOk = !anyWay || rule('remote') || onlyRemote ? (anyWay || onlyRemote ? true : profile.remoteOk) : false;
    const seasons = ['Summer', 'Fall', 'Winter', 'Spring'].filter((x) => rule(`season${x}`));
    const wanted = [...new Set(input.assignments.map((a) => CATEGORY_LABEL[a.category].toLowerCase()))];
    const brief: Brief = {
      goal: `${wanted.join(', ')} for a ${profile.year.toLowerCase()} in ${profile.major} interested in ${fields.join(' and ')}`,
      hardCriteria: [
        `open to ${yearPlural(profile.year)}`,
        onlyRemote ? 'remote only' : remoteOk ? `near ${said('cities') ?? profile.location} or remote` : `near ${said('cities') ?? profile.location}`,
        'still open: deadline not passed',
        // Restrictions are rules, so each one that is set becomes a hard criterion.
        ...(rule('paidOnly') ? [`paid${said('minPay') ? `, at least $${said('minPay')} an hour` : ''}`] : []),
        ...(seasons.length ? [`during ${seasons.join(' or ').toLowerCase()}`] : []),
        ...(rule('skipNoDeadline') ? ['states a deadline'] : []),
        ...(said('workAuthorization') ? [`open to: ${said('workAuthorization')}`] : []),
        ...(rule('skipCoverLetter') ? ['no cover letter required'] : []),
        ...(rule('skipSoonDeadline') ? ['deadline at least 3 days away'] : []),
      ],
      preferences: [
        // First in the list because they matter most.
        ...notes.map((n) => `from their note${n.title ? ` "${n.title}"` : ''}: ${n.body.replace(/\s+/g, ' ').slice(0, 200)}`),
        ...(prefs?.topField ? [`top field: ${prefs.topField}`] : []),
        ...(said('rolesWanted') ? [`roles wanted most: ${said('rolesWanted')}`] : []),
        ...fields.map((f) => `${f} work`),
        ...entries.slice(0, 3).filter((e) => e.role || e.organization).map((e) => `builds on their experience: ${[e.role, e.organization].filter(Boolean).join(' at ')}`),
        ...(input.resumeText ? ['matches the skills on their résumé'] : []),
        ...profile.careerInterests.filter((c) => c !== 'Not sure yet').map((c) => `leads toward ${c.toLowerCase()}`),
        ...(profile.eventTypes.length ? [`events such as ${profile.eventTypes.join(', ').toLowerCase()}`] : []),
        ...memory.likes.slice(0, 3).map((l) => `more like what they liked: ${l.feature}`),
      ],
      avoid: [...new Set([...signals.avoidNames, ...signals.avoid, ...ruledOut, ...memory.avoidFields, ...[said('skipCompanies'), said('skipIndustries'), said('skipRoles')].filter((x): x is string => x !== null)])],
      interests: fields,
      year: profile.year,
      location: profile.location,
      remoteOk,
      notes: notes.map((n) => (n.title ? `${n.title}: ${n.body}` : n.body)),
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

  async validate(candidate: Candidate, brief: Brief, memory: MemorySummary, focus: ReviewFocus) {
    await this.pause(1300, candidate.sourceUrl + focus);
    const reject = (reason: string) => ({ keep: false, reason, fit: 0, record: candidate });
    const now = this.now().getTime();
    const signals = noteSignals(brief.notes.map((body) => ({ title: '', body })));
    const noted = noteMatch({ ...candidate, location: candidate.location }, signals);

    if (focus === 'status') {
      // Is it real and still open?
      if (!findByUrl(candidate.sourceUrl)) return reject('The official page could not be found');
      if (candidate.deadline && Date.parse(candidate.deadline) < now) return reject(`Closed: the deadline passed on ${candidate.deadline.slice(0, 10)}`);
      if (!candidate.deadline && brief.hardCriteria.includes('states a deadline')) return reject("States no deadline, and the student's restrictions skip those");
    } else {
      // Does it meet the student's rules, and is it what they are looking for? Notes are checked first.
      if (noted.avoided.length) return reject(`The student's notes rule this out (${noted.avoided.slice(0, 3).join(', ')})`);
      if (candidate.eligibleYears && !candidate.eligibleYears.includes(brief.year)) return reject(`Not open to ${yearPlural(brief.year)}: ${candidate.eligibility?.toLowerCase()}`);
      const item = findByUrl(candidate.sourceUrl);
      if (candidate.format === 'in_person' && item?.locationKind === 'other city') return reject(`In person in ${candidate.location}, and the student wants near ${brief.location}${brief.remoteOk ? ' or remote' : ''}`);
      if (candidate.format === 'online' && !brief.remoteOk) return reject('Remote only, and the student wants in person');
      if (candidate.format !== 'online' && brief.hardCriteria.includes('remote only')) return reject(`In person in ${candidate.location}, and the student's restrictions say remote only`);
      if (candidate.field && memory.avoidFields.includes(candidate.field)) return reject(`Not what the student is looking for: they keep disliking ${candidate.field} opportunities`);
    }

    let fit = 0.38;
    if (candidate.field && brief.interests.includes(candidate.field)) fit += 0.26;
    if (candidate.tags.includes('first-year friendly') && (brief.year === 'Freshman' || brief.year === 'Sophomore')) fit += 0.12;
    if (candidate.tags.some((t) => /python|sql|react|figma/i.test(t))) fit += 0.06;
    fit += hash(candidate.sourceUrl) * 0.14;
    // Something a note asks for is a strong fit whatever else is true of it.
    if (noted.wanted.length) fit = Math.max(fit, 0.8) + 0.05 * Math.min(noted.wanted.length, 3);
    const reason =
      focus === 'status'
        ? candidate.deadline ? `Open: the official page gives a deadline of ${candidate.deadline.slice(0, 10)}` : 'Open: the official page is up and lists no closing date'
        : noted.wanted.length ? "Asked for in the student's notes, and meets every rule" : 'Meets every rule the student set';
    return { keep: true, reason, fit: Math.min(0.98, Number(fit.toFixed(2))), record: candidate };
  }

  async present(kept: Opportunity[], brief: Brief, memory: MemorySummary) {
    await this.pause(1500, 'present');
    const liked = new Set(memory.likes.map((l) => l.feature));
    const out = new Map<string, string>();
    for (const o of kept) {
      const bits: string[] = [];
      const asked = noteMatch(o, noteSignals(brief.notes.map((body) => ({ title: '', body })))).wanted;
      if (asked.length) bits.push(`Your notes ask for this (${asked.slice(0, 3).join(', ')})`);
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
