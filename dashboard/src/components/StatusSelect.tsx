import { STATUSES, statusLabel } from '../lib/applications.ts';
import { useStore } from '../state/StoreProvider.tsx';
import type { ApplicationStatus } from '../types.ts';

/**
 * Sets where the student stands on one opportunity: Interested (the default), To apply, Applying
 * or Applied. The status is kept with the student's account; To apply and Applying put the
 * deadline on Google Calendar when it is connected.
 */
export function StatusSelect({ id, className = '' }: { id: string; className?: string }) {
  const { state, dispatch } = useStore();
  const status = state.applications[id]?.status ?? 'interested';
  return (
    <label className={`status-select ${className}`} data-status={status}>
      <span className="sr-only">Application status</span>
      <select
        value={status}
        onChange={(event) => {
          const next = event.target.value as ApplicationStatus;
          // Sent to the account by the live layer, which watches every status change.
          dispatch({ type: 'setApplication', id, status: next });
        }}
      >
        {STATUSES.map((value) => (
          <option key={value} value={value}>
            {statusLabel[value]}
          </option>
        ))}
      </select>
    </label>
  );
}
