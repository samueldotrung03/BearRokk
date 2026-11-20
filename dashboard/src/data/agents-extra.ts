// What the simulated workers can "find" on the Agents page. Invented like the rest of the sample
// data: items linked to a feed card reuse that card's (invented) organizer, and every other item
// names only a generic kind of organizer. Sources are kinds of pages, never real sites or URLs.
//
// The list is shaped so a run shows every judgment the validation agents make: reposts, closed
// postings, pages with no official source, the wrong class year, too far away, and anything the
// student asked for less of.
import type { ClassYear } from '../types.ts';

export type Category = 'internships' | 'events' | 'clubs' | 'programs';

export type Tag =
  | 'research'
  | 'hackathon'
  | 'scholarship'
  | 'finance'
  | 'ml'
  | 'backend'
  | 'data'
  | 'web'
  | 'security'
  | 'robotics'
  | 'startup'
  | 'networking';

export interface Candidate {
  id: string;
  title: string;
  organizer: string;
  category: Category;
  tags: Tag[];
  /** The kind of page a worker read it on. */
  source: string;
  format: 'remote' | 'in_person' | 'hybrid';
  /** Within reach of campus, for anything not fully remote. */
  near: boolean;
  /** Class years it is open to. An empty list means it is not for students at all. */
  years: ClassYear[] | 'any';
  /** Shown when the class year or level does not fit. */
  levelNote?: string;
  open: boolean;
  /** Shown when it is closed. */
  closedNote?: string;
  /** False when no official page backs it up, only a forum post or a rumor. */
  official: boolean;
  /** The candidate this one is a repost of. */
  repostOf?: string;
  /** The feed card this candidate is, when it is one of the sample opportunities. */
  opportunityId?: string;
  /** Which slice of its category it belongs to, 0 to 3, when several managers share a category. */
  slice: number;
  /** Fit score for candidates that are not feed cards, 0 to 1. */
  fit: number;
}

export const categoryLabels: Record<Category, string> = {
  internships: 'Internships',
  events: 'Events and networking',
  clubs: 'Clubs and communities',
  programs: 'Programs',
};

/** How a category is split when more than one manager works on it, with the pages each slice reads. */
export const categorySlices: Record<Category, { label: string; sources: string[] }[]> = {
  internships: [
    { label: 'by field', sources: ['company career pages', 'internship program lists'] },
    { label: 'by employer type', sources: ['startup job boards', 'company career pages'] },
    { label: 'by location', sources: ['university job board', 'regional job listings'] },
    { label: 'by source', sources: ['job board reposts', 'program lists'] },
  ],
  events: [
    { label: 'on campus', sources: ['campus events calendar', 'department newsletters'] },
    { label: 'conferences', sources: ['conference sites', 'meetup pages'] },
    { label: 'online', sources: ['online event listings', 'developer community pages'] },
    { label: 'career center', sources: ['career center listings', 'company events pages'] },
  ],
  clubs: [
    { label: 'student orgs', sources: ['student org directory', 'club websites'] },
    { label: 'by interest', sources: ['club websites', 'club fair listings'] },
    { label: 'department groups', sources: ['department pages', 'department newsletters'] },
    { label: 'communities', sources: ['community forums', 'meetup pages'] },
  ],
  programs: [
    { label: 'research', sources: ['lab websites', 'department research pages'] },
    { label: 'scholarships', sources: ['foundation pages', 'financial aid listings'] },
    { label: 'hackathons', sources: ['hackathon listings', 'student org directory'] },
    { label: 'other programs', sources: ['club newsletters', 'program directories'] },
  ],
};

const base = { near: true, years: 'any' as const, open: true, official: true, fit: 0.7 };

