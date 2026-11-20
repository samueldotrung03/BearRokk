// Sample career guides for the public showcase copy of the dashboard, which has no backend.
// They are written by hand, not researched by the agents: every guide is marked as simulated,
// the stories in "What people in the job say" are by made-up people and marked as samples,
// and pay and outlook are left unknown because no source stands behind a figure.
import type { Basics, Guide, GuideSummary, Interview, SectionState, Start, Voices } from '../lib/discover/guide.ts';

const AT = '2026-11-19T12:00:00.000Z';

const done = <T,>(data: T, sample = false): SectionState<T> => ({ status: 'done', data, sample, error: null, added: null });

type Post = Voices['posts'][number];
const post = (author: string, role: string, handle: string, topic: Post['topic'], text: string, takeaway: string): Post => ({
  author,
  role,
  handle,
  text,
  takeaway,
  topic,
  url: null,
  date: null,
});

const guide = (
  slug: string,
  title: string,
  oneLine: string,
  field: string,
  basics: Basics,
  voices: Voices,
  interview: Interview,
  start: Start,
): Guide => ({
  slug,
  query: title,
  title,
  oneLine,
  field,
  status: 'ready',
  provider: 'simulated',
  startedAt: AT,
  updatedAt: AT,
  error: null,
  sections: { basics: done(basics), voices: done(voices, true), interview: done(interview), start: done(start) },
  asks: [],
  activity: [],
});

