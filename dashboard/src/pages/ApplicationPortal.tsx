// The application portal (/applications/:id): one application written inside BearRok, Common App
// style. A left bar lists its parts (questions, uploads, the student's own notes) and the selected
// part opens on the right. Everything saves to the student's account as they work; uploaded files'
// contents stay on this computer.
import { useParams } from 'react-router';
import { PortalMessage, loadTitle } from '../components/applications/portal/PortalMessage.tsx';
import { PortalWorkspace } from '../components/applications/portal/PortalWorkspace.tsx';
import { usePortalLoad } from '../components/applications/portal/usePortalLoad.ts';
import { Page } from '../components/Page.tsx';
import '../styles/portal.css';

export function ApplicationPortal() {
  const { id } = useParams();
  const { load, retry } = usePortalLoad(id);

  if (load.state !== 'ready')
    return (
      <Page title={loadTitle[load.state]} subtitle={load.state === 'loading' ? 'Opening the questions, uploads and notes for this application.' : 'Your applications are listed on the Applications page.'}>
        <PortalMessage state={load.state} onRetry={retry} />
      </Page>
    );

  const { application, portal, restored } = load;
  return (
    <Page title={application.title} subtitle={application.organizer || 'Your own application'}>
      <PortalWorkspace key={id} id={id!} application={application} portal={portal} restored={restored} />
    </Page>
  );
}
