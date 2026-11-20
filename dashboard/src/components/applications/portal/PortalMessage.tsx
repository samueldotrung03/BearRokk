// What the portal and the view show while an application opens, or when it cannot be opened.
import { ArrowLeft, LoaderCircle } from 'lucide-react';
import { Link } from 'react-router';
import { Card } from '../../Page.tsx';
import type { PortalLoad } from './usePortalLoad.ts';

export const loadTitle: Record<Exclude<PortalLoad['state'], 'ready'>, string> = {
  loading: 'Application',
  missing: 'Application not found',
  offline: 'Cannot open this application',
};

export function PortalMessage({ state, onRetry }: { state: Exclude<PortalLoad['state'], 'ready'>; onRetry?: () => void }) {
  return (
    <Card className="mx-auto max-w-2xl p-8">
      {state === 'loading' ? (
        <p className="flex items-center gap-2 text-[15px] text-ink-2" role="status">
          <LoaderCircle className="size-4 animate-spin" aria-hidden="true" />
          Opening your application…
        </p>
      ) : state === 'missing' ? (
        <p className="text-[15px] leading-relaxed text-ink-2">This application is not on your account. It may have been removed, or the link is incomplete.</p>
      ) : (
        <>
          <p className="text-[15px] leading-relaxed text-ink-2">The app cannot reach your applications right now. Nothing you wrote is lost: it is kept with your account and will be here when the connection is back.</p>
          {onRetry && (
            <button type="button" className="btn-primary mt-4 px-4 py-2 text-sm text-white" onClick={onRetry}>
              Try again
            </button>
          )}
        </>
      )}
      {state !== 'loading' && (
        <Link to="/applications" className="pt-back mt-5">
          <ArrowLeft className="size-4" aria-hidden="true" />
          Back to all applications
        </Link>
      )}
    </Card>
  );
}
