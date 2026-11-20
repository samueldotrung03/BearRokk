// One application, open for work: the header, the left bar of parts, and the selected part's
// editor. It owns the tab list, saves it to the account as the student works (autosave.ts), asks
// the agents for the application's questions when there are none yet, and marks it done.
import { LoaderCircle, Search } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { createSaver, type SaveState, type Saver } from '../../../lib/portal/autosave.ts';
import { TAB_LIMITS, mergeFound, moveBy, moveToGap, newTab, progressOf, removeTab, restoreTab, sameTabs, updateTab } from '../../../lib/portal/tabs.ts';
import type { Portal, PortalApplication, PortalTab, PortalTabKind } from '../../../lib/portal/types.ts';
import { useLive } from '../../../state/live.tsx';
import { useStore } from '../../../state/StoreProvider.tsx';
import type { ApplicationStatus } from '../../../types.ts';
import { Card } from '../../Page.tsx';
import { deleteTabFiles } from './fileStore.ts';
import { kindIcon, kindLabel } from './kinds.ts';
import { PortalHeader } from './PortalHeader.tsx';
import { TabEditor, type TabPatch } from './TabEditor.tsx';
import { TabList } from './TabList.tsx';
import { UndoToast } from './UndoToast.tsx';

type Removed = { tab: PortalTab; index: number };

/** How long a deleted part can be brought back. */
const UNDO_MS = 8000;

const LOOKING = "Your agents are looking for this application's questions and uploads…";

function QuickAdd({ onAdd }: { onAdd: (kind: PortalTabKind) => void }) {
  return (
    <div className="mt-5 flex flex-wrap gap-2">
      {(['question', 'upload', 'note'] as const).map((kind) => {
        const Icon = kindIcon[kind];
        return (
          <button key={kind} type="button" className="pt-btn" onClick={() => onAdd(kind)}>
            <Icon className="size-4" aria-hidden="true" />
            Add {kind === 'upload' ? 'an upload' : `a ${kindLabel[kind].toLowerCase()}`}
          </button>
        );
      })}
    </div>
  );
}

/** The right side when there is no part to show yet. */
function EmptyPane({
  drafting,
  drafted,
  problem,
  onAdd,
  onFind,
}: {
  drafting: boolean;
  drafted: Portal['drafted'];
  problem: string | null;
  onAdd: (kind: PortalTabKind) => void;
  onFind: () => void;
}) {
  if (drafting)
    return (
      <div className="pt-empty" role="status">
        <LoaderCircle className="size-6 animate-spin text-brand" aria-hidden="true" />
        <p className="pt-empty-title">{LOOKING}</p>
        <p className="pt-empty-text">They read the posting and the organizer's pages for every question and file it asks for. This can take a minute; you can add your own parts meanwhile.</p>
        <QuickAdd onAdd={onAdd} />
      </div>
    );
  if (problem)
    return (
      <div className="pt-empty">
        <p className="pt-empty-title">The agents could not look just now</p>
        <p className="pt-empty-text">{problem}</p>
        <button type="button" className="btn-primary mt-4 flex items-center gap-2 px-4 py-2 text-sm text-white" onClick={onFind}>
          <Search className="size-4" aria-hidden="true" />
          Try again
        </button>
        <QuickAdd onAdd={onAdd} />
      </div>
    );
  if (drafted && !drafted.found)
    return (
      <div className="pt-empty">
        <p className="pt-empty-title">Your agents could not find this application's questions</p>
        {drafted.note && <p className="pt-empty-text">{drafted.note}</p>}
        <p className="pt-empty-text">Add the questions yourself: copy each prompt from the organizer's form into a question, and add an upload for each file it asks for.</p>
        <QuickAdd onAdd={onAdd} />
      </div>
    );
  return (
    <div className="pt-empty">
      <p className="pt-empty-title">No parts yet</p>
      <p className="pt-empty-text">Add the application's questions and uploads, or a note of your own.</p>
      <QuickAdd onAdd={onAdd} />
    </div>
  );
}

