import { describe, expect, it } from 'vitest';
import { applicationInfo, initialState, opportunities } from '../../data/sample.ts';
import type { Opportunity } from '../../types.ts';
import { countWords, findBlanks, parseLimit, questionParts } from './text.ts';
import { answersPart, buildOutline, classifyPrompt, goalFromAbout, outlineToDraft, reviewDraft } from './writer.ts';

const profile = initialState.profile;
const northwind = opportunities.find((o) => o.id === 'opp-northwind-swe') as Opportunity;
const [teamPrompt, whyPrompt] = applicationInfo['opp-northwind-swe']!.prompts as [string, string];

describe('prompt reading', () => {
  it('reads the word limit the organizer wrote, and none when there is no number', () => {
    expect(parseLimit(teamPrompt)).toEqual({ max: 200, optional: false });
    expect(parseLimit('Describe your experience with Python and any machine learning library.').max).toBeNull();
    expect(parseLimit('Answer in 300 words or less.').max).toBe(300);
    expect(parseLimit('What would you like to work on? (optional)')).toEqual({ max: null, optional: true });
  });

  it('splits a prompt into each thing it asks, including a trailing "and why"', () => {
    expect(questionParts(teamPrompt)).toEqual(['Tell us about a project you built with other people.', 'What was your part?']);
    expect(questionParts("Which of the lab's recent papers interests you most, and why? (250 words)")).toEqual([
      "Which of the lab's recent papers interests you most?",
      'Why?',
    ]);
  });

  it('classifies every sample prompt into a specific kind', () => {
    const kinds = Object.values(applicationInfo).flatMap((info) => info.prompts.map(classifyPrompt));
    expect(kinds).not.toContain('general');
    expect(classifyPrompt(whyPrompt)).toBe('motivation');
    expect(classifyPrompt(teamPrompt)).toBe('teamwork');
  });

  it('keeps a solo project question apart from a team one, so the outline does not invent teammates', () => {
    expect(classifyPrompt('Describe a service or API you built. What would you change now? (200 words)')).toBe('project');
    expect(classifyPrompt('What did transferring teach you? (300 words)')).toBe('reflection');
    const outline = buildOutline({ prompt: 'Describe a service or API you built. (200 words)', draft: '', opportunity: northwind, profile });
    expect(outlineToDraft(outline)).not.toMatch(/teammates/);
  });

  it('links an answer to the interest that best matches the posting, keeping acronyms', () => {
    const ml = opportunities.find((o) => o.id === 'opp-ml-research')!;
    const outline = buildOutline({ prompt: applicationInfo['opp-ml-research']!.prompts[0]!, draft: '', opportunity: ml, profile });
    expect(outline.sections[1]!.starter).toContain('my interest in AI and machine learning');
  });

  it('counts words, ignoring stray punctuation', () => {
    expect(countWords('  I built — a  parser, in C++ . ')).toBe(6);
    expect(countWords('')).toBe(0);
  });
});

