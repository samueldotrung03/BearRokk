// Invented sample data so the dashboard can be designed before the agents are wired in.
// Every organization here is made up and every link points to example.org. Dates are set
// relative to today so the template never looks stale.
import type { AppState } from '../state/store.ts';
import type { AgentEvent, AgentNode, CareerPath, Opportunity, Roadmap } from '../types.ts';

const HOUR = 3_600_000;
const DAY = 24 * HOUR;
const now = Date.now();
const inDays = (days: number) => new Date(now + days * DAY).toISOString();
const hoursAgo = (hours: number) => new Date(now - hours * HOUR).toISOString();
const minutesAgo = (minutes: number) => new Date(now - minutes * 60_000).toISOString();
const link = (slug: string) => `https://example.org/${slug}`;
// Placeholder photos hotlinked from Unsplash. If one fails to load, the card shows an icon panel.
const photo = (id: string) => `https://images.unsplash.com/photo-${id}?w=640&q=70&auto=format&fit=crop`;

export const opportunities: Opportunity[] = [
  {
    id: 'opp-northwind-swe',
    type: 'internship',
    origin: 'prepared',
    title: 'Software Engineering Intern, Summer 2027',
    organizer: 'Northwind Robotics',
    sourceUrl: link('northwind/careers/swe-intern'),
    actionUrl: link('northwind/careers/swe-intern/apply'),
    format: 'hybrid',
    location: 'San Francisco, CA',
    fitExplanation:
      'Open to sophomores, asks for Python and one data structures course, and you have both. It lines up with the backend interest in your profile.',
    deadline: inDays(9),
    startTime: null,
    image: photo('1485827404703-89b55fcc595e'),
    imageAspect: 0.8,
    tags: ['Python', 'Backend', 'Sophomores welcome'],
    unknowns: [],
    foundAt: hoursAgo(3),
    lastCheckedAt: minutesAgo(12),
    baseScore: 0.92,
  },
  {
    id: 'opp-bay-hack',
    type: 'hackathon',
    origin: 'prepared',
    title: 'Bay Builders Winter Hackathon',
    organizer: 'Bay Builders Collective',
    sourceUrl: link('bay-builders/winter-hack'),
    actionUrl: link('bay-builders/winter-hack/register'),
    format: 'in_person',
    location: 'Berkeley, CA',
    fitExplanation:
      'Your roadmap asks for one shipped team project this term. This is a 36-hour build with a beginner track, ten minutes from campus.',
    deadline: inDays(5),
    startTime: inDays(17),
    image: photo('1504384308090-c894fdcc538d'),
    imageAspect: 0.72,
    tags: ['Team project', 'Beginner track', 'Free'],
    unknowns: [],
    foundAt: hoursAgo(6),
    lastCheckedAt: minutesAgo(12),
    baseScore: 0.88,
  },
  {
    id: 'opp-lumen-info',
    type: 'event',
    origin: 'prepared',
    title: 'Engineering Info Session and Resume Review',
    organizer: 'Lumen Labs',
    sourceUrl: link('lumen-labs/events/campus-info-session'),
    actionUrl: link('lumen-labs/events/campus-info-session/rsvp'),
    format: 'in_person',
    location: 'Soda Hall, room 306',
    fitExplanation:
      'Lumen hires interns from this session every year, and their engineers review resumes on the spot. Yours has not been reviewed yet.',
    deadline: null,
    startTime: inDays(3),
    image: photo('1540575467063-178a50c2df87'),
    imageAspect: 1.0,
    tags: ['Networking', 'Resume review'],
    unknowns: [{ field: 'registrationDeadline', label: 'RSVP deadline not stated' }],
    foundAt: hoursAgo(20),
    lastCheckedAt: hoursAgo(1),
    baseScore: 0.84,
  },
  {
    id: 'opp-systems-club',
    type: 'club',
    origin: 'prepared',
    title: 'Open Source Systems Club',
    organizer: 'Student Computing Association',
    sourceUrl: link('sca/open-source-systems'),
    actionUrl: link('sca/open-source-systems/join'),
    format: 'in_person',
    location: 'Meets Wednesdays, 6:00 PM',
    fitExplanation:
      'Members pair up to land a first pull request in a real project. That counts toward the "contribute to shared code" step in your roadmap.',
    deadline: null,
    startTime: inDays(7),
    image: photo('1523240795612-9a054b0db644'),
    imageAspect: 0.85,
    tags: ['Open source', 'No application'],
    unknowns: [],
    foundAt: hoursAgo(26),
    lastCheckedAt: hoursAgo(2),
    baseScore: 0.8,
  },
  {
    id: 'opp-ml-research',
    type: 'research',
    origin: 'prepared',
    title: 'Undergraduate Research Assistant, Efficient ML Systems',
    organizer: 'Distributed Learning Lab',
    sourceUrl: link('dll/openings/undergrad-ra'),
    actionUrl: link('dll/openings/undergrad-ra/apply'),
    format: 'in_person',
    location: 'On campus',
    fitExplanation:
      'You saved two machine learning posts last week. This lab takes sophomores for spring and lists Python as the only hard requirement.',
    deadline: inDays(21),
    startTime: null,
    image: photo('1532094349884-543bc11b234d'),
    imageAspect: 1.15,
    tags: ['Machine learning', 'Spring 2027', 'For credit'],
    unknowns: [{ field: 'hours', label: 'Weekly hours not stated' }],
    foundAt: hoursAgo(30),
    lastCheckedAt: hoursAgo(2),
    baseScore: 0.76,
  },
  {
    id: 'opp-first-gen-scholarship',
    type: 'scholarship',
    origin: 'prepared',
    title: 'First-Generation Technologists Scholarship',
    organizer: 'Meridian Foundation',
    sourceUrl: link('meridian/scholarships/first-gen-tech'),
    actionUrl: link('meridian/scholarships/first-gen-tech/apply'),
    format: 'online',
    location: null,
    fitExplanation:
      'For first-generation students in computing with at least a year left. It pays $5,000 and pairs each recipient with an industry mentor.',
    deadline: inDays(30),
    startTime: null,
    image: photo('1522071820081-009f0129c71c'),
    imageAspect: 0.75,
    tags: ['$5,000', 'Mentorship'],
    unknowns: [],
    foundAt: hoursAgo(44),
    lastCheckedAt: hoursAgo(5),
    baseScore: 0.72,
  },
  {
    id: 'opp-harbor-data',
    type: 'internship',
    origin: 'prepared',
    title: 'Data Engineering Intern',
    organizer: 'Harbor Analytics',
    sourceUrl: link('harbor/jobs/data-eng-intern'),
    actionUrl: link('harbor/jobs/data-eng-intern/apply'),
    format: 'online',
    location: 'Remote, US',
    fitExplanation:
      'Close to the backend roles you have opened, with SQL as the main gap. Your roadmap already has a SQL step, so this shows what it leads to.',
    deadline: inDays(16),
    startTime: null,
    image: photo('1558494949-ef010cbdcc31'),
    imageAspect: 1.2,
    tags: ['SQL', 'Pipelines', 'Remote'],
    unknowns: [],
    foundAt: hoursAgo(50),
    lastCheckedAt: hoursAgo(5),
    baseScore: 0.7,
  },
  {
    id: 'opp-career-fair',
    type: 'event',
    origin: 'prepared',
    title: 'Spring Engineering Career Fair',
    organizer: 'Campus Career Center',
    sourceUrl: link('career-center/spring-engineering-fair'),
    actionUrl: link('career-center/spring-engineering-fair/register'),
    format: 'in_person',
    location: 'Student Union, Pauley Ballroom',
    fitExplanation:
      'More than 80 employers attend, and 31 of them list sophomore internships. The agents will prepare a shortlist for you a week before.',
    deadline: inDays(40),
    startTime: inDays(48),
    image: photo('1515187029135-18ee286d815b'),
    imageAspect: 0.9,
    tags: ['Career fair', '80+ employers'],
    unknowns: [],
    foundAt: hoursAgo(70),
    lastCheckedAt: hoursAgo(8),
    baseScore: 0.66,
  },
];

