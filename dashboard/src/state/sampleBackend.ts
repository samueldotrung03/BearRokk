// A stand-in for the student's part of the backend in the public showcase (SAMPLE_FEED), which has
// no agents behind it. It answers the few calls the pages make to show the sample student's
// application portals and saved sheet, from the sample data, and says plainly that anything else
// needs the real agents. Nothing here is sent anywhere; portal edits last only this visit.
import { SHEET_COLUMNS } from '../components/saved/SheetView.tsx';
import { applicationInfo, opportunities } from '../data/sample.ts';
import { statusLabel } from '../lib/applications.ts';
import type { Portal, PortalApplication, PortalTab } from '../lib/portal/types.ts';
import type { ApplicationStatus, Opportunity } from '../types.ts';

export interface SampleContext {
  saved: string[];
  applications: Record<string, { status: ApplicationStatus }>;
}

const NOTE = 'This is the public sample copy of BearRok, so there are no agents behind it to do that.';

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

// Portal tabs written during this visit, by application.
const portals = new Map<string, PortalTab[]>();

function sampleTabs(o: Opportunity): PortalTab[] {
  const info = applicationInfo[o.id];
  const at = o.foundAt;
  const tab = (id: string, kind: PortalTab['kind'], title: string, prompt: string): PortalTab => ({
    id,
    kind,
    title,
    prompt,
    wordLimit: Number(/\((\d+) words\)/.exec(prompt)?.[1]) || null,
    body: '',
    files: [],
    source: 'posting',
    done: false,
    updatedAt: at,
  });
  return [
    ...(info?.prompts ?? []).map((p, i) => tab(`sample-q-${i}`, 'question', `Question ${i + 1}`, p)),
    ...(info?.materials ?? []).map((m, i) => tab(`sample-u-${i}`, 'upload', m, `Upload: ${m}`)),
  ];
}

function application(o: Opportunity, status: ApplicationStatus, tabs: PortalTab[]): PortalApplication {
  return {
    opportunityId: o.id,
    title: o.title,
    organizer: o.organizer,
    status,
    deadline: o.deadline,
    actionUrl: o.actionUrl,
    custom: false,
    updatedAt: o.lastCheckedAt,
    progress: { done: tabs.filter((t) => t.done).length, total: tabs.length },
  };
}

const daysLeft = (deadline: string | null) => (deadline ? String(Math.ceil((Date.parse(deadline) - Date.now()) / 86_400_000)) : '');

/** The saved list as the backend's tracker sheet writes it, one row per saved sample posting. */
function sheet(ctx: SampleContext) {
  const saved = opportunities.filter((o) => ctx.saved.includes(o.id));
  const rows = saved.map((o) => {
    const info = applicationInfo[o.id];
    const cell: Record<string, string> = {
      Opportunity: o.title,
      Organizer: o.organizer,
      Type: o.type,
      Status: statusLabel[ctx.applications[o.id]?.status ?? 'interested'],
      Deadline: o.deadline?.slice(0, 10) ?? 'Unknown',
      'Days left': daysLeft(o.deadline),
      'Deadline from': o.deadline ? 'Sample posting' : '',
      Starts: o.startTime?.slice(0, 10) ?? '',
      Format: o.format?.replace('_', ' ') ?? '',
      Location: o.location ?? '',
      'Who can apply': o.eligibility ?? '',
      'Apply link': o.actionUrl ?? '',
      'Official page': o.sourceUrl,
      'Materials needed': (info?.materials ?? []).join('; '),
      'Application questions': (info?.prompts ?? []).join(' | '),
      Calendar: '',
      'Next reminder': '',
      'Saved on': o.foundAt.slice(0, 10),
      Fit: `${Math.round(o.baseScore * 100)}%`,
    };
    return SHEET_COLUMNS.map((c) => cell[c] ?? '');
  });
  return { header: SHEET_COLUMNS, rows, ids: saved.map((o) => o.id) };
}

/** What the backend would answer for one call under /api/students/:id, in the sample copy. */
export async function sampleRequest(path: string, init: RequestInit, ctx: SampleContext): Promise<Response> {
  const method = (init.method ?? 'GET').toUpperCase();
  if (path === '/sheet' && method === 'GET') return json(sheet(ctx));
  const portal = /^\/applications\/([^/]+)\/portal(\/draft)?$/.exec(path);
  if (portal) {
    const id = decodeURIComponent(portal[1] ?? '');
    const o = opportunities.find((x) => x.id === id);
    const status = ctx.applications[id]?.status;
    if (!o || !status) return json({ error: 'not found' }, 404);
    if (method === 'PUT') {
      const body = JSON.parse(String(init.body ?? '{}')) as { tabs?: PortalTab[] };
      portals.set(id, body.tabs ?? []);
    }
    const tabs = portals.get(id) ?? sampleTabs(o);
    const result: Portal = { tabs, drafted: { at: o.foundAt, found: tabs.length > 0, note: 'Sample questions and uploads, taken from the sample posting.' } };
    return json({ application: application(o, status, tabs), portal: result });
  }
  // Status changes are kept by the app itself in the sample copy.
  if (/^\/applications\/[^/]+$/.test(path) && method === 'PUT') return json({ ok: true });
  return json({ error: NOTE }, 503);
}
