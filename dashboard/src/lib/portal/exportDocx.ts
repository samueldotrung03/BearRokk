// The application as a Word document. The content is laid out first as plain blocks (title,
// organizer, deadline, then every tab in the student's order) so it can be tested without opening
// a .docx, and the blocks are then turned into a `docx` Document for download.
import { Document, HeadingLevel, Packer, Paragraph, TextRun } from 'docx';
import { longDate } from './dates.ts';
import { paragraphsOf, wordStatus } from './tabs.ts';
import type { PortalTab } from './types.ts';

export interface ExportMeta {
  title: string;
  organizer: string;
  deadline: string | null;
}

export type ExportBlock =
  | { type: 'title'; text: string }
  | { type: 'meta'; text: string }
  | { type: 'heading'; text: string }
  /** The organizer's prompt or upload rules, set in italics. */
  | { type: 'prompt'; text: string }
  /** A line about the answer, such as its word count. */
  | { type: 'small'; text: string }
  /** One paragraph of the student's writing; single line breaks inside it are kept. */
  | { type: 'paragraph'; text: string }
  /** One attached file. */
  | { type: 'item'; text: string }
  /** Something missing, such as an answer not written yet. */
  | { type: 'empty'; text: string };

/** The document's content, in reading order. */
export function exportBlocks(meta: ExportMeta, tabs: PortalTab[]): ExportBlock[] {
  const blocks: ExportBlock[] = [{ type: 'title', text: meta.title }];
  if (meta.organizer) blocks.push({ type: 'meta', text: meta.organizer });
  blocks.push({ type: 'meta', text: meta.deadline ? `Deadline: ${longDate(meta.deadline)}` : 'Deadline: not given' });

  for (const tab of tabs) {
    blocks.push({ type: 'heading', text: tab.title || 'Untitled' });
    if (tab.kind !== 'note' && tab.prompt.trim()) blocks.push({ type: 'prompt', text: tab.prompt.trim() });
    if (tab.kind === 'upload') {
      if (tab.files.length === 0) blocks.push({ type: 'empty', text: 'No files attached yet.' });
      for (const file of tab.files) blocks.push({ type: 'item', text: `Attached: ${file.name}` });
      // Some upload parts also carry the student's own notes about the file.
      for (const p of paragraphsOf(tab.body)) blocks.push({ type: 'paragraph', text: p });
      continue;
    }
    const paragraphs = paragraphsOf(tab.body);
    if (tab.kind === 'question' && paragraphs.length) blocks.push({ type: 'small', text: wordStatus(tab.body, tab.wordLimit).label });
    if (paragraphs.length === 0) blocks.push({ type: 'empty', text: tab.kind === 'question' ? 'No answer yet.' : 'Empty note.' });
    for (const p of paragraphs) blocks.push({ type: 'paragraph', text: p });
  }
  return blocks;
}

/** Text with its line breaks kept as Word line breaks. */
function runs(text: string, style: { italics?: boolean; size?: number; color?: string } = {}): TextRun[] {
  return text.split('\n').map((line, i) => new TextRun({ text: line, break: i > 0 ? 1 : undefined, ...style }));
}

function toParagraph(block: ExportBlock): Paragraph {
  switch (block.type) {
    case 'title':
      return new Paragraph({ heading: HeadingLevel.TITLE, children: runs(block.text) });
    case 'meta':
      return new Paragraph({ children: runs(block.text, { color: '46617D' }), spacing: { after: 60 } });
    case 'heading':
      return new Paragraph({ heading: HeadingLevel.HEADING_1, children: runs(block.text), spacing: { before: 360, after: 120 } });
    case 'prompt':
      return new Paragraph({ children: runs(block.text, { italics: true }), spacing: { after: 160 } });
    case 'small':
      return new Paragraph({ children: runs(block.text, { size: 18, color: '71849A' }), spacing: { after: 120 } });
    case 'item':
      return new Paragraph({ children: runs(block.text), bullet: { level: 0 } });
    case 'empty':
      return new Paragraph({ children: runs(block.text, { italics: true, color: '71849A' }) });
    case 'paragraph':
      return new Paragraph({ children: runs(block.text), spacing: { after: 200, line: 300 } });
  }
}

/** The Word document for an application. */
export function buildApplicationDocx(meta: ExportMeta, tabs: PortalTab[]): Document {
  return new Document({
    title: `${meta.title} application`,
    creator: 'BearRok',
    styles: { default: { document: { run: { font: 'Georgia', size: 24 } } } },
    sections: [{ children: exportBlocks(meta, tabs).map(toParagraph) }],
  });
}

/** "<title> application.docx", with characters file systems refuse taken out. */
export function exportFileName(title: string): string {
  const safe = title.replace(/[\\/:*?"<>|\u0000-\u001f]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 120);
  return `${safe || 'Untitled'} application.docx`;
}

/** Builds the document and hands it to the browser as a download. */
export async function downloadApplicationDocx(meta: ExportMeta, tabs: PortalTab[]): Promise<void> {
  const blob = await Packer.toBlob(buildApplicationDocx(meta, tabs));
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = exportFileName(meta.title);
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}
