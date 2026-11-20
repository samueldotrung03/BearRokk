// An upload part's files: a drop zone and file picker, and the list of what is attached. The
// contents are kept on this computer (fileStore.ts); only names, sizes and types go to the account.
import { Download, ExternalLink, FileText, Upload, X } from 'lucide-react';
import { useId, useRef, useState, type DragEvent } from 'react';
import { formatBytes, makeId } from '../../../lib/portal/tabs.ts';
import type { PortalFile, PortalTab } from '../../../lib/portal/types.ts';
import { deleteFile, getFile, putFile } from './fileStore.ts';

/** Files larger than this are refused, so one video cannot fill the computer's browser storage. */
const MAX_BYTES = 50 * 1024 * 1024;

export function UploadZone({ tab, onFiles }: { tab: PortalTab; onFiles: (files: PortalFile[]) => void }) {
  const inputId = useId();
  const [over, setOver] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  // The newest list, so files added one after another are not lost to a stale copy.
  const files = useRef(tab.files);
  files.current = tab.files;

  const add = async (list: FileList | File[]) => {
    const chosen = [...list];
    if (chosen.length === 0) return;
    setProblem(null);
    setBusy(true);
    const added: PortalFile[] = [];
    const refused: string[] = [];
    for (const file of chosen) {
      if (file.size > MAX_BYTES) {
        refused.push(`${file.name} is over 50 MB.`);
        continue;
      }
      const id = makeId('file');
      try {
        await putFile(tab.id, id, file);
        added.push({ id, name: file.name, size: file.size, type: file.type || 'application/octet-stream', addedAt: new Date().toISOString() });
      } catch {
        refused.push(`${file.name} could not be kept on this computer.`);
      }
    }
    setBusy(false);
    if (added.length) onFiles([...files.current, ...added]);
    if (refused.length) setProblem(refused.join(' '));
  };

  const remove = async (file: PortalFile) => {
    onFiles(files.current.filter((f) => f.id !== file.id));
    await deleteFile(tab.id, file.id).catch(() => {});
  };

  const open = async (file: PortalFile, download: boolean) => {
    setProblem(null);
    const blob = await getFile(tab.id, file.id).catch(() => null);
    if (!blob) {
      setProblem(`${file.name} is not on this computer. It stays on the computer it was added from.`);
      return;
    }
    const url = URL.createObjectURL(blob);
    if (download) {
      const link = document.createElement('a');
      link.href = url;
      link.download = file.name;
      document.body.append(link);
      link.click();
      link.remove();
    } else {
      window.open(url, '_blank', 'noopener');
    }
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
  };

  // Only files are taken here; a tab being dragged in the left bar is not a file.
  const hasFiles = (e: DragEvent) => [...e.dataTransfer.types].includes('Files');

  return (
    <div className="pt-upload">
      <div
        className="pt-drop"
        data-over={over || undefined}
        onDragOver={(e) => {
          if (!hasFiles(e)) return;
          e.preventDefault();
          e.dataTransfer.dropEffect = 'copy';
          setOver(true);
        }}
        onDragLeave={() => setOver(false)}
        onDrop={(e) => {
          if (!hasFiles(e)) return;
          e.preventDefault();
          setOver(false);
          void add(e.dataTransfer.files);
        }}
      >
        <Upload className="size-6 text-brand" aria-hidden="true" />
        <p className="text-[15px] font-semibold text-ink">Drop files here</p>
        <p className="text-sm text-ink-3">or</p>
        <label htmlFor={inputId} className="btn-primary cursor-pointer px-4 py-2 text-sm text-white">
          {busy ? 'Adding…' : 'Choose files'}
        </label>
        <input
          id={inputId}
          type="file"
          multiple
          className="sr-only"
          onChange={(e) => {
            if (e.target.files) void add(e.target.files);
            e.target.value = '';
          }}
        />
      </div>

      <p className="pt-local-note">
        Files stay on this computer. Your account keeps only their names and sizes, so you attach the files themselves on the organizer's application page when you submit.
      </p>

      {problem && (
        <p className="pt-problem" role="alert">
          {problem}
        </p>
      )}

      {tab.files.length > 0 ? (
        <ul className="pt-files" aria-label="Attached files">
          {tab.files.map((file) => (
            <li key={file.id} className="pt-file">
              <FileText className="size-4 shrink-0 text-ink-3" aria-hidden="true" />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium text-ink">{file.name}</span>
                <span className="block text-xs text-ink-3">{formatBytes(file.size)}</span>
              </span>
              <button type="button" className="pt-icon-btn" onClick={() => void open(file, false)} aria-label={`Open ${file.name}`} title="Open">
                <ExternalLink className="size-4" aria-hidden="true" />
              </button>
              <button type="button" className="pt-icon-btn" onClick={() => void open(file, true)} aria-label={`Download ${file.name}`} title="Download">
                <Download className="size-4" aria-hidden="true" />
              </button>
              <button type="button" className="pt-icon-btn" onClick={() => void remove(file)} aria-label={`Remove ${file.name}`} title="Remove">
                <X className="size-4" aria-hidden="true" />
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-ink-3">No files attached yet.</p>
      )}
    </div>
  );
}
