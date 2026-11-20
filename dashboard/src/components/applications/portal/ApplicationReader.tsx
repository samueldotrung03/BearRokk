// The whole application laid out for a reader, read-only: a title block, then every part in the
// student's order with its prompt, answer and word count, the files attached, and notes. It is
// what "View all" shows and what prints.
import { statusLabel } from '../../../lib/applications.ts';
import { longDate } from '../../../lib/portal/dates.ts';
import { formatBytes, paragraphsOf, progressOf, wordStatus } from '../../../lib/portal/tabs.ts';
import type { PortalApplication, PortalTab } from '../../../lib/portal/types.ts';
import { kindLabel } from './kinds.ts';

function Paragraphs({ body, empty }: { body: string; empty: string }) {
  const paragraphs = paragraphsOf(body);
  if (paragraphs.length === 0) return <p className="pt-read-empty">{empty}</p>;
  return (
    <div className="pt-read-body">
      {paragraphs.map((p, i) => (
        <p key={i}>{p}</p>
      ))}
    </div>
  );
}

function Part({ tab, number, total }: { tab: PortalTab; number: number; total: number }) {
  const words = wordStatus(tab.body, tab.wordLimit);
  return (
    <section className="pt-read-part">
      <p className="pt-read-kicker">
        Part {number} of {total} · {kindLabel[tab.kind]}
        {tab.done ? ' · Done' : ''}
      </p>
      <h2 className="pt-read-h2">{tab.title || 'Untitled'}</h2>
      {tab.kind !== 'note' && tab.prompt.trim() && <p className="pt-read-prompt">{tab.prompt.trim()}</p>}

      {tab.kind === 'question' && (
        <>
          <Paragraphs body={tab.body} empty="No answer yet." />
          <p className="pt-read-count" data-over={words.over || undefined}>
            {words.label}
            {words.over ? ', over the limit' : ''}
          </p>
        </>
      )}

      {tab.kind === 'upload' &&
        (tab.files.length ? (
          <ul className="pt-read-files">
            {tab.files.map((f) => (
              <li key={f.id}>
                {f.name} <span className="pt-read-size">({formatBytes(f.size)})</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="pt-read-empty">No files attached yet.</p>
        ))}

      {tab.kind === 'note' && <Paragraphs body={tab.body} empty="Empty note." />}
    </section>
  );
}

export function ApplicationReader({ application, tabs }: { application: PortalApplication; tabs: PortalTab[] }) {
  const progress = progressOf(tabs);
  return (
    <article className="pt-paper pt-print-root">
      <header className="pt-read-head">
        <h1 className="pt-read-title">{application.title}</h1>
        {application.organizer && <p className="pt-read-org">{application.organizer}</p>}
        <p className="pt-read-meta">
          {application.deadline ? `Deadline: ${longDate(application.deadline)}` : 'Deadline: not given'} · {statusLabel[application.status]}
          {progress.total > 0 && ` · ${progress.done} of ${progress.total} parts done`}
        </p>
      </header>
      {tabs.length === 0 ? (
        <p className="pt-read-empty">This application has no parts yet. Add its questions and uploads in the portal.</p>
      ) : (
        tabs.map((tab, i) => <Part key={tab.id} tab={tab} number={i + 1} total={tabs.length} />)
      )}
    </article>
  );
}
