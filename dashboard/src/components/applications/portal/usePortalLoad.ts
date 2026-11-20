// Opens one application's portal from the backend, for the portal and the read-only view alike.
import { useEffect, useRef, useState } from 'react';
import type { Portal, PortalApplication } from '../../../lib/portal/types.ts';
import { readPending } from '../../../lib/portal/pending.ts';
import { useLive } from '../../../state/live.tsx';

export type PortalLoad =
  | { state: 'loading' }
  /** No such application on this account (or no id in the address). */
  | { state: 'missing' }
  /** The backend could not be reached or answered with an error. */
  | { state: 'offline' }
  /** restored: edits made on this computer that had not reached the account are shown over it. */
  | { state: 'ready'; application: PortalApplication; portal: Portal; restored: boolean };

export function usePortalLoad(id: string | undefined): { load: PortalLoad; retry: () => void } {
  const live = useLive();
  const request = useRef(live.request);
  request.current = live.request;
  const [load, setLoad] = useState<PortalLoad>(id ? { state: 'loading' } : { state: 'missing' });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!id) {
      setLoad({ state: 'missing' });
      return;
    }
    let cancelled = false;
    setLoad({ state: 'loading' });
    void (async () => {
      try {
        const res = await request.current(`/applications/${encodeURIComponent(id)}/portal`);
        if (cancelled) return;
        if (res.status === 404 || res.status === 400) return setLoad({ state: 'missing' });
        if (!res.ok) return setLoad({ state: 'offline' });
        const body = (await res.json()) as { application?: PortalApplication; portal?: Portal };
        if (cancelled) return;
        if (!body.application || !body.portal) return setLoad({ state: 'missing' });
        const pending = readPending(id);
        setLoad({ state: 'ready', application: body.application, portal: { tabs: pending ?? body.portal.tabs ?? [], drafted: body.portal.drafted ?? null }, restored: pending !== null });
      } catch {
        if (!cancelled) setLoad({ state: 'offline' });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [id, attempt]);

  return { load, retry: () => setAttempt((n) => n + 1) };
}
