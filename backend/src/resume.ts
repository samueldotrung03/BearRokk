// A student's résumé: the file they uploaded and the text read out of it for the agents.
// Held in memory with the rest of the student's data, and never written to disk.
import { extractText, getDocumentProxy } from 'unpdf';

export const RESUME_MAX_BYTES = 5 * 1024 * 1024;
export const RESUME_TYPES = ['application/pdf', 'text/plain'];

export interface Resume {
  name: string;
  type: string;
  size: number;
  uploadedAt: string;
  /** Text the agents can read. Null when none could be read from the file. */
  text: string | null;
  bytes: Uint8Array;
}

/** What the page is told about the résumé: everything but the file and its text. */
export type ResumeInfo = Omit<Resume, 'text' | 'bytes'> & { readable: boolean };

export const resumeInfo = (r: Resume | null): ResumeInfo | null =>
  r ? { name: r.name, type: r.type, size: r.size, uploadedAt: r.uploadedAt, readable: r.text !== null } : null;

const tidy = (text: string) => text.replace(/\u0000/g, '').replace(/[ \t]+/g, ' ').replace(/\n{3,}/g, '\n\n').trim();

/** Read the text out of an uploaded résumé. A scanned PDF with no text layer gives null. */
export async function readResume(bytes: Uint8Array, type: string): Promise<string | null> {
  try {
    if (type === 'text/plain') return tidy(new TextDecoder().decode(bytes)).slice(0, 20_000) || null;
    // unpdf takes ownership of the buffer it is given, so hand it a copy.
    const doc = await getDocumentProxy(bytes.slice());
    const { text } = await extractText(doc, { mergePages: true });
    return tidy(text).slice(0, 20_000) || null;
  } catch {
    return null;
  }
}
