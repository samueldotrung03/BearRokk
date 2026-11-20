// What the profile page asks, in three tabs. Career interests decide what the agents search for,
// Restrictions are rules no result may break, and Custom notes are read first and override both.

export type Item =
  | { kind: 'check'; id: string; label: string }
  | { kind: 'text'; id: string; label: string; placeholder?: string; long?: boolean; hint?: string }
  | { kind: 'list'; id: string; label: string; placeholder?: string; addLabel?: string; hint?: string }
  | { kind: 'number'; id: string; label: string; placeholder?: string; prefix?: string; suffix?: string }
  | { kind: 'date'; id: string; label: string }
  | { kind: 'select'; id: string; label: string; options: string[] };

export interface Section {
  title: string;
  hint?: string;
  /** Tick-boxes that belong together get one heading. */
  checksLabel?: string;
  items: Item[];
}

export interface FieldGroup {
  title: string;
  fields: string[];
}

export const fieldGroups: FieldGroup[] = [
  {
    title: 'Technology',
    fields: ['Software engineering', 'AI / machine learning', 'Data science / analytics', 'Product management', 'Cybersecurity', 'Cloud / infrastructure / DevOps', 'Hardware / robotics', 'Electrical / embedded engineering', 'Game development', 'Design / UX', 'IT / technical support'],
  },
  {
    title: 'Finance and business',
    fields: ['Quant trading / quant research', 'Investment banking', 'Asset management / hedge funds', 'Venture capital / private equity', 'Sales and trading', 'Corporate finance / accounting', 'Fintech', 'Insurance / actuarial', 'Real estate', 'Consulting', 'Business operations / strategy', 'Marketing / growth', 'Sales / business development', 'Supply chain / logistics', 'Startups (any role)'],
  },
  {
    title: 'Science, engineering and health',
    fields: ['Academic research (lab or professor)', 'Biotech / pharma', 'Healthcare / medicine', 'Public health', 'Mechanical / aerospace engineering', 'Civil / environmental engineering', 'Energy / climate / sustainability', 'Chemistry / materials'],
  },
  {
    title: 'Policy, law and society',
    fields: ['Economics / policy research', 'Government / public service', 'Law / legal', 'Nonprofit / social impact', 'Education / teaching', 'International relations'],
  },
  {
    title: 'Media and creative',
    fields: ['Journalism / writing', 'Media / entertainment', 'Communications / PR', 'Graphic / visual design', 'Film / video production', 'Music / arts'],
  },
  {
    title: 'Other',
    fields: ['Sports business / analytics', 'Hospitality / tourism', 'Human resources / people'],
  },
];

/** Kinds of opportunity the agents can look for. Ids match the backend's categories. */
export const opportunityKinds = [
  { id: 'internship', label: 'Internships' },
  { id: 'event', label: 'Events and networking' },
  { id: 'club', label: 'Clubs and communities' },
  { id: 'program', label: 'Research, scholarships and hackathons' },
];

export const careerSections: Section[] = [
  {
    title: 'Roles',
    hint: 'Be as specific as you like: "backend, not frontend" or "trading, not operations".',
    items: [
      { kind: 'list', id: 'rolesWanted', label: 'Roles I want most', placeholder: 'A role, such as backend engineer', addLabel: 'Add another role' },
      { kind: 'list', id: 'rolesOpen', label: "Roles I'm open to", placeholder: 'A role', addLabel: 'Add another role' },
    ],
  },
  {
    title: 'Where I want to end up',
    hint: 'Your agents favour opportunities that lead here, and your roadmap is built toward it.',
    items: [
      { kind: 'list', id: 'careersConsidering', label: "Careers I'm considering", placeholder: 'A career', addLabel: 'Add another career' },
      { kind: 'list', id: 'dreamRoles', label: 'Dream roles', placeholder: 'A role', addLabel: 'Add another role' },
      { kind: 'list', id: 'dreamCompanies', label: 'Dream companies or organizations', placeholder: 'A company or organization', addLabel: 'Add another company' },
      { kind: 'list', id: 'topics', label: 'Industries, topics and problems I care about', placeholder: 'A topic, such as climate', addLabel: 'Add another topic' },
    ],
  },
  {
    title: 'What I want out of it',
    checksLabel: 'Tick what matters most',
    items: [
      { kind: 'check', id: 'wantSkills', label: 'Learning real skills' },
      { kind: 'check', id: 'wantMentorship', label: 'Mentorship' },
      { kind: 'check', id: 'wantName', label: 'A well-known name on my résumé' },
      { kind: 'check', id: 'wantReturnOffer', label: 'A return offer' },
      { kind: 'check', id: 'wantPay', label: 'Good pay' },
      { kind: 'check', id: 'wantNetwork', label: 'Meeting people in the field' },
    ],
  },
  {
    title: 'About me',
    hint: 'Anything a résumé does not show that helps judge fit.',
    items: [{ kind: 'text', id: 'buildingNow', label: "Clubs, projects and skills I'm building now", long: true }],
  },
];