const softwareEngineer = guide(
  'software-engineering',
  'Software engineer',
  'Designs, builds and maintains the software behind apps, websites and services.',
  'Computing',
  {
    summary:
      'Software engineers turn ideas into working programs, then keep them fast, safe and easy to change. Most of the job is reading code, writing small changes, testing them and working with a team on what to build next.',
    dayInLife: [
      'A short morning check-in with the team about what each person is working on.',
      'A few hours writing code and tests for one feature or bug fix.',
      'Reviewing a teammate\'s code change and leaving comments.',
      'Looking into a problem reported by users and finding its cause.',
    ],
    whatTheyDo: [
      'Write and test code for new features.',
      'Find and fix bugs in existing programs.',
      'Review other engineers\' code before it is merged.',
      'Design how parts of a system fit together.',
      'Keep services running and fix them when they break.',
    ],
    whereTheyWork: [
      'Software and internet companies of every size.',
      'Banks, hospitals, retailers and other businesses with in-house tech teams.',
      'Government agencies and research labs.',
      'Startups, often in small teams where each person covers a lot.',
    ],
    specialties: [
      { name: 'Backend', what: 'Builds the servers, databases and APIs that apps talk to.' },
      { name: 'Frontend', what: 'Builds the pages and screens people see and click.' },
      { name: 'Infrastructure', what: 'Runs the machines, deploys and tools other engineers rely on.' },
    ],
    skills: [
      { name: 'Python', kind: 'tool' },
      { name: 'Java', kind: 'tool' },
      { name: 'Git', kind: 'tool' },
      { name: 'SQL', kind: 'tool' },
      { name: 'Data structures and algorithms', kind: 'knowledge' },
      { name: 'Unit testing', kind: 'method' },
      { name: 'Code review', kind: 'method' },
      { name: 'REST APIs', kind: 'knowledge' },
      { name: 'Linux command line', kind: 'tool' },
    ],
    education: 'Often a degree in computer science or a related field, though some engineers come from bootcamps or teach themselves.',
    pay: null,
    outlook: null,
    sources: [],
  },
  {
    summary:
      'These sample engineers all say that building real projects taught them more than any single course. They also agree that reading other people\'s code and asking good questions matters as much as writing your own.',
    posts: [
      post('Maya Lindqvist', 'Backend engineer', '@sample_dev1', 'getting in', 'My first internship came from a small project I actually used every day, not from a long list of tutorials. Interviewers asked about it for most of the call.', 'One project you use and can explain in depth beats many unfinished ones.'),
      post('Tomas Reyes', 'Frontend engineer', '@sample_dev2', 'the work', 'Most of my week is reading code someone else wrote and figuring out where my change fits. Getting comfortable in a big codebase was the real learning curve.', 'Practice reading unfamiliar code, not only writing new code.'),
      post('Priya Anand', 'New graduate engineer', '@sample_dev3', 'advice', 'I practiced interview problems out loud with a friend every week. Explaining my thinking while coding felt awkward at first and then became normal.', 'Practice talking through problems, not only solving them.'),
      post('Jonah Okafor', 'Infrastructure engineer', '@sample_dev4', 'the work', 'When something breaks, the first job is to read the logs calmly and write down what you know. Guessing and changing things at random makes it worse.', 'Debugging is a careful, step-by-step skill you can practice.'),
    ],
  },
  {
    formats: [
      { name: 'Online assessment', tests: 'Solving one to three coding problems on your own within a time limit.', howToPractice: 'Do timed practice problems on arrays, strings, hash maps and trees.', url: null },
      { name: 'Coding interview', tests: 'Solving a problem live while explaining your thinking to an interviewer.', howToPractice: 'Solve problems out loud with a friend or a recording, and test your code by hand.', url: null },
      { name: 'System design', tests: 'Sketching how a larger service would work and the tradeoffs involved.', howToPractice: 'Walk through how a simple app like a link shortener stores and serves data.', url: null },
      { name: 'Behavioral interview', tests: 'How you work with others, handle problems and learn from mistakes.', howToPractice: 'Write short stories from projects and classes using situation, action and result.', url: null },
    ],
    questions: [
      { kind: 'Online assessment', question: 'Given a list of numbers, return the two that add up to a target.', tip: 'A hash map turns the slow nested loop into one pass.' },
      { kind: 'Coding interview', question: 'Check whether a string of brackets is balanced.', tip: 'Say out loud why a stack fits before you write code.' },
      { kind: 'Coding interview', question: 'Find the depth of a binary tree.', tip: 'Start with the recursive version, then mention the iterative one.' },
      { kind: 'System design', question: 'How would you design a service that shortens long links?', tip: 'Ask how many users it serves before choosing storage.' },
      { kind: 'Behavioral interview', question: 'Tell me about a time a project did not go as planned.', tip: 'Spend most of the answer on what you did and what changed after.' },
      { kind: 'Behavioral interview', question: 'Why do you want to work on software?', tip: 'Point to a real project or moment, not a general statement.' },
    ],
    sources: [],
  },
  {
    steps: [
      { title: 'Learn one language well', detail: 'Pick Python or Java and work through a full tutorial, writing every example yourself.', when: 'First month', resource: { title: 'The Python Tutorial', url: 'https://docs.python.org/3/tutorial/' }, prepares: ['Online assessment'] },
      { title: 'Learn the command line and Git', detail: 'Get comfortable with the terminal, a text editor and saving your work with Git.', when: 'Alongside the language', resource: { title: 'The Missing Semester of Your CS Education', url: 'https://missing.csail.mit.edu' }, prepares: ['Coding interview'] },
      { title: 'Practice data structures and algorithms', detail: 'Solve a few problems each week on arrays, hash maps, stacks, trees and graphs, timing yourself.', when: 'Every week from the second month', resource: null, prepares: ['Online assessment'] },
      { title: 'Build one real project', detail: 'Make something you would use yourself, put it on GitHub with a clear README, and be ready to explain every part.', when: 'Over a few months', resource: null, prepares: ['Behavioral interview'] },
      { title: 'Practice explaining your code out loud', detail: 'Solve problems while talking through your thinking, with a friend or a recording.', when: 'Before applying', resource: null, prepares: ['Coding interview'] },
      { title: 'Read about how larger systems work', detail: 'Learn what servers, databases, caches and APIs do and how they connect.', when: 'Before interviews for internships or new graduate roles', resource: { title: 'roadmap.sh', url: 'https://roadmap.sh' }, prepares: ['System design'] },
    ],
    resources: [
      { title: 'The Missing Semester of Your CS Education', url: 'https://missing.csail.mit.edu', kind: 'course', free: true },
      { title: 'freeCodeCamp', url: 'https://www.freecodecamp.org', kind: 'course', free: true },
      { title: 'roadmap.sh', url: 'https://roadmap.sh', kind: 'site', free: true },
    ],
  },
);

