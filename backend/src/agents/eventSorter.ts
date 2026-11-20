// Sorting the student's own calendar events: career-related (application deadlines, interviews,
// career fairs, info sessions, hackathons, workshops, club meetings about a field, networking) or
// personal (birthdays, dentist, gym, family). The calendar's "Career only" filter hides personal
// ones. These rules are the fallback when no model is connected, and the model's safety net.
export interface CalendarEventInput {
  id: string;
  title: string;
  calendar?: string | null;
  location?: string | null;
}

export interface EventVerdict {
  id: string;
  career: boolean;
  /** What kind of thing it is, for the student to see. */
  kind: 'deadline' | 'interview' | 'event' | 'class' | 'work' | 'opportunity' | 'personal';
  reason: string;
}

/** Shown on the calendar: things about the student's career and the opportunities they pursue. */
const CAREER: [RegExp, EventVerdict['kind'], string][] = [
  [/\b(interview|phone screen|oa\b|online assessment|coding challenge|technical screen|recruiter|offer call|superday)\b/i, 'interview', 'Part of applying for a job'],
  [/\b(career fair|job fair|info ?session|information session|networking|meet ?(and|&) ?greet|coffee chat|alumni|recruiting|employer|career centre|career center)\b/i, 'event', 'A career event'],
  [/(hackathon|hacks\b|\bhack\b|\bctf\b|datathon|buildathon|\bdemo day\b|\bpitch (night|competition)\b|case competition)/i, 'event', 'A hackathon or competition'],
  [/\b(internship|fellowship|scholarship|research (position|program|assistant)|application|apply|resume|résumé|cover letter|portfolio review)\b/i, 'opportunity', 'About an opportunity or applying'],
  [/\b(workshop|webinar|conference|summit|meetup|speaker|panel)\b/i, 'event', 'A talk or workshop'],
  [/\b(club|society|chapter|general meeting|officer meeting|board meeting)\b/i, 'event', 'A club meeting'],
];

/**
 * Left off: coursework and the student's job. A course code (PB101, CS 61A, EC1A5), lectures,
 * sections, exams, quizzes and assignments, even ones with a deadline, are classes, not career.
 */
const NOT_CAREER: [RegExp, EventVerdict['kind'], string][] = [
  [/\b[A-Z]{2,5} ?\d{1,3}[A-Z]?\d*[A-Z]?\b/, 'class', 'Coursework'],
  [/\b(lecture|seminar|tutorial|section|discussion|lab\b|office hours|midterm|final|exam|quiz|test\b|homework|assignment|problem set|pset|essay due|coursework|reading|revision|class\b|course)\b/i, 'class', 'Coursework'],
  [/\b(shift|standup|1:1|one on one|team sync|onboarding)\b/i, 'work', 'Work'],
];

const DEADLINE = /\b(deadline|due|apply by|applications? (close|due|open)|closes?)\b/i;

export function sortByRules(events: CalendarEventInput[]): EventVerdict[] {
  return events.map((e) => {
    const text = `${e.title} ${e.calendar ?? ''}`;
    for (const [pattern, kind, reason] of CAREER) if (pattern.test(text)) return { id: e.id, career: true, kind, reason };
    for (const [pattern, kind, reason] of NOT_CAREER) if (pattern.test(text)) return { id: e.id, career: false, kind, reason };
    // A deadline that is not coursework is most likely an opportunity's.
    if (DEADLINE.test(text)) return { id: e.id, career: true, kind: 'deadline', reason: 'A deadline' };
    return { id: e.id, career: false, kind: 'personal', reason: 'Looks personal' };
  });
}

/** An event the student described in their own words, ready to put on the calendar. */
export interface EventDraft {
  title: string;
  /** YYYY-MM-DD */
  day: string;
  /** HH:MM, or null for all day. */
  time: string | null;
  endTime: string | null;
  note: string;
}

export type EventAsk = { ok: true; event: EventDraft; reply: string } | { ok: false; reply: string };

/** Keeps only what is well formed: a real date, times as HH:MM, an end after the start. */
export function cleanDraft(d: Partial<EventDraft> | null | undefined): EventDraft | null {
  if (!d || typeof d.title !== 'string' || !d.title.trim() || typeof d.day !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(d.day) || Number.isNaN(Date.parse(d.day))) return null;
  const hhmm = (v: unknown) => (typeof v === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(v) ? v : null);
  const time = hhmm(d.time);
  const end = time ? hhmm(d.endTime) : null;
  return { title: d.title.trim().slice(0, 120), day: d.day, time, endTime: end && end > time! ? end : null, note: typeof d.note === 'string' ? d.note.trim().slice(0, 400) : '' };
}
