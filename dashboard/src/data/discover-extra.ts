// Descriptive extras for the career discovery page. Everything here is a generic description of
// what each kind of work usually involves, written for the demo. There are no salaries, no
// company names, no statistics and no quotes from real people: when a student asks for those,
// the page says it does not know. Counts about real-looking histories come from `pathProfiles`
// in sample.ts, never from this file.
import { fieldExtras } from './fields.ts';

/** How much of an ordinary week an activity takes, in words rather than invented percentages. */
export type WeekShare = 'most' | 'some' | 'little';

export interface WeekItem {
  activity: string;
  share: WeekShare;
}

export interface ExpectedSkill {
  label: string;
  /** Core skills are what most intern postings for this path ask for; useful ones help but are rarer. */
  importance: 'core' | 'useful';
  /** The matching skill name on the profile, when the profile has a field for it. */
  profileSkill: string | null;
  /** A roadmap step that, once done, counts as having this skill. */
  stepId: string | null;
}

export interface PathExtra {
  pathId: string;
  /** What the job is, in two or three plain sentences. */
  work: string;
  week: WeekItem[];
  pace: string;
  /** Short pace word for the compare table. */
  paceShort: string;
  skills: ExpectedSkill[];
  /** Profile interests (from `interestOptions`) that point at this path. */
  interests: string[];
  /** Opportunity tags that suggest a feed card leads toward this path. */
  feedTags: string[];
  /** Neighbouring paths that share most of the same groundwork. */
  neighbours: string[];
  /** Accent hue for the path's mark, so the paths are easy to tell apart at a glance. */
  hue: string;
}

