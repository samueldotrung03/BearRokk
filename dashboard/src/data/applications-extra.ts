// Word lists and outline shapes the application helper uses. They are rules, not a model: in the
// product Grok reads the posting and the profile and writes with the student. Keeping them as
// data means the wording can change without touching the logic in src/lib/apps.

/** Phrases that sound like an answer but tell a reader nothing, each with a way to fix it. */
export const vaguePhrases: { phrase: string; hint: string }[] = [
  { phrase: 'passionate', hint: 'Show it with something you did instead of naming the feeling.' },
  { phrase: 'hard worker', hint: 'Give one example of the work instead.' },
  { phrase: 'hard-working', hint: 'Give one example of the work instead.' },
  { phrase: 'team player', hint: 'Describe one moment with the team instead.' },
  { phrase: 'a lot', hint: 'Swap it for a number: hours, users, teammates, lines changed.' },
  { phrase: 'learned a lot', hint: 'Name the one thing you learned.' },
  { phrase: 'many things', hint: 'Pick the one thing that matters most and name it.' },
  { phrase: 'various', hint: 'Name them, or keep only the best one.' },
  { phrase: 'stuff', hint: 'Say exactly what it was.' },
  { phrase: 'etc', hint: 'Finish the list or cut it to the strongest item.' },
  { phrase: 'always been', hint: 'Point to when it actually started.' },
  { phrase: 'make a difference', hint: 'Say who it helps and how.' },
  { phrase: 'make an impact', hint: 'Say who it helps and how.' },
  { phrase: 'very', hint: 'Cut it, or use a stronger, more exact word.' },
  { phrase: 'really', hint: 'Cut it, or use a stronger, more exact word.' },
];

/** Tools and fields the helper recognizes when a question or a draft names them. */
export const techTerms = [
  'Python',
  'Java',
  'C++',
  'SQL',
  'JavaScript',
  'TypeScript',
  'Git',
  'Linux',
  'React',
  'Data structures',
  'machine learning',
  'PyTorch',
  'TensorFlow',
  'robotics',
  'backend',
  'pipelines',
  'API',
  'cloud',
];

export type PromptKind =
  | 'teamwork'
  | 'project'
  | 'reflection'
  | 'motivation'
  | 'interest'
  | 'experience'
  | 'identity'
  | 'impact'
  | 'plan'
  | 'general';

/**
 * One part of an outline. `guide` talks to the student and may quote their profile or the posting.
 * `starter` is draft text: it states only profile or posting facts, and everything personal is a
 * [bracketed blank] the student fills in. Tokens in {braces} are filled in src/lib/apps/writer.ts;
 * a token with no value becomes a blank, never a guess. `weight` splits the word limit.
 */
export interface SectionTemplate {
  heading: string;
  guide: string;
  starter: string;
  weight: number;
}

