// Deterministic checks applied to every candidate, whatever produced it:
// merge repeat announcements, drop unsupported claims, keep event dates and deadlines apart, test the link.
import { randomUUID } from 'node:crypto';
import type { Brief, Candidate, EvidenceField, Opportunity, Origin, Unknown } from './types.ts';

/** Same page regardless of scheme, www, tracking parameters, fragment or trailing slash. */
export function canonicalUrl(url: string | null): string | null {
  if (!url) return null;
  try {
    const u = new URL(url.trim());
    for (const key of [...u.searchParams.keys()]) {
      if (/^(utm_|ref$|ref_|source$|fbclid|gclid|mc_)/i.test(key)) u.searchParams.delete(key);
    }
    const host = u.hostname.toLowerCase().replace(/^www\./, '');
    const path = u.pathname.replace(/\/+$/, '');
    const query = u.searchParams.toString();
    return `${host}${path}${query ? `?${query}` : ''}`.toLowerCase();
  } catch {
    return null;
  }
}

const normalize = (s: string | null) => (s ?? '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

function sameOpportunity(a: Candidate, b: Candidate): boolean {
  if (a.type !== b.type) return false;
  const urlsA = [canonicalUrl(a.sourceUrl), canonicalUrl(a.actionUrl)].filter(Boolean);
  const urlsB = new Set([canonicalUrl(b.sourceUrl), canonicalUrl(b.actionUrl)].filter(Boolean));
  if (urlsA.some((u) => urlsB.has(u))) return true;
  if (normalize(a.title) !== normalize(b.title) || !normalize(a.title)) return false;
  // Same name: treat as one unless the organizers or event dates clearly differ.
  if (a.organizer && b.organizer && normalize(a.organizer) !== normalize(b.organizer)) return false;
  if (a.startTime && b.startTime && a.startTime.slice(0, 10) !== b.startTime.slice(0, 10)) return false;
  return true;
}

const FACT_FIELDS = [
  'organizer',
  'actionUrl',
  'format',
  'location',
  'meetingSchedule',
  'membershipIntake',
  'acceptingMembers',
  'startTime',
  'endTime',
  'timeZone',
  'registrationDeadline',
  'registrationOpen',
] as const;

const filled = (c: Candidate) => FACT_FIELDS.filter((f) => c[f] !== null).length;

export type Merged = { candidate: Candidate; alsoSeenAt: string[] };

/** Collapse repeat announcements into one record, keeping the fuller one and noting conflicts. */
export function mergeDuplicates(items: (Candidate | Merged)[]): Merged[] {
  const out: Merged[] = [];
  for (const item of items) {
    const incoming: Merged = 'candidate' in item ? item : { candidate: item, alsoSeenAt: [] };
    const next = incoming.candidate;
    const hit = out.find((m) => sameOpportunity(m.candidate, next));
    if (!hit) {
      out.push({ candidate: structuredClone(next), alsoSeenAt: [...incoming.alsoSeenAt] });
      continue;
    }
    const [primary, other] = filled(next) > filled(hit.candidate) ? [structuredClone(next), hit.candidate] : [hit.candidate, next];
    const record = primary as Record<string, unknown>;
    for (const field of FACT_FIELDS) {
      if (primary[field] === null && other[field] !== null) {
        record[field] = other[field];
      } else if (
        (field === 'startTime' || field === 'registrationDeadline') &&
        primary[field] && other[field] && primary[field] !== other[field]
      ) {
        primary.uncertainties.push(`Sources disagree on ${LABELS[field] ?? field}: ${primary[field]} or ${other[field]}.`);
      }
    }
    // If the fuller record is a repost whose sign-up link is the other record's page, that page is the organizer's.
    const repostUrl = primary.sourceUrl;
    if (canonicalUrl(primary.actionUrl) === canonicalUrl(other.sourceUrl)) primary.sourceUrl = other.sourceUrl;
    incoming.alsoSeenAt.push(repostUrl);
    primary.evidence.push(...other.evidence);
    primary.uncertainties = [...new Set([...primary.uncertainties, ...other.uncertainties])];
    const seen = new Set([...hit.alsoSeenAt, ...incoming.alsoSeenAt, other.sourceUrl, hit.candidate.sourceUrl]);
    seen.delete(primary.sourceUrl);
    hit.candidate = primary;
    hit.alsoSeenAt = [...seen];
  }
  return out;
}

const LABELS: Record<string, string> = {
  organizer: 'organizer',
  actionUrl: 'sign-up link',
  format: 'online or in-person format',
  meetingSchedule: 'meeting schedule',
  membershipIntake: 'how to join',
  startTime: 'event date',
  timeZone: 'time zone',
  registrationDeadline: 'registration deadline',
};

const UNKNOWN_TEXT: Record<string, string> = {
  organizer: 'Organizer unknown',
  actionUrl: 'No sign-up link found',
  format: 'Online or in person unknown',
  meetingSchedule: 'Meeting schedule unknown',
  membershipIntake: 'How to join unknown',
  startTime: 'Event date unknown',
  timeZone: 'Time zone unknown',
  registrationDeadline: 'Registration deadline unknown',
};

const REQUIRED_KNOWN = {
  club: ['organizer', 'actionUrl', 'format', 'meetingSchedule', 'membershipIntake'],
  event: ['organizer', 'actionUrl', 'format', 'startTime', 'timeZone', 'registrationDeadline'],
} as const;

/** Facts that may only be displayed with a quote behind them. */
const NEEDS_EVIDENCE: EvidenceField[] = ['meetingSchedule', 'membershipIntake', 'startTime', 'endTime', 'registrationDeadline'];

/** Null out schedule and date claims that arrived without source text. */
export function dropUnsupported(c: Candidate): Candidate {
  const backed = new Set(c.evidence.filter((e) => e.quote.trim() && e.url.trim()).map((e) => e.field));
  const next = structuredClone(c);
  for (const field of NEEDS_EVIDENCE) {
    if (!backed.has(field)) (next as Record<string, unknown>)[field] = null;
  }
  return next;
}

function parseDay(value: string | null): number | null {
  if (!value) return null;
  const t = Date.parse(value.length === 10 ? `${value}T00:00:00Z` : value);
  return Number.isNaN(t) ? null : t;
}

export type DateCheck = { keep: boolean; reason: string | null; uncertainties: string[] };

/** Events only: reject past or out-of-window events, and flag deadlines that cannot be right. */
export function checkDates(c: Candidate, brief: Brief | null, today: Date): DateCheck {
  const uncertainties: string[] = [];
  if (c.type !== 'event') return { keep: true, reason: null, uncertainties };
  const dayStart = Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate());
  const start = parseDay(c.startTime);
  const end = parseDay(c.endTime);
  const deadline = parseDay(c.registrationDeadline);

  if (c.startTime && start === null) uncertainties.push(`Could not read the event date "${c.startTime}".`);
  if ((end ?? start) !== null && (end ?? start)! < dayStart) return { keep: false, reason: 'event already happened', uncertainties };
  if (start !== null && brief?.dateFrom && brief.dateTo) {
    const from = parseDay(brief.dateFrom)!;
    const to = parseDay(brief.dateTo)! + 86_400_000;
    if (start < from || start >= to) return { keep: false, reason: 'event is outside the requested dates', uncertainties };
  }
  if (deadline !== null && deadline < dayStart) return { keep: false, reason: 'registration deadline has passed', uncertainties };
  if (c.registrationOpen === false) return { keep: false, reason: 'registration is closed', uncertainties };
  if (deadline !== null && start !== null && deadline > (end ?? start) + 86_400_000) {
    uncertainties.push('The listed registration deadline falls after the event; confirm it on the organizer page.');
  }
  return { keep: true, reason: null, uncertainties };
}