export const pathExtras: PathExtra[] = [
  {
    pathId: 'path-swe',
    work: 'You write, test and review the code behind a product or an internal system. Most of the job is turning a vague need into something that works, then keeping it working as it grows.',
    week: [
      { activity: 'Writing and testing code', share: 'most' },
      { activity: 'Reviewing teammates’ pull requests', share: 'some' },
      { activity: 'Planning and design discussions', share: 'some' },
      { activity: 'Fixing bugs and on-call questions', share: 'little' },
    ],
    pace: 'Small changes shipped often, with a release rhythm of days to a few weeks.',
    paceShort: 'Ship often',
    skills: [
      { label: 'Data structures and algorithms', importance: 'core', profileSkill: 'Data structures', stepId: 'step-ds' },
      { label: 'One language you build in quickly', importance: 'core', profileSkill: 'Python', stepId: null },
      { label: 'Git and code review', importance: 'core', profileSkill: 'Git', stepId: 'step-club' },
      { label: 'SQL and databases', importance: 'useful', profileSkill: 'SQL', stepId: 'step-sql' },
      { label: 'A shipped team project', importance: 'core', profileSkill: null, stepId: 'step-hack' },
      { label: 'Linux and the command line', importance: 'useful', profileSkill: 'Linux', stepId: null },
    ],
    interests: ['Backend systems', 'Cloud infrastructure', 'Web development', 'Security'],
    feedTags: ['Python', 'Backend', 'Open source', 'Team project'],
    neighbours: ['path-data', 'path-ml'],
    hue: '#245bd8',
  },
  {
    pathId: 'path-ml',
    work: 'You prepare data, train and evaluate models, and help turn the ones that work into features a product can depend on. A lot of it is careful measurement: knowing whether a change actually helped.',
    week: [
      { activity: 'Running and reading experiments', share: 'most' },
      { activity: 'Cleaning and preparing data', share: 'some' },
      { activity: 'Writing code to serve or test models', share: 'some' },
      { activity: 'Reading papers and sharing results', share: 'little' },
    ],
    pace: 'Slower loops: one result can take days of training and checking before it is trusted.',
    paceShort: 'Long experiments',
    skills: [
      { label: 'Linear algebra and probability', importance: 'core', profileSkill: null, stepId: 'step-ml-math' },
      { label: 'Python', importance: 'core', profileSkill: 'Python', stepId: null },
      { label: 'A deep learning library', importance: 'core', profileSkill: null, stepId: 'step-ml-lib' },
      { label: 'A model you trained and evaluated', importance: 'core', profileSkill: null, stepId: 'step-ml-model' },
      { label: 'Research or lab experience', importance: 'useful', profileSkill: null, stepId: 'step-ml-research' },
      { label: 'Data structures', importance: 'useful', profileSkill: 'Data structures', stepId: null },
    ],
    interests: ['AI and machine learning', 'Research', 'Data', 'Robotics'],
    feedTags: ['Machine learning', 'Research'],
    neighbours: ['path-data', 'path-swe'],
    hue: '#7c4dff',
  },
  {
    pathId: 'path-data',
    work: 'You build the pipelines that collect, clean and move data so analysts and models can trust it. The work is quiet when it goes well: the numbers arrive on time and mean what people think they mean.',
    week: [
      { activity: 'Building and fixing pipelines', share: 'most' },
      { activity: 'Writing SQL and checking data quality', share: 'some' },
      { activity: 'Talking with the people who use the data', share: 'some' },
      { activity: 'Cloud and scheduling setup', share: 'little' },
    ],
    pace: 'Steady and reliability-minded: fewer launches, more care that nothing breaks silently.',
    paceShort: 'Steady',
    skills: [
      { label: 'Strong SQL', importance: 'core', profileSkill: 'SQL', stepId: 'step-data-sql' },
      { label: 'Python for scripting', importance: 'core', profileSkill: 'Python', stepId: null },
      { label: 'Pipelines and scheduling', importance: 'core', profileSkill: null, stepId: 'step-data-pipeline' },
      { label: 'One cloud platform', importance: 'useful', profileSkill: null, stepId: 'step-data-cloud' },
      { label: 'Work in a shared codebase', importance: 'useful', profileSkill: 'Git', stepId: 'step-data-club' },
    ],
    interests: ['Data', 'Backend systems', 'Cloud infrastructure'],
    feedTags: ['SQL', 'Pipelines'],
    neighbours: ['path-swe', 'path-ml'],
    hue: '#0f9d8a',
  },
  {
    pathId: 'path-pm',
    work: 'You decide what a team builds next and why, by talking with users, weighing trade-offs and writing it down clearly. You do not write the code, but you need to understand it well enough to be trusted.',
    week: [
      { activity: 'Meetings with engineers and designers', share: 'most' },
      { activity: 'Writing briefs and plans', share: 'some' },
      { activity: 'Talking with users and reading feedback', share: 'some' },
      { activity: 'Looking at how features are used', share: 'little' },
    ],
    pace: 'Fast and people-heavy, with priorities that move as the team learns.',
    paceShort: 'Fast, many people',
    skills: [
      { label: 'Clear writing', importance: 'core', profileSkill: null, stepId: 'step-pm-writing' },
      { label: 'Leading a team to a result', importance: 'core', profileSkill: null, stepId: 'step-pm-lead' },
      { label: 'Enough technical depth to earn trust', importance: 'core', profileSkill: 'Data structures', stepId: null },
      { label: 'Time spent with real users', importance: 'useful', profileSkill: null, stepId: 'step-pm-users' },
    ],
    interests: ['Product'],
    feedTags: ['Networking', 'Team project'],
    neighbours: ['path-swe'],
    hue: '#e07a1f',
  },
  ...fieldExtras,
];

export interface QuizOption {
  id: string;
  label: string;
  /** How the option reads inside an explanation: "you said you {because}". */
  because: string;
  /** How well this answer fits each path, 0 (not at all) to 1 (exactly). Missing paths count as 0. */
  fit: Record<string, number>;
}

export interface QuizQuestion {
  id: string;
  prompt: string;
  options: QuizOption[];
}


