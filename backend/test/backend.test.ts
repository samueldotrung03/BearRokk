import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createApp } from '../src/app.ts';
import { scopeWithRules } from '../src/coordinator.ts';
import { extractCitations, extractText } from '../src/grok.ts';
import type { Deps } from '../src/pipeline.ts';
import { LocalStore } from '../src/store/local.ts';
import { Opportunity, Search, type Candidate } from '../src/types.ts';
import { canonicalUrl, checkDates, dropUnsupported, mergeDuplicates } from '../src/validate.ts';

const TODAY = new Date('2026-11-18T20:00:00Z');
const DEMO = 'I want to join a beginner-friendly coding club and attend an online hackathon next month.';

function candidate(over: Partial<Candidate>): Candidate {
  return {
    type: 'event',
    title: 'Winter Hack',
    organizer: 'Hack Org',
    sourceUrl: 'https://hack.example/winter',
    actionUrl: null,
    format: 'online',
    location: null,
    fitExplanation: 'Online hackathon.',
    meetingSchedule: null,
    membershipIntake: null,
    acceptingMembers: null,
    startTime: '2026-12-05T09:00:00-08:00',
    endTime: null,
    timeZone: 'America/Los_Angeles',
    registrationDeadline: null,
    registrationOpen: true,
    evidence: [{ field: 'startTime', quote: 'Starts Dec 5 at 9am PT', url: 'https://hack.example/winter' }],
    uncertainties: [],
    ...over,
  };
}

test('coordinator keeps "online" with the hackathon and asks about the club', () => {
  const s = scopeWithRules({ request: DEMO, today: TODAY });
  const club = s.brief.workers.find((w) => w.type === 'club')!;
  const event = s.brief.workers.find((w) => w.type === 'event')!;
  assert.equal(event.format, 'online');
  assert.equal(club.format, null);
  assert.deepEqual(club.preferences, ['beginner-friendly']);
  assert.deepEqual([s.brief.dateFrom, s.brief.dateTo], ['2026-12-01', '2026-12-31']);
  assert.deepEqual(s.brief.interests, ['coding']);
  assert.equal(s.followUpQuestion, 'Should the club also meet online, or do you want one near you?');
});

test('coordinator folds the follow-up answer into the club brief', () => {
  const followUp = { question: 'q', answer: 'One near Berkeley please' };
  const s = scopeWithRules({ request: DEMO, followUp, today: TODAY });
  const club = s.brief.workers.find((w) => w.type === 'club')!;
  assert.equal(s.followUpQuestion, null);
  assert.equal(club.location, 'Berkeley');
  assert.equal(club.format, 'in_person');
});

test('coordinator asks nothing when the request is already specific', () => {
  const s = scopeWithRules({ request: 'Find me an online robotics club', today: TODAY });
  assert.equal(s.followUpQuestion, null);
  assert.deepEqual(s.brief.workers.map((w) => w.type), ['club']);
});

test('canonicalUrl ignores tracking parameters, www and trailing slashes', () => {
  assert.equal(canonicalUrl('https://www.Luma.com/abc/?utm_source=x#top'), canonicalUrl('http://luma.com/abc'));
  assert.notEqual(canonicalUrl('https://luma.com/abc?id=1'), canonicalUrl('https://luma.com/abc?id=2'));
});

test('repeat announcements merge into one record and conflicts are surfaced', () => {
  const repost = candidate({
    sourceUrl: 'https://reddit.example/r/hack/1',
    actionUrl: 'https://hack.example/winter?utm_source=reddit',
    startTime: '2026-12-06T09:00:00-08:00',
    registrationDeadline: '2026-12-01',
    organizer: null,
    evidence: [{ field: 'registrationDeadline', quote: 'Sign up by Dec 1', url: 'https://reddit.example/r/hack/1' }],
  });
  const merged = mergeDuplicates([candidate({}), repost]);
  assert.equal(merged.length, 1);
  const m = merged[0]!;
  assert.equal(m.candidate.registrationDeadline, '2026-12-01');
  assert.equal(m.candidate.evidence.length, 2);
  assert.match(m.candidate.uncertainties.join(' '), /disagree on event date/);
  assert.equal(m.alsoSeenAt.length, 1);
});

test('different events with different links stay separate', () => {
  const other = candidate({ title: 'Spring Hack', sourceUrl: 'https://hack.example/spring' });
  assert.equal(mergeDuplicates([candidate({}), other]).length, 2);
});

test('a date with no quote behind it is dropped', () => {
  const c = dropUnsupported(candidate({ registrationDeadline: '2026-12-01' }));
  assert.equal(c.registrationDeadline, null);
  assert.equal(c.startTime, '2026-12-05T09:00:00-08:00');
});

test('date checks reject past, out-of-window and closed events', () => {
  const brief = scopeWithRules({ request: DEMO, today: TODAY }).brief;
  assert.equal(checkDates(candidate({}), brief, TODAY).keep, true);
  assert.equal(checkDates(candidate({ startTime: '2026-11-01' }), brief, TODAY).reason, 'event already happened');
  assert.equal(checkDates(candidate({ startTime: '2027-01-10' }), brief, TODAY).reason, 'event is outside the requested dates');
  assert.equal(checkDates(candidate({ registrationDeadline: '2026-11-10' }), brief, TODAY).reason, 'registration deadline has passed');
  const odd = checkDates(candidate({ registrationDeadline: '2026-12-20' }), brief, TODAY);
  assert.equal(odd.keep, true);
  assert.equal(odd.uncertainties.length, 1);
});

