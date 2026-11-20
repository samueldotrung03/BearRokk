// Invented postings the simulated agents "find". Every organization is made up and every link
// points to example.org. Some are deliberately closed, restricted or reposted so validation has
// real judgments to make.
import type { Candidate, ClassYear, Category, Format, OppType } from './types.ts';
import { CATEGORY_OF, yearPlural } from './types.ts';

export type OrgKind = 'startup' | 'large company' | 'nonprofit' | 'lab' | 'student group' | 'university';
export type LocationKind = 'near campus' | 'remote' | 'other city';
export type SourceKind = 'career page' | 'program list' | 'community post';

export interface CatalogItem {
  slug: string;
  category: Category;
  type: OppType;
  title: string;
  organizer: string;
  orgKind: OrgKind;
  field: string;
  locationKind: LocationKind;
  city: string | null;
  sourceKind: SourceKind;
  years: ClassYear[] | null;
  /** Days from now. Negative means already closed; null means the page does not say. */
  deadlineDays: number | null;
  startDays: number | null;
  tags: string[];
  /** A repost of this posting exists on a community site. */
  reposted: boolean;
}

const ALL: ClassYear[] = ['Freshman', 'Sophomore', 'Junior', 'Senior'];
const UPPER: ClassYear[] = ['Junior', 'Senior'];
const EARLY: ClassYear[] = ['Freshman', 'Sophomore'];

type Row = [
  title: string, organizer: string, orgKind: OrgKind, field: string, locationKind: LocationKind, city: string | null,
  sourceKind: SourceKind, years: ClassYear[] | null, deadlineDays: number | null, tags: string[], reposted?: boolean, startDays?: number | null,
];

const internships: Row[] = [
  ['Software Engineering Intern', 'Northwind Robotics', 'startup', 'software', 'near campus', 'Berkeley, CA', 'career page', ALL, 21, ['Python', 'first-year friendly'], true],
  ['Data Analyst Intern', 'Harbor Data Co', 'startup', 'data', 'remote', null, 'career page', ALL, 12, ['SQL', 'first-year friendly'], true],
  ['Machine Learning Intern', 'Meadowlark AI', 'startup', 'ai', 'remote', null, 'career page', UPPER, 30, ['PyTorch']],
  ['Explore Program: First-Year SWE', 'Granite Cloud', 'large company', 'software', 'near campus', 'San Francisco, CA', 'program list', EARLY, 9, ['first-year friendly', 'mentorship'], true],
  ['Data Science Intern', 'Tidewater Analytics', 'large company', 'data', 'other city', 'Austin, TX', 'career page', ALL, 25, ['Python', 'statistics']],
  ['Product Design Intern', 'Pinecrest Design', 'startup', 'design', 'remote', null, 'community post', ALL, 18, ['Figma']],
  ['Frontend Engineering Intern', 'Quillstack', 'startup', 'software', 'remote', null, 'community post', ALL, 14, ['React', 'first-year friendly']],
  ['Security Engineering Intern', 'Kestrel Security', 'large company', 'security', 'near campus', 'Oakland, CA', 'career page', UPPER, 40, ['networks']],
  ['Research Software Intern', 'Lumen Labs', 'lab', 'ai', 'near campus', 'Berkeley, CA', 'career page', ALL, null, ['Python', 'research']],
  ['Civic Tech Fellow', 'Open Atlas Foundation', 'nonprofit', 'software', 'remote', null, 'program list', ALL, 33, ['open source', 'first-year friendly']],
  ['Data Engineering Intern', 'Copperline Systems', 'large company', 'data', 'near campus', 'San Jose, CA', 'career page', ALL, -3, ['SQL', 'pipelines']],
  ['Hardware Intern', 'Riverbend Energy', 'large company', 'hardware', 'other city', 'Denver, CO', 'career page', ALL, 28, ['embedded']],
  ['Game Programming Intern', 'Bluejay Games', 'startup', 'software', 'remote', null, 'community post', ALL, 16, ['C#', 'games']],
  ['Quantitative Analyst Intern', 'Juniper Finance', 'large company', 'finance', 'other city', 'New York, NY', 'career page', UPPER, 11, ['statistics']],
  ['Finance Rotational Intern', 'Juniper Finance', 'large company', 'finance', 'remote', null, 'program list', ALL, 22, ['Excel']],
  ['Health Data Intern', 'Fernhill Health', 'nonprofit', 'data', 'remote', null, 'career page', ALL, 19, ['Python', 'public health'], true],
  ['Bioinformatics Intern', 'Saffron Bio', 'lab', 'bio', 'near campus', 'Emeryville, CA', 'career page', ALL, 35, ['Python', 'research']],
  ['Product Management Intern', 'Brightpath Learning', 'startup', 'product', 'remote', null, 'career page', ALL, 27, ['education']],
  ['Backend Engineering Intern', 'Granite Cloud', 'large company', 'software', 'near campus', 'San Francisco, CA', 'career page', UPPER, 20, ['Go', 'distributed systems']],
  ['Analytics Intern', 'Marigold Media', 'startup', 'data', 'near campus', 'Oakland, CA', 'community post', ALL, 8, ['SQL', 'dashboards']],
  ['AI Safety Research Intern', 'Lumen Labs', 'lab', 'ai', 'remote', null, 'program list', ALL, 45, ['research', 'Python']],
  ['Mobile Engineering Intern', 'Quillstack', 'startup', 'software', 'near campus', 'Berkeley, CA', 'career page', ALL, -6, ['Swift']],
  ['Data Journalism Intern', 'Marigold Media', 'startup', 'data', 'remote', null, 'career page', ALL, 24, ['Python', 'writing']],
  ['UX Research Intern', 'Brightpath Learning', 'startup', 'design', 'remote', null, 'program list', ALL, 29, ['interviews']],
];