// Written so a student in any major can answer honestly: no question assumes coding. Each option
// points at a few paths strongly and a few more partly, and the paths share options in different
// combinations from question to question, so a pattern of answers can lead to any of them.
export const quizQuestions: QuizQuestion[] = [
  {
    id: 'enjoy',
    prompt: 'What part of a project do you enjoy most?',
    options: [
      { id: 'build', label: 'Making the thing itself and getting it to work', because: 'enjoy making things and getting them to work', fit: { 'path-swe': 1, 'path-mecheng': 1, 'path-design': 0.6, 'path-data': 0.5, 'path-ml': 0.4, 'path-research': 0.3 } },
      { id: 'why', label: 'Finding out why something happens', because: 'enjoy finding out why things happen', fit: { 'path-research': 1, 'path-ml': 0.6, 'path-health': 0.6, 'path-data': 0.6, 'path-policy': 0.4, 'path-finance': 0.3, 'path-media': 0.3 } },
      { id: 'help', label: 'Helping the people it is for', because: 'enjoy helping the people a project is for', fit: { 'path-education': 1, 'path-health': 1, 'path-design': 0.8, 'path-policy': 0.6, 'path-pm': 0.6, 'path-marketing': 0.3 } },
      { id: 'share', label: 'Telling people about it and winning them over', because: 'enjoy telling people about an idea and winning them over', fit: { 'path-marketing': 1, 'path-media': 1, 'path-consulting': 0.8, 'path-policy': 0.8, 'path-pm': 0.7, 'path-finance': 0.5 } },
    ],
  },
  {
    id: 'style',
    prompt: 'How do you like to work?',
    options: [
      { id: 'deep', label: 'Heads-down on one hard problem', because: 'like going heads-down on one hard problem', fit: { 'path-research': 1, 'path-ml': 0.9, 'path-finance': 0.8, 'path-data': 0.8, 'path-mecheng': 0.6, 'path-swe': 0.5 } },
      { id: 'team', label: 'Making something with a small team', because: 'like making something with a small team', fit: { 'path-mecheng': 1, 'path-design': 1, 'path-swe': 0.8, 'path-pm': 0.7, 'path-data': 0.5, 'path-media': 0.5 } },
      { id: 'people', label: 'Face to face with lots of different people', because: 'like working face to face with lots of people', fit: { 'path-education': 1, 'path-health': 1, 'path-consulting': 0.8, 'path-marketing': 0.8, 'path-pm': 0.8, 'path-policy': 0.5 } },
      { id: 'argue', label: 'Reading, writing and making an argument', because: 'like reading, writing and making an argument', fit: { 'path-policy': 1, 'path-media': 1, 'path-research': 0.5, 'path-consulting': 0.5, 'path-pm': 0.4, 'path-marketing': 0.4, 'path-education': 0.4 } },
    ],
  },
  {
    id: 'wrong',
    prompt: 'A plan you worked on is going wrong. What do you do first?',
    options: [
      { id: 'trace', label: 'Trace it step by step until I find the cause', because: 'trace a problem step by step until you find the cause', fit: { 'path-swe': 1, 'path-data': 1, 'path-health': 0.8, 'path-mecheng': 0.7, 'path-ml': 0.5 } },
      { id: 'test', label: 'Try a few versions side by side and compare', because: 'try a few versions side by side and compare', fit: { 'path-research': 1, 'path-marketing': 1, 'path-mecheng': 1, 'path-design': 0.8, 'path-ml': 0.7, 'path-data': 0.4, 'path-swe': 0.3 } },
      { id: 'ask', label: 'Ask the people it affects what they need', because: 'start by asking the people a problem affects', fit: { 'path-pm': 1, 'path-design': 1, 'path-education': 1, 'path-health': 0.9, 'path-policy': 0.8, 'path-media': 0.6 } },
      { id: 'cost', label: 'Check the numbers and what each fix would cost', because: 'check the numbers and the cost of each fix', fit: { 'path-finance': 1, 'path-consulting': 1, 'path-data': 0.6, 'path-policy': 0.5, 'path-ml': 0.3 } },
    ],
  },
  {
    id: 'think',
    prompt: 'Which kind of thinking feels most natural?',
    options: [
      { id: 'numbers', label: 'Numbers, chances and statistics', because: 'think naturally in numbers and statistics', fit: { 'path-finance': 1, 'path-data': 1, 'path-research': 1, 'path-ml': 0.9, 'path-consulting': 0.7, 'path-marketing': 0.3 } },
      { id: 'logic', label: 'Logic and cause and effect, step by step', because: 'think in logic and cause and effect', fit: { 'path-swe': 1, 'path-mecheng': 0.8, 'path-data': 0.7, 'path-health': 0.7, 'path-ml': 0.5, 'path-policy': 0.4, 'path-pm': 0.3 } },
      { id: 'words', label: 'Words, stories and arguments', because: 'reason best in words, stories and arguments', fit: { 'path-media': 1, 'path-policy': 1, 'path-education': 0.8, 'path-marketing': 0.8, 'path-pm': 0.6, 'path-consulting': 0.5 } },
      { id: 'visual', label: 'Pictures, shapes and how things fit together', because: 'think in pictures and how things fit together', fit: { 'path-design': 1, 'path-mecheng': 1, 'path-marketing': 0.5, 'path-health': 0.3, 'path-swe': 0.2 } },
    ],
  },
  {
    id: 'proud',
    prompt: 'Which result would make you proudest?',
    options: [
      { id: 'used', label: 'Something people use every day without thinking about it', because: 'would be proudest of something people use every day', fit: { 'path-swe': 1, 'path-design': 1, 'path-mecheng': 1, 'path-pm': 0.8, 'path-data': 0.7 } },
      { id: 'finding', label: 'A finding that holds up when others check it', because: 'would be proudest of a finding that holds up', fit: { 'path-research': 1, 'path-ml': 0.6, 'path-health': 0.6, 'path-data': 0.5, 'path-media': 0.4, 'path-policy': 0.3 } },
      { id: 'helped', label: 'A person or a community clearly better off', because: 'would be proudest of people clearly better off', fit: { 'path-health': 1, 'path-education': 1, 'path-policy': 1, 'path-media': 0.4, 'path-pm': 0.3 } },
      { id: 'minds', label: 'A story, campaign or deal that changed people’s minds', because: 'would be proudest of work that changed people’s minds', fit: { 'path-media': 1, 'path-marketing': 1, 'path-consulting': 1, 'path-finance': 0.8, 'path-policy': 0.6, 'path-pm': 0.5 } },
    ],
  },
  {
    id: 'pace',
    prompt: 'What pace suits you?',
    options: [
      { id: 'weekly', label: 'Something new out every week', because: 'like putting something new out every week', fit: { 'path-swe': 1, 'path-marketing': 1, 'path-media': 1, 'path-pm': 0.8, 'path-design': 0.6 } },
      { id: 'long', label: 'Long projects, one solid result at a time', because: 'prefer long projects with one solid result at a time', fit: { 'path-research': 1, 'path-mecheng': 1, 'path-design': 0.7, 'path-ml': 0.6, 'path-policy': 0.6, 'path-data': 0.3 } },
      { id: 'steady', label: 'Steady and reliable, with a routine', because: 'prefer a steady, reliable routine', fit: { 'path-data': 1, 'path-education': 1, 'path-health': 0.7, 'path-policy': 0.5, 'path-swe': 0.3, 'path-finance': 0.3 } },
      { id: 'fast', label: 'Fast and high-stakes, with priorities that shift', because: 'like a fast, high-stakes pace', fit: { 'path-finance': 1, 'path-consulting': 1, 'path-pm': 1, 'path-health': 0.9, 'path-media': 0.7, 'path-marketing': 0.5 } },
    ],
  },
  {
    id: 'place',
    prompt: 'Where would you most like to spend a working day?',
    options: [
      { id: 'desk', label: 'At a desk or screen, deep in my own work', because: 'want to spend the day deep in your own work at a desk', fit: { 'path-swe': 1, 'path-data': 1, 'path-ml': 1, 'path-design': 0.8, 'path-finance': 0.5, 'path-media': 0.5 } },
      { id: 'lab', label: 'In a lab, a studio or a workshop', because: 'want to spend the day in a lab, a studio or a workshop', fit: { 'path-research': 1, 'path-mecheng': 1, 'path-design': 1, 'path-media': 0.6, 'path-health': 0.5 } },
      { id: 'community', label: 'In a clinic, a classroom or a community', because: 'want to spend the day in a clinic, a classroom or a community', fit: { 'path-health': 1, 'path-education': 1, 'path-policy': 0.8, 'path-media': 0.3 } },
      { id: 'meetings', label: 'In meetings with clients, teams or decision-makers', because: 'want to spend the day with clients and decision-makers', fit: { 'path-consulting': 1, 'path-finance': 1, 'path-pm': 1, 'path-policy': 0.8, 'path-marketing': 0.8 } },
    ],
  },
];
