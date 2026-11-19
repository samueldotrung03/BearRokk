// What to do after an application is sent: a short follow-up checklist and practice questions.
// Both come from the posting's own details (type, tags, questions, dates) and the profile, and
// each question says where it came from, so nothing reads as inside knowledge the app lacks.
import type { ApplicationInfo, Opportunity, Profile } from '../../types.ts';
import { shortDate } from '../time.ts';
import { mentions, promptText } from './text.ts';

export interface FollowUp {
  id: string;
  label: string;
}

const isEventLike = (o: Opportunity) => o.type === 'event' || o.type === 'hackathon' || o.type === 'club';

export function followUpSteps(o: Opportunity, info: ApplicationInfo | undefined): FollowUp[] {
  if (isEventLike(o)) {
    return [
      { id: 'confirmed', label: `Registration confirmed by ${o.organizer}` },
      ...(o.startTime ? [{ id: 'start', label: `Start time in your calendar: ${shortDate(o.startTime)}` }] : [{ id: 'start', label: 'Find out when it starts' }]),
      ...(o.location ? [{ id: 'where', label: `Know how to get there: ${o.location}` }] : []),
      ...(info?.materials.length ? [{ id: 'bring', label: `Ready to bring: ${info.materials.join(', ')}` }] : []),
      { id: 'after', label: 'Afterward, note who you met and one thing you learned' },
    ];
  }
  return [
    { id: 'confirmed', label: `Confirmation email from ${o.organizer} saved` },
    { id: 'copy', label: 'A copy of your answers and the posting kept, in case the page goes down' },
    { id: 'date', label: 'The day you applied written in your notes below' },
    { id: 'check', label: 'Check in politely if you hear nothing in about two weeks' },
    { id: 'prep', label: 'Practice the questions below out loud once' },
  ];
}

export interface PrepQuestion {
  question: string;
  /** Where the question came from, shown under it. */
  from: string;
}

export function interviewQuestions(o: Opportunity, info: ApplicationInfo | undefined, profile: Profile): PrepQuestion[] {
  if (isEventLike(o)) return [];
  const kind = o.type === 'research' ? 'research position' : o.type;
  const questions: PrepQuestion[] = [
    { question: `Why ${o.organizer}, and why this ${kind}?`, from: 'Asked in almost every interview for a role like this' },
  ];
  for (const tag of o.tags) {
    const skill = profile.skills.find((s) => s.toLowerCase() === tag.toLowerCase());
    if (skill) {
      questions.push({ question: `Walk me through something you built with ${skill}. What would you do differently?`, from: `The posting lists ${tag}, and so does your profile` });
    } else if (/^[A-Z]/.test(tag) && !/\$|welcome|free|remote/i.test(tag)) {
      questions.push({ question: `What do you know about ${tag.toLowerCase()}, and how would you get up to speed?`, from: `The posting lists ${tag}; your profile does not yet` });
    }
  }
  for (const prompt of info?.prompts ?? []) {
    if (/optional/i.test(prompt)) continue;
    questions.push({ question: `Expect a follow-up on your written answer: “${promptText(prompt)}”`, from: 'One of the application’s own questions' });
  }
  const interest = profile.interests.find((i) => mentions(`${o.title} ${o.tags.join(' ')} ${o.fitExplanation}`, i.split(' ')[0] ?? i));
  if (interest) {
    questions.push({ question: `Where do you see ${interest.toLowerCase()} fitting into this work?`, from: 'An interest on your profile that matches the posting' });
  }
  questions.push({ question: `What questions do you have for us about the ${o.title} role?`, from: 'Have two ready; the posting’s details are a good source' });
  return questions.slice(0, 6);
}
