// Sample opportunities outside technology, so the feed serves students in every field, and the
// record of which career paths each sample opportunity leads toward. Invented data, like
// sample.ts: every organization is made up and every link points to example.org.
import type {
  ApplicationInfo,
  Opportunity,
  OpportunityType,
} from "../types.ts";

const HOUR = 3_600_000;
const DAY = 24 * HOUR;
const now = Date.now();
const inDays = (days: number) => new Date(now + days * DAY).toISOString();
const hoursAgo = (hours: number) => new Date(now - hours * HOUR).toISOString();
const link = (slug: string) => `https://example.org/${slug}`;
// Free stock clips from Mixkit, standing in for a posting's own video.
const clip = (id: number) =>
  `https://assets.mixkit.co/videos/${id}/${id}-720.mp4`;
const still = (id: number) =>
  `https://assets.mixkit.co/videos/${id}/${id}-thumb-720-0.jpg`;

/** Stock footage by subject. Cards on the same subject take turns through the list. */
const footage = {
  hospital: [29933, 5553],
  lab: [23618, 6412],
  finance: [45706, 42648],
  meeting: [9124, 5609],
  civic: [16104, 15858],
  design: [14636],
  classroom: [14955],
  writing: [23082, 24357],
  workshop: [44728, 34519, 29997],
  campus: [4503],
  volunteers: [46003, 33621],
};

interface Spec {
  id: string;
  type: OpportunityType;
  title: string;
  organizer: string;
  format: Opportunity["format"];
  location: string;
  fit: string;
  /** Days until the deadline, or null when the posting names none. */
  due: number | null;
  /** Days until it starts, for events. */
  starts?: number;
  footage: keyof typeof footage;
  tags: string[];
  score: number;
  foundHoursAgo: number;
  /** Career paths this leads toward. Empty means it is open to any field. */
  paths: string[];
  prompts?: string[];
  materials?: string[];
}

