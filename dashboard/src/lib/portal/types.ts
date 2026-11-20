// The application portal: one application written inside BearRok, Common App style. Each part of
// the application is a tab (a question to answer, something to upload, or the student's own note),
// kept with the student's account so nothing lives in scattered Google Docs. The same shapes are
// in backend/src/agents/types.ts; the backend is the source of truth.
import type { ApplicationStatus } from '../../types.ts';

export type PortalTabKind = 'question' | 'upload' | 'note';

export interface PortalFile {
  id: string;
  name: string;
  size: number;
  type: string;
  addedAt: string;
}

export interface PortalTab {
  id: string;
  kind: PortalTabKind;
  /** Short name shown in the left bar, e.g. "Why this company" or "Résumé". */
  title: string;
  /** question: the prompt as the organizer words it. upload: what to upload and any rules. note: empty. */
  prompt: string;
  /** A word limit when the organizer gives one. */
  wordLimit: number | null;
  /** The student's answer or note: plain text, paragraphs split by blank lines. */
  body: string;
  /** upload tabs: the files attached. The account keeps names and sizes; the contents stay on this device. */
  files: PortalFile[];
  /** Where the tab came from: the posting itself, the agents' search, or the student. */
  source: 'posting' | 'agents' | 'student';
  /** The student ticked this part as finished. */
  done: boolean;
  updatedAt: string;
}

export interface Portal {
  /** In the order the student arranged them. */
  tabs: PortalTab[];
  /** The agents' last look for this application's questions and uploads. */
  drafted: { at: string; found: boolean; note: string } | null;
}

/** An application as the Applications page lists it. */
export interface PortalApplication {
  /** The posting's id, or "custom-..." for one the student made without a posting. */
  opportunityId: string;
  title: string;
  organizer: string;
  status: ApplicationStatus;
  deadline: string | null;
  actionUrl: string | null;
  custom: boolean;
  updatedAt: string;
  /** Tabs done out of tabs in all, for progress on the list. */
  progress: { done: number; total: number };
}

/*
 * Backend routes, under /api/students/:id (call them with useLive().request(path, init); paths
 * below are relative to that base):
 *
 *   GET    /applications                         { applications: Application[] }  (existing; each now has `custom` and `portal`)
 *   POST   /applications                         body { opportunityId } | { title, organizer?, deadline?, actionUrl? }
 *                                                -> { application }  status to_apply unless the posting is already tracked
 *   GET    /applications/:id/portal              -> { application, portal }  (a portal with no tabs yet is { tabs: [], drafted: null })
 *   PUT    /applications/:id/portal              body { tabs: PortalTab[] } -> { portal }   whole list, in order; ids kept
 *   POST   /applications/:id/portal/draft        -> { portal }  the agents look for the questions and uploads and add them
 *                                                as tabs (source 'posting' or 'agents'); tabs the student made or wrote in are never
 *                                                replaced; drafted.found false with a note when nothing could be found
 *   PUT    /applications/:id                     body { status: 'applied' } marks it done (existing route)
 *   DELETE /applications/:id                     stop tracking (existing route); a custom one is removed
 */
