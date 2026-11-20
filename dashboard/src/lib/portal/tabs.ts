// The rules for an application portal's tabs, kept apart from the page so they can be tested:
// counting words, moving tabs, adding and removing them, and folding the agents' newly found
// questions into what the student already has without losing anything they wrote.
import type { PortalTab, PortalTabKind } from './types.ts';

/** What the account keeps of a portal (PORTAL_LIMITS in backend/src/agents/portal.ts); more is cut off there. */
export const TAB_LIMITS = { tabs: 40, title: 120, prompt: 2000, body: 40_000 };

/** Words as an essay box counts them: runs of text that hold at least one letter or digit. */
export function wordCount(text: string): number {
  return text.split(/\s+/).filter((token) => /[\p{L}\p{N}]/u.test(token)).length;
}

/** How a word count reads next to its limit, and whether it is over. */
export function wordStatus(text: string, limit: number | null): { count: number; over: boolean; label: string } {
  const count = wordCount(text);
  const words = count === 1 ? 'word' : 'words';
  if (!limit) return { count, over: false, label: `${count} ${words}` };
  return { count, over: count > limit, label: `${count} of ${limit} words` };
}

/** Plain text split into paragraphs at blank lines; each paragraph keeps its single line breaks. */
export function paragraphsOf(body: string): string[] {
  return body
    .replace(/\r\n?/g, '\n')
    .split(/\n[ \t]*\n/)
    .map((p) => p.replace(/^\n+|\n+$/g, '').trimEnd())
    .filter((p) => p.trim() !== '');
}

/**
 * Moves a tab to a gap in the list as it was before the move: gap 0 is above the first tab, gap
 * `tabs.length` below the last. This is what a drop line between two tabs points at.
 */
export function moveToGap(tabs: PortalTab[], id: string, gap: number): PortalTab[] {
  const from = tabs.findIndex((t) => t.id === id);
  if (from < 0) return tabs;
  const g = Math.max(0, Math.min(tabs.length, gap));
  // Gaps below the tab shift up by one once the tab is lifted out.
  const to = g > from ? g - 1 : g;
  if (to === from) return tabs;
  const next = [...tabs];
  const [tab] = next.splice(from, 1);
  next.splice(to, 0, tab!);
  return next;
}

/** Moves a tab one place up (-1) or down (+1); at either end it stays where it is. */
export function moveBy(tabs: PortalTab[], id: string, delta: -1 | 1): PortalTab[] {
  const from = tabs.findIndex((t) => t.id === id);
  if (from < 0) return tabs;
  const to = from + delta;
  if (to < 0 || to >= tabs.length) return tabs;
  const next = [...tabs];
  [next[from], next[to]] = [next[to]!, next[from]!];
  return next;
}

const defaultTitle: Record<PortalTabKind, string> = { question: 'New question', upload: 'New upload', note: 'Untitled note' };

/** A short left-bar name drawn from a question's prompt: its first few words. */
export function titleFromPrompt(prompt: string, max = 6): string {
  const words = prompt.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return '';
  const head = words.slice(0, max).join(' ').replace(/[.,;:!?]+$/, '');
  return words.length > max ? `${head}…` : head;
}

/** A tab the student adds by hand. */
export function newTab(
  kind: PortalTabKind,
  fields: { title?: string; prompt?: string; wordLimit?: number | null } = {},
  id: string = makeId('tab'),
  now: string = new Date().toISOString(),
): PortalTab {
  const prompt = fields.prompt?.trim() ?? '';
  const title = fields.title?.trim() || (kind === 'question' ? titleFromPrompt(prompt) : '') || defaultTitle[kind];
  return { id, kind, title, prompt, wordLimit: fields.wordLimit && fields.wordLimit > 0 ? Math.round(fields.wordLimit) : null, body: '', files: [], source: 'student', done: false, updatedAt: now };
}

/** Changes one tab's fields and stamps it as changed. */
export function updateTab(tabs: PortalTab[], id: string, patch: Partial<Omit<PortalTab, 'id'>>, now: string = new Date().toISOString()): PortalTab[] {
  return tabs.map((t) => (t.id === id ? { ...t, ...patch, updatedAt: now } : t));
}

/** Takes a tab out, remembering where it was so an undo can put it back in the same place. */
export function removeTab(tabs: PortalTab[], id: string): { tabs: PortalTab[]; removed: { tab: PortalTab; index: number } | null } {
  const index = tabs.findIndex((t) => t.id === id);
  if (index < 0) return { tabs, removed: null };
  return { tabs: tabs.filter((t) => t.id !== id), removed: { tab: tabs[index]!, index } };
}

/** Puts a removed tab back where it was (or at the end if the list has since got shorter). */
export function restoreTab(tabs: PortalTab[], removed: { tab: PortalTab; index: number }): PortalTab[] {
  if (tabs.some((t) => t.id === removed.tab.id)) return tabs;
  const next = [...tabs];
  next.splice(Math.min(removed.index, next.length), 0, removed.tab);
  return next;
}

/** Parts ticked as finished out of all parts. */
export function progressOf(tabs: PortalTab[]): { done: number; total: number } {
  return { done: tabs.filter((t) => t.done).length, total: tabs.length };
}

/**
 * What the agents' search came back with, folded into the tabs on screen. The student's own list
 * wins: their order, their edits and their own tabs stay as they are, and only tabs the screen
 * does not have yet are added, at the end, in the order the agents gave them.
 */
export function mergeFound(local: PortalTab[], found: PortalTab[]): PortalTab[] {
  const have = new Set(local.map((t) => t.id));
  const added = found.filter((t) => !have.has(t.id));
  return added.length ? [...local, ...added] : local;
}

/** True when two tab lists hold the same tabs in the same order with the same contents. */
export function sameTabs(a: PortalTab[], b: PortalTab[]): boolean {
  return a.length === b.length && a.every((t, i) => JSON.stringify(t) === JSON.stringify(b[i]));
}

/** A readable size: "820 bytes", "14 KB", "2.3 MB". */
export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} ${bytes === 1 ? 'byte' : 'bytes'}`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  const mb = bytes / (1024 * 1024);
  return `${mb < 10 ? mb.toFixed(1) : Math.round(mb)} MB`;
}

/** An id unique enough for tabs and files on one account. */
export function makeId(prefix: string): string {
  const random = typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID().slice(0, 8) : Math.random().toString(36).slice(2, 10);
  return `${prefix}-${Date.now().toString(36)}-${random}`;
}
