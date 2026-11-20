// The bar above the portal: back to the list, where the application stands, its deadline, how
// many parts are done, whether the work is saved, and the actions (export, view all, mark done).
import { ArrowLeft, Check, CloudCheck, CloudOff, Download, ExternalLink, Eye, LoaderCircle, RotateCcw } from 'lucide-react';
import { Link } from 'react-router';
import { statusLabel } from '../../../lib/applications.ts';
import type { SaveState } from '../../../lib/portal/autosave.ts';
import { daysLeftLabel, longDate } from '../../../lib/portal/dates.ts';
import type { PortalApplication } from '../../../lib/portal/types.ts';
import { daysUntil } from '../../../lib/time.ts';
import type { ApplicationStatus } from '../../../types.ts';

export function SaveIndicator({ state }: { state: SaveState }) {
  if (state === 'retrying')
    return (
      <span className="pt-save" data-state="retrying" role="status">
        <CloudOff className="size-4" aria-hidden="true" />
        Not saved: retrying
      </span>
    );
  if (state === 'saved')
    return (
      <span className="pt-save" data-state="saved" role="status">
        <CloudCheck className="size-4" aria-hidden="true" />
        Saved
      </span>
    );
  return (
    <span className="pt-save" data-state="saving" role="status">
      <LoaderCircle className="size-4 animate-spin" aria-hidden="true" />
      Saving…
    </span>
  );
}

export function PortalHeader({
  id,
  application,
  status,
  progress,
  saveState,
  exporting,
  statusBusy,
  problem,
  onExport,
  onStatus,
}: {
  id: string;
  application: PortalApplication;
  status: ApplicationStatus;
  progress: { done: number; total: number };
  saveState: SaveState;
  exporting: boolean;
  statusBusy: boolean;
  problem: string | null;
  onExport: () => void;
  onStatus: (status: ApplicationStatus) => void;
}) {
  const applied = status === 'applied';
  const days = application.deadline ? daysUntil(application.deadline) : null;
  return (
    <div className="pt-head">
      <div className="pt-head-row">
        <Link to="/applications" className="pt-back">
          <ArrowLeft className="size-4" aria-hidden="true" />
          All applications
        </Link>
        <SaveIndicator state={saveState} />
      </div>

      <div className="pt-head-row pt-head-main">
        <dl className="pt-facts">
          <div>
            <dt>Status</dt>
            <dd>
              <span className="pt-status" data-status={status}>
                {statusLabel[status]}
              </span>
            </dd>
          </div>
          <div>
            <dt>Deadline</dt>
            <dd>
              {application.deadline ? (
                <>
                  {longDate(application.deadline)}{' '}
                  <span className="pt-days" data-soon={(days !== null && days <= 7) || undefined}>
                    {daysLeftLabel(application.deadline)}
                  </span>
                </>
              ) : (
                <span className="text-ink-3">Not given</span>
              )}
            </dd>
          </div>
          <div>
            <dt>Progress</dt>
            <dd>
              {progress.total === 0 ? <span className="text-ink-3">No parts yet</span> : `${progress.done} of ${progress.total} parts done`}
            </dd>
          </div>
          {application.actionUrl && (
            <div>
              <dt>Submit at</dt>
              <dd>
                <a href={application.actionUrl} target="_blank" rel="noreferrer" className="pt-ext">
                  Organizer's application page
                  <ExternalLink className="size-3.5" aria-hidden="true" />
                </a>
              </dd>
            </div>
          )}
        </dl>

        <div className="pt-actions">
          <button type="button" className="pt-btn" onClick={onExport} disabled={exporting}>
            {exporting ? <LoaderCircle className="size-4 animate-spin" aria-hidden="true" /> : <Download className="size-4" aria-hidden="true" />}
            Export (.docx)
          </button>
          <Link to={`/applications/${encodeURIComponent(id)}/view`} className="pt-btn">
            <Eye className="size-4" aria-hidden="true" />
            View all
          </Link>
          {applied ? (
            <button type="button" className="pt-btn" onClick={() => onStatus('applying')} disabled={statusBusy} title="Set it back to Applying">
              <RotateCcw className="size-4" aria-hidden="true" />
              Reopen
            </button>
          ) : (
            <button type="button" className="pt-btn pt-btn-primary" onClick={() => onStatus('applied')} disabled={statusBusy}>
              <Check className="size-4" aria-hidden="true" />
              Mark as done
            </button>
          )}
        </div>
      </div>
      {applied && <p className="pt-applied-note">Marked as applied. Reopen it if you still have parts to finish.</p>}
      {problem && (
        <p className="pt-problem" role="alert">
          {problem}
        </p>
      )}
    </div>
  );
}