describe('outline', () => {
  it('uses only profile and posting facts and leaves personal details as blanks', () => {
    const outline = buildOutline({ prompt: teamPrompt, draft: '', opportunity: northwind, profile });
    const draft = outlineToDraft(outline);
    // Every personal claim is a blank for the student to fill.
    expect(findBlanks(draft).length).toBeGreaterThanOrEqual(6);
    expect(draft).toContain('[your project]');
    expect(draft).toContain('Northwind Robotics');
    // Skills appear only as hints inside a blank, never as a claim that the student used them.
    expect(draft).not.toMatch(/I used Python/);
    expect(draft).toMatch(/\[a tool you used, such as Python\]/);
    // Every fact chip comes from the profile or the posting and its value is really there.
    for (const fact of outline.facts) {
      const source = fact.source === 'profile' ? JSON.stringify(profile).toLowerCase() : JSON.stringify(northwind).toLowerCase();
      expect(source).toContain(fact.value.split(' ')[0]!.toLowerCase());
    }
  });

  it('splits the word limit across sections without going over it', () => {
    const outline = buildOutline({ prompt: teamPrompt, draft: '', opportunity: northwind, profile });
    const total = outline.sections.reduce((sum, s) => sum + (s.words ?? 0), 0);
    expect(total).toBeGreaterThan(150);
    expect(total).toBeLessThanOrEqual(200);
  });

  it('turns a missing profile value into a blank instead of guessing', () => {
    const bare = { ...profile, about: '', skills: [] };
    const outline = buildOutline({ prompt: whyPrompt, draft: '', opportunity: northwind, profile: bare });
    expect(goalFromAbout('')).toBeNull();
    expect(outlineToDraft(outline)).toContain('[goal]');
  });

  it('names only asked tools the profile really has, and flags the gap honestly', () => {
    const ml = opportunities.find((o) => o.id === 'opp-ml-research')!;
    const prompt = applicationInfo['opp-ml-research']!.prompts[1]!;
    const outline = buildOutline({ prompt, draft: '', opportunity: ml, profile });
    expect(outline.sections[0]!.starter).toMatch(/^I have used Python in \[/);
    expect(outline.sections[2]!.guide).toMatch(/machine learning, which your profile does not list/);
  });
});

describe('draft check', () => {
  const review = (draft: string, prompt = teamPrompt) => reviewDraft({ prompt, draft, opportunity: northwind, profile });

  it('catches an answer over the stated limit', () => {
    const notes = review(Array.from({ length: 230 }, () => 'word').join(' ')).notes;
    expect(notes.find((n) => n.id === 'length')).toMatchObject({ tone: 'fix', title: '30 words over the limit' });
  });

  it('notices when "What was your part?" is not answered, and when it is', () => {
    const vague = 'We built a robot for a class. We worked on it every weekend and we were proud of what we made.';
    expect(review(vague).notes.some((n) => n.tone === 'fix' && n.detail.includes('What was your part?'))).toBe(true);
    const owned = `For a class project, three of us built a line-following robot. My part was the motor control code. I wrote it in Python and tuned it for two weeks.`;
    expect(review(owned).notes.some((n) => n.tone === 'fix' && n.detail.includes('What was your part?'))).toBe(false);
  });

  it('points at vague phrases with their exact place in the draft', () => {
    const draft = 'I am passionate about robots and I learned a lot.';
    const notes = review(draft).notes.filter((n) => n.id.startsWith('vague'));
    expect(notes.map((n) => n.title)).toEqual(['Vague: “passionate”', 'Vague: “learned a lot”']);
    const target = notes[1]!.target!;
    expect(draft.slice(target.start, target.end)).toBe('learned a lot');
  });

  it('flags blanks left from an outline as something to fix', () => {
    const outline = buildOutline({ prompt: teamPrompt, draft: '', opportunity: northwind, profile });
    const notes = review(outlineToDraft(outline)).notes;
    expect(notes[0]).toMatchObject({ id: 'blanks', tone: 'fix' });
  });

  it('asks a "why" answer to name the organizer', () => {
    const generic = 'I like robots because they move. I want to learn more about software that controls machines in the real world.';
    expect(review(generic, whyPrompt).notes.some((n) => n.id === 'organizer')).toBe(true);
    expect(review(`${generic} Northwind ships warehouse robots.`, whyPrompt).notes.some((n) => n.id === 'organizer')).toBe(false);
  });

  it('scores a specific, complete answer above a vague one', () => {
    const strong =
      'For my data structures class, four of us built a campus shuttle tracker in Java. My part was the backend: I wrote the API that read GPS pings every 10 seconds and the code that cached routes. When our map froze during the demo, I traced it to a lock I had added, fixed it in an hour, and wrote a test so it would not return. About 300 students used it that term. I want to bring the same care to robotics software at Northwind Robotics.';
    const weak = 'We did a lot of stuff on a project and it was very fun. We learned a lot.';
    expect(review(strong).score).toBeGreaterThan(review(weak).score + 30);
  });

  it('accepts an answer that gives a reason for the "why" part', () => {
    expect(answersPart('Why?', 'It matters to me because it runs on real hardware.')).toBe(true);
    expect(answersPart('Why?', 'It is a paper about compilers.')).toBe(false);
  });
});
