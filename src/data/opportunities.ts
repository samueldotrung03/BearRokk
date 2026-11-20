export type CategoryId = 'internship' | 'event' | 'club' | 'competition' | 'research' | 'scholarship';
export type Format = 'online' | 'in_person' | 'hybrid';
export type ArtId = 'codepath' | 'berkeley' | 'mlh' | 'suli' | 'club' | 'competition' | 'scholarship' | 'event' | 'internship' | 'research';

export interface Opportunity {
  id: string;
  title: string;
  category: CategoryId;
  organizer: string;
  organizerUrl: string | null;
  location: string;
  format: Format;
  fitExplanation: string;
  why: string[];
  tags: string[];
  matchScore: number;
  lastCheckedAt: string;
  /** Application or registration deadline. Null means the date is unknown, not that there is no deadline. */
  deadline: string | null;
  deadlineKind: 'application' | 'registration' | null;
  /** When an event starts, a club meets, or a program begins. Null when that date is unknown. */
  start: string | null;
  startKind: 'event' | 'meeting' | 'program' | null;
  term: string | null;
  eligibility: string;
  organizerNotes: string;
  art: ArtId;
}

const HOUR = 3_600_000;
const DAY = 24 * HOUR;
const hoursAgo = (hours: number) => new Date(Date.now() - hours * HOUR).toISOString();
const daysFromNow = (days: number) => new Date(Date.now() + days * DAY).toISOString();

/**
 * Prepared examples for the demo request: “I want to join a beginner-friendly coding club and
 * attend an online hackathon next month.” Named programs use their public organizer sites.
 * Dates that were not confirmed stay explicitly unknown.
 */