export const outlineTemplates: Record<PromptKind, SectionTemplate[]> = {
  teamwork: [
    {
      heading: 'The project in one line',
      guide: 'What it was, who it was for, and how many people built it. Keep it to two sentences.',
      starter: '[your project] was [what it did, in one line], built with [number] teammates for [a class, club or hackathon].',
      weight: 2,
    },
    {
      heading: 'Your part',
      guide: 'The question asks what your part was, so use "I" and name what you owned. Your profile lists {skills}; mention only the ones you really used.',
      starter: 'My part was [what you owned]. I [one concrete thing you did] using [a tool you used, such as {skillHint}].',
      weight: 3,
    },
    {
      heading: 'One moment with the team',
      guide: 'A single specific moment: a disagreement, a handoff, a bug you fixed together.',
      starter: 'When [a problem the team ran into], I [what you did], and [what changed because of it].',
      weight: 3,
    },
    {
      heading: 'Result, and why it matters here',
      guide: 'Close with the outcome, ideally a number, and link it to {organizer}.',
      starter: 'In the end, [the result, ideally a number]. I want to bring the same habits to the {role} role at {organizer}.',
      weight: 2,
    },
  ],
  project: [
    {
      heading: 'What you built',
      guide: 'Name it and say what it does and who used it, in one or two sentences.',
      starter: 'I built [what you built], a [what it does] for [who used it].',
      weight: 2,
    },
    {
      heading: 'How you built it',
      guide: 'The choices that mattered. Your profile lists {skills}; mention only what you really used.',
      starter: 'I wrote it in [a tool you used, such as {skillHint}] and [one design choice you made, and why].',
      weight: 3,
    },
    {
      heading: 'What you would change',
      guide: 'Reviewers like honest hindsight: one real weakness and how you would fix it now.',
      starter: 'Looking back, I would change [one thing] because [what you learned since].',
      weight: 3,
    },
    {
      heading: 'Why it matters here',
      guide: 'Link the lesson to {organizer}. The posting highlights {tags}.',
      starter: 'That is the kind of work I want to keep doing at {organizer}: [how it connects].',
      weight: 2,
    },
  ],
  reflection: [
    {
      heading: 'The situation',
      guide: 'Set the scene briefly and plainly. Only what you are comfortable sharing.',
      starter: '[the situation, in one or two sentences].',
      weight: 2,
    },
    {
      heading: 'A moment that taught you something',
      guide: 'One specific moment, with what you did. Specific beats general.',
      starter: 'When [a specific moment], I [what you did].',
      weight: 4,
    },
    {
      heading: 'What you learned',
      guide: 'Say the lesson in your own words, then show it changed something you do.',
      starter: 'It taught me [the lesson], and now I [what you do differently].',
      weight: 3,
    },
    {
      heading: 'Where it takes you',
      guide: 'Tie it to your goal from your profile: {goal}.',
      starter: 'That matters for where I am headed: {goal}.',
      weight: 1,
    },
  ],
  motivation: [
    {
      heading: 'Where it started',
      guide: 'A real moment, not "I have always been passionate". When did {topic} first catch your attention?',
      starter: 'I first got interested in {topic} when [the moment it started].',
      weight: 2,
    },
    {
      heading: 'What you did about it',
      guide: 'Your profile says: "{about}" Connect that to something you have done.',
      starter: 'As a {year} studying {major} at {school}, I have [a class, project or club where you worked on this].',
      weight: 3,
    },
    {
      heading: 'Why {organizer}',
      guide: 'Use the posting. It highlights {tags}. Name one thing about them that you checked yourself.',
      starter: '{organizer} stands out to me because [something specific from the posting or their work].',
      weight: 3,
    },
    {
      heading: 'What you want from it',
      guide: 'One thing you want to learn and one thing you can offer. It ties back to your goal: {goal}.',
      starter: 'I am working toward {goal}, and here I want to learn [a skill] while contributing [what you can offer].',
      weight: 2,
    },
  ],
  interest: [
    {
      heading: 'Pick one',
      guide: 'Name exactly one and say its main idea in your own words, so it is clear you read it.',
      starter: 'The one that interests me most is [its title], which [its main idea, in your words].',
      weight: 3,
    },
    {
      heading: 'Why it matters to you',
      guide: 'Your interests include {interests}. Link the choice to one of them.',
      starter: 'It connects to my interest in {interestMatch} because [your reason].',
      weight: 3,
    },
    {
      heading: 'A question you would ask',
      guide: 'A good answer ends with curiosity: an open question or a next step you would try.',
      starter: 'I would like to explore [an open question or next step].',
      weight: 2,
    },
    {
      heading: 'What you would bring',
      guide: 'Your profile lists {skills}. Pick what is relevant and say where you used it.',
      starter: 'I can help with [a skill you would bring, such as {skillHint}], which I used in [where you used it].',
      weight: 2,
    },
  ],
  experience: [
    {
      heading: 'Name what you know',
      guide: 'The question names {asked}. Your profile covers {askedHave}.',
      starter: 'I have used {askedHaveText} in [a course or project, and for how long].',
      weight: 3,
    },
    {
      heading: 'One concrete use',
      guide: 'One thing you built or analyzed, with what it did. A number helps.',
      starter: 'In [a class or project], I used it to [what you built or analyzed], which [the result].',
      weight: 4,
    },
    {
      heading: 'Gaps, honestly',
      guide: '{gapGuide}',
      starter: 'I am currently learning [the tool] by [how you are learning it].',
      weight: 2,
    },
  ],
  identity: [
    {
      heading: 'What it means to you',
      guide: '{identityGuide} Share only what you are comfortable sharing.',
      starter: 'Being the first in my family to go to college means [what it means to you, in your words].',
      weight: 3,
    },
    {
      heading: 'A moment that shows it',
      guide: 'One specific moment or responsibility. Details make this real; general statements do not.',
      starter: '[a specific moment or responsibility that shows it].',
      weight: 3,
    },
    {
      heading: 'Where it is taking you',
      guide: 'Your profile names a goal: {goal}.',
      starter: 'I am working toward {goal}, and [how this part of your story shapes that goal].',
      weight: 3,
    },
    {
      heading: 'Tie it back',
      guide: 'One sentence linking it to {title}.',
      starter: '[how {title} would help you get there].',
      weight: 1,
    },
  ],
  impact: [
    {
      heading: 'Where you are now',
      guide: 'Plain facts about your year as it stands. No need to dramatize.',
      starter: 'Right now, [what your year looks like without it].',
      weight: 3,
    },
    {
      heading: 'What would change',
      guide: 'Be concrete: fewer work hours, a course, a project, a conference. The posting mentions {tags}.',
      starter: 'With this support, I could [a specific change].',
      weight: 4,
    },
    {
      heading: 'What it leads to',
      guide: 'Tie it to your goal from your profile: {goal}.',
      starter: 'That would move me closer to {goal} by [how].',
      weight: 3,
    },
  ],
  plan: [
    {
      heading: 'The idea',
      guide: 'What it is and who it helps, in one sentence.',
      starter: 'I want to build [your idea], a [what it is] for [who it helps].',
      weight: 4,
    },
    {
      heading: 'How you would build it',
      guide: 'Your profile lists {skills}. Name what you would use and one thing you would learn.',
      starter: 'I would use [tools, such as {skillHint}] and learn [something new] along the way.',
      weight: 3,
    },
    {
      heading: 'Why here',
      guide: 'The posting highlights {tags}. Say why that fits you.',
      starter: '[why this fits you, for example: {firstTag}].',
      weight: 3,
    },
  ],
  general: [
    {
      heading: 'Answer first',
      guide: 'Open with a direct answer to the question in one sentence.',
      starter: '[your direct answer, in one sentence].',
      weight: 3,
    },
    {
      heading: 'One example',
      guide: 'Back it with one specific thing you did. Your profile lists {skills} and {interests}.',
      starter: 'For example, [something specific you did].',
      weight: 4,
    },
    {
      heading: 'Connect it',
      guide: 'Link it to {organizer} and the {title}.',
      starter: 'That is why [how it connects to {title}].',
      weight: 3,
    },
  ],
};
