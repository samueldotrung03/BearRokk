// Career paths beyond technology, so students in any major get a goal, a roadmap and a match.
// Each path is written once as a compact spec and expanded into the same shapes the four
// technology paths in sample.ts use. Like those, every profile is invented sample data that
// stands for no real person, and the hours are planning estimates, not measurements.
//
// This file must not import sample.ts: sample.ts imports it, and the cycle would leave these
// arrays undefined while sample.ts is still loading.
import type { CareerPath, ClassYear, PathGroup, PathProfile, Requirement, Roadmap, StepKind } from '../types.ts';
import type { PathExtra, WeekShare } from './discover-extra.ts';

const DAY = 86_400_000;
const now = Date.now();
const inDays = (days: number) => new Date(now + days * DAY).toISOString();

/** Fields in the order the goal picker and the match list show them. */
export const pathGroups: PathGroup[] = [
  'Technology',
  'Finance and business',
  'Science, engineering and health',
  'Policy, law and society',
  'Media and creative',
];

// [key, kind, title, detail, opportunityId, due in days or null, rough hours]
type StepSpec = [string, StepKind, string, string, string | null, number | null, number];
// [label, profile skill, step key]
type RequirementSpec = [string, string | null, string | null];
// [outcome, class year, timeline, step keys]
type ProfileSpec = [string, ClassYear, string[], string[]];
// [label, importance, profile skill, step key]
type SkillSpec = [string, 'core' | 'useful', string | null, string | null];

interface FieldSpec {
  key: string;
  group: PathGroup;
  title: string;
  oneLine: string;
  whyItFits: string;
  expects: string[];
  firstSteps: string[];
  goal: string;
  summary: string;
  requirements: RequirementSpec[];
  phases: { title: string; window: string; steps: StepSpec[] }[];
  profiles: ProfileSpec[];
  extra: {
    work: string;
    week: [string, WeekShare][];
    pace: string;
    paceShort: string;
    skills: SkillSpec[];
    interests: string[];
    feedTags: string[];
    neighbours: string[];
    hue: string;
  };
}