const specs: Spec[] = [
  {
    id: "opp-mercy-clinical",
    type: "internship",
    title: "Summer Clinical Internship",
    organizer: "Mercy Bay Hospital",
    format: "in_person",
    location: "Oakland, CA",
    fit: "Eight weeks rotating through three units with a nurse or physician mentor. Open to any major on a pre-health track, and no clinical experience is asked for.",
    due: 12,
    footage: "hospital",
    tags: ["Healthcare", "Patient contact", "Paid"],
    score: 0.84,
    foundHoursAgo: 4,
    paths: ["path-health"],
    prompts: [
      "Why do you want to work with patients? (250 words)",
      "Tell us about a time you cared for someone. (200 words)",
    ],
    materials: ["Resume (PDF)", "Unofficial transcript", "Immunization record"],
  },
  {
    id: "opp-premed-society",
    type: "club",
    title: "Pre-Health Society",
    organizer: "Pre-Health Society",
    format: "in_person",
    location: "Berkeley, CA",
    fit: "Weekly meetings with shadowing sign-ups, admissions panels and a study group for the entrance exam. Members say it is where they found their first shadowing hours.",
    due: null,
    starts: 6,
    footage: "hospital",
    tags: ["Healthcare", "Shadowing", "No application"],
    score: 0.78,
    foundHoursAgo: 20,
    paths: ["path-health"],
  },
  {
    id: "opp-bio-lab",
    type: "research",
    title: "Undergraduate Research Assistant",
    organizer: "Hale Cell Biology Lab",
    format: "in_person",
    location: "Berkeley, CA",
    fit: "Ten hours a week preparing samples and recording results. The lab trains new assistants from scratch and asks only for one biology or chemistry course.",
    due: 18,
    footage: "lab",
    tags: ["Life sciences", "Research", "For credit"],
    score: 0.83,
    foundHoursAgo: 9,
    paths: ["path-research", "path-health"],
    prompts: [
      "Which question in biology would you most like to answer, and why? (200 words)",
    ],
    materials: ["Resume (PDF)", "Unofficial transcript"],
  },
  {
    id: "opp-harlow-finance",
    type: "internship",
    title: "Summer Analyst",
    organizer: "Harlow Capital",
    format: "in_person",
    location: "San Francisco, CA",
    fit: "A ten-week analyst program that takes sophomores and juniors from any major. The posting asks for comfort with spreadsheets and one accounting or economics course.",
    due: 10,
    footage: "finance",
    tags: ["Finance", "Excel", "Paid"],
    score: 0.82,
    foundHoursAgo: 3,
    paths: ["path-finance"],
    prompts: [
      "Walk us through a company or market you follow and why. (250 words)",
    ],
    materials: ["Resume (PDF)", "Unofficial transcript"],
  },
  {
    id: "opp-case-comp",
    type: "hackathon",
    title: "Bay Case Competition",
    organizer: "Bay Business Collective",
    format: "in_person",
    location: "Berkeley, CA",
    fit: "Teams of four get a real company problem on Friday and present a recommendation on Sunday. First-timers get a coach, and no business coursework is needed.",
    due: 8,
    starts: 15,
    footage: "meeting",
    tags: ["Consulting", "Business", "Teams of 4"],
    score: 0.8,
    foundHoursAgo: 7,
    paths: ["path-consulting", "path-finance", "path-marketing"],
    materials: ['Team name or "looking for a team"'],
  },
  {
    id: "opp-consulting-club",
    type: "club",
    title: "Student Consulting Group",
    organizer: "Student Consulting Group",
    format: "in_person",
    location: "Berkeley, CA",
    fit: "Student teams take on a semester-long project for a local business or nonprofit. It is the most common first line on consulting resumes from this campus.",
    due: 14,
    footage: "meeting",
    tags: ["Consulting", "Business", "Client project"],
    score: 0.77,
    foundHoursAgo: 30,
    paths: ["path-consulting"],
    prompts: [
      "Tell us about a problem you solved for someone else. (200 words)",
    ],
    materials: ["Resume (PDF)"],
  },
  {
    id: "opp-brightside-marketing",
    type: "internship",
    title: "Marketing Intern",
    organizer: "Brightside Foods",
    format: "hybrid",
    location: "Emeryville, CA",
    fit: "You would plan and write a campaign with the brand team and see its results. They ask for writing samples, not a marketing degree.",
    due: 20,
    footage: "meeting",
    tags: ["Marketing", "Writing", "Social media"],
    score: 0.81,
    foundHoursAgo: 11,
    paths: ["path-marketing", "path-media"],
    prompts: ["Pick a campaign you admire. What made it work? (200 words)"],
    materials: ["Resume (PDF)", "Two writing or design samples"],
  },
  {
    id: "opp-civic-fellowship",
    type: "internship",
    title: "Eastbay Civic Fellowship",
    organizer: "Eastbay Civic Fund",
    format: "in_person",
    location: "Oakland, CA",
    fit: "A paid summer placement in a city department or a council office. Fellows write one policy memo that the office actually uses. Open to every major.",
    due: 22,
    footage: "civic",
    tags: ["Policy", "Government", "Paid"],
    score: 0.82,
    foundHoursAgo: 14,
    paths: ["path-policy"],
    prompts: ["Name one local problem you would work on and how. (300 words)"],
    materials: ["Resume (PDF)", "A writing sample of up to five pages"],
  },
  {
    id: "opp-prelaw-night",
    type: "event",
    title: "Law School Admissions Night",
    organizer: "Pre-Law Association",
    format: "in_person",
    location: "Berkeley, CA",
    fit: "Admissions officers and current law students answer questions for an hour, then stay to talk. Useful in any year, since it explains what to do before you apply.",
    due: null,
    starts: 9,
    footage: "civic",
    tags: ["Law", "Panel", "Free"],
    score: 0.74,
    foundHoursAgo: 26,
    paths: ["path-policy"],
  },
  {
    id: "opp-design-jam",
    type: "hackathon",
    title: "48-Hour Design Jam",
    organizer: "Bay Design Guild",
    format: "in_person",
    location: "San Francisco, CA",
    fit: "Small teams design a solution to a community brief in a weekend and leave with a finished portfolio piece. Beginners are paired with a working designer.",
    due: 11,
    starts: 17,
    footage: "design",
    tags: ["Design", "Portfolio", "Beginner track"],
    score: 0.8,
    foundHoursAgo: 6,
    paths: ["path-design"],
    materials: ['Team name or "looking for a team"'],
  },
  {
    id: "opp-studio-design",
    type: "internship",
    title: "Product Design Intern",
    organizer: "Fieldnote Studio",
    format: "hybrid",
    location: "San Francisco, CA",
    fit: "A twelve-week internship on a small studio team. The posting weighs the portfolio above the major and asks for two projects with the thinking shown.",
    due: 19,
    footage: "design",
    tags: ["Design", "Portfolio", "Paid"],
    score: 0.82,
    foundHoursAgo: 16,
    paths: ["path-design"],
    prompts: [
      "Show us one project and the decision you are proudest of. (200 words)",
    ],
    materials: ["Resume (PDF)", "Portfolio link"],
  },
  {
    id: "opp-teach-fellows",
    type: "internship",
    title: "Summer Teaching Fellow",
    organizer: "Bridge Scholars",
    format: "in_person",
    location: "Richmond, CA",
    fit: "You co-teach a middle school class for six weeks with a mentor teacher and daily coaching. Open to any major, with a stipend and housing.",
    due: 15,
    footage: "classroom",
    tags: ["Education", "Teaching", "Stipend"],
    score: 0.83,
    foundHoursAgo: 8,
    paths: ["path-education"],
    prompts: [
      "Describe a teacher who changed how you learn. (250 words)",
      "How would you handle a student who has given up? (200 words)",
    ],
    materials: ["Resume (PDF)", "One reference"],
  },
  {
    id: "opp-tutoring-club",
    type: "club",
    title: "Community Tutoring Corps",
    organizer: "Community Tutoring Corps",
    format: "in_person",
    location: "Berkeley, CA",
    fit: "Two hours a week tutoring at a local school, with training first. It is the simplest way to find out whether you like teaching.",
    due: null,
    starts: 5,
    footage: "classroom",
    tags: ["Education", "Volunteering", "No application"],
    score: 0.76,
    foundHoursAgo: 40,
    paths: ["path-education"],
  },
  {
    id: "opp-newsroom",
    type: "internship",
    title: "Reporting Intern",
    organizer: "The Bay Ledger",
    format: "hybrid",
    location: "Oakland, CA",
    fit: "Interns pitch and publish their own stories with an editor. The application asks for three clips, and student paper work counts.",
    due: 24,
    footage: "writing",
    tags: ["Media", "Writing", "Published clips"],
    score: 0.81,
    foundHoursAgo: 13,
    paths: ["path-media"],
    prompts: [
      "Pitch one story you would report in your first month. (200 words)",
    ],
    materials: ["Resume (PDF)", "Three published clips"],
  },
  {
    id: "opp-student-paper",
    type: "club",
    title: "Campus Newspaper",
    organizer: "The Daily Bear",
    format: "in_person",
    location: "Berkeley, CA",
    fit: "New writers start with one edited story a week. Every clip you publish here is one you can send with an internship application.",
    due: 7,
    footage: "writing",
    tags: ["Media", "Writing", "Open to all"],
    score: 0.78,
    foundHoursAgo: 22,
    paths: ["path-media", "path-marketing"],
    materials: ["One writing sample"],
  },
  {
    id: "opp-racing-team",
    type: "club",
    title: "Formula Electric Racing Team",
    organizer: "Formula Electric",
    format: "in_person",
    location: "Berkeley, CA",
    fit: "Students design, machine and race an electric car each year. New members start on a subteam and learn the shop tools there.",
    due: 9,
    footage: "workshop",
    tags: ["Mechanical engineering", "Hardware", "Team project"],
    score: 0.8,
    foundHoursAgo: 18,
    paths: ["path-mecheng"],
    prompts: ["Which subteam interests you and why? (150 words)"],
    materials: ["Resume (PDF)"],
  },
  {
    id: "opp-kestrel-mech",
    type: "internship",
    title: "Mechanical Engineering Intern",
    organizer: "Kestrel Aerospace",
    format: "in_person",
    location: "Alameda, CA",
    fit: "You would design and test a part with the structures team. The posting asks for a statics course, CAD, and one hands-on project such as a student team.",
    due: 21,
    footage: "workshop",
    tags: ["Mechanical engineering", "CAD", "Paid"],
    score: 0.83,
    foundHoursAgo: 10,
    paths: ["path-mecheng"],
    prompts: [
      "Describe something you designed and built. What failed first? (200 words)",
    ],
    materials: ["Resume (PDF)", "Unofficial transcript"],
  },
  {
    id: "opp-allmajors-fair",
    type: "event",
    title: "All-Majors Career Fair",
    organizer: "Campus Career Center",
    format: "in_person",
    location: "Berkeley, CA",
    fit: "More than a hundred employers across health, business, government, education, media and engineering, all recruiting from every major.",
    due: null,
    starts: 13,
    footage: "campus",
    tags: ["Career fair", "All majors", "100+ employers"],
    score: 0.79,
    foundHoursAgo: 2,
    paths: [],
  },
  {
    id: "opp-creative-scholarship",
    type: "scholarship",
    title: "Creative Futures Scholarship",
    organizer: "Tamsin Arts Foundation",
    format: "online",
    location: "Online",
    fit: "An award for students in writing, design, film, music or art. It is judged on a short portfolio and one essay, with no grade cutoff.",
    due: 27,
    footage: "design",
    tags: ["$4,000", "Portfolio", "Arts and media"],
    score: 0.75,
    foundHoursAgo: 28,
    paths: ["path-design", "path-media"],
    prompts: ["What do you want your work to do for other people? (300 words)"],
    materials: ["Portfolio link", "Unofficial transcript"],
  },
  {
    id: "opp-service-day",
    type: "event",
    title: "Citywide Day of Service",
    organizer: "Eastbay Volunteers",
    format: "in_person",
    location: "Oakland, CA",
    fit: "One Saturday at a food bank, a clinic or a school, in a team of students. Open to everyone, and a first line for a resume that has none yet.",
    due: null,
    starts: 10,
    footage: "volunteers",
    tags: ["Volunteering", "All majors", "Free"],
    score: 0.72,
    foundHoursAgo: 34,
    paths: [],
  },
];