test('Grok response parsing reads text and citations', () => {
  const body = {
    citations: ['https://a.example'],
    output: [
      { type: 'web_search_call' },
      { type: 'message', content: [{ type: 'output_text', text: '{"a":1}', annotations: [{ type: 'url_citation', url: 'https://b.example' }] }] },
    ],
  };
  assert.equal(extractText(body), '{"a":1}');
  assert.deepEqual(extractCitations(body), ['https://a.example', 'https://b.example']);
});

// ---------------------------------------------------------------------------
// API journeys
// ---------------------------------------------------------------------------

async function call(app: ReturnType<typeof createApp>['app'], method: string, path: string, body?: unknown) {
  const res = await app.request(path, {
    method,
    headers: { 'content-type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  return { status: res.status, json: (await res.json()) as any };
}

test('prepared journey: question, follow-up, two labeled cards with an unknown deadline', async () => {
  const { app, engine } = createApp(new LocalStore(null), { liveAvailable: () => false, now: () => TODAY, preparedStepMs: 0 });

  const created = await call(app, 'POST', '/api/searches', { request: DEMO });
  assert.equal(created.status, 201);
  assert.equal(created.json.search.status, 'needs_follow_up');
  assert.equal(created.json.search.origin, 'prepared');
  const id = created.json.search.id;

  const answered = await call(app, 'POST', `/api/searches/${id}/follow-up`, { answer: 'Online is fine' });
  assert.equal(answered.json.search.status, 'searching');
  await engine.idle(id);

  const done = await call(app, 'GET', `/api/searches/${id}`);
  Search.parse(done.json.search);
  assert.equal(done.json.search.status, 'complete');
  assert.equal(done.json.search.resultCount, 2);
  assert.deepEqual(done.json.search.workers.map((w: any) => w.status), ['done', 'done']);
  const opps = done.json.opportunities.map((o: unknown) => Opportunity.parse(o));
  assert.deepEqual(opps.map((o: Opportunity) => o.type).sort(), ['club', 'event']);
  assert.ok(opps.every((o: Opportunity) => o.origin === 'prepared'));
  const event = opps.find((o: Opportunity) => o.type === 'event')!;
  assert.deepEqual(event.unknowns, [{ field: 'registrationDeadline', label: 'Registration deadline unknown' }]);
  assert.equal(event.club, null);
});

test('live journey: duplicates merge, rejected and dead leads are dropped, one failed worker does not sink the run', async () => {
  const deps: Partial<Deps> = {
    liveAvailable: () => true,
    now: () => TODAY,
    scopeLive: async (input) => ({ ...scopeWithRules(input), followUpQuestion: null }),
    discover: async (worker) => {
      if (worker.type === 'club') throw new Error('search tool unavailable');
      return [
        candidate({}),
        candidate({ sourceUrl: 'https://devpost.example/winter', actionUrl: 'https://hack.example/winter' }),
        candidate({ title: 'Closed Hack', sourceUrl: 'https://hack.example/closed' }),
        candidate({ title: 'Dead Link Hack', sourceUrl: 'https://hack.example/dead' }),
        candidate({ title: 'Old Hack', sourceUrl: 'https://hack.example/old', startTime: '2026-10-01' }),
      ];
    },
    verify: async (c) => ({ keep: c.title !== 'Closed Hack', reason: '', record: c }),
    checkLink: async (url) => (url.includes('dead') ? 'unreachable' : 'ok'),
  };
  process.env.MAX_RESULTS_PER_TYPE = '5';
  const { app, engine } = createApp(new LocalStore(null), deps);

  const created = await call(app, 'POST', '/api/searches', { request: DEMO });
  assert.equal(created.json.search.status, 'searching');
  assert.equal(created.json.search.origin, 'live');
  await engine.idle(created.json.search.id);

  const done = await call(app, 'GET', `/api/searches/${created.json.search.id}`);
  assert.equal(done.json.search.status, 'complete');
  assert.deepEqual(done.json.search.workers.map((w: any) => [w.type, w.status]), [['club', 'failed'], ['event', 'done']]);
  assert.deepEqual(done.json.opportunities.map((o: any) => o.title), ['Winter Hack']);
  assert.deepEqual(done.json.opportunities[0].alsoSeenAt, ['https://devpost.example/winter']);
  assert.equal(done.json.opportunities[0].linkCheck, 'ok');
});

test('API errors: empty request, unknown search, live mode without a key', async () => {
  const { app } = createApp(new LocalStore(null), { liveAvailable: () => false, preparedStepMs: 0 });
  assert.equal((await call(app, 'POST', '/api/searches', { request: '  ' })).status, 400);
  assert.equal((await call(app, 'GET', '/api/searches/nope')).status, 404);
  assert.equal((await call(app, 'POST', '/api/searches', { request: DEMO, mode: 'live' })).status, 409);
});