const specs: FieldSpec[] = [
  {
    key: 'health',
    group: 'Science, engineering and health',
    title: 'Healthcare and pre-med',
    oneLine: 'Care for patients, on the way to medicine, nursing or another health career.',
    whyItFits:
      'Fits students who want to work directly with people and are ready for a long science path. Clinical hours and steady grades in the core sciences count most early on.',
    expects: ['Biology and chemistry with steady grades', 'Regular hours in a clinical setting', 'Time shadowing a clinician'],
    firstSteps: ['Join a pre-health club', 'Start clinical volunteering', 'Shadow a clinician'],
    goal: 'Clinical internship, summer 2027',
    summary:
      'Health programs look for two things early: proof you can handle the science, and time spent around patients. Start the clinical hours now, because they build slowly.',
    requirements: [
      ['Biology and chemistry with steady grades', null, 'sciences'],
      ['Regular hours in a clinical setting', null, 'volunteer'],
      ['Time shadowing a clinician', null, 'shadow'],
      ['Basic life support certification', null, 'cpr'],
      ['An advisor who knows your plans', null, 'advisor'],
      ['Applications sent before spring deadlines', null, 'apply'],
    ],
    phases: [
      {
        title: 'Build the base',
        window: 'Now through December',
        steps: [
          ['sciences', 'learn', 'Keep the core sciences on track', 'Biology and chemistry grades are the first thing health programs check. Ask for help early rather than late.', null, null, 10],
          ['club', 'join', 'Join the pre-health society', 'Members share shadowing contacts and hear from advisors about which courses to take when.', 'opp-premed-society', 7, 2],
          ['cpr', 'learn', 'Get basic life support certified', 'A one-day course. Many clinical roles ask for it before your first shift.', null, 21, 5],
        ],
      },
      {
        title: 'Get clinical hours',
        window: 'December through February',
        steps: [
          ['volunteer', 'join', 'Volunteer every week in a clinic or hospital', 'Steady weekly hours over months mean more than a burst of them in one summer.', null, null, 12],
          ['shadow', 'attend', 'Shadow a clinician for a few days', 'Seeing an ordinary day is the best test of whether you want this work. Ask your club or campus health center for contacts.', null, 30, 8],
          ['advisor', 'attend', 'Meet a pre-health advisor', 'Bring your course plan and ask which experiences you are still missing.', null, 14, 1],
        ],
      },
      {
        title: 'Apply',
        window: 'January through April',
        steps: [
          ['mercy', 'apply', 'Apply to Mercy Bay Hospital', 'It places students on a care team for the summer. Check the hours it asks for before you apply.', 'opp-mercy-clinical', 11, 2],
          ['fair', 'attend', 'Meet health employers at the all-majors fair', 'Hospitals and clinics hire summer aides and scribes there. Ask what training they give.', 'opp-allmajors-fair', 40, 3],
          ['apply', 'apply', 'Send applications for summer clinical roles', 'Medical scribe, care aide and research assistant roles all count as clinical hours.', null, 60, 6],
        ],
      },
    ],
    profiles: [
      ['Clinical intern, community hospital', 'Sophomore', ['Biology and chemistry sequence', 'Weekly hospital volunteering', 'Shadowed a family doctor', 'Applied in January'], ['sciences', 'volunteer', 'shadow', 'mercy', 'apply']],
      ['Medical scribe, emergency department', 'Junior', ['Pre-health society', 'Basic life support course', 'Clinic volunteering', 'Applied to six scribe roles'], ['club', 'cpr', 'volunteer', 'apply']],
      ['Patient care aide, outpatient clinic', 'Sophomore', ['Core sciences', 'Basic life support course', 'Volunteered at a free clinic', 'All-majors fair'], ['sciences', 'cpr', 'volunteer', 'fair']],
      ['Summer clinical program, university hospital', 'Junior', ['Core sciences', 'Pre-health advisor meetings', 'Shadowed a surgeon', 'Weekly hospital volunteering'], ['sciences', 'advisor', 'shadow', 'volunteer', 'apply']],
      ['Care team intern, community health center', 'Sophomore', ['Pre-health society', 'Volunteered at a health center', 'Shadowed a nurse practitioner'], ['club', 'volunteer', 'shadow', 'mercy']],
      ['Physical therapy aide, sports clinic', 'Junior', ['Anatomy and biology', 'Shadowed a physical therapist', 'Basic life support course', 'Applied in March'], ['sciences', 'shadow', 'cpr', 'apply']],
      ['Pharmacy intern, retail pharmacy', 'Junior', ['Chemistry sequence', 'Pre-health advisor', 'All-majors fair', 'Applied to five pharmacies'], ['sciences', 'advisor', 'fair', 'apply']],
      ['Public health intern, county clinic', 'Senior', ['Biology courses', 'Volunteered with a vaccine clinic', 'Shadowed a public health nurse'], ['sciences', 'volunteer', 'shadow']],
      ['Hospice volunteer lead', 'Sophomore', ['Pre-health society', 'Weekly hospice volunteering', 'Basic life support course'], ['club', 'volunteer', 'cpr']],
      ['Research and clinic intern, children’s hospital', 'Junior', ['Core sciences', 'Shadowed a pediatrician', 'Clinic volunteering', 'Applied in January'], ['sciences', 'shadow', 'volunteer', 'mercy', 'apply']],
    ],
    extra: {
      work: 'You care for patients as part of a team, or support the people who do. Early on that means clinical hours, careful routines and learning how a clinic or hospital actually runs.',
      week: [
        ['Working with patients', 'most'],
        ['Charting and handing off to the next shift', 'some'],
        ['Coursework and studying', 'some'],
        ['Meetings with the care team', 'little'],
      ],
      pace: 'Steady shifts with busy stretches, and a path to a license that takes years of training.',
      paceShort: 'Long training',
      skills: [
        ['Biology and chemistry', 'core', null, 'sciences'],
        ['Hours in a clinical setting', 'core', null, 'volunteer'],
        ['Caring, clear communication with patients', 'core', 'Customer service', null],
        ['Basic life support', 'useful', null, 'cpr'],
        ['A second language', 'useful', 'A second language', null],
      ],
      interests: ['Healthcare and medicine', 'Biology and life sciences', 'Psychology', 'Social impact and nonprofits'],
      feedTags: ['Healthcare'],
      neighbours: ['path-research', 'path-education'],
      hue: '#e03131',
    },
  },
  {
    key: 'research',
    group: 'Science, engineering and health',
    title: 'Lab and life-science research',
    oneLine: 'Run experiments that answer open questions in biology, chemistry or medicine.',
    whyItFits:
      'Fits students who like asking why and are patient with experiments that fail before they work. A spot in a lab as an undergraduate is the usual way in.',
    expects: ['Lab coursework with basic techniques', 'A spot in a faculty lab', 'Comfort reading a research paper'],
    firstSteps: ['Read the recent work of one lab', 'Email three professors', 'Apply to a summer research program'],
    goal: 'Summer research position, 2027',
    summary:
      'Labs take undergraduates who show steady interest and careful hands. The fastest way in is a short, specific email to a professor whose work you have read.',
    requirements: [
      ['Lab coursework with basic techniques', 'Lab work', 'labcourse'],
      ['Comfort reading a research paper', null, 'papers'],
      ['Basic statistics for experiments', 'Data analysis', 'stats'],
      ['A spot in a faculty lab', null, 'join'],
      ['A poster or talk about your work', null, 'poster'],
      ['Summer program applications sent', null, 'apply'],
    ],
    phases: [
      {
        title: 'Learn the basics',
        window: 'Now through December',
        steps: [
          ['labcourse', 'learn', 'Do well in your lab course', 'Careful notes and clean technique in a teaching lab are what a professor asks your instructor about.', null, null, 8],
          ['papers', 'learn', 'Read five papers from one lab', 'Pick a lab on campus and read its recent work. You will need it for the email and the first meeting.', null, 14, 6],
          ['stats', 'learn', 'Learn the statistics experiments use', 'Means, error bars and a simple test of difference cover most of what an undergraduate needs at first.', null, 28, 8],
        ],
      },
      {
        title: 'Get into a lab',
        window: 'December through February',
        steps: [
          ['email', 'apply', 'Email three professors about their work', 'Say which paper you read, what interested you, and how many hours a week you can give.', null, 10, 2],
          ['join', 'join', 'Apply to the Hale Cell Biology Lab', 'The lab trains new assistants from scratch. Say which of its questions interests you and why.', 'opp-bio-lab', 17, 10],
          ['journal', 'attend', 'Go to a journal club', 'Hearing how researchers question a paper teaches you more than reading it alone.', null, 30, 2],
        ],
      },
      {
        title: 'Show the work',
        window: 'February through April',
        steps: [
          ['apply', 'apply', 'Apply to summer research programs', 'Many pay a stipend. Ask your professor for a letter at least a month ahead.', null, 45, 8],
          ['fair', 'attend', 'Meet science employers at the all-majors fair', 'Ask biotech companies what their summer research assistants do.', 'opp-allmajors-fair', 40, 3],
          ['poster', 'build', 'Present a poster at the undergraduate symposium', 'Early results count. Practice explaining your work to someone outside the lab.', null, 70, 10],
        ],
      },
    ],
    profiles: [
      ['Summer research student, university biology lab', 'Sophomore', ['Intro lab course', 'Read papers from one lab', 'Emailed three professors', 'Joined the lab in January'], ['labcourse', 'papers', 'email', 'join', 'apply']],
      ['Research assistant, neuroscience lab', 'Junior', ['Statistics course', 'Emailed four professors', 'Lab member for a year', 'Poster at the symposium'], ['stats', 'email', 'join', 'poster', 'apply']],
      ['Summer research program, medical school', 'Junior', ['Lab courses', 'Journal club', 'Lab member', 'Applied to five programs'], ['labcourse', 'journal', 'join', 'apply']],
      ['Lab technician intern, biotech company', 'Senior', ['Lab courses', 'Statistics', 'All-majors fair', 'Applied in February'], ['labcourse', 'stats', 'fair', 'apply']],
      ['Undergraduate researcher, ecology lab', 'Sophomore', ['Read the lab’s papers', 'Emailed the professor', 'Field work with the lab'], ['papers', 'email', 'join']],
      ['Research intern, chemistry lab', 'Junior', ['Organic chemistry lab', 'Lab member', 'Poster at the symposium'], ['labcourse', 'join', 'poster']],
      ['Summer research fellow, public health lab', 'Junior', ['Statistics', 'Read ten papers', 'Lab member', 'Applied to four programs'], ['stats', 'papers', 'join', 'apply']],
      ['Research assistant, genetics lab', 'Sophomore', ['Intro lab course', 'Emailed two professors', 'Joined a lab', 'Journal club'], ['labcourse', 'email', 'join', 'journal']],
      ['Research associate intern, vaccine company', 'Senior', ['Lab courses', 'Lab member for two years', 'All-majors fair'], ['labcourse', 'join', 'fair', 'apply']],
    ],
    extra: {
      work: 'You design and run experiments, record what happens and work out what it means. Most days are spent at the bench or with data, and results come slowly.',
      week: [
        ['Running experiments', 'most'],
        ['Analyzing results', 'some'],
        ['Reading papers', 'some'],
        ['Lab meetings and talks', 'little'],
      ],
      pace: 'Slow and careful: one result can take months, and failed experiments are normal.',
      paceShort: 'Months per result',
      skills: [
        ['Lab techniques', 'core', 'Lab work', 'labcourse'],
        ['Reading research papers', 'core', null, 'papers'],
        ['Statistics for experiments', 'core', 'Data analysis', 'stats'],
        ['Presenting your work', 'useful', 'Public speaking', 'poster'],
        ['A tool for analyzing data, such as Python', 'useful', 'Python', null],
      ],
      interests: ['Biology and life sciences', 'Research', 'Healthcare and medicine', 'Environment and sustainability'],
      feedTags: ['Life sciences', 'Research'],
      neighbours: ['path-health', 'path-ml'],
      hue: '#2b8a3e',
    },
  },
  {
    key: 'finance',
    group: 'Finance and business',
    title: 'Finance and investment',
    oneLine: 'Study companies and markets to decide where money should go.',
    whyItFits:
      'Fits students who like numbers, quick decisions and following the news. Banks and investment firms recruit early, often a full year before the summer.',
    expects: ['Accounting basics', 'Spreadsheet modeling', 'Conversations with people in the field'],
    firstSteps: ['Learn the three financial statements', 'Join the investment club', 'Build a simple model in a spreadsheet'],
    goal: 'Finance internship, summer 2027',
    summary:
      'Finance recruiting starts early and runs on preparation and the people you have met. Learn accounting and spreadsheets first, then talk to people who already do the work.',
    requirements: [
      ['Accounting basics', null, 'accounting'],
      ['Spreadsheet modeling', 'Excel', 'model'],
      ['A stock pitch or company analysis', null, 'pitch'],
      ['Conversations with people in the field', null, 'coffee'],
      ['A one-page finance resume', null, 'resume'],
      ['Applications sent on the early timeline', null, 'apply'],
    ],
    phases: [
      {
        title: 'Learn the language',
        window: 'Now through December',
        steps: [
          ['accounting', 'learn', 'Learn the three financial statements', 'How the income statement, balance sheet and cash flow connect is the first thing interviews test.', null, 21, 10],
          ['club', 'join', 'Join the student investment club', 'Clubs run pitch meetings and share which firms are recruiting when.', null, 7, 3],
          ['model', 'learn', 'Build a simple company model in a spreadsheet', 'Start from one public company report. Getting the numbers to tie out is the skill.', null, 35, 10],
        ],
      },
      {
        title: 'Show your thinking',
        window: 'December and January',
        steps: [
          ['pitch', 'build', 'Write and present one stock pitch', 'One page: what the company does, why the price is wrong, and what would prove you wrong.', null, 30, 8],
          ['coffee', 'attend', 'Have five short calls with people in finance', 'Ask about their work, not for a job. Alumni lists are a good place to start.', null, 45, 5],
          ['resume', 'build', 'Put your resume in the one-page finance format', 'Firms read many resumes quickly. A number or a result in each line helps.', null, 14, 2],
        ],
      },
      {
        title: 'Apply',
        window: 'January through March',
        steps: [
          ['harlow', 'apply', 'Apply to Harlow Capital', 'Read the posting for the teams it hires into, and name the one you want.', 'opp-harlow-finance', 9, 2],
          ['fair', 'attend', 'Meet finance firms at the all-majors fair', 'Bring your pitch in one sentence. Follow up within two days.', 'opp-allmajors-fair', 40, 3],
          ['apply', 'apply', 'Send applications to ten firms', 'Smaller firms and corporate finance teams hire later, and are worth applying to as well.', null, 60, 8],
        ],
      },
    ],
    profiles: [
      ['Summer analyst, regional bank', 'Junior', ['Accounting course', 'Investment club pitch', 'Calls with alumni', 'Applied in September'], ['accounting', 'club', 'pitch', 'coffee', 'apply']],
      ['Investment intern, asset manager', 'Junior', ['Investment club', 'Spreadsheet model of one company', 'Stock pitch', 'Applied to twelve firms'], ['club', 'model', 'pitch', 'apply']],
      ['Corporate finance intern, consumer company', 'Sophomore', ['Accounting course', 'Resume in finance format', 'All-majors fair'], ['accounting', 'resume', 'fair', 'apply']],
      ['Summer analyst, investment bank', 'Junior', ['Accounting and modeling', 'Ten calls with alumni', 'Investment club', 'Applied early'], ['accounting', 'model', 'coffee', 'club', 'harlow', 'apply']],
      ['Wealth management intern, advisory firm', 'Sophomore', ['Investment club', 'Calls with advisors', 'All-majors fair'], ['club', 'coffee', 'fair']],
      ['Finance intern, startup', 'Junior', ['Spreadsheet modeling', 'Stock pitch', 'Applied in January'], ['model', 'pitch', 'apply']],
      ['Risk intern, credit union', 'Senior', ['Accounting course', 'Statistics', 'Resume review', 'Applied to eight roles'], ['accounting', 'resume', 'apply']],
      ['Equity research intern, investment firm', 'Junior', ['Accounting', 'Two stock pitches', 'Calls with analysts'], ['accounting', 'pitch', 'coffee', 'harlow']],
      ['Treasury intern, city government', 'Sophomore', ['Accounting course', 'Spreadsheet model', 'All-majors fair'], ['accounting', 'model', 'fair']],
    ],
    extra: {
      work: 'You study companies, markets and deals to help decide where money should go. Much of the work is building spreadsheets, checking numbers and explaining a view to people who will act on it.',
      week: [
        ['Spreadsheets and models', 'most'],
        ['Reading reports and the news', 'some'],
        ['Meetings and calls', 'some'],
        ['Writing short summaries', 'little'],
      ],
      pace: 'Fast, with long hours at many firms, tied to markets and deal deadlines.',
      paceShort: 'Fast, long hours',
      skills: [
        ['Accounting basics', 'core', null, 'accounting'],
        ['Spreadsheet modeling', 'core', 'Excel', 'model'],
        ['A clear investment view', 'core', null, 'pitch'],
        ['People you have talked to in the field', 'useful', null, 'coffee'],
        ['Data analysis', 'useful', 'Data analysis', null],
      ],
      interests: ['Finance', 'Economics', 'Business and entrepreneurship'],
      feedTags: ['Finance'],
      neighbours: ['path-consulting', 'path-data'],
      hue: '#9c7a00',
    },
  },
  {
    key: 'consulting',
    group: 'Finance and business',
    title: 'Business and consulting',
    oneLine: 'Help organizations solve business problems with research, numbers and clear advice.',
    whyItFits:
      'Fits students who enjoy puzzles, teamwork and presenting a clear answer. Firms hire from every major and test you with case interviews.',
    expects: ['Structured problem solving', 'Spreadsheet basics', 'Clear presentations'],
    firstSteps: ['Join the consulting club', 'Practice case interviews', 'Enter a case competition'],
    goal: 'Consulting internship, summer 2027',
    summary:
      'Consulting firms hire from every major. What they test is how you break a problem down and explain your answer, and both get better with practice.',
    requirements: [
      ['Structured problem solving', null, 'cases'],
      ['Spreadsheet basics', 'Excel', 'excel'],
      ['Clear presentations', 'Public speaking', 'comp'],
      ['A team result you can point to', 'Leadership', 'project'],
      ['Conversations with consultants', null, 'coffee'],
      ['Applications sent before the deadlines', null, 'apply'],
    ],
    phases: [
      {
        title: 'Learn the method',
        window: 'Now through December',
        steps: [
          ['club', 'join', 'Join the consulting club', 'Clubs run case practice every week and pair new members with someone who has interviewed.', 'opp-consulting-club', 7, 3],
          ['cases', 'learn', 'Practice ten case interviews with a partner', 'Say your structure out loud before you do any math. That habit is most of the skill.', null, 30, 10],
          ['excel', 'learn', 'Get comfortable with spreadsheets', 'Lookups, pivot tables and a clean chart are enough to start.', null, 21, 6],
        ],
      },
      {
        title: 'Show the work',
        window: 'December through February',
        steps: [
          ['comp', 'build', 'Compete in a case competition', 'Teams of three or four present to judges from firms. It is practice and a line on your resume at once.', 'opp-case-comp', 12, 12],
          ['project', 'build', 'Do a free project for a local business or nonprofit', 'Many consulting clubs run these. A real client and a real recommendation give you stories for interviews.', null, 60, 12],
          ['coffee', 'attend', 'Talk with three consultants about their work', 'Ask what a first-year does in a week. Thank them in writing.', null, 40, 3],
        ],
      },
      {
        title: 'Apply',
        window: 'January through March',
        steps: [
          ['fair', 'attend', 'Meet firms at the all-majors fair', 'Ask each firm what their interns worked on last summer.', 'opp-allmajors-fair', 40, 3],
          ['resume', 'build', 'Rewrite your resume around results', 'Each line should say what changed because of your work.', null, 20, 2],
          ['apply', 'apply', 'Send applications to eight firms', 'Include smaller and boutique firms. They often hire later in the year.', null, 55, 8],
        ],
      },
    ],
    profiles: [
      ['Summer associate, strategy firm', 'Junior', ['Consulting club', 'Twenty practice cases', 'Case competition finalist', 'Applied in August'], ['club', 'cases', 'comp', 'apply']],
      ['Business analyst intern, consulting firm', 'Junior', ['Consulting club', 'Free project for a nonprofit', 'Calls with consultants', 'All-majors fair'], ['club', 'project', 'coffee', 'fair', 'apply']],
      ['Operations intern, healthcare company', 'Sophomore', ['Spreadsheet course', 'Case competition', 'Resume rewrite'], ['excel', 'comp', 'resume', 'apply']],
      ['Consulting intern, boutique firm', 'Junior', ['Practice cases', 'Club project for a local shop', 'Applied to ten firms'], ['cases', 'project', 'apply']],
      ['Strategy intern, retail company', 'Sophomore', ['Consulting club', 'Spreadsheet basics', 'Case competition'], ['club', 'excel', 'comp']],
      ['Business analyst intern, public sector practice', 'Senior', ['Practice cases', 'Calls with consultants', 'All-majors fair', 'Applied in September'], ['cases', 'coffee', 'fair', 'apply']],
      ['Summer associate, economics consulting firm', 'Junior', ['Spreadsheet modeling', 'Practice cases', 'Case competition', 'Resume rewrite'], ['excel', 'cases', 'comp', 'resume', 'apply']],
      ['Social impact consulting fellow', 'Sophomore', ['Consulting club', 'Free project for a nonprofit', 'Calls with consultants'], ['club', 'project', 'coffee']],
      ['Business operations intern, startup', 'Junior', ['Club member', 'Practice cases', 'All-majors fair'], ['club', 'cases', 'fair']],
    ],
    extra: {
      work: 'You join a client for a few weeks or months, break a business problem into parts, find the facts and recommend what to do. Most of it is teamwork, spreadsheets and slides.',
      week: [
        ['Research and analysis', 'most'],
        ['Problem solving with your team', 'some'],
        ['Building slides', 'some'],
        ['Client meetings', 'little'],
      ],
      pace: 'Project by project, with intense weeks before each client meeting.',
      paceShort: 'Project sprints',
      skills: [
        ['Structured problem solving', 'core', null, 'cases'],
        ['Spreadsheets', 'core', 'Excel', 'excel'],
        ['Presenting clearly', 'core', 'Public speaking', 'comp'],
        ['Leading a team', 'useful', 'Leadership', 'project'],
        ['Project management', 'useful', 'Project management', null],
      ],
      interests: ['Consulting', 'Business and entrepreneurship', 'Economics'],
      feedTags: ['Consulting', 'Business'],
      neighbours: ['path-finance', 'path-pm'],
      hue: '#2f4b7c',
    },
  },
  {
    key: 'marketing',
    group: 'Finance and business',
    title: 'Marketing and communications',
    oneLine: 'Help people find, understand and choose a product, cause or brand.',
    whyItFits:
      'Fits students who like writing, social media and working out what makes people care. Real posts and campaigns you ran matter more than your major.',
    expects: ['Writing for different audiences', 'Running a social media channel', 'A campaign with results you measured'],
    firstSteps: ['Run social media for a club', 'Learn the basics of analytics', 'Build a small portfolio'],
    goal: 'Marketing internship, summer 2027',
    summary:
      'Marketing teams hire on examples. Run the channels for a club or a small business, measure what worked, and put the best pieces in a simple portfolio.',
    requirements: [
      ['Writing for different audiences', 'Writing', 'writing'],
      ['Running a social media channel', 'Social media', 'channel'],
      ['Basic analytics', 'Data analysis', 'analytics'],
      ['A campaign with results you measured', null, 'campaign'],
      ['A portfolio of your work', null, 'portfolio'],
      ['Applications sent in spring', null, 'apply'],
    ],
    phases: [
      {
        title: 'Learn the craft',
        window: 'Now through December',
        steps: [
          ['channel', 'join', 'Run social media for a club', 'Weekly posts for a real group teach you more than any course. Keep notes on what got a response.', null, 7, 3],
          ['writing', 'learn', 'Write one idea for three audiences', 'Write it as a post, an email and a short ad. Notice what has to change each time.', null, 21, 5],
          ['analytics', 'learn', 'Learn the basics of web and social analytics', 'Free courses from the big platforms cover reach, clicks and sign-ups.', null, 30, 6],
        ],
      },
      {
        title: 'Run a campaign',
        window: 'December through February',
        steps: [
          ['campaign', 'build', 'Plan and run one small campaign', 'Pick a goal, such as event sign-ups, try two versions, and count which one worked better.', null, 45, 10],
          ['portfolio', 'build', 'Put your best work in a simple portfolio', 'Three pieces, each with the goal, what you did and what happened.', null, 60, 6],
          ['fair', 'attend', 'Ask about marketing roles at the all-majors fair', 'Many companies hire marketing interns from every major there.', 'opp-allmajors-fair', 40, 3],
        ],
      },
      {
        title: 'Apply',
        window: 'February through April',
        steps: [
          ['brightside', 'apply', 'Apply to Brightside Foods', 'Put your portfolio link in the first line of the application.', 'opp-brightside-marketing', 18, 2],
          ['coffee', 'attend', 'Talk with two people who work in marketing', 'Ask what they wish they had learned in school.', null, 50, 2],
          ['apply', 'apply', 'Send applications to eight teams', 'Agencies, in-house teams and nonprofits all hire marketing interns.', null, 65, 8],
        ],
      },
    ],
    profiles: [
      ['Marketing intern, consumer brand', 'Junior', ['Ran a club’s social media', 'Campaign for a campus event', 'Portfolio site', 'Applied in March'], ['channel', 'campaign', 'portfolio', 'apply']],
      ['Social media intern, nonprofit', 'Sophomore', ['Club social media', 'Analytics course', 'All-majors fair'], ['channel', 'analytics', 'fair']],
      ['Communications intern, university office', 'Sophomore', ['Writing for the campus paper', 'Club social media', 'Portfolio'], ['writing', 'channel', 'portfolio', 'apply']],
      ['Growth marketing intern, app company', 'Junior', ['Analytics course', 'Ran an email campaign', 'Portfolio', 'Applied to ten roles'], ['analytics', 'campaign', 'portfolio', 'brightside', 'apply']],
      ['Brand intern, agency', 'Junior', ['Club social media', 'Writing samples', 'Calls with two marketers'], ['channel', 'writing', 'coffee', 'apply']],
      ['Content intern, local business', 'Sophomore', ['Ran social media for a café', 'Small paid campaign', 'Portfolio'], ['channel', 'campaign', 'portfolio']],
      ['Marketing coordinator intern, health company', 'Senior', ['Writing samples', 'Analytics course', 'All-majors fair', 'Applied in February'], ['writing', 'analytics', 'fair', 'apply']],
      ['Public relations intern, agency', 'Junior', ['Writing for different audiences', 'Club social media', 'Portfolio'], ['writing', 'channel', 'portfolio']],
      ['Events marketing intern, music venue', 'Sophomore', ['Promoted club events', 'Campaign for a concert', 'Talked with a promoter'], ['channel', 'campaign', 'coffee']],
    ],
    extra: {
      work: 'You decide how to tell people about a product or cause, make the posts, emails and campaigns, and measure what worked. It mixes writing, design and numbers.',
      week: [
        ['Writing and making content', 'most'],
        ['Planning campaigns', 'some'],
        ['Checking results', 'some'],
        ['Meetings with other teams', 'little'],
      ],
      pace: 'Quick turnarounds, with campaigns planned weeks ahead and posts going out every day.',
      paceShort: 'Quick turnarounds',
      skills: [
        ['Writing', 'core', 'Writing', 'writing'],
        ['Social media', 'core', 'Social media', 'channel'],
        ['Analytics', 'core', 'Data analysis', 'analytics'],
        ['A campaign you ran', 'useful', null, 'campaign'],
        ['Graphic design', 'useful', 'Graphic design', null],
      ],
      interests: ['Marketing', 'Business and entrepreneurship', 'Writing and journalism', 'Visual art and design'],
      feedTags: ['Marketing'],
      neighbours: ['path-media', 'path-design'],
      hue: '#e64980',
    },
  },
  {
    key: 'policy',
    group: 'Policy, law and society',
    title: 'Public policy and law',
    oneLine: 'Research problems in government and society, and work on the rules that address them.',
    whyItFits:
      'Fits students who read the news closely, enjoy debate and want their work to change public rules. Writing and research count more than any one major.',
    expects: ['Research and clear writing', 'How government and courts work', 'Time in a public office, campaign or nonprofit'],
    firstSteps: ['Write a short policy memo', 'Go to a pre-law night', 'Apply for a government fellowship'],
    goal: 'Policy or legal internship, summer 2027',
    summary:
      'Policy offices and law firms look for careful writing and some time spent inside public work. A memo you wrote and a semester of service give you both.',
    requirements: [
      ['Research and clear writing', 'Writing', 'memo'],
      ['How government and courts work', null, 'course'],
      ['Public speaking or debate', 'Public speaking', 'debate'],
      ['Time in a public office, campaign or nonprofit', null, 'volunteer'],
      ['A writing sample', null, 'sample'],
      ['Applications sent before the deadlines', null, 'apply'],
    ],
    phases: [
      {
        title: 'Learn how it works',
        window: 'Now through December',
        steps: [
          ['course', 'learn', 'Take a course on government or law', 'Knowing how a bill or a case moves is the base for everything else.', null, null, 8],
          ['prelaw', 'attend', 'Go to the pre-law night', 'Lawyers and admissions staff explain what to do in college and what can wait.', 'opp-prelaw-night', 9, 2],
          ['memo', 'build', 'Write a two-page policy memo', 'Pick a local issue, lay out two options and recommend one. Short and plain beats long.', null, 28, 6],
        ],
      },
      {
        title: 'Get inside public work',
        window: 'December through February',
        steps: [
          ['volunteer', 'join', 'Volunteer with a local office, campaign or legal aid group', 'A few hours a week is enough to see how decisions are actually made.', null, 30, 10],
          ['debate', 'join', 'Join debate, mock trial or model UN', 'Arguing a side under time pressure is practice for both law and policy work.', null, 14, 4],
          ['sample', 'build', 'Turn your best paper into a writing sample', 'Most applications ask for one. Five clean pages are better than fifteen.', null, 45, 4],
        ],
      },
      {
        title: 'Apply',
        window: 'January through March',
        steps: [
          ['civic', 'apply', 'Apply to the Eastbay Civic Fellowship', 'It places students in government offices for the summer. Write about one issue you care about.', 'opp-civic-fellowship', 22, 3],
          ['fair', 'attend', 'Meet public sector employers at the all-majors fair', 'Agencies and nonprofits often have tables and hire from every major.', 'opp-allmajors-fair', 40, 3],
          ['apply', 'apply', 'Send six applications', 'Include legislative offices, agencies, nonprofits and law firms.', null, 60, 6],
        ],
      },
    ],
    profiles: [
      ['Legislative intern, state senator’s office', 'Junior', ['Government course', 'Volunteered on a local campaign', 'Policy memo', 'Applied in January'], ['course', 'volunteer', 'memo', 'civic', 'apply']],
      ['Legal intern, legal aid office', 'Junior', ['Pre-law night', 'Mock trial', 'Writing sample', 'Applied to five offices'], ['prelaw', 'debate', 'sample', 'apply']],
      ['Policy intern, city hall', 'Sophomore', ['Government course', 'Two policy memos', 'Volunteered with a council member'], ['course', 'memo', 'volunteer']],
      ['Research intern, policy institute', 'Junior', ['Statistics and government courses', 'Policy memo', 'Writing sample', 'Applied in February'], ['course', 'memo', 'sample', 'apply']],
      ['Summer fellow, federal agency', 'Junior', ['Government course', 'Model UN', 'Volunteered at a nonprofit', 'Civic fellowship'], ['course', 'debate', 'volunteer', 'civic']],
      ['Law firm summer assistant', 'Senior', ['Pre-law night', 'Mock trial', 'All-majors fair'], ['prelaw', 'debate', 'fair', 'apply']],
      ['Advocacy intern, environmental nonprofit', 'Sophomore', ['Volunteered with the group', 'Policy memo', 'Debate team'], ['volunteer', 'memo', 'debate']],
      ['Campaign field intern', 'Sophomore', ['Government course', 'Volunteered on a campaign', 'All-majors fair'], ['course', 'volunteer', 'fair']],
      ['Court intern, county court', 'Junior', ['Law and society course', 'Pre-law night', 'Writing sample', 'Applied to four courts'], ['course', 'prelaw', 'sample', 'apply']],
    ],
    extra: {
      work: 'You research a public problem, weigh the options and write them up for the people who decide, or you help apply the law to real cases. Reading and writing fill most days.',
      week: [
        ['Reading and research', 'most'],
        ['Writing memos and briefs', 'some'],
        ['Meetings and hearings', 'some'],
        ['Public events', 'little'],
      ],
      pace: 'Tied to legislative calendars and court dates, with slow stretches and sudden deadlines.',
      paceShort: 'Calendar-driven',
      skills: [
        ['Research and writing', 'core', 'Writing', 'memo'],
        ['How government works', 'core', null, 'course'],
        ['Time in public service', 'core', null, 'volunteer'],
        ['Public speaking', 'useful', 'Public speaking', 'debate'],
        ['A writing sample', 'useful', null, 'sample'],
      ],
      interests: ['Law and policy', 'Government and public service', 'International relations', 'Social impact and nonprofits'],
      feedTags: ['Policy', 'Law'],
      neighbours: ['path-education', 'path-media'],
      hue: '#8d5b34',
    },
  },
  {
    key: 'design',
    group: 'Media and creative',
    title: 'Design and UX',
    oneLine: 'Shape how products, screens and spaces look and work for the people who use them.',
    whyItFits:
      'Fits students who notice what makes things easy or frustrating and like to sketch ideas. A portfolio that shows your process gets you hired, whatever your major.',
    expects: ['One design tool used well', 'Research with real users', 'Two or three case studies'],
    firstSteps: ['Redesign one thing you use', 'Learn a design tool', 'Join a design jam'],
    goal: 'Design internship, summer 2027',
    summary:
      'Design teams hire on portfolios. Two or three projects that show how you found a problem, tried ideas and tested them are worth more than polish.',
    requirements: [
      ['One design tool used well', 'Graphic design', 'tool'],
      ['Research with real users', null, 'research'],
      ['A project designed with a team', null, 'jam'],
      ['Two or three case studies', null, 'portfolio'],
      ['Feedback from a working designer', null, 'critique'],
      ['Applications sent in spring', null, 'apply'],
    ],
    phases: [
      {
        title: 'Learn the tools',
        window: 'Now through December',
        steps: [
          ['tool', 'learn', 'Learn one design tool well', 'Most teams use the same few. Recreate three screens you admire to learn it fast.', null, 21, 10],
          ['research', 'learn', 'Interview five people about one problem', 'Watch how they do the task today before you design anything.', null, 30, 5],
          ['redesign', 'build', 'Redesign one thing you use every day', 'An app, a form or a sign on campus. Show before and after, and say why.', null, 35, 8],
        ],
      },
      {
        title: 'Build a portfolio',
        window: 'December through February',
        steps: [
          ['jam', 'build', 'Design with a team at the design jam', 'A weekend with a brief, a team and a deadline gives you a whole project to show.', 'opp-design-jam', 10, 10],
          ['portfolio', 'build', 'Write up two or three case studies', 'Problem, research, ideas, testing, result. Photos of your sketches help.', null, 50, 10],
          ['critique', 'attend', 'Get a portfolio review from a working designer', 'One honest review shows you what to cut.', null, 40, 2],
        ],
      },
      {
        title: 'Apply',
        window: 'February through April',
        steps: [
          ['studio', 'apply', 'Apply to Fieldnote Studio', 'Send your portfolio link and one sentence on the project you are proudest of.', 'opp-studio-design', 18, 2],
          ['scholarship', 'apply', 'Apply for the creative scholarship', 'It funds students in creative fields, and your portfolio is most of the application.', 'opp-creative-scholarship', 30, 3],
          ['apply', 'apply', 'Send applications to eight teams', 'Studios, agencies and in-house product teams all take design interns.', null, 60, 8],
        ],
      },
    ],
    profiles: [
      ['UX design intern, banking app', 'Junior', ['Learned a design tool', 'User interviews for a class', 'Two case studies', 'Applied in February'], ['tool', 'research', 'portfolio', 'apply']],
      ['Product design intern, education startup', 'Sophomore', ['Design jam team', 'Redesigned the campus bus app', 'Portfolio review'], ['jam', 'redesign', 'critique', 'portfolio']],
      ['Graphic design intern, agency', 'Sophomore', ['Design tool', 'Posters for clubs', 'Portfolio', 'Creative scholarship'], ['tool', 'portfolio', 'scholarship', 'apply']],
      ['UX research intern, health company', 'Junior', ['User interviews', 'Design jam', 'Case study write-up'], ['research', 'jam', 'portfolio', 'apply']],
      ['Visual design intern, game studio', 'Junior', ['Design tool', 'Redesign project', 'Portfolio review', 'Applied to ten studios'], ['tool', 'redesign', 'critique', 'apply']],
      ['Design intern, nonprofit', 'Sophomore', ['Design tool', 'Interviews with volunteers', 'Portfolio'], ['tool', 'research', 'portfolio']],
      ['Product design intern, travel company', 'Senior', ['Two design jams', 'Three case studies', 'Applied in January'], ['jam', 'portfolio', 'studio', 'apply']],
      ['Interaction design intern, hardware company', 'Junior', ['Design tool', 'User interviews', 'Redesign project', 'Portfolio'], ['tool', 'research', 'redesign', 'portfolio']],
      ['Design fellow, city digital service', 'Junior', ['Interviews with residents', 'Design jam', 'Portfolio review'], ['research', 'jam', 'critique', 'portfolio']],
    ],
    extra: {
      work: 'You find out what people need, sketch ideas, test them with users and turn the best into screens, products or graphics a team can build. Feedback and revision are most of the job.',
      week: [
        ['Designing and prototyping', 'most'],
        ['Talking with users', 'some'],
        ['Feedback sessions', 'some'],
        ['Handing designs to the people who build them', 'little'],
      ],
      pace: 'Short cycles of sketch, test and revise, with frequent reviews.',
      paceShort: 'Short cycles',
      skills: [
        ['A design tool', 'core', 'Graphic design', 'tool'],
        ['User research', 'core', null, 'research'],
        ['A portfolio of case studies', 'core', null, 'portfolio'],
        ['A project made with a team', 'useful', null, 'jam'],
        ['Explaining your choices in writing', 'useful', 'Writing', null],
      ],
      interests: ['Visual art and design', 'Architecture', 'Fashion', 'Web development'],
      feedTags: ['Design'],
      neighbours: ['path-marketing', 'path-pm'],
      hue: '#ae3ec9',
    },
  },
  {
    key: 'education',
    group: 'Policy, law and society',
    title: 'Teaching and education',
    oneLine: 'Help people learn, in classrooms, tutoring programs or schools.',
    whyItFits:
      'Fits students who are patient, like explaining things and want to see people grow. Hours spent working with learners matter most, starting with tutoring.',
    expects: ['Weekly hours working with students', 'Clear explanations', 'Knowing the credential path'],
    firstSteps: ['Join a tutoring club', 'Observe a classroom', 'Apply for a teaching fellowship'],
    goal: 'Teaching fellowship, summer 2027',
    summary:
      'Education programs look for steady time spent helping students learn. Tutoring every week and watching experienced teachers will also show you whether you love it.',
    requirements: [
      ['Weekly hours working with students', null, 'tutor'],
      ['Clear explanations', 'Public speaking', 'lesson'],
      ['Time observing a classroom', null, 'observe'],
      ['A cleared background check', null, 'clearance'],
      ['Knowing the credential path', null, 'credential'],
      ['Applications sent in spring', null, 'apply'],
    ],
    phases: [
      {
        title: 'Start working with students',
        window: 'Now through December',
        steps: [
          ['tutor', 'join', 'Join the tutoring club', 'Tutors meet the same students every week, which is the best way to see if teaching suits you.', 'opp-tutoring-club', 7, 3],
          ['clearance', 'learn', 'Get the background check schools require', 'Most programs that work with minors need it. It can take a few weeks, so start early.', null, 14, 1],
          ['observe', 'attend', 'Observe two classes taught by experienced teachers', 'Watch how they start a class, handle questions and check that students understood.', null, 30, 4],
        ],
      },
      {
        title: 'Teach something',
        window: 'December through February',
        steps: [
          ['lesson', 'build', 'Plan and teach one full lesson', 'Ask a teacher or club lead for a slot, and ask someone to watch and give notes.', null, 45, 6],
          ['credential', 'learn', 'Learn how teaching credentials work in your state', 'Talk with an education advisor about programs and the tests they require.', null, 40, 2],
          ['language', 'learn', 'Practice a second language with learners', 'Bilingual teachers are in demand. Volunteering with language learners counts.', null, null, 4],
        ],
      },
      {
        title: 'Apply',
        window: 'January through April',
        steps: [
          ['fellows', 'apply', 'Apply to Bridge Scholars', 'You teach a summer class with a mentor teacher. Write about a student you helped.', 'opp-teach-fellows', 14, 3],
          ['fair', 'attend', 'Meet school districts at the all-majors fair', 'Districts and education nonprofits hire summer staff there.', 'opp-allmajors-fair', 40, 3],
          ['apply', 'apply', 'Send applications to summer programs', 'Camps, tutoring centers and summer schools all count as teaching hours.', null, 60, 5],
        ],
      },
    ],
    profiles: [
      ['Summer teaching fellow, middle school', 'Sophomore', ['Weekly tutoring', 'Observed two classes', 'Taught a lesson', 'Applied in February'], ['tutor', 'observe', 'lesson', 'fellows', 'apply']],
      ['Tutoring program intern, nonprofit', 'Sophomore', ['Tutoring club', 'Background check', 'All-majors fair'], ['tutor', 'clearance', 'fair', 'apply']],
      ['Classroom aide, elementary school', 'Junior', ['Tutoring club', 'Background check', 'Observed classes'], ['tutor', 'clearance', 'observe']],
      ['Summer school teaching assistant', 'Junior', ['Tutoring', 'Taught two lessons', 'Credential advising', 'Applied to four programs'], ['tutor', 'lesson', 'credential', 'apply']],
      ['Bilingual tutor, community center', 'Sophomore', ['Volunteered with language learners', 'Tutoring club', 'Background check'], ['language', 'tutor', 'clearance']],
      ['Camp education counselor, science museum', 'Sophomore', ['Tutoring', 'Taught a lesson', 'All-majors fair'], ['tutor', 'lesson', 'fair']],
      ['Teaching fellow, summer bridge program', 'Junior', ['Tutoring club lead', 'Observed classes', 'Teach Fellows'], ['tutor', 'observe', 'fellows', 'apply']],
      ['Education research intern, school district', 'Senior', ['Credential advising', 'Observed classes', 'Applied in March'], ['credential', 'observe', 'apply']],
      ['After-school program lead', 'Junior', ['Weekly tutoring', 'Background check', 'Taught lessons'], ['tutor', 'clearance', 'lesson']],
    ],
    extra: {
      work: 'You plan lessons, teach them and help each student keep up. Outside class there is grading, talking with families and changing plans for students who need something different.',
      week: [
        ['Teaching and tutoring', 'most'],
        ['Planning lessons', 'some'],
        ['Grading and feedback', 'some'],
        ['Meetings with families and staff', 'little'],
      ],
      pace: 'Set by the school calendar: full, steady weeks with breaks between terms.',
      paceShort: 'School calendar',
      skills: [
        ['Hours working with students', 'core', null, 'tutor'],
        ['Clear explanations', 'core', 'Public speaking', 'lesson'],
        ['Patience and listening', 'core', 'Customer service', null],
        ['Classroom observation', 'useful', null, 'observe'],
        ['A second language', 'useful', 'A second language', 'language'],
      ],
      interests: ['Education', 'Psychology', 'Social impact and nonprofits'],
      feedTags: ['Education'],
      neighbours: ['path-health', 'path-policy'],
      hue: '#1098ad',
    },
  },
  {
    key: 'media',
    group: 'Media and creative',
    title: 'Journalism and media',
    oneLine: 'Report, write and produce stories that inform the public.',
    whyItFits:
      'Fits students who are curious, like talking to strangers and write quickly. Editors hire on published stories, so the student paper is the usual start.',
    expects: ['Published stories', 'Interviewing and fact checking', 'Writing on deadline'],
    firstSteps: ['Join the student paper', 'Publish three reported stories', 'Learn basic audio or video'],
    goal: 'Newsroom internship, summer 2027',
    summary:
      'Newsrooms hire on clips: stories you reported and got published. Write for the student paper every week, and add one audio or video skill.',
    requirements: [
      ['Published stories', null, 'clips'],
      ['Writing on deadline', 'Writing', 'paper'],
      ['Interviewing and fact checking', null, 'interview'],
      ['Audio or video basics', 'Video editing', 'multimedia'],
      ['A simple portfolio of clips', null, 'portfolio'],
      ['Applications sent before the deadlines', null, 'apply'],
    ],
    phases: [
      {
        title: 'Start reporting',
        window: 'Now through December',
        steps: [
          ['paper', 'join', 'Join the student paper', 'Editors give new writers stories every week. Say yes to the ones nobody else wants at first.', 'opp-student-paper', 5, 4],
          ['interview', 'learn', 'Practice interviewing and checking facts', 'Record, take notes, and confirm every name and number before you file.', null, 21, 4],
          ['clips', 'build', 'Publish three reported stories', 'Reported means you talked to people, not only read about it.', null, 40, 12],
        ],
      },
      {
        title: 'Add skills',
        window: 'December through February',
        steps: [
          ['multimedia', 'learn', 'Learn basic audio or video editing', 'Many newsrooms want stories in more than one form. Free editing apps are enough to start.', null, 35, 8],
          ['data', 'learn', 'Learn to find a story in a spreadsheet', 'Public data sets hold many local stories. Sorting and simple charts get you far.', null, 50, 6],
          ['portfolio', 'build', 'Put your clips on one simple page', 'Your best three first, with a line on how you reported each.', null, 55, 3],
        ],
      },
      {
        title: 'Apply',
        window: 'January through March',
        steps: [
          ['newsroom', 'apply', 'Apply to The Bay Ledger', 'Send your three best clips. Editors read the first paragraph of each closely.', 'opp-newsroom', 20, 2],
          ['scholarship', 'apply', 'Apply for the creative scholarship', 'It funds students in writing and media as well as the arts.', 'opp-creative-scholarship', 30, 3],
          ['apply', 'apply', 'Send applications to six outlets', 'Local papers, public radio and online outlets all take summer interns.', null, 60, 6],
        ],
      },
    ],
    profiles: [
      ['Reporting intern, city newspaper', 'Junior', ['Student paper, weekly stories', 'Ten published clips', 'Clips page', 'Applied in December'], ['paper', 'clips', 'portfolio', 'newsroom', 'apply']],
      ['Audio intern, public radio station', 'Sophomore', ['Student radio', 'Audio editing', 'Three published stories'], ['multimedia', 'clips', 'interview', 'apply']],
      ['Data reporting intern, news site', 'Junior', ['Student paper', 'Spreadsheet reporting', 'Clips page', 'Applied to eight outlets'], ['paper', 'data', 'portfolio', 'apply']],
      ['Video producer intern, local TV news', 'Junior', ['Video editing', 'Student paper', 'Published stories'], ['multimedia', 'paper', 'clips']],
      ['Editorial intern, magazine', 'Sophomore', ['Student paper', 'Interview practice', 'Creative scholarship'], ['paper', 'interview', 'scholarship', 'apply']],
      ['Social video intern, digital outlet', 'Sophomore', ['Video editing', 'Clips page', 'Applied in January'], ['multimedia', 'portfolio', 'apply']],
      ['News intern, wire service', 'Senior', ['Student paper editor', 'Fifteen published clips', 'Fact checking'], ['paper', 'clips', 'interview', 'newsroom']],
      ['Communications intern, museum', 'Junior', ['Student paper', 'Published features', 'Clips page'], ['paper', 'clips', 'portfolio']],
      ['Podcast production intern', 'Sophomore', ['Audio editing', 'Interview practice', 'Published episodes'], ['multimedia', 'interview', 'clips']],
    ],
    extra: {
      work: 'You find stories, interview people, check facts and write or produce pieces on deadline. Editors and producers shape the work with you before it goes out.',
      week: [
        ['Reporting and interviews', 'most'],
        ['Writing and editing', 'some'],
        ['Pitching story ideas', 'some'],
        ['Audio, video and social posts', 'little'],
      ],
      pace: 'Daily deadlines for news, with longer projects running underneath.',
      paceShort: 'Daily deadlines',
      skills: [
        ['Writing on deadline', 'core', 'Writing', 'paper'],
        ['Interviewing and fact checking', 'core', null, 'interview'],
        ['Published stories', 'core', null, 'clips'],
        ['Audio or video editing', 'useful', 'Video editing', 'multimedia'],
        ['Finding stories in data', 'useful', 'Data analysis', 'data'],
      ],
      interests: ['Writing and journalism', 'Film and music', 'Law and policy', 'International relations'],
      feedTags: ['Media', 'Writing'],
      neighbours: ['path-marketing', 'path-policy'],
      hue: '#343a40',
    },
  },
  {
    key: 'mecheng',
    group: 'Science, engineering and health',
    title: 'Mechanical and aerospace engineering',
    oneLine: 'Design, build and test machines, vehicles and the parts inside them.',
    whyItFits:
      'Fits students who like math, taking things apart and building with their hands. A student build team is where most engineering interns make their first real parts.',
    expects: ['Statics and dynamics', 'Computer-aided design', 'A part you designed, built and tested'],
    firstSteps: ['Join a build team', 'Learn a CAD tool', 'Get trained in the student machine shop'],
    goal: 'Mechanical engineering internship, summer 2027',
    summary:
      'Engineering employers look for coursework plus proof you have designed and built real parts. A build team gives you both, and the shop skills to go with them.',
    requirements: [
      ['Statics and dynamics', null, 'courses'],
      ['Computer-aided design', null, 'cad'],
      ['Machine shop training', null, 'shop'],
      ['A part you designed, built and tested', null, 'part'],
      ['Analysis of test results', 'Data analysis', 'testing'],
      ['Applications sent before spring', null, 'apply'],
    ],
    phases: [
      {
        title: 'Learn the tools',
        window: 'Now through December',
        steps: [
          ['courses', 'learn', 'Keep statics and dynamics on track', 'Interviews ask you to draw the forces on a simple part. Practice by hand.', null, null, 10],
          ['cad', 'learn', 'Learn one CAD tool', 'Model three parts you can hold. Most student licences are free.', null, 28, 10],
          ['shop', 'learn', 'Get trained in the student machine shop', 'Safety training lets you make your own parts instead of waiting on someone else.', null, 14, 4],
        ],
      },
      {
        title: 'Build something',
        window: 'December through February',
        steps: [
          ['team', 'join', 'Join the racing team', 'Build teams give new members a real part of the car and a deadline.', 'opp-racing-team', 7, 6],
          ['part', 'build', 'Design, build and test one part', 'Write down what you expected, what you measured and what you changed.', null, 60, 12],
          ['testing', 'learn', 'Analyze your test data', 'A spreadsheet or Python is enough. Plots with units and error bars make results believable.', null, 70, 6],
        ],
      },
      {
        title: 'Apply',
        window: 'January through March',
        steps: [
          ['kestrel', 'apply', 'Apply to Kestrel Aerospace', 'Mention the part you built and what testing taught you.', 'opp-kestrel-mech', 20, 2],
          ['fair', 'attend', 'Meet engineering employers at the all-majors fair', 'Bring a photo of your part on your phone. It starts better conversations than a resume.', 'opp-allmajors-fair', 40, 3],
          ['apply', 'apply', 'Send applications to ten companies', 'Aerospace, automotive, energy and product companies all hire mechanical interns.', null, 55, 8],
        ],
      },
    ],
    profiles: [
      ['Mechanical engineering intern, aerospace company', 'Junior', ['Statics and dynamics', 'Rocket team, two years', 'Designed a fin bracket', 'Applied in October'], ['courses', 'team', 'part', 'cad', 'apply']],
      ['Design intern, electric vehicle company', 'Junior', ['CAD course', 'Racing team suspension group', 'Machine shop training'], ['cad', 'team', 'shop', 'part', 'kestrel']],
      ['Test engineering intern, robotics company', 'Sophomore', ['Statics', 'Machine shop training', 'Test data analysis', 'All-majors fair'], ['courses', 'shop', 'testing', 'fair', 'apply']],
      ['Manufacturing intern, medical device company', 'Junior', ['Machine shop training', 'CAD', 'Applied to twelve companies'], ['shop', 'cad', 'apply']],
      ['Mechanical intern, energy company', 'Senior', ['Statics and dynamics', 'Build team', 'Part testing'], ['courses', 'team', 'part', 'testing']],
      ['Product design intern, consumer hardware', 'Sophomore', ['CAD', 'Designed and printed a part', 'All-majors fair'], ['cad', 'part', 'fair']],
      ['Propulsion intern, launch company', 'Junior', ['Dynamics', 'Rocket team', 'CAD', 'Test data analysis'], ['courses', 'team', 'cad', 'testing', 'apply']],
      ['Field engineering intern, construction equipment maker', 'Junior', ['Statics', 'Machine shop training', 'Build team'], ['courses', 'shop', 'team', 'apply']],
      ['Research intern, university engineering lab', 'Sophomore', ['Statics', 'CAD', 'Designed a test fixture'], ['courses', 'cad', 'part']],
    ],
    extra: {
      work: 'You design parts and machines, model them on a computer, build prototypes and test whether they hold up. Much of the work is careful calculation and fixing what the test shows.',
      week: [
        ['Design and CAD', 'most'],
        ['Building and testing', 'some'],
        ['Analysis and calculations', 'some'],
        ['Design reviews with the team', 'little'],
      ],
      pace: 'Long design cycles, with testing weeks that move fast.',
      paceShort: 'Long build cycles',
      skills: [
        ['Statics and dynamics', 'core', null, 'courses'],
        ['Computer-aided design', 'core', null, 'cad'],
        ['A part you built and tested', 'core', null, 'part'],
        ['Machine shop training', 'useful', null, 'shop'],
        ['Analyzing test data in Python or a spreadsheet', 'useful', 'Python', 'testing'],
      ],
      interests: ['Mechanical and civil engineering', 'Robotics', 'Environment and sustainability'],
      feedTags: ['Mechanical engineering', 'Hardware'],
      neighbours: ['path-swe', 'path-research'],
      hue: '#d9480f',
    },
  },
];