export type LinkStatus = Opportunity['linkCheck'];

/** Is the page the student will open actually there? Bot-blocking is reported, not treated as dead. */
export async function checkLink(url: string, fetchImpl: typeof fetch = fetch): Promise<LinkStatus> {
  try {
    const res = await fetchImpl(url, {
      redirect: 'follow',
      signal: AbortSignal.timeout(8000),
      headers: { 'user-agent': 'Mozilla/5.0 (compatible; link-check)', accept: 'text/html,*/*' },
    });
    await res.body?.cancel();
    if (res.ok) return 'ok';
    if (res.status === 404 || res.status === 410) return 'unreachable';
    return 'blocked';
  } catch {
    return 'unreachable';
  }
}

export function toOpportunity(
  merged: Merged,
  ctx: { searchId: string; origin: Origin; linkCheck: LinkStatus; checkedAt: Date; extraUncertainties?: string[] },
): Opportunity {
  const c = merged.candidate;
  const unknowns: Unknown[] = REQUIRED_KNOWN[c.type]
    .filter((f) => c[f] === null)
    // An online opportunity needs no time zone caveat beyond the missing date itself.
    .filter((f) => !(f === 'timeZone' && c.startTime === null))
    .map((f) => ({ field: f, label: UNKNOWN_TEXT[f]! }));
  const uncertainties = [...new Set([...c.uncertainties, ...(ctx.extraUncertainties ?? [])])];
  if (ctx.linkCheck === 'blocked') uncertainties.push('The organizer page could not be checked automatically; open it to confirm.');
  return {
    id: randomUUID(),
    searchId: ctx.searchId,
    type: c.type,
    origin: ctx.origin,
    title: c.title,
    organizer: c.organizer,
    sourceUrl: c.sourceUrl,
    actionUrl: c.actionUrl,
    format: c.format,
    location: c.location,
    fitExplanation: c.fitExplanation,
    lastCheckedAt: ctx.checkedAt.toISOString(),
    club:
      c.type === 'club'
        ? { meetingSchedule: c.meetingSchedule, membershipIntake: c.membershipIntake, acceptingMembers: c.acceptingMembers }
        : null,
    event:
      c.type === 'event'
        ? {
            startTime: c.startTime,
            endTime: c.endTime,
            timeZone: c.timeZone,
            registrationDeadline: c.registrationDeadline,
            registrationOpen: c.registrationOpen,
          }
        : null,
    evidence: c.evidence,
    unknowns,
    uncertainties,
    alsoSeenAt: merged.alsoSeenAt,
    linkCheck: ctx.linkCheck,
  };
}