const dataEngineer = guide(
  'data-engineering',
  'Data engineer',
  'Builds the pipelines and storage that move data to the people and tools who use it.',
  'Data',
  {
    summary:
      'Data engineers collect data from many places, clean it and store it so analysts and machine learning teams can trust it. The work is part software engineering and part databases, with a lot of attention to data being correct and on time.',
    dayInLife: [
      'Checking that last night\'s data jobs finished and fixing any that failed.',
      'Writing SQL and Python to add a new data source to a pipeline.',
      'Meeting with analysts to understand what tables they need.',
      'Testing that numbers match between the source and the warehouse.',
    ],
    whatTheyDo: [
      'Build pipelines that move data from apps and services into a warehouse.',
      'Design tables so data is easy and fast to query.',
      'Write checks that catch missing or wrong data.',
      'Schedule and monitor jobs that run every hour or every day.',
      'Help analysts and data scientists find and use the right data.',
    ],
    whereTheyWork: [
      'Tech companies with large amounts of user data.',
      'Banks, insurers and retailers that report on sales and risk.',
      'Hospitals and research groups that handle large datasets.',
    ],
    specialties: [
      { name: 'Analytics engineering', what: 'Shapes warehouse tables for reports and dashboards.' },
      { name: 'Streaming', what: 'Handles data that arrives continuously, second by second.' },
      { name: 'Data platform', what: 'Runs the shared tools and storage other data teams build on.' },
    ],
    skills: [
      { name: 'SQL', kind: 'tool' },
      { name: 'Python', kind: 'tool' },
      { name: 'Apache Spark', kind: 'tool' },
      { name: 'Apache Airflow', kind: 'tool' },
      { name: 'Data modeling', kind: 'method' },
      { name: 'ETL and ELT pipelines', kind: 'method' },
      { name: 'Data warehouses', kind: 'knowledge' },
      { name: 'Data quality testing', kind: 'method' },
      { name: 'Cloud storage', kind: 'knowledge' },
    ],
    education: 'Often a degree in computer science, statistics or a related field; many move over from software or analyst roles.',
    pay: null,
    outlook: null,
    sources: [],
  },
  {
    summary:
      'These sample data engineers say strong SQL is the skill they use most every day. They also say the job is mostly about trust, so careful checks on data matter more than clever code.',
    posts: [
      post('Elena Vasquez', 'Data engineer', '@sample_data1', 'the work', 'I write more SQL than anything else, even with fancy tools around it. Getting really good at joins and window functions paid off fast.', 'Strong SQL is the core of the job.'),
      post('Sam Whitfield', 'Analytics engineer', '@sample_data2', 'getting in', 'I started as an analyst and kept automating my own reports until it became my job. Moving over from inside the company was easier than applying cold.', 'Analyst roles can be a path into data engineering.'),
      post('Aisha Bello', 'Data platform engineer', '@sample_data3', 'advice', 'Build one small pipeline end to end, from a public dataset to a table you can query. Interviewers wanted to hear how I handled bad rows.', 'An end-to-end project shows you understand the whole flow.'),
      post('Lucas Moreau', 'Junior data engineer', '@sample_data4', 'the work', 'The worst days are when a dashboard shows wrong numbers and nobody knows why. Writing checks early saves those days.', 'Data quality checks are part of the work, not an extra.'),
    ],
  },
  {
    formats: [
      { name: 'SQL screen', tests: 'Writing queries with joins, grouping and window functions on sample tables.', howToPractice: 'Do interactive SQL lessons, then write queries on a public dataset.', url: null },
      { name: 'Coding interview', tests: 'Solving a data-shaped problem in Python, such as parsing or grouping records.', howToPractice: 'Practice reading files, using dictionaries and handling messy input in Python.', url: null },
      { name: 'Data modeling', tests: 'Designing tables for a business, such as orders and customers, and explaining choices.', howToPractice: 'Sketch tables for an app you know and explain how a report would query them.', url: null },
      { name: 'Behavioral interview', tests: 'How you handle broken data, deadlines and working with analysts.', howToPractice: 'Prepare short stories about fixing a data problem and working with others.', url: null },
    ],
    questions: [
      { kind: 'SQL screen', question: 'Find the top three customers by total spending in each month.', tip: 'A window function with a rank keeps this to one query.' },
      { kind: 'SQL screen', question: 'Find users who signed up but never placed an order.', tip: 'Explain why you chose a left join or NOT EXISTS.' },
      { kind: 'Coding interview', question: 'Read a file of log lines and count errors by hour.', tip: 'Mention how you would handle lines that do not parse.' },
      { kind: 'Data modeling', question: 'Design tables for an online store\'s orders and returns.', tip: 'Start from the questions the business will ask of the data.' },
      { kind: 'Data modeling', question: 'When would you keep a full history of changes to a table?', tip: 'Give a concrete example, such as a customer changing address.' },
      { kind: 'Behavioral interview', question: 'Tell me about a time you found wrong data.', tip: 'Describe how you found the cause and what you changed so it would not repeat.' },
    ],
    sources: [],
  },
  {
    steps: [
      { title: 'Learn SQL', detail: 'Work through interactive lessons on selecting, joining and grouping data.', when: 'First month', resource: { title: 'SQLBolt', url: 'https://sqlbolt.com' }, prepares: ['SQL screen'] },
      { title: 'Learn Python for data', detail: 'Learn the basics of Python, then practice reading files and grouping records.', when: 'Alongside SQL', resource: { title: 'The Python Tutorial', url: 'https://docs.python.org/3/tutorial/' }, prepares: ['Coding interview'] },
      { title: 'Practice harder SQL', detail: 'Write queries with window functions and subqueries on a public dataset.', when: 'Second and third month', resource: null, prepares: ['SQL screen'] },
      { title: 'Learn how tables are designed', detail: 'Read about fact and dimension tables and sketch a design for an app you know.', when: 'After you are comfortable with SQL', resource: null, prepares: ['Data modeling'] },
      { title: 'Build one pipeline end to end', detail: 'Load a public dataset, clean it, store it in a database and add checks for bad rows.', when: 'Over a few months', resource: null, prepares: ['Behavioral interview'] },
      { title: 'Learn the command line and Git', detail: 'Get comfortable running scripts, scheduling jobs and keeping your project in Git.', when: 'Before applying', resource: { title: 'The Missing Semester of Your CS Education', url: 'https://missing.csail.mit.edu' }, prepares: ['Coding interview'] },
    ],
    resources: [
      { title: 'SQLBolt', url: 'https://sqlbolt.com', kind: 'practice', free: true },
      { title: 'The Python Tutorial', url: 'https://docs.python.org/3/tutorial/', kind: 'course', free: true },
      { title: 'roadmap.sh', url: 'https://roadmap.sh', kind: 'site', free: true },
    ],
  },
);