const events: Row[] = [
  ['Bay Area Tech Career Fair', 'Placeholder Career Center', 'university', 'software', 'near campus', 'Berkeley, CA', 'program list', ALL, 6, ['career fair', 'networking'], true, 10],
  ['Data Careers Mixer', 'Harbor Data Co', 'startup', 'data', 'near campus', 'Berkeley, CA', 'community post', ALL, 4, ['networking', 'first-year friendly'], false, 5],
  ['Startup Info Night', 'Northwind Robotics', 'startup', 'software', 'near campus', 'Berkeley, CA', 'community post', ALL, 7, ['info session'], false, 8],
  ['Alumni Coffee Chats: Product', 'Placeholder Alumni Network', 'nonprofit', 'product', 'remote', null, 'program list', ALL, 13, ['networking', 'mentorship'], false, 15],
  ['AI Research Talk Series', 'Lumen Labs', 'lab', 'ai', 'remote', null, 'career page', ALL, null, ['talk'], false, 9],
  ['Women in Engineering Meetup', 'Placeholder Engineers Collective', 'nonprofit', 'software', 'near campus', 'Oakland, CA', 'community post', ALL, 11, ['networking', 'meetup'], true, 12],
  ['Design Portfolio Review Night', 'Pinecrest Design', 'startup', 'design', 'remote', null, 'community post', ALL, 16, ['portfolio'], false, 18],
  ['Finance Recruiting Panel', 'Juniper Finance', 'large company', 'finance', 'other city', 'New York, NY', 'career page', ALL, 10, ['panel'], false, 12],
  ['Security Careers Q&A', 'Kestrel Security', 'large company', 'security', 'remote', null, 'career page', ALL, 14, ['info session'], false, 15],
  ['Fall Networking Social', 'Placeholder Career Center', 'university', 'software', 'near campus', 'Berkeley, CA', 'program list', ALL, -2, ['networking'], false, -1],
];

const clubs: Row[] = [
  ['Placeholder Systems Club', 'Placeholder Systems Club', 'student group', 'software', 'near campus', 'Berkeley, CA', 'program list', ALL, null, ['beginner workshops', 'first-year friendly']],
  ['Placeholder Data Science Society', 'Placeholder Data Science Society', 'student group', 'data', 'near campus', 'Berkeley, CA', 'program list', ALL, 15, ['projects', 'first-year friendly'], true],
  ['Open Source Contributors Circle', 'Open Atlas Foundation', 'nonprofit', 'software', 'remote', null, 'community post', ALL, null, ['open source', 'mentorship']],
  ['Placeholder AI Reading Group', 'Placeholder AI Reading Group', 'student group', 'ai', 'near campus', 'Berkeley, CA', 'community post', ALL, null, ['research', 'papers']],
  ['Placeholder Design Collective', 'Placeholder Design Collective', 'student group', 'design', 'near campus', 'Berkeley, CA', 'program list', ALL, 20, ['Figma', 'projects']],
  ['Placeholder Consulting Club', 'Placeholder Consulting Club', 'student group', 'finance', 'near campus', 'Berkeley, CA', 'program list', UPPER, 5, ['case practice']],
  ['Placeholder Robotics Team', 'Placeholder Robotics Team', 'student group', 'hardware', 'near campus', 'Berkeley, CA', 'program list', ALL, 12, ['embedded', 'competition']],
  ['Placeholder Security Club', 'Placeholder Security Club', 'student group', 'security', 'near campus', 'Berkeley, CA', 'community post', ALL, null, ['CTF', 'first-year friendly']],
];

