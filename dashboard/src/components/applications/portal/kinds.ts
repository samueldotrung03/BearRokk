// How each kind of portal tab is named and drawn, shared by the left bar, the add menu and the editor.
import { MessageSquareText, Paperclip, StickyNote, type LucideIcon } from 'lucide-react';
import type { PortalTab, PortalTabKind } from '../../../lib/portal/types.ts';

export const kindIcon: Record<PortalTabKind, LucideIcon> = { question: MessageSquareText, upload: Paperclip, note: StickyNote };

export const kindLabel: Record<PortalTabKind, string> = { question: 'Question', upload: 'Upload', note: 'Note' };

export const kindHint: Record<PortalTabKind, string> = {
  question: 'A prompt to answer, with a word limit if there is one',
  upload: 'A file to attach, such as a résumé or transcript',
  note: 'A free document for drafts, lists or anything else',
};

export const sourceLabel: Record<PortalTab['source'], string> = {
  posting: 'From the posting',
  agents: 'Found by your agents',
  student: 'Added by you',
};
