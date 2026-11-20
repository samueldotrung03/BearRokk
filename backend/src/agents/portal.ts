// The application portal's rules, kept apart from the agent system so they can be tested alone:
// what a saved tab may hold, how the agents' finds become tabs, and how those are merged into
// what the student already has without touching their work.
import { randomBytes } from 'node:crypto';
import type { DraftedApplication } from './brain.ts';
import type { ApplicationInfo, Portal, PortalFile, PortalTab, PortalTabKind } from './types.ts';

/**
 * Sizes that keep a portal, and every portal on one account, inside the 1 MB document the
 * learned memory is stored in. The byte limits are on the stored JSON.
 */
export const PORTAL_LIMITS = {
  tabs: 40,
  title: 120,
  prompt: 2000,
  body: 40_000,
  filesPerTab: 20,
  fileName: 200,
  fileType: 100,
  id: 64,
  wordLimit: 20_000,
  /** One application's portal. */
  portalBytes: 200_000,
  /** Every portal on the account together, leaving room for the rest of the learned memory. */
  accountBytes: 500_000,
} as const;

const KINDS: PortalTabKind[] = ['question', 'upload', 'note'];
const SOURCES: PortalTab['source'][] = ['posting', 'agents', 'student'];

export const emptyPortal = (): Portal => ({ tabs: [], drafted: null });
export const newTabId = () => `tab-${randomBytes(6).toString('hex')}`;
const newFileId = () => `file-${randomBytes(6).toString('hex')}`;

/** Bytes a portal takes when stored. */
export const portalBytes = (portal: Portal) => Buffer.byteLength(JSON.stringify(portal));

const text = (v: unknown, max: number) => (typeof v === 'string' ? v.slice(0, max) : '');
const isoOr = (v: unknown, fallback: string) => (typeof v === 'string' && !Number.isNaN(Date.parse(v)) ? new Date(v).toISOString() : fallback);

function cleanWordLimit(v: unknown): number | null {
  return typeof v === 'number' && Number.isInteger(v) && v > 0 && v <= PORTAL_LIMITS.wordLimit ? v : null;
}

/** A file's details only: anything else sent with it (such as the contents) is dropped. */
function cleanFiles(raw: unknown, now: string): PortalFile[] {
  if (!Array.isArray(raw)) return [];
  const seen = new Set<string>();
  const out: PortalFile[] = [];
  for (const f of raw) {
    if (!f || typeof f !== 'object' || typeof f.name !== 'string' || !f.name.trim()) continue;
    let id = text(f.id, PORTAL_LIMITS.id);
    if (!id || seen.has(id)) id = newFileId();
    seen.add(id);
    out.push({
      id,
      name: f.name.slice(0, PORTAL_LIMITS.fileName),
      size: typeof f.size === 'number' && Number.isFinite(f.size) && f.size >= 0 ? Math.floor(f.size) : 0,
      type: text(f.type, PORTAL_LIMITS.fileType),
      addedAt: isoOr(f.addedAt, now),
    });
    if (out.length === PORTAL_LIMITS.filesPerTab) break;
  }
  return out;
}

/** True when the student would see a difference between the two. */
function sameContent(a: PortalTab, b: Omit<PortalTab, 'updatedAt' | 'source' | 'id'>) {
  return a.kind === b.kind && a.title === b.title && a.prompt === b.prompt && a.wordLimit === b.wordLimit && a.body === b.body && a.done === b.done && JSON.stringify(a.files) === JSON.stringify(b.files);
}

/**
 * The tabs a page sent, made safe to store: unknown kinds are dropped, text is cut to the limits,
 * order and ids are kept. Where a tab came from is the server's record, so a page cannot relabel
 * the student's own tab as the posting's; a tab the server has not seen is the student's.
 * updatedAt moves only for a tab whose content changed.
 */
export function cleanTabs(raw: unknown[], previous: PortalTab[], now: string): PortalTab[] {
  const before = new Map(previous.map((t) => [t.id, t]));
  const seen = new Set<string>();
  const out: PortalTab[] = [];
  for (const t of raw) {
    if (out.length === PORTAL_LIMITS.tabs) break;
    if (!t || typeof t !== 'object') continue;
    const r = t as Record<string, unknown>;
    if (!KINDS.includes(r.kind as PortalTabKind)) continue;
    let id = text(r.id, PORTAL_LIMITS.id);
    if (!id || seen.has(id)) id = newTabId();
    seen.add(id);
    const old = before.get(id);
    const content = {
      kind: r.kind as PortalTabKind,
      title: text(r.title, PORTAL_LIMITS.title),
      prompt: text(r.prompt, PORTAL_LIMITS.prompt),
      wordLimit: cleanWordLimit(r.wordLimit),
      body: text(r.body, PORTAL_LIMITS.body),
      files: cleanFiles(r.files, now),
      done: r.done === true,
    };
    const source = old ? old.source : 'student';
    const updatedAt = old && sameContent(old, content) ? old.updatedAt : now;
    out.push({ id, ...content, source: SOURCES.includes(source) ? source : 'student', updatedAt });
  }
  return out;
}