export const opportunities: Opportunity[] = [
  {
    id: 'codepath-spring-2027',
    title: 'CodePath Spring 2027 Free Courses',
    category: 'club',
    organizer: 'CodePath',
    organizerUrl: 'https://www.codepath.org/courses',
    location: 'Online',
    format: 'online',
    fitExplanation:
      'You asked for a beginner-friendly coding club. CodePath’s Spring 2027 courses are free, online, and taught for students who are new to software.',
    why: [
      'Your request asked for a beginner-friendly coding community, and CodePath runs free courses for students starting out.',
      'The Spring 2027 courses are online, so you can join without hunting through separate campus pages.',
      'The enrollment deadline is unknown in this prepared example. The organizer page is the place to confirm it.',
    ],
    tags: ['beginner', 'coding', 'free', 'online', 'club'],
    matchScore: 0.98,
    lastCheckedAt: hoursAgo(2),
    deadline: null,
    deadlineKind: 'application',
    start: null,
    startKind: 'program',
    term: 'Spring 2027',
    eligibility: 'College students. Exact class-year and major rules are unknown in this prepared example.',
    organizerNotes: 'CodePath publishes the course list. This card is a prepared example, not a live check of seats.',
    art: 'codepath',
  },
  {
    id: 'berkeley-data-discovery',
    title: 'Berkeley Data Discovery',
    category: 'research',
    organizer: 'UC Berkeley Data Science Discovery',
    organizerUrl: 'https://data.berkeley.edu/education/data-science-discovery',
    location: 'Berkeley, CA',
    format: 'in_person',
    fitExplanation:
      'You wanted to learn coding by doing, not only by reading listings. Berkeley Data Discovery pairs students with a data project and a research mentor.',
    why: [
      'You asked to join a coding community and build experience. A mentored data project is a concrete way to do that.',
      'The program is at UC Berkeley, so the location is a campus research group rather than an online club.',
      'The application deadline and who outside Berkeley may apply are unknown in this prepared example.',
    ],
    tags: ['data', 'research', 'mentor', 'campus'],
    matchScore: 0.93,
    lastCheckedAt: hoursAgo(3),
    deadline: null,
    deadlineKind: 'application',
    start: null,
    startKind: 'program',
    term: 'Spring 2027',
    eligibility: 'Eligibility beyond “student researcher” is unknown. Confirm campus and class-year rules on the organizer page.',
    organizerNotes: 'Organizer: UC Berkeley Data Science Discovery. Prepared example.',
    art: 'berkeley',
  },
  {
    id: 'mlh-global-hack-week',
    title: 'MLH Global Hack Week',
    category: 'event',
    organizer: 'Major League Hacking',
    organizerUrl: 'https://ghw.mlh.io/',
    location: 'Online',
    format: 'online',
    fitExplanation:
      'You asked for an online hackathon next month. Global Hack Week is a week of online workshops and a hackathon, and the next prepared session is in the coming month.',
    why: [
      'Your request named an online hackathon next month, and this event is online.',
      'The event start is a separate date from registration. Registration deadline is unknown here.',
      'Major League Hacking is the organizer, so the action link goes to their Global Hack Week page.',
    ],
    tags: ['hackathon', 'online', 'beginner', 'event'],
    matchScore: 0.9,
    lastCheckedAt: hoursAgo(5),
    deadline: null,
    deadlineKind: 'registration',
    start: daysFromNow(20),
    startKind: 'event',
    term: null,
    eligibility: 'Students. Age, school, and team rules are unknown in this prepared example.',
    organizerNotes: 'Major League Hacking hosts Global Hack Week. The start date is a prepared stand-in for “next month,” not a scraped listing.',
    art: 'mlh',
  },
  {
    id: 'doe-suli',
    title: 'DOE SULI',
    category: 'internship',
    organizer: 'U.S. Department of Energy',
    organizerUrl: 'https://science.osti.gov/wdts/suli',
    location: 'National laboratories',
    format: 'in_person',
    fitExplanation:
      'You wanted a next step after a beginner coding community. SULI is a paid summer research internship at Department of Energy national laboratories.',
    why: [
      'A summer laboratory internship is a later step than a beginner club, so it ranks after CodePath and the hackathon.',
      'The program term is Summer 2027. That is not the application deadline.',
      'The application deadline and citizenship rules are unknown in this prepared example and stay labeled that way.',
    ],
    tags: ['internship', 'research', 'summer', 'energy'],
    matchScore: 0.86,
    lastCheckedAt: hoursAgo(8),
    deadline: null,
    deadlineKind: 'application',
    start: null,
    startKind: 'program',
    term: 'Summer 2027',
    eligibility: 'Undergraduates. Citizenship, enrollment, and GPA rules are unknown here. Read them on the program page before applying.',
    organizerNotes: 'Science Undergraduate Laboratory Internships, U.S. Department of Energy. Prepared example.',
    art: 'suli',
  },
  {
    id: 'open-source-systems-club',
    title: 'Open Source Systems Club',
    category: 'club',
    organizer: 'Student Computing Association',
    organizerUrl: 'https://example.org/open-source-systems-club',
    location: 'Campus student center',
    format: 'in_person',
    fitExplanation:
      'You asked for a coding club. This campus club writes code together on Wednesdays, but it is in person rather than the online community you described.',
    why: [
      'It matches the coding-club part of your request.',
      'Meetings are on campus, which is a weaker fit than CodePath’s online courses.',
    ],
    tags: ['club', 'coding', 'open source', 'campus'],
    matchScore: 0.78,
    lastCheckedAt: hoursAgo(6),
    deadline: null,
    deadlineKind: null,
    start: daysFromNow(6),
    startKind: 'meeting',
    term: 'Weekly on Wednesdays',
    eligibility: 'Any student may visit a meeting. Membership intake is unknown.',
    organizerNotes: 'Prepared campus example. The organizer link is a placeholder.',
    art: 'club',
  },
  {
    id: 'bay-case-competition',
    title: 'Bay Case Competition',
    category: 'competition',
    organizer: 'Bay Builders Collective',
    organizerUrl: 'https://example.org/bay-case-competition',
    location: 'San Francisco, CA',
    format: 'hybrid',
    fitExplanation:
      'You asked for something to attend next month. This case competition has a weekend final and a registration deadline a week earlier.',
    why: [
      'The final is next month, which matches your timing.',
      'It is a competition, not the beginner coding club or the online hackathon.',
    ],
    tags: ['competition', 'case', 'hybrid'],
    matchScore: 0.74,
    lastCheckedAt: hoursAgo(9),
    deadline: daysFromNow(14),
    deadlineKind: 'registration',
    start: daysFromNow(21),
    startKind: 'event',
    term: null,
    eligibility: 'Undergraduate teams. Team size is unknown.',
    organizerNotes: 'Prepared example. Registration deadline and event start are both filled in so they can be compared.',
    art: 'competition',
  },
  {
    id: 'transfer-scholars-award',
    title: 'Transfer Scholars in Computing Award',
    category: 'scholarship',
    organizer: 'Meridian Foundation',
    organizerUrl: 'https://example.org/transfer-scholars',
    location: 'Online',
    format: 'online',
    fitExplanation:
      'You did not ask for funding. This award is here because the same search also watches scholarships for computing students.',
    why: ['It is a scholarship, outside the club and hackathon you asked for.', 'The application deadline is known on this prepared card. Eligibility for transfer students is stated; other rules are unknown.'],
    tags: ['scholarship', 'computing', 'transfer'],
    matchScore: 0.7,
    lastCheckedAt: hoursAgo(12),
    deadline: daysFromNow(40),
    deadlineKind: 'application',
    start: null,
    startKind: null,
    term: 'Award for the 2027–28 year',
    eligibility: 'Transfer students in computing. GPA and essay rules are unknown.',
    organizerNotes: 'Prepared example with a placeholder organizer link.',
    art: 'scholarship',
  },
  {
    id: 'engineers-meet-students',
    title: 'Engineers Meet Students Night',
    category: 'event',
    organizer: 'Campus Career Center',
    organizerUrl: 'https://example.org/engineers-night',
    location: 'Campus alumni hall',
    format: 'in_person',
    fitExplanation:
      'You asked about an event next month. This is an in-person employer night, not the online hackathon.',
    why: ['The date is an event start.', 'Registration deadline is unknown, and the event is on campus rather than online.'],
    tags: ['event', 'career', 'campus'],
    matchScore: 0.66,
    lastCheckedAt: hoursAgo(4),
    deadline: null,
    deadlineKind: 'registration',
    start: daysFromNow(18),
    startKind: 'event',
    term: null,
    eligibility: 'Open to students. Whether employers require a résumé is unknown.',
    organizerNotes: 'Prepared campus example.',
    art: 'event',
  },
  {
    id: 'harbor-data-intern',
    title: 'Data Engineering Intern',
    category: 'internship',
    organizer: 'Harbor Analytics',
    organizerUrl: 'https://example.org/harbor-analytics',
    location: 'Oakland, CA',
    format: 'hybrid',
    fitExplanation:
      'You are building toward technical work. Harbor’s internship asks for a data project, which is further along than a beginner club.',
    why: ['The application deadline is listed, separate from the summer start.', 'Hybrid in Oakland is a weaker match than an online beginner community.'],
    tags: ['internship', 'data', 'hybrid'],
    matchScore: 0.62,
    lastCheckedAt: hoursAgo(7),
    deadline: daysFromNow(12),
    deadlineKind: 'application',
    start: null,
    startKind: 'program',
    term: 'Summer 2027',
    eligibility: 'Students who can work in the U.S. for the summer. Class year is unknown.',
    organizerNotes: 'Prepared example. Harbor Analytics is not a real employer in this demo.',
    art: 'internship',
  },
  {
    id: 'efficient-ml-research',
    title: 'Undergraduate Research Assistant, Efficient ML',
    category: 'research',
    organizer: 'Distributed Learning Lab',
    organizerUrl: 'https://example.org/efficient-ml',
    location: 'Campus lab',
    format: 'in_person',
    fitExplanation:
      'You wanted hands-on coding. This lab seat expects prior machine-learning coursework, so it is a later step than CodePath.',
    why: ['It is research on campus, not the beginner club or the online hackathon.', 'The application deadline is unknown.'],
    tags: ['research', 'machine learning', 'campus'],
    matchScore: 0.58,
    lastCheckedAt: hoursAgo(11),
    deadline: null,
    deadlineKind: 'application',
    start: null,
    startKind: 'program',
    term: 'Spring 2027',
    eligibility: 'Undergraduates. Required courses are unknown.',
    organizerNotes: 'Prepared example with a placeholder lab page.',
    art: 'research',
  },
];

export const studentRequest = 'I want to join a beginner-friendly coding club and attend an online hackathon next month.';