const pathId = (spec: FieldSpec) => `path-${spec.key}`;
const stepId = (spec: FieldSpec, key: string) => `step-${spec.key}-${key}`;
const maybeStep = (spec: FieldSpec, key: string | null) => (key === null ? null : stepId(spec, key));

export const fieldPaths: CareerPath[] = specs.map((spec) => ({
  id: pathId(spec),
  title: spec.title,
  oneLine: spec.oneLine,
  // The agents' first read for the sample student, whose profile is all technology.
  match: 'explore',
  whyItFits: spec.whyItFits,
  expects: spec.expects,
  firstSteps: spec.firstSteps,
  group: spec.group,
}));

export const fieldRoadmaps: Roadmap[] = specs.map((spec) => ({
  goalId: pathId(spec),
  goal: spec.goal,
  summary: spec.summary,
  requirements: spec.requirements.map(
    ([label, skill, step], index): Requirement => ({ id: `req-${spec.key}-${index + 1}`, label, skill, stepId: maybeStep(spec, step) }),
  ),
  phases: spec.phases.map((phase, index) => ({
    id: `phase-${spec.key}-${index + 1}`,
    title: phase.title,
    window: phase.window,
    steps: phase.steps.map(([key, kind, title, detail, opportunityId, due]) => ({
      id: stepId(spec, key),
      kind,
      title,
      detail,
      opportunityId,
      due: due === null ? null : inDays(due),
    })),
  })),
}));

export const fieldProfiles: PathProfile[] = specs.flatMap((spec) =>
  spec.profiles.map(([outcome, year, timeline, did], index) => ({
    id: `profile-${spec.key}-${index + 1}`,
    goalId: pathId(spec),
    outcome,
    year,
    timeline,
    did: did.map((key) => stepId(spec, key)),
  })),
);

export const fieldExtras: PathExtra[] = specs.map((spec) => ({
  pathId: pathId(spec),
  work: spec.extra.work,
  week: spec.extra.week.map(([activity, share]) => ({ activity, share })),
  pace: spec.extra.pace,
  paceShort: spec.extra.paceShort,
  skills: spec.extra.skills.map(([label, importance, profileSkill, step]) => ({ label, importance, profileSkill, stepId: maybeStep(spec, step) })),
  interests: spec.extra.interests,
  feedTags: spec.extra.feedTags,
  neighbours: spec.extra.neighbours,
  hue: spec.extra.hue,
}));

/** Rough hours for every step of these paths, in the same form as `stepHours`. */
export const fieldStepHours: Record<string, number> = Object.fromEntries(
  specs.flatMap((spec) => spec.phases.flatMap((phase) => phase.steps.map((step): [string, number] => [stepId(spec, step[0]), step[6]]))),
);
