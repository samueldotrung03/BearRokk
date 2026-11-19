// Descriptive extras for the career discovery page. Everything here is a generic description of
// what each kind of work usually involves, written for the demo. There are no salaries, no
// company names, no statistics and no quotes from real people: when a student asks for those,
// the page says it does not know. Counts about real-looking histories come from `pathProfiles`
// in sample.ts, never from this file.

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
  /** Accent hue for the path's mark, so the four paths are easy to tell apart at a glance. */
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

export const quizQuestions: QuizQuestion[] = [
  {
    id: 'enjoy',
    prompt: 'What part of a project do you enjoy most?',
    options: [
      { id: 'build', label: 'Getting it to work end to end', because: 'enjoy getting things working end to end', fit: { 'path-swe': 1, 'path-data': 0.5, 'path-ml': 0.3, 'path-pm': 0.2 } },
      { id: 'patterns', label: 'Experimenting to see what works best', because: 'enjoy experimenting to see what works best', fit: { 'path-ml': 1, 'path-data': 0.5, 'path-swe': 0.3, 'path-pm': 0.2 } },
      { id: 'organize', label: 'Making messy information clean and reliable', because: 'like making messy information clean and reliable', fit: { 'path-data': 1, 'path-swe': 0.4, 'path-ml': 0.4, 'path-pm': 0.2 } },
      { id: 'decide', label: 'Deciding what to build and why', because: 'enjoy deciding what to build and why', fit: { 'path-pm': 1, 'path-swe': 0.3 } },
    ],
  },
  {
    id: 'style',
    prompt: 'How do you like to work?',
    options: [
      { id: 'deep', label: 'Heads-down on one hard problem', because: 'like going heads-down on one hard problem', fit: { 'path-swe': 0.8, 'path-ml': 0.8, 'path-data': 0.7, 'path-pm': 0 } },
      { id: 'team', label: 'Building alongside a small team', because: 'like building alongside a small team', fit: { 'path-swe': 1, 'path-data': 0.6, 'path-pm': 0.6, 'path-ml': 0.4 } },
      { id: 'people', label: 'Talking with lots of people and bringing them together', because: 'like bringing people together', fit: { 'path-pm': 1, 'path-swe': 0.2, 'path-data': 0.2 } },
      { id: 'read', label: 'Reading, trying ideas, writing up what I found', because: 'like reading, trying ideas and writing up results', fit: { 'path-ml': 1, 'path-pm': 0.4, 'path-data': 0.3, 'path-swe': 0.2 } },
    ],
  },
  {
    id: 'broken',
    prompt: 'Something you built gives a wrong answer. What do you do first?',
    options: [
      { id: 'trace', label: 'Trace through the code until I find the cause', because: 'trace a bug until you find the cause', fit: { 'path-swe': 1, 'path-data': 0.7, 'path-ml': 0.4 } },
      { id: 'experiment', label: 'Run a few versions side by side and compare', because: 'compare versions side by side to find what changed', fit: { 'path-ml': 1, 'path-data': 0.4, 'path-swe': 0.4 } },
      { id: 'guard', label: 'Add a check so it can never fail silently again', because: 'add checks so things never fail silently', fit: { 'path-data': 1, 'path-swe': 0.6, 'path-ml': 0.3 } },
      { id: 'impact', label: 'Find out who it affects and what matters most', because: 'start by asking who a problem affects', fit: { 'path-pm': 1, 'path-swe': 0.2, 'path-data': 0.3 } },
    ],
  },
  {
    id: 'math',
    prompt: 'Which kind of thinking feels most natural?',
    options: [
      { id: 'linalg', label: 'Linear algebra and probability', because: 'are comfortable with linear algebra and probability', fit: { 'path-ml': 1, 'path-data': 0.4, 'path-swe': 0.3 } },
      { id: 'logic', label: 'Logic, proofs and algorithms', because: 'think naturally in logic and algorithms', fit: { 'path-swe': 1, 'path-ml': 0.5, 'path-data': 0.5, 'path-pm': 0.2 } },
      { id: 'tables', label: 'Tables, counts and statistics', because: 'think in tables, counts and statistics', fit: { 'path-data': 1, 'path-ml': 0.6, 'path-pm': 0.3, 'path-swe': 0.3 } },
      { id: 'words', label: 'Words, stories and diagrams', because: 'reason best in words and diagrams', fit: { 'path-pm': 1, 'path-swe': 0.2 } },
    ],
  },
  {
    id: 'proud',
    prompt: 'Which result would make you proudest?',
    options: [
      { id: 'service', label: 'A service lots of people use without thinking about it', because: 'would be proudest of a service people rely on', fit: { 'path-swe': 1, 'path-data': 0.5, 'path-ml': 0.3, 'path-pm': 0.4 } },
      { id: 'model', label: 'A model that clearly beats the old way', because: 'would be proudest of a model that beats the old way', fit: { 'path-ml': 1, 'path-data': 0.3, 'path-swe': 0.2 } },
      { id: 'pipeline', label: 'Numbers a whole team trusts every morning', because: 'would be proudest of data a team trusts every day', fit: { 'path-data': 1, 'path-ml': 0.3, 'path-swe': 0.4 } },
      { id: 'launch', label: 'A feature that shipped because I made the case', because: 'would be proudest of a feature you argued for', fit: { 'path-pm': 1, 'path-swe': 0.3 } },
    ],
  },
  {
    id: 'pace',
    prompt: 'What pace suits you?',
    options: [
      { id: 'weekly', label: 'Ship something small every week', because: 'like shipping something small every week', fit: { 'path-swe': 1, 'path-pm': 0.6, 'path-data': 0.5, 'path-ml': 0.2 } },
      { id: 'long', label: 'Long experiments, one solid result at a time', because: 'prefer long experiments with one solid result at a time', fit: { 'path-ml': 1, 'path-data': 0.3, 'path-swe': 0.2 } },
      { id: 'steady', label: 'Steady and reliable, few surprises', because: 'prefer a steady, reliable pace', fit: { 'path-data': 1, 'path-swe': 0.5, 'path-ml': 0.3 } },
      { id: 'fast', label: 'Fast, with priorities that shift', because: 'like a fast pace with shifting priorities', fit: { 'path-pm': 1, 'path-swe': 0.4 } },
    ],
  },
];