const used: Partial<Record<keyof typeof footage, number>> = {};
/** The next clip for a subject, so two cards on the same subject do not share footage. */
function nextClip(subject: keyof typeof footage): number {
  const turn = used[subject] ?? 0;
  used[subject] = turn + 1;
  const pool = footage[subject];
  return pool[turn % pool.length]!;
}

export const moreOpportunities: Opportunity[] = specs.map((spec, index) => {
  const cover = nextClip(spec.footage);
  return {
    id: spec.id,
    type: spec.type,
    origin: "prepared",
    title: spec.title,
    organizer: spec.organizer,
    sourceUrl: link(spec.id.replace("opp-", "")),
    actionUrl: link(`${spec.id.replace("opp-", "")}/apply`),
    format: spec.format,
    location: spec.location,
    fitExplanation: spec.fit,
    deadline: spec.due === null ? null : inDays(spec.due),
    startTime: spec.starts === undefined ? null : inDays(spec.starts),
    image: still(cover),
    video: clip(cover),
    imageAspect: 0.8 + (index % 3) * 0.15,
    tags: spec.tags,
    unknowns: [],
    foundAt: hoursAgo(spec.foundHoursAgo),
    lastCheckedAt: hoursAgo(1),
    baseScore: spec.score,
  };
});

export const moreApplicationInfo: Record<string, ApplicationInfo> =
  Object.fromEntries(
    specs
      .filter((spec) => spec.prompts || spec.materials)
      .map((spec) => [
        spec.id,
        {
          prompts: spec.prompts ?? [],
          materials: spec.materials ?? [],
          requiresLogin: false,
        },
      ]),
  );

/**
 * Which career paths each sample opportunity leads toward. The feed ranking uses it to bring a
 * student's own field forward. An opportunity that is missing, or has an empty list, is open
 * to any field.
 */
export const opportunityPaths: Record<string, string[]> = {
  "opp-northwind-swe": ["path-swe"],
  "opp-bay-hack": ["path-swe", "path-pm"],
  "opp-lumen-info": ["path-swe"],
  "opp-systems-club": ["path-swe"],
  "opp-ml-research": ["path-ml"],
  "opp-harbor-data": ["path-data"],
  "opp-cinder-backend": ["path-swe"],
  "opp-systems-research": ["path-swe"],
  "opp-data-hack": ["path-data", "path-ml"],
  "opp-robotics-club": ["path-swe", "path-mecheng"],
  "opp-cloud-workshop": ["path-swe", "path-data"],
  "opp-quill-product": ["path-pm", "path-design"],
  ...Object.fromEntries(specs.map((spec) => [spec.id, spec.paths])),
};