const productManager = guide(
  'product-management',
  'Product manager',
  'Decides what a product should do next and leads the team that builds it.',
  'Business and technology',
  {
    summary:
      'Product managers figure out what problems users have and decide which ones the team should solve first. They do not usually write the code, but they work closely with engineers and designers every day to ship the right thing.',
    dayInLife: [
      'Reading user feedback and usage numbers to spot problems.',
      'Writing a short document that explains a new feature and why it matters.',
      'Meeting with engineers and designers to agree on what gets built this cycle.',
      'Talking with a few users to test an idea before the team builds it.',
    ],
    whatTheyDo: [
      'Talk with users to understand their problems.',
      'Decide which features to build first and explain why.',
      'Write clear requirements for engineers and designers.',
      'Track whether a launched feature actually helped users.',
      'Keep the team and other groups informed about plans and changes.',
    ],
    whereTheyWork: [
      'Software and internet companies.',
      'Companies that make physical products with software inside them.',
      'Banks, retailers and health companies with digital products.',
      'Startups, where the role often mixes with design or operations.',
    ],
    specialties: [
      { name: 'Technical product manager', what: 'Works on products for developers, such as APIs and platforms.' },
      { name: 'Growth product manager', what: 'Focuses on helping more people find, start and keep using a product.' },
      { name: 'Consumer product manager', what: 'Works on apps that everyday people use directly.' },
    ],
    skills: [
      { name: 'User research', kind: 'method' },
      { name: 'Product requirements documents', kind: 'method' },
      { name: 'A/B testing', kind: 'method' },
      { name: 'Prioritization frameworks', kind: 'method' },
      { name: 'SQL', kind: 'tool' },
      { name: 'Wireframing', kind: 'method' },
      { name: 'Product metrics', kind: 'knowledge' },
      { name: 'Agile and Scrum', kind: 'knowledge' },
    ],
    education: 'There is no single path; product managers come from computer science, business, design and many other majors.',
    pay: null,
    outlook: null,
    sources: [],
  },
  {
    summary:
      'These sample product managers say the job is mostly listening, writing and making tradeoffs clear. They agree that showing you have shipped something, even a small side project, helps you get in.',
    posts: [
      post('Rachel Kim', 'Product manager', '@sample_pm1', 'the work', 'Half my job is writing things down clearly so the whole team agrees on what we are building. A short, clear document saves weeks of confusion.', 'Clear writing is one of the most used skills.'),
      post('Daniel Osei', 'Associate product manager', '@sample_pm2', 'getting in', 'I got my first role after running a small app with real users in college. Interviewers cared most about how I decided what to fix first.', 'Shipping something with real users is strong proof.'),
      post('Nora Halvorsen', 'Growth product manager', '@sample_pm3', 'advice', 'Learn enough SQL to answer your own questions about the data. You will make better calls when you do not have to wait for someone else.', 'Basic SQL makes a product manager more independent.'),
      post('Marcus Bell', 'Technical product manager', '@sample_pm4', 'the work', 'Saying no to good ideas is the hardest part. I explain the tradeoff and what we would give up, and people usually understand.', 'Prioritizing means explaining tradeoffs, not only choosing.'),
    ],
  },
  {
    formats: [
      { name: 'Product sense', tests: 'Designing or improving a product for a group of users and explaining your choices.', howToPractice: 'Pick an app you use, name its users and their problems, and propose one improvement.', url: null },
      { name: 'Analytical interview', tests: 'Choosing metrics and working through a drop or change in numbers.', howToPractice: 'Practice explaining which numbers you would watch for a feature and why.', url: null },
      { name: 'Technical interview', tests: 'Understanding how software is built well enough to work with engineers.', howToPractice: 'Learn the basics of how apps, servers and databases connect.', url: null },
      { name: 'Behavioral interview', tests: 'Leading without authority, handling disagreement and learning from failure.', howToPractice: 'Write short stories from team projects about decisions you made and why.', url: null },
    ],
    questions: [
      { kind: 'Product sense', question: 'How would you improve a library app for students?', tip: 'Choose one group of users and one problem before listing features.' },
      { kind: 'Product sense', question: 'Design a product to help people cook at home more often.', tip: 'Say how you would test the idea before building it.' },
      { kind: 'Analytical interview', question: 'Daily sign-ups dropped sharply last week. How would you find out why?', tip: 'Check for a tracking or data problem before assuming users changed.' },
      { kind: 'Analytical interview', question: 'What would you measure to know if a new search feature works?', tip: 'Pair one main metric with one that warns you of harm.' },
      { kind: 'Technical interview', question: 'Explain what happens when someone opens a web page.', tip: 'Keep it simple and in order: request, server, response, page.' },
      { kind: 'Behavioral interview', question: 'Tell me about a time you disagreed with a teammate.', tip: 'Show how you listened and how the decision was made.' },
    ],
    sources: [],
  },
  {
    steps: [
      { title: 'Study products you use', detail: 'Pick three apps and write down who they serve, what problem they solve and one thing you would change.', when: 'First month', resource: null, prepares: ['Product sense'] },
      { title: 'Learn basic SQL', detail: 'Work through interactive lessons so you can answer simple questions about data yourself.', when: 'First and second month', resource: { title: 'SQLBolt', url: 'https://sqlbolt.com' }, prepares: ['Analytical interview'] },
      { title: 'Learn how software is built', detail: 'Learn the basics of web pages, servers, databases and APIs.', when: 'Alongside SQL', resource: { title: 'freeCodeCamp', url: 'https://www.freecodecamp.org' }, prepares: ['Technical interview'] },
      { title: 'Ship a small project with real users', detail: 'Build or run something small, such as a club tool or simple app, and improve it from feedback.', when: 'Over a few months', resource: null, prepares: ['Behavioral interview'] },
      { title: 'Practice product questions out loud', detail: 'Answer one product design question a week with a friend, using a clear structure.', when: 'Before applying', resource: null, prepares: ['Product sense'] },
      { title: 'Practice metric questions', detail: 'For features you know, write down what you would measure and how you would explain a sudden drop.', when: 'Before applying', resource: null, prepares: ['Analytical interview'] },
    ],
    resources: [
      { title: 'SQLBolt', url: 'https://sqlbolt.com', kind: 'practice', free: true },
      { title: 'freeCodeCamp', url: 'https://www.freecodecamp.org', kind: 'course', free: true },
      { title: 'roadmap.sh', url: 'https://roadmap.sh', kind: 'site', free: true },
    ],
  },
);

export const sampleGuides: Guide[] = [softwareEngineer, dataEngineer, productManager];

export const sampleGuideList: GuideSummary[] = sampleGuides.map(({ slug, title, oneLine, updatedAt, status }) => ({
  slug,
  title,
  oneLine,
  updatedAt,
  status,
}));