export const roadmaps: Roadmap[] = [
  {
    goalId: 'path-swe',
    goal: 'Software engineering internship, summer 2027',
    summary:
      'You have the coursework most postings ask for. What is missing is proof you can build with other people, and applications sent before the January rush.',
    phases: [
      {
        id: 'phase-foundations',
        title: 'Close the gaps',
        window: 'Now through December',
        steps: [
          {
            id: 'step-ds',
            kind: 'learn',
            title: 'Finish the data structures course',
            detail: 'Trees, graphs and hashing are what interviews for intern roles draw on most.',
            opportunityId: null,
            due: null,
          },
          {
            id: 'step-sql',
            kind: 'learn',
            title: 'Learn SQL well enough to join and aggregate',
            detail: 'Six of the ten internships the agents matched to you list it. Two weekends is enough.',
            opportunityId: 'opp-harbor-data',
            due: inDays(14),
          },
          {
            id: 'step-club',
            kind: 'join',
            title: 'Join a club where you write code with others',
            detail: 'Reviewed pull requests are the fastest way to show you can work in shared code.',
            opportunityId: 'opp-systems-club',
            due: inDays(7),
          },
        ],
      },
      {
        id: 'phase-proof',
        title: 'Build proof',
        window: 'December and January',
        steps: [
          {
            id: 'step-hack',
            kind: 'build',
            title: 'Ship one team project at a hackathon',
            detail: 'A finished project with a demo link gives you something concrete to talk about in every interview.',
            opportunityId: 'opp-bay-hack',
            due: inDays(5),
          },
          {
            id: 'step-project',
            kind: 'build',
            title: 'Turn the project into a portfolio piece',
            detail: 'Write the README, record a one-minute demo, and deploy it somewhere a recruiter can click.',
            opportunityId: null,
            due: inDays(35),
          },
          {
            id: 'step-resume',
            kind: 'attend',
            title: 'Get your resume reviewed by an engineer',
            detail: 'One review from someone who screens interns is worth more than another draft on your own.',
            opportunityId: 'opp-lumen-info',
            due: inDays(3),
          },
        ],
      },
      {
        id: 'phase-apply',
        title: 'Apply and follow up',
        window: 'December through February',
        steps: [
          {
            id: 'step-apply-northwind',
            kind: 'apply',
            title: 'Apply to Northwind Robotics',
            detail: 'Your strongest match so far. The application closes soon and takes about forty minutes.',
            opportunityId: 'opp-northwind-swe',
            due: inDays(9),
          },
          {
            id: 'step-fair',
            kind: 'attend',
            title: 'Work the spring career fair with a shortlist',
            detail: 'Talk to eight employers the agents pick for you, and follow up with each within two days.',
            opportunityId: 'opp-career-fair',
            due: inDays(48),
          },
          {
            id: 'step-apply-ten',
            kind: 'apply',
            title: 'Send ten applications before February',
            detail: 'The feed keeps this list filled. Save a posting and it is added to the count here.',
            opportunityId: null,
            due: inDays(70),
          },
        ],
      },
    ],
  },
];