export const restrictionSections: Section[] = [
  {
    title: 'Where',
    checksLabel: 'Ways of working I accept',
    items: [
      { kind: 'check', id: 'inPerson', label: 'In person' },
      { kind: 'check', id: 'hybrid', label: 'Hybrid' },
      { kind: 'check', id: 'remote', label: 'Remote' },
      { kind: 'check', id: 'relocate', label: 'I would relocate for the right one' },
      { kind: 'list', id: 'cities', label: 'Cities or regions I can be in', placeholder: 'A city or region', addLabel: 'Add another place', hint: 'Used for in-person and hybrid. Leave blank to use the location on your account.' },
    ],
  },
  {
    title: 'When',
    checksLabel: 'Seasons I am available',
    items: [
      { kind: 'check', id: 'seasonSummer', label: 'Summer' },
      { kind: 'check', id: 'seasonFall', label: 'Fall' },
      { kind: 'check', id: 'seasonWinter', label: 'Winter' },
      { kind: 'check', id: 'seasonSpring', label: 'Spring' },
      { kind: 'date', id: 'earliestStart', label: 'Earliest I can start' },
      { kind: 'date', id: 'latestEnd', label: 'Latest I can finish' },
      { kind: 'number', id: 'maxHours', label: 'Most hours a week during school', suffix: 'hours' },
    ],
  },
  {
    title: 'Pay',
    checksLabel: 'Pay rules',
    items: [
      { kind: 'check', id: 'paidOnly', label: 'Paid only' },
      { kind: 'check', id: 'unpaidResearchOk', label: 'Unpaid is fine for research or nonprofits' },
      { kind: 'number', id: 'minPay', label: 'Lowest pay I would take', prefix: '$', suffix: 'an hour' },
    ],
  },
  {
    title: 'Who can apply',
    checksLabel: 'Eligibility',
    items: [
      { kind: 'select', id: 'classYear', label: 'My year in school', options: ['Freshman', 'Sophomore', 'Junior', 'Senior', 'Graduate student'] },
      { kind: 'number', id: 'graduationYear', label: 'Graduation year', placeholder: '2030' },
      { kind: 'select', id: 'workAuthorization', label: 'Work authorization', options: ['US citizen or permanent resident', 'International student (CPT or OPT)', 'Will need sponsorship', 'Authorized outside the US'] },
      { kind: 'check', id: 'onlyMyYear', label: 'Only show what is open to my year' },
      { kind: 'check', id: 'earlyPrograms', label: 'Include programs made for first- and second-years' },
    ],
  },
  {
    title: 'Never show me',
    checksLabel: 'Skip anything that',
    items: [
      { kind: 'list', id: 'skipCompanies', label: 'Companies or organizations to skip', placeholder: 'A company or organization', addLabel: 'Add another company' },
      { kind: 'list', id: 'skipIndustries', label: 'Industries to skip', placeholder: 'An industry, such as tobacco', addLabel: 'Add another industry' },
      { kind: 'list', id: 'skipRoles', label: 'Kinds of role to skip', placeholder: 'A kind of role, such as sales', addLabel: 'Add another kind of role' },
      { kind: 'check', id: 'skipCoverLetter', label: 'Requires a cover letter' },
      { kind: 'check', id: 'skipSoonDeadline', label: 'Is due in less than 3 days' },
      { kind: 'check', id: 'skipNoDeadline', label: 'Does not state a deadline' },
    ],
  },
];

/** A note the student wrote: a file with a title and whatever they want in it. */
export interface Note {
  id: string;
  title: string;
  body: string;
  updatedAt: string;
}

/** One thing the student has done. Every part is optional. */
export interface ExperienceEntry {
  id: string;
  kind: string;
  role: string;
  organization: string;
  location: string;
  /** YYYY-MM, or empty. */
  start: string;
  end: string;
  /** Still doing it, so there is no end date. */
  current: boolean;
  summary: string;
  skills: string[];
  link: string;
}

export const experienceKinds = ['Internship', 'Job', 'Research', 'Project', 'Club or leadership', 'Volunteering', 'Competition or hackathon', 'Teaching or tutoring', 'Other'];

export interface Experience {
  linkedin: string;
  /** Other places the student's work lives: GitHub, a portfolio, a personal site. */
  links: string[];
  entries: ExperienceEntry[];
}

export const emptyExperience: Experience = { linkedin: '', links: [], entries: [] };

/** What the student has filled in. Blank answers and unticked boxes are simply absent. */
export interface Preferences {
  /** Fields ticked under Career interests, including ones the student added. */
  fields: string[];
  /** The one field that matters most. */
  topField: string | null;
  /** Fields the student typed in themselves. */
  customFields: string[];
  /** Kinds of opportunity to search for, by id. Empty means all of them. */
  kinds: string[];
  /** Typed answers, by item id. */
  answers: Record<string, string>;
  /** Answers that can have several entries, by item id: the non-empty entries in order. */
  lists: Record<string, string[]>;
  /** Ticked boxes, by item id. */
  checks: Record<string, boolean>;
  /** Custom notes. The agents read these first and they override everything else. */
  notes: Note[];
  /** The Experience tab: links and things the student has done. The résumé file itself is kept by the backend. */
  experience: Experience;
}

export const emptyPreferences: Preferences = { fields: [], topField: null, customFields: [], kinds: [], answers: {}, lists: {}, checks: {}, notes: [], experience: emptyExperience };

/** Older saved answers may lack newer parts. */
export const withDefaults = (p: Partial<Preferences> | undefined): Preferences => ({ ...emptyPreferences, ...p, lists: p?.lists ?? {}, experience: { ...emptyExperience, ...p?.experience } });
