// Writes three real roadmaps with whatever model is connected and checks they have the shape the
// dashboard draws: an open-ended career, one built from a student's picks, and a posting already applied to. Uses an invented
// student, so nothing personal is sent.
// Run: npm run roadmap:check      (after npm run grok:check passes)
import { config, liveAvailable } from '../src/config.ts';
import { RoadmapRequest, writeRoadmap, type Roadmap } from '../src/roadmap.ts';

if (!liveAvailable()) {
  console.error('No model is connected. Set XAI_API_KEY, or GROK_TRANSPORT=cli, in backend/.env first.');
  process.exit(1);
}
console.log(`transport: ${config.grokTransport}${config.grokTransport === 'claude' ? '  (TEST MODE: this is Claude, not Grok)' : ''}\n`);

const profile = {
  major: 'Computer Science',
  year: 'Sophomore',
  school: 'A public university',
  skills: ['Python', 'SQL', 'Git'],
  interests: ['Backend systems'],
  experience: [{ role: 'Peer tutor', organization: 'Campus tutoring center', summary: 'Tutored data structures', skills: ['Teaching'] }],
  notes: ['Paid roles only'],
};

const cases: { name: string; request: unknown; checks: [string, (r: Roadmap) => boolean][] }[] = [
  {
    name: 'career (open-ended)',
    request: { kind: 'career', goal: 'Software engineering', profile },
    checks: [
      ['at least 20 options', (r) => r.phases.flatMap((p) => p.steps).length >= 20],
      ['at least 5 directions', (r) => r.phases.length >= 5],
      ['no direction has a time window', (r) => r.phases.every((p) => !p.window.trim())],
      ['related paths returned', (r) => r.relatedPaths.length >= 2],
      ['accounts of how people got in', (r) => r.howPeopleGotIn.length >= 1],
    ],
  },
  {
    name: 'career, built from the student\'s picks',
    request: { kind: 'career', goal: 'Finance and investment', profile, chosen: [{ category: 'People and communities', title: 'Join the student investment club' }, { category: 'Skills to build', title: 'Learn the three financial statements' }] },
    checks: [
      ['keeps exactly what they chose', (r) => r.phases.flatMap((p) => p.steps).length === 2],
      ['one phase per category chosen from', (r) => r.phases.length === 2],
      ['things to do for every step', (r) => r.phases.flatMap((p) => p.steps).every((s) => s.actions.length >= 3)],
      ['more recommendations in every category', (r) => r.phases.every((p) => p.more.length >= 2)],
    ],
  },
  {
    name: 'posting already applied to',
    request: {
      kind: 'job',
      goal: 'Software Engineering Intern at Stripe',
      profile,
      posting: { title: 'Software Engineering Intern', organizer: 'Stripe', type: 'internship', tags: ['Ruby', 'APIs', 'Backend'], materials: ['Resume'], prompts: [], status: 'applied' },
    },
    checks: [
      ['does not tell them to apply again', (r) => r.phases.flatMap((p) => p.steps).every((s) => s.kind !== 'apply')],
      ['has steps for after applying', (r) => r.phases.flatMap((p) => p.steps).some((s) => s.source === 'after')],
      ['names what the profile lacks', (r) => r.fit.missing.length >= 1],
      ['reports the selection process', (r) => r.process.length >= 1],
      ['every resource is a real link', (r) => r.phases.flatMap((p) => p.steps).flatMap((s) => s.resources).every((x) => /^https?:\/\//.test(x.url))],
    ],
  },
];

let failed = 0;
for (const c of cases) {
  const started = Date.now();
  try {
    const { data, citations } = await writeRoadmap(RoadmapRequest.parse(c.request));
    const steps = data.phases.flatMap((p) => p.steps);
    console.log(`${c.name}: ${data.phases.length} phases, ${steps.length} steps, ${citations.length} citations, ${Math.round((Date.now() - started) / 1000)}s`);
    for (const [label, ok] of c.checks) {
      const pass = ok(data);
      if (!pass) failed += 1;
      console.log(`  ${pass ? 'ok  ' : 'FAIL'} ${label}`);
    }
    console.log(`  summary: ${data.summary}\n`);
  } catch (error) {
    failed += c.checks.length;
    console.log(`${c.name}: FAILED after ${Math.round((Date.now() - started) / 1000)}s: ${error instanceof Error ? error.message : error}\n`);
  }
}
console.log(failed === 0 ? 'All checks passed. The dashboard will show these as written by the connected model.' : `${failed} check(s) failed. The prompt in src/roadmap.ts is the place to adjust.`);
process.exit(failed === 0 ? 0 : 1);