export const careerPaths: CareerPath[] = [
  {
    id: 'path-swe',
    title: 'Software engineering',
    oneLine: 'Build and run the systems behind products people use.',
    match: 'strong',
    whyItFits:
      'You list backend systems and Python, you have opened mostly engineering postings, and your coursework already covers the usual prerequisites.',
    expects: ['Data structures and algorithms', 'One language you can build in quickly', 'A project built with other people'],
    firstSteps: ['Finish data structures', 'Ship a team project', 'Apply before January'],
  },
  {
    id: 'path-ml',
    title: 'Machine learning engineering',
    oneLine: 'Train models and turn them into something a product can rely on.',
    match: 'good',
    whyItFits:
      'You saved two machine learning posts and listed AI as an interest. The math sequence you are in is the one this path builds on.',
    expects: ['Linear algebra and probability', 'Python with a deep learning library', 'A model you trained and evaluated yourself'],
    firstSteps: ['Take the intro ML course', 'Join a research lab', 'Reproduce one paper result'],
  },
  {
    id: 'path-data',
    title: 'Data engineering',
    oneLine: 'Move and shape data so analysts and models can trust it.',
    match: 'good',
    whyItFits:
      'It sits next to the backend roles you already like, and it has fewer applicants per opening at the intern level.',
    expects: ['Strong SQL', 'Pipelines and scheduling basics', 'Comfort with one cloud platform'],
    firstSteps: ['Learn SQL joins and window functions', 'Build a small pipeline', 'Earn a cloud fundamentals badge'],
  },
  {
    id: 'path-pm',
    title: 'Product management',
    oneLine: 'Decide what gets built, and why, with engineers and designers.',
    match: 'explore',
    whyItFits:
      'You have led a club project, which is the experience associate PM programs look for. Nothing else in your history points here yet.',
    expects: ['Clear writing', 'Evidence of leading a team to a result', 'Enough technical depth to earn trust'],
    firstSteps: ['Lead a hackathon team', 'Write one product teardown', 'Attend a PM info session'],
  },
];