const programs: (Row & { type?: OppType })[] = [
  ['Winter Online Hackathon', 'Placeholder Hack Collective', 'nonprofit', 'software', 'remote', null, 'program list', ALL, 17, ['hackathon', 'first-year friendly'], true, 24],
  ['Data for Good Hackathon', 'Fernhill Health', 'nonprofit', 'data', 'near campus', 'Berkeley, CA', 'community post', ALL, 13, ['hackathon', 'public health'], false, 20],
  ['Undergraduate Research Apprenticeship', 'Placeholder University', 'university', 'ai', 'near campus', 'Berkeley, CA', 'program list', ALL, 26, ['research', 'mentorship']],
  ['Summer Research Program in Computing', 'Lumen Labs', 'lab', 'software', 'other city', 'Seattle, WA', 'program list', UPPER, 38, ['research']],
  ['First-Generation Tech Scholarship', 'Open Atlas Foundation', 'nonprofit', 'software', 'remote', null, 'program list', ALL, 31, ['scholarship', 'first-year friendly']],
  ['Women in Data Scholarship', 'Tidewater Analytics', 'large company', 'data', 'remote', null, 'career page', ALL, 23, ['scholarship']],
  ['Security Capture-the-Flag Weekend', 'Kestrel Security', 'large company', 'security', 'remote', null, 'community post', ALL, 9, ['hackathon', 'CTF'], false, 11],
  ['Bio Lab Research Assistant', 'Saffron Bio', 'lab', 'bio', 'near campus', 'Emeryville, CA', 'career page', ALL, null, ['research']],
  ['Design Sprint Challenge', 'Pinecrest Design', 'startup', 'design', 'remote', null, 'community post', ALL, 15, ['hackathon', 'Figma'], false, 19],
  ['STEM Leadership Scholarship', 'Placeholder University', 'university', 'software', 'near campus', 'Berkeley, CA', 'program list', ALL, -4, ['scholarship']],
];

const PROGRAM_TYPE = (tags: string[]): OppType =>
  tags.includes('hackathon') ? 'hackathon' : tags.includes('scholarship') ? 'scholarship' : 'research';

const slugify = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

function build(rows: Row[], typeOf: (tags: string[]) => OppType): CatalogItem[] {
  return rows.map(([title, organizer, orgKind, field, locationKind, city, sourceKind, years, deadlineDays, tags, reposted, startDays]) => {
    const type = typeOf(tags);
    return {
      slug: `${slugify(organizer)}/${slugify(title)}`,
      category: CATEGORY_OF[type],
      type,
      title,
      organizer,
      orgKind,
      field,
      locationKind,
      city,
      sourceKind,
      years,
      deadlineDays,
      startDays: startDays ?? null,
      tags,
      reposted: reposted ?? false,
    };
  });
}

export const CATALOG: CatalogItem[] = [
  ...build(internships, () => 'internship'),
  ...build(events, () => 'event'),
  ...build(clubs, () => 'club'),
  ...build(programs, PROGRAM_TYPE),
];

const DAY = 86_400_000;
export const officialUrl = (item: CatalogItem) => `https://example.org/${item.slug}`;
export const repostUrl = (item: CatalogItem) => `https://community.example.org/posts/${slugify(item.title)}?utm_source=share`;

export function findByUrl(url: string): CatalogItem | null {
  return CATALOG.find((i) => officialUrl(i) === url || repostUrl(i) === url) ?? null;
}

const yearsText = (years: ClassYear[] | null) =>
  !years || years.length === 4 ? 'Open to all class years' : `Open to ${years.map(yearPlural).join(' and ')} only`;

/** The record an extractor would read off the official page. */
export function toCandidate(item: CatalogItem, now: Date): Candidate {
  const url = officialUrl(item);
  const iso = (days: number | null) => (days === null ? null : new Date(now.getTime() + days * DAY).toISOString());
  const deadline = iso(item.deadlineDays);
  const format: Format = item.locationKind === 'remote' ? 'online' : 'in_person';
  const evidence = [{ field: 'eligibility', quote: `${yearsText(item.years)}.`, url }];
  if (deadline) {
    const verb = item.category === 'internship' ? 'Applications close' : item.category === 'club' ? 'Sign-ups close' : 'Register by';
    evidence.push({ field: 'deadline', quote: `${verb} ${deadline.slice(0, 10)}.`, url });
  }
  return {
    type: item.type,
    title: item.title,
    organizer: item.organizer,
    sourceUrl: url,
    actionUrl: `${url}/apply`,
    format,
    location: item.city,
    field: item.field,
    tags: item.tags,
    eligibility: yearsText(item.years),
    eligibleYears: item.years,
    deadline,
    startTime: iso(item.startDays),
    image: null,
    evidence,
  };
}