export function PortalWorkspace({ id, application, portal }: { id: string; application: PortalApplication; portal: Portal }) {
  const live = useLive();
  const liveRef = useRef(live);
  liveRef.current = live;
  const { dispatch } = useStore();
  const base = `/applications/${encodeURIComponent(id)}`;

  const [tabs, setTabs] = useState<PortalTab[]>(portal.tabs);
  const tabsRef = useRef<PortalTab[]>(portal.tabs);
  const [selectedId, setSelectedId] = useState<string | null>(portal.tabs[0]?.id ?? null);
  const [focusId, setFocusId] = useState<string | null>(null);
  const [saveState, setSaveState] = useState<SaveState>('saved');
  const [saveProblem, setSaveProblem] = useState<string | null>(null);
  const saver = useRef<Saver<PortalTab[]> | null>(null);

  const [drafted, setDrafted] = useState(portal.drafted);
  // A portal with nothing in it shows the agents' search from the first paint; it starts below.
  const needsDraft = portal.tabs.length === 0 && portal.drafted === null;
  const [drafting, setDrafting] = useState(needsDraft);
  const [draftProblem, setDraftProblem] = useState<string | null>(null);

  const [status, setStatus] = useState<ApplicationStatus>(application.status);
  const [statusBusy, setStatusBusy] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);

  const [undo, setUndo] = useState<Removed | null>(null);
  const undoRef = useRef<Removed | null>(null);

  // ---- saving --------------------------------------------------------------------------------
  // The whole list goes to the account after a typing pause, at once after structural changes,
  // and once more when the page is left or hidden.
  useEffect(() => {
    const s = createSaver<PortalTab[]>({
      save: async (list) => {
        const res = await liveRef.current.request(`${base}/portal`, { method: 'PUT', body: JSON.stringify({ tabs: list }) });
        if (res.status === 413) {
          // Too long for the account: say so, and keep retrying so it saves once it is shortened.
          const body = (await res.json().catch(() => ({}))) as { error?: string };
          setSaveProblem(body.error ?? 'This application is too long to save. Shorten an answer or remove a part.');
        }
        if (!res.ok) throw new Error(`The account answered ${res.status}`);
        setSaveProblem(null);
      },
      onState: setSaveState,
    });
    saver.current = s;
    const flush = () => s.flush();
    const hidden = () => {
      if (document.visibilityState === 'hidden') s.flush();
    };
    window.addEventListener('pagehide', flush);
    window.addEventListener('beforeunload', flush);
    document.addEventListener('visibilitychange', hidden);
    return () => {
      window.removeEventListener('pagehide', flush);
      window.removeEventListener('beforeunload', flush);
      document.removeEventListener('visibilitychange', hidden);
      s.dispose();
      if (saver.current === s) saver.current = null;
    };
  }, [base]);

  /** Changes the list on screen and queues it for saving. */
  const apply = (change: (list: PortalTab[]) => PortalTab[], immediate = false) => {
    const next = change(tabsRef.current);
    if (next === tabsRef.current) return;
    tabsRef.current = next;
    setTabs(next);
    saver.current?.change(next, immediate);
  };

  // ---- the agents' search for questions ------------------------------------------------------
  const findQuestions = async () => {
    setDrafting(true);
    setDraftProblem(null);
    try {
      const res = await liveRef.current.request(`${base}/portal/draft`, { method: 'POST' });
      const body = (await res.json().catch(() => ({}))) as { portal?: Portal; error?: string };
      if (!res.ok || !body.portal) throw new Error(body.error ?? `The account answered ${res.status}`);
      const found = body.portal;
      setDrafted(found.drafted);
      const merged = mergeFound(tabsRef.current, found.tabs ?? []);
      if (merged !== tabsRef.current) {
        tabsRef.current = merged;
        setTabs(merged);
        setSelectedId((current) => current ?? merged[0]?.id ?? null);
      }
      // The account already has what the agents added; save only when the screen holds more
      // (parts the student added meanwhile, or edits still waiting to go).
      if (!sameTabs(merged, found.tabs ?? []) || saver.current?.state() !== 'saved') saver.current?.change(merged, true);
    } catch {
      setDraftProblem('Try again in a moment, or add the questions yourself.');
    } finally {
      setDrafting(false);
    }
  };

  // A new application with nothing in it yet starts the search straight away, once.
  const started = useRef(false);
  useEffect(() => {
    if (started.current) return;
    started.current = true;
    if (needsDraft) void findQuestions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ---- tabs ----------------------------------------------------------------------------------
  const addTab = (kind: PortalTabKind) => {
    if (tabsRef.current.length >= TAB_LIMITS.tabs) return;
    const tab = newTab(kind);
    apply((list) => [...list, tab], true);
    setSelectedId(tab.id);
    setFocusId(tab.id);
  };

  // When the left bar is stacked above the editor (narrow windows), picking a part scrolls to it.
  const selectTab = (tabId: string) => {
    setSelectedId(tabId);
    if (window.matchMedia('(max-width: 899px)').matches) requestAnimationFrame(() => document.getElementById(`pt-main-${id}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
  };

  const changeTab = (tabId: string, patch: TabPatch, immediate = false) => apply((list) => updateTab(list, tabId, patch), immediate);

  // Files of a deleted upload part are cleared from this computer once it can no longer be undone.
  const forget = (removed: Removed) => {
    if (removed.tab.kind === 'upload' && removed.tab.files.length) void deleteTabFiles(removed.tab.id).catch(() => {});
  };

  const deleteTab = (tabId: string) => {
    const { removed } = removeTab(tabsRef.current, tabId);
    if (!removed) return;
    apply((list) => removeTab(list, tabId).tabs, true);
    if (selectedId === tabId) {
      const left = tabsRef.current;
      setSelectedId(left[Math.min(removed.index, left.length - 1)]?.id ?? null);
    }
    if (undoRef.current) forget(undoRef.current);
    undoRef.current = removed;
    setUndo(removed);
  };

  const undoDelete = () => {
    const removed = undoRef.current;
    if (!removed) return;
    apply((list) => restoreTab(list, removed), true);
    setSelectedId(removed.tab.id);
    undoRef.current = null;
    setUndo(null);
  };

  const closeUndo = () => {
    if (undoRef.current) forget(undoRef.current);
    undoRef.current = null;
    setUndo(null);
  };

  useEffect(() => {
    if (!undo) return;
    const timer = window.setTimeout(closeUndo, UNDO_MS);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [undo]);

  // Leaving the page ends the chance to undo.
  useEffect(
    () => () => {
      if (undoRef.current) forget(undoRef.current);
    },
    [],
  );

  // ---- status and export ---------------------------------------------------------------------
  const changeStatus = async (next: ApplicationStatus) => {
    saver.current?.flush();
    setStatusBusy(true);
    setProblem(null);
    try {
      // One the student made has no posting behind it; its id starts "custom-".
      if (application.custom || id.startsWith('custom-')) {
        const res = await liveRef.current.request(base, { method: 'PUT', body: JSON.stringify({ status: next }) });
        if (!res.ok) throw new Error(`The account answered ${res.status}`);
      } else {
        // A posting's status is also shown on the Saved page, which reads it from here.
        dispatch({ type: 'setApplication', id, status: next });
        await liveRef.current.setStatus(id, next);
      }
      setStatus(next);
    } catch {
      setProblem(next === 'applied' ? 'Could not mark it as done. Check your connection and try again.' : 'Could not reopen it. Check your connection and try again.');
    } finally {
      setStatusBusy(false);
    }
  };

  const exportDocx = async () => {
    setExporting(true);
    setProblem(null);
    try {
      // The Word library is large, so it loads only when a student exports.
      const { downloadApplicationDocx } = await import('../../../lib/portal/exportDocx.ts');
      await downloadApplicationDocx({ title: application.title, organizer: application.organizer, deadline: application.deadline }, tabsRef.current);
    } catch {
      setProblem('Could not make the Word file. Try again.');
    } finally {
      setExporting(false);
    }
  };

  const selectedIndex = Math.max(0, tabs.findIndex((t) => t.id === selectedId));
  const selected = tabs[selectedIndex] ?? null;
  const draftNote = drafted && !drafted.found && tabs.length > 0 ? drafted.note || "Your agents could not find this application's questions." : draftProblem && tabs.length > 0 ? `Your agents could not look just now. ${draftProblem}` : null;

  return (
    <>
      <Card className="mb-5 p-5 sm:p-6">
        <PortalHeader
          id={id}
          application={application}
          status={status}
          progress={progressOf(tabs)}
          saveState={saveState}
          exporting={exporting}
          statusBusy={statusBusy}
          problem={problem ?? saveProblem}
          onExport={() => void exportDocx()}
          onStatus={(next) => void changeStatus(next)}
        />
      </Card>

      <div className="pt-layout">
        <Card className="pt-side-card p-3">
          <TabList
            tabs={tabs}
            selectedId={selected?.id ?? null}
            onSelect={selectTab}
            onMoveToGap={(tabId, gap) => apply((list) => moveToGap(list, tabId, gap), true)}
            onMoveBy={(tabId, delta) => apply((list) => moveBy(list, tabId, delta), true)}
            onAdd={addTab}
            drafting={drafting}
            draftNote={draftNote}
            onFindAgain={() => void findQuestions()}
          />
        </Card>

        <Card className="pt-main p-5 sm:p-8">
          <span id={`pt-main-${id}`} className="pt-anchor" aria-hidden="true" />
          {selected ? (
            <TabEditor
              key={selected.id}
              tab={selected}
              index={selectedIndex}
              total={tabs.length}
              autoFocus={focusId === selected.id}
              onChange={(patch, immediate) => changeTab(selected.id, patch, immediate)}
              onDelete={() => deleteTab(selected.id)}
            />
          ) : (
            <EmptyPane drafting={drafting} drafted={drafted} problem={draftProblem} onAdd={addTab} onFind={() => void findQuestions()} />
          )}
        </Card>
      </div>

      {undo && <UndoToast message={`Deleted "${undo.tab.title || 'Untitled'}".`} onUndo={undoDelete} onClose={closeUndo} />}
    </>
  );
}