export const agents: { master: AgentNode; managers: AgentNode[]; workers: AgentNode[] } = {
  master: {
    id: 'master',
    name: 'Master agent',
    role: 'Reads your profile and memory, decides what you need',
    status: 'running',
    detail: 'Noticed two saved machine learning posts. Asked for more research openings.',
  },
  managers: [
    {
      id: 'manager-search',
      name: 'Search manager',
      role: 'Plans the search and briefs the workers',
      status: 'running',
      detail: 'Four workers out. Next full sweep in 18 minutes.',
    },
    {
      id: 'manager-feed',
      name: 'Feed and roadmap manager',
      role: 'Turns results into cards and roadmap steps',
      status: 'done',
      detail: 'Ranked 8 cards and linked 6 of them to roadmap steps.',
    },
  ],
  workers: [
    { id: 'worker-internships', name: 'Internships', role: 'Company career pages', status: 'running', detail: '14 pages read, 2 kept' },
    { id: 'worker-events', name: 'Events', role: 'Info sessions and fairs', status: 'done', detail: '9 pages read, 2 kept' },
    { id: 'worker-clubs', name: 'Clubs and hackathons', role: 'Campus and community', status: 'done', detail: '11 pages read, 2 kept' },
    { id: 'worker-research', name: 'Research and scholarships', role: 'Labs and foundations', status: 'idle', detail: 'Queued for the next sweep' },
  ],
};

export const agentEvents: AgentEvent[] = [
  { id: 'ev-1', at: minutesAgo(2), agent: 'Internships worker', text: 'Reading the Northwind Robotics careers page again to confirm the deadline.' },
  { id: 'ev-2', at: minutesAgo(12), agent: 'Feed and roadmap manager', text: 'Ranked 8 cards. Moved the hackathon up because registration closes in 5 days.' },
  { id: 'ev-3', at: minutesAgo(14), agent: 'Events worker', text: 'Dropped a career panel that already happened.' },
  { id: 'ev-4', at: minutesAgo(19), agent: 'Clubs and hackathons worker', text: 'Merged two announcements of the Bay Builders hackathon into one card.' },
  { id: 'ev-5', at: minutesAgo(31), agent: 'Search manager', text: 'Briefed four workers: sophomore, Python, backend, within reach of Berkeley.' },
  { id: 'ev-6', at: minutesAgo(32), agent: 'Master agent', text: 'Read your memory: 2 saves in machine learning, 1 dismissal in finance.' },
];

/** What the agents used this week. Shown in the dock; invented like the rest of this file. */
export const agentUsage = {
  /** Pages the workers read on each of the last seven days, oldest first; the last is today. */
  pagesPerDay: [38, 52, 47, 61, 44, 70, 58],
  /** Share of today's Grok budget already spent, 0 to 1. */
  budgetUsed: 0.62,
  searchesToday: 14,
};

export const interestOptions = [
  'Backend systems',
  'AI and machine learning',
  'Cloud infrastructure',
  'Web development',
  'Data',
  'Robotics',
  'Security',
  'Product',
  'Finance',
  'Research',
];

export const skillOptions = ['Python', 'Java', 'C++', 'SQL', 'JavaScript', 'Git', 'Linux', 'React', 'Data structures'];

export const initialState: AppState = {
  saved: [],
  dismissed: [],
  opened: [],
  doneSteps: ['step-ds'],
  goalId: 'path-swe',
  profile: {
    name: 'Maya',
    fullName: 'Maya Tran',
    major: 'Computer Science',
    about: 'First-generation student. Likes building backend systems and wants a software engineering internship for summer 2027.',
    school: 'UC Berkeley',
    year: 'Sophomore',
    location: 'Berkeley, CA',
    interests: ['Backend systems', 'AI and machine learning'],
    skills: ['Python', 'Java', 'Git', 'Data structures'],
  },
};
