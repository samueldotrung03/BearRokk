// "View all" (/applications/:id/view): the whole application laid out for a reader, read-only,
// with a Print button. When printed, only the application itself is on the page.
import { ArrowLeft, Printer } from 'lucide-react';
import { Link, useParams } from 'react-router';
import { ApplicationReader } from '../components/applications/portal/ApplicationReader.tsx';
import { PortalMessage, loadTitle } from '../components/applications/portal/PortalMessage.tsx';
import { usePortalLoad } from '../components/applications/portal/usePortalLoad.ts';
import { Page } from '../components/Page.tsx';
import type { PortalApplication, PortalTab } from '../lib/portal/types.ts';
import '../styles/portal.css';

export function ApplicationView() {
  const { id } = useParams();
  const { load, retry } = usePortalLoad(id);

  if (load.state !== 'ready')
    return (
      <Page title={loadTitle[load.state]} subtitle={load.state === 'loading' ? 'Laying out the whole application.' : 'Your applications are listed on the Applications page.'}>
        <PortalMessage state={load.state} onRetry={retry} />
      </Page>
    );

  return <ApplicationViewReady id={id!} application={load.application} tabs={load.portal.tabs} />;
}

/** The view once the application has opened. */
export function ApplicationViewReady({ id, application, tabs }: { id: string; application: PortalApplication; tabs: PortalTab[] }) {
  return (
    <Page title="View all" subtitle="The whole application in one place, ready to read through or print.">
      <div className="pt-view-bar pt-noprint">
        <Link to={`/applications/${encodeURIComponent(id)}`} className="pt-btn">
          <ArrowLeft className="size-4" aria-hidden="true" />
          Back to the portal
        </Link>
        <button type="button" className="pt-btn pt-btn-primary" onClick={() => window.print()}>
          <Printer className="size-4" aria-hidden="true" />
          Print
        </button>
      </div>
      <ApplicationReader application={application} tabs={tabs} />
    </Page>
  );
}
