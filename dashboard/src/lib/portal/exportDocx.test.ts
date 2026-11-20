import { Packer } from 'docx';
import { strFromU8, unzipSync } from 'fflate';
import { describe, expect, it } from 'vitest';
import { buildApplicationDocx, exportBlocks, exportFileName } from './exportDocx.ts';
import type { PortalTab } from './types.ts';

const base = { prompt: '', wordLimit: null, body: '', files: [], source: 'agents' as const, done: false, updatedAt: '2026-11-01T00:00:00.000Z' };
const tabs: PortalTab[] = [
  { ...base, id: 't1', kind: 'question', title: 'Why us', prompt: 'Why do you want to join the lab?', wordLimit: 300, body: 'Because of the rovers.\n\nAnd the people.' },
  { ...base, id: 't2', kind: 'upload', title: 'Resume', prompt: 'One page PDF.', files: [{ id: 'f1', name: 'resume-2026.pdf', size: 1000, type: 'application/pdf', addedAt: 'x' }] },
  { ...base, id: 't3', kind: 'note', title: 'People to ask', body: 'Professor Lee\nTA Sam', source: 'student' },
  { ...base, id: 't4', kind: 'question', title: 'Anything else', prompt: 'Is there anything else?' },
];
const meta = { title: 'Robotics Lab Internship', organizer: 'Cal Robotics', deadline: '2026-12-15T12:00:00.000Z' };

/** The words of document.xml in reading order, with the XML tags taken out. */
async function documentText(): Promise<string> {
  const buffer = await Packer.toBuffer(buildApplicationDocx(meta, tabs));
  const xml = strFromU8(unzipSync(new Uint8Array(buffer))['word/document.xml']!);
  return xml.replace(/<w:br\/>/g, '\n').replace(/<\/w:p>/g, '\n').replace(/<[^>]+>/g, '');
}

describe('export to .docx', () => {
  it('lays out the title block, then every tab in order with prompt and answer', () => {
    const blocks = exportBlocks(meta, tabs);
    expect(blocks.slice(0, 3)).toEqual([
      { type: 'title', text: 'Robotics Lab Internship' },
      { type: 'meta', text: 'Cal Robotics' },
      { type: 'meta', text: 'Deadline: December 15, 2026' },
    ]);
    const headings = blocks.filter((b) => b.type === 'heading').map((b) => b.text);
    expect(headings).toEqual(['Why us', 'Resume', 'People to ask', 'Anything else']);
    expect(blocks).toContainEqual({ type: 'prompt', text: 'Why do you want to join the lab?' });
    expect(blocks).toContainEqual({ type: 'small', text: '7 of 300 words' });
    expect(blocks).toContainEqual({ type: 'item', text: 'Attached: resume-2026.pdf' });
    expect(blocks).toContainEqual({ type: 'empty', text: 'No answer yet.' });
    expect(exportBlocks({ ...meta, deadline: null }, [])[2]).toEqual({ type: 'meta', text: 'Deadline: not given' });
  });

  it('writes every tab\'s text into the packed document, in order', async () => {
    const text = await documentText();
    const expected = [
      'Robotics Lab Internship',
      'Cal Robotics',
      'Deadline: December 15, 2026',
      'Why us',
      'Why do you want to join the lab?',
      'Because of the rovers.',
      'And the people.',
      'Resume',
      'One page PDF.',
      'resume-2026.pdf',
      'People to ask',
      'Professor Lee\nTA Sam',
      'Anything else',
      'Is there anything else?',
    ];
    let from = 0;
    for (const piece of expected) {
      const at = text.indexOf(piece, from);
      expect(at, `"${piece}" after position ${from}`).toBeGreaterThanOrEqual(0);
      from = at + piece.length;
    }
  });

  it('names the file after the application', () => {
    expect(exportFileName('Robotics Lab Internship')).toBe('Robotics Lab Internship application.docx');
    expect(exportFileName('A/B: test?')).toBe('A B test application.docx');
    expect(exportFileName('  ')).toBe('Untitled application.docx');
  });
});