export const candidates: Candidate[] = [
  // Internships
  { ...base, id: 'c-swe', title: 'Software Engineering Intern, Summer 2027', organizer: 'Northwind Robotics', category: 'internships', tags: ['backend', 'robotics'], source: 'company career page', format: 'hybrid', opportunityId: 'opp-northwind-swe', slice: 0 },
  { ...base, id: 'c-data', title: 'Data Engineering Intern', organizer: 'Harbor Analytics', category: 'internships', tags: ['data', 'backend'], source: 'company career page', format: 'remote', opportunityId: 'opp-harbor-data', slice: 1 },
  { ...base, id: 'c-senior', title: 'Senior Backend Engineer', organizer: 'a cloud software company', category: 'internships', tags: ['backend'], source: 'company career page', format: 'hybrid', years: [], levelNote: 'A full-time role asking for 5+ years of experience', slice: 2 },
  { ...base, id: 'c-swe-repost', title: 'Software Engineering Intern (job board repost)', organizer: 'Northwind Robotics', category: 'internships', tags: ['backend', 'robotics'], source: 'job board repost', format: 'hybrid', repostOf: 'c-swe', slice: 3 },
  { ...base, id: 'c-quant', title: 'Quantitative Trading Intern', organizer: 'a trading firm', category: 'internships', tags: ['finance', 'data'], source: 'company career page', format: 'in_person', slice: 2, fit: 0.62 },
  { ...base, id: 'c-fall', title: 'Fall Software Intern', organizer: 'a payments company', category: 'internships', tags: ['finance', 'backend'], source: 'internship program list', format: 'hybrid', open: false, closedNote: 'The application closed last month', slice: 1 },
  { ...base, id: 'c-ml-remote', title: 'ML Platform Intern, Remote', organizer: 'an AI startup', category: 'internships', tags: ['ml', 'startup', 'backend'], source: 'startup job board', format: 'remote', slice: 0, fit: 0.78 },
  { ...base, id: 'c-security', title: 'Security Engineering Intern', organizer: 'a security company', category: 'internships', tags: ['security'], source: 'company career page', format: 'in_person', near: false, slice: 3, fit: 0.6 },
  { ...base, id: 'c-bank', title: 'Technology Analyst Program', organizer: 'a regional bank', category: 'internships', tags: ['finance', 'data'], source: 'university job board', format: 'hybrid', years: ['Junior'], levelNote: 'Open to juniors only', slice: 1 },

  // Events and networking
  { ...base, id: 'c-info', title: 'Engineering Info Session and Resume Review', organizer: 'Lumen Labs', category: 'events', tags: ['networking'], source: 'company events page', format: 'in_person', opportunityId: 'opp-lumen-info', slice: 0 },
  { ...base, id: 'c-fair', title: 'Spring Engineering Career Fair', organizer: 'Campus Career Center', category: 'events', tags: ['networking'], source: 'career center listing', format: 'in_person', opportunityId: 'opp-career-fair', slice: 3 },
  { ...base, id: 'c-fin-night', title: 'Finance networking night', organizer: 'an investment club', category: 'events', tags: ['finance', 'networking'], source: 'campus events calendar', format: 'in_person', slice: 0, fit: 0.58 },
  { ...base, id: 'c-panel', title: 'Career panel: life after the internship', organizer: 'the engineering department', category: 'events', tags: ['networking'], source: 'campus events calendar', format: 'in_person', open: false, closedNote: 'It already happened last week', slice: 0 },
  { ...base, id: 'c-talk', title: 'Online talk: landing a first backend internship', organizer: 'a developer community', category: 'events', tags: ['backend', 'networking'], source: 'online event listing', format: 'remote', slice: 2, fit: 0.74 },
  { ...base, id: 'c-conf', title: 'National student tech conference', organizer: 'a national student group', category: 'events', tags: ['networking'], source: 'conference site', format: 'in_person', near: false, slice: 1, fit: 0.6 },

  // Clubs and communities
  { ...base, id: 'c-systems', title: 'Open Source Systems Club', organizer: 'Student Computing Association', category: 'clubs', tags: ['backend'], source: 'student org directory', format: 'in_person', opportunityId: 'opp-systems-club', slice: 0 },
  { ...base, id: 'c-ai-club', title: 'AI Builders student club', organizer: 'a student club', category: 'clubs', tags: ['ml'], source: 'club website', format: 'in_person', slice: 1, fit: 0.76 },
  { ...base, id: 'c-quant-club', title: 'Quant finance club', organizer: 'a student club', category: 'clubs', tags: ['finance', 'data'], source: 'club website', format: 'in_person', slice: 1, fit: 0.6 },
  { ...base, id: 'c-cp', title: 'Competitive programming club', organizer: 'a student club', category: 'clubs', tags: ['backend'], source: 'student org directory', format: 'in_person', open: false, closedNote: 'The club page says it is inactive this semester', slice: 0 },
  { ...base, id: 'c-grad', title: 'Graduate ML reading group', organizer: 'a department group', category: 'clubs', tags: ['ml', 'research'], source: 'department page', format: 'in_person', years: [], levelNote: 'For graduate students only', slice: 2 },
  { ...base, id: 'c-community', title: 'Bay Area backend developers community', organizer: 'a developer community', category: 'clubs', tags: ['backend', 'web'], source: 'community forum', format: 'hybrid', slice: 3, fit: 0.68 },

  // Programs: research, scholarships, hackathons
  { ...base, id: 'c-hack', title: 'Bay Builders Winter Hackathon', organizer: 'Bay Builders Collective', category: 'programs', tags: ['hackathon'], source: 'hackathon listing', format: 'in_person', opportunityId: 'opp-bay-hack', slice: 2 },
  { ...base, id: 'c-ml-lab', title: 'Undergraduate Research Assistant, Efficient ML Systems', organizer: 'Distributed Learning Lab', category: 'programs', tags: ['research', 'ml'], source: 'lab website', format: 'in_person', opportunityId: 'opp-ml-research', slice: 0 },
  { ...base, id: 'c-scholarship', title: 'First-Generation Technologists Scholarship', organizer: 'Meridian Foundation', category: 'programs', tags: ['scholarship'], source: 'foundation page', format: 'remote', opportunityId: 'opp-first-gen-scholarship', slice: 1 },
  { ...base, id: 'c-hack-repost', title: 'Bay Builders Winter Hackathon (newsletter repost)', organizer: 'Bay Builders Collective', category: 'programs', tags: ['hackathon'], source: 'club newsletter', format: 'in_person', repostOf: 'c-hack', slice: 3 },
  { ...base, id: 'c-sys-lab', title: 'Undergraduate Researcher, Distributed Systems', organizer: 'a campus systems lab', category: 'programs', tags: ['research', 'backend'], source: 'student forum post', format: 'in_person', official: false, slice: 0 },
  { ...base, id: 'c-summer-research', title: 'Summer Research Program in Computing', organizer: 'a university research program', category: 'programs', tags: ['research'], source: 'program directory', format: 'in_person', slice: 0, fit: 0.72 },
  { ...base, id: 'c-fin-scholarship', title: 'Future Finance Leaders Scholarship', organizer: 'a finance association', category: 'programs', tags: ['finance', 'scholarship'], source: 'foundation page', format: 'remote', slice: 1, fit: 0.55 },
  { ...base, id: 'c-old-hack', title: 'Fall Campus Hackathon', organizer: 'a student hackathon team', category: 'programs', tags: ['hackathon'], source: 'hackathon listing', format: 'in_person', open: false, closedNote: 'Registration closed and the event is over', slice: 2 },
];
