import { describe, expect, it } from 'vitest';
import { formatBytes, mergeFound, moveBy, moveToGap, newTab, paragraphsOf, progressOf, removeTab, restoreTab, titleFromPrompt, updateTab, wordCount, wordStatus } from './tabs.ts';
import type { PortalTab } from './types.ts';

const tab = (id: string, extra: Partial<PortalTab> = {}): PortalTab => ({
  id,
  kind: 'question',
  title: id.toUpperCase(),
  prompt: '',
  wordLimit: null,
  body: '',
  files: [],
  source: 'agents',
  done: false,
  updatedAt: '2026-11-01T00:00:00.000Z',
  ...extra,
});
const ids = (tabs: PortalTab[]) => tabs.map((t) => t.id).join('');

describe('word count', () => {
  it('counts words separated by any white space and ignores stray punctuation', () => {
    expect(wordCount('')).toBe(0);
    expect(wordCount('   \n ')).toBe(0);
    expect(wordCount('I built a robot.\n\nIt — mostly — worked.')).toBe(7);
    expect(wordCount("don't stop, 2026 résumé")).toBe(4);
  });

  it('warns once the answer goes over the limit', () => {
    expect(wordStatus('one two three', 3)).toEqual({ count: 3, over: false, label: '3 of 3 words' });
    expect(wordStatus('one two three four', 3).over).toBe(true);
    expect(wordStatus('one', null)).toEqual({ count: 1, over: false, label: '1 word' });
  });
});

describe('paragraphs', () => {
  it('splits at blank lines and keeps single line breaks inside a paragraph', () => {
    expect(paragraphsOf('First line\nsame paragraph\n\n\nSecond\r\n\r\n  \n')).toEqual(['First line\nsame paragraph', 'Second']);
    expect(paragraphsOf('')).toEqual([]);
  });
});

describe('moving tabs', () => {
  const tabs = [tab('a'), tab('b'), tab('c'), tab('d')];

  it('drops a tab into the gap the drop line points at', () => {
    expect(ids(moveToGap(tabs, 'a', 0))).toBe('abcd');
    expect(ids(moveToGap(tabs, 'a', 1))).toBe('abcd');
    expect(ids(moveToGap(tabs, 'a', 2))).toBe('bacd');
    expect(ids(moveToGap(tabs, 'a', 4))).toBe('bcda');
    expect(ids(moveToGap(tabs, 'd', 0))).toBe('dabc');
    expect(ids(moveToGap(tabs, 'c', 1))).toBe('acbd');
    expect(ids(moveToGap(tabs, 'b', 99))).toBe('acdb');
    expect(ids(moveToGap(tabs, 'zz', 0))).toBe('abcd');
  });

  it('moves one place with the keyboard and stops at the ends', () => {
    expect(ids(moveBy(tabs, 'b', -1))).toBe('bacd');
    expect(ids(moveBy(tabs, 'b', 1))).toBe('acbd');
    expect(moveBy(tabs, 'a', -1)).toBe(tabs);
    expect(moveBy(tabs, 'd', 1)).toBe(tabs);
  });
});

describe('adding, editing and removing tabs', () => {
  it('makes a student tab, naming a question after its prompt', () => {
    const q = newTab('question', { prompt: 'Why do you want to work on our robotics team this summer?', wordLimit: 250 }, 'q1', 'now');
    expect(q).toMatchObject({ id: 'q1', kind: 'question', source: 'student', title: 'Why do you want to work…', wordLimit: 250, done: false, body: '', files: [] });
    expect(newTab('note', {}, 'n1').title).toBe('Untitled note');
    expect(newTab('upload', {}, 'u1').title).toBe('New upload');
    expect(newTab('question', { prompt: '  ', wordLimit: 0 }, 'q2')).toMatchObject({ title: 'New question', wordLimit: null });
    expect(titleFromPrompt('Short one.')).toBe('Short one');
  });

  it('updates one tab and stamps it', () => {
    const next = updateTab([tab('a'), tab('b')], 'b', { body: 'Hello', done: true }, 'later');
    expect(next[0]!.updatedAt).toBe('2026-11-01T00:00:00.000Z');
    expect(next[1]).toMatchObject({ body: 'Hello', done: true, updatedAt: 'later' });
  });

  it('puts a deleted tab back in its place on undo', () => {
    const tabs = [tab('a'), tab('b'), tab('c')];
    const { tabs: left, removed } = removeTab(tabs, 'b');
    expect(ids(left)).toBe('ac');
    expect(ids(restoreTab(left, removed!))).toBe('abc');
    // Undo after other tabs went still brings it back, at the end if its place is gone.
    expect(ids(restoreTab([tab('a')], { tab: tab('c'), index: 2 }))).toBe('ac');
    expect(removeTab(tabs, 'zz').removed).toBeNull();
  });

  it('counts finished parts', () => {
    expect(progressOf([tab('a', { done: true }), tab('b'), tab('c', { done: true })])).toEqual({ done: 2, total: 3 });
  });
});

describe('folding in what the agents found', () => {
  it('keeps the student order and edits, and adds only new tabs at the end', () => {
    const local = [tab('mine', { source: 'student' }), tab('b', { body: 'my draft' })];
    const found = [tab('b', { body: '' }), tab('x'), tab('mine'), tab('y')];
    const merged = mergeFound(local, found);
    expect(ids(merged)).toBe('minebxy');
    expect(merged[1]!.body).toBe('my draft');
    expect(mergeFound(local, [tab('b')])).toBe(local);
  });
});

describe('file sizes', () => {
  it('reads as bytes, KB or MB', () => {
    expect(formatBytes(1)).toBe('1 byte');
    expect(formatBytes(820)).toBe('820 bytes');
    expect(formatBytes(14 * 1024)).toBe('14 KB');
    expect(formatBytes(2.3 * 1024 * 1024)).toBe('2.3 MB');
  });
});