/** Text compared without case, accents, punctuation or spacing, so the same prompt is seen as the same. */
export function normalise(s: string) {
  return s
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

/** A word limit the prompt itself states, such as "(500 words)" or "in 200 words or fewer". */
export function wordLimitIn(prompt: string): number | null {
  const m = prompt.match(/\b(\d{2,5})\s*(?:-|\s)?\s*words?\b/i) ?? prompt.match(/\bwords?\s*(?:limit|max(?:imum)?)\s*:?\s*(\d{2,5})\b/i);
  return m ? cleanWordLimit(Number(m[1])) : null;
}

/** A short name for the left bar, from the prompt's own words. */
export function questionTitle(prompt: string) {
  const clean = prompt.replace(/\s+/g, ' ').trim().replace(/[?.!:]+$/, '');
  const words = clean.split(' ');
  return (words.length > 7 ? `${words.slice(0, 7).join(' ')}...` : clean).slice(0, PORTAL_LIMITS.title);
}

/** A short name for an upload: the usual documents get their usual name. */
export function uploadTitle(material: string) {
  const m = material.toLowerCase();
  if (/cover letter/.test(m)) return 'Cover letter';
  if (/r[eé]sum[eé]|\bcv\b|curriculum vitae/.test(m)) return 'Résumé';
  if (/transcript/.test(m)) return 'Transcript';
  if (/portfolio/.test(m)) return 'Portfolio';
  if (/recommendation|reference/.test(m)) return 'Recommendation';
  if (/writing sample/.test(m)) return 'Writing sample';
  return questionTitle(material);
}

/** Tabs for what the posting's own application reader found. */
export function tabsFromPosting(info: ApplicationInfo | null, now: string): PortalTab[] {
  if (!info) return [];
  return [
    ...info.prompts.filter((p) => p.trim()).map((p) => draftTab('question', questionTitle(p), p, wordLimitIn(p), 'posting', now)),
    ...info.materials.filter((m) => m.trim()).map((m) => draftTab('upload', uploadTitle(m), m, null, 'posting', now)),
  ];
}

/** Tabs for what the application drafter found. */
export function tabsFromDraft(draft: DraftedApplication, now: string): PortalTab[] {
  return [
    ...draft.questions.filter((q) => q.prompt.trim()).map((q) => draftTab('question', q.title.trim() || questionTitle(q.prompt), q.prompt, cleanWordLimit(q.wordLimit) ?? wordLimitIn(q.prompt), 'agents', now)),
    ...draft.uploads.filter((u) => u.title.trim() || u.prompt.trim()).map((u) => draftTab('upload', u.title.trim() || uploadTitle(u.prompt), u.prompt, null, 'agents', now)),
  ];
}

function draftTab(kind: PortalTabKind, title: string, prompt: string, wordLimit: number | null, source: PortalTab['source'], now: string): PortalTab {
  return { id: newTabId(), kind, title: title.slice(0, PORTAL_LIMITS.title), prompt: prompt.trim().slice(0, PORTAL_LIMITS.prompt), wordLimit, body: '', files: [], source, done: false, updatedAt: now };
}

/**
 * Add the drafted tabs after the student's. Nothing already there is replaced, moved or removed,
 * so the student's own tabs and anything they wrote or attached are safe. A question whose prompt
 * is already on a tab, or an upload already asked for, is not added again.
 */
export function mergeTabs(existing: PortalTab[], incoming: PortalTab[]): { tabs: PortalTab[]; added: PortalTab[] } {
  const prompts = new Set(existing.map((t) => normalise(t.prompt)).filter(Boolean));
  const uploads = new Set(existing.filter((t) => t.kind === 'upload').map((t) => normalise(t.title)).filter(Boolean));
  const tabs = [...existing];
  const added: PortalTab[] = [];
  for (const t of incoming) {
    if (tabs.length >= PORTAL_LIMITS.tabs) break;
    const p = normalise(t.prompt);
    const u = t.kind === 'upload' ? normalise(t.title) : '';
    if ((p && prompts.has(p)) || (u && uploads.has(u))) continue;
    if (p) prompts.add(p);
    if (u) uploads.add(u);
    tabs.push(t);
    added.push(t);
  }
  return { tabs, added };
}

/** The drafter's answer with sizes capped, so a long or odd answer cannot fill the account. */
export function cleanDraft(d: DraftedApplication): DraftedApplication {
  return {
    questions: d.questions.slice(0, 25).map((q) => ({ title: q.title.slice(0, PORTAL_LIMITS.title), prompt: q.prompt.slice(0, PORTAL_LIMITS.prompt), wordLimit: cleanWordLimit(q.wordLimit) })),
    uploads: d.uploads.slice(0, 15).map((u) => ({ title: u.title.slice(0, PORTAL_LIMITS.title), prompt: u.prompt.slice(0, PORTAL_LIMITS.prompt) })),
    found: d.found && (d.questions.length > 0 || d.uploads.length > 0),
    note: d.note.slice(0, 500),
  };
}
