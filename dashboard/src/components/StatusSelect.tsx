import { STATUSES, statusLabel } from '../lib/applications.ts';
import { useStore } from '../state/StoreProvider.tsx';
import type { ApplicationStatus } from '../types.ts';

/** Sets where the student stands on one opportunity. "Not tracking" removes it from Applications. */
export function StatusSelect({ id, className = '' }: { id: string; className?: string }) {
  const { state, dispatch } = useStore();
  const status = state.applications[id]?.status ?? '';
  return (
    <label className={`status-select ${className}`} data-status={status || 'none'}>
      <span className="sr-only">Application status</span>
      <select
        value={status}
        onChange={(event) =>
          dispatch({ type: 'setApplication', id, status: (event.target.value || null) as ApplicationStatus | null })
        }
      >
        <option value="">Not tracking</option>
        {STATUSES.map((value) => (
          <option key={value} value={value}>
            {statusLabel[value]}
          </option>
        ))}
      </select>
    </label>
  );
}
