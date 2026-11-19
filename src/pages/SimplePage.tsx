import { Link } from 'react-router';

const pages: Record<string, { title: string; body: string }> = {
  roadmap: {
    title: 'Roadmap',
    body: 'The roadmap for this demo is the request itself: join a beginner-friendly coding community, then attend an online hackathon. Saving a card keeps it beside that plan.',
  },
  discover: {
    title: 'Career discovery',
    body: 'Career discovery is a later step. The prepared profile is a first-year student looking for a coding club and a hackathon, which is what For you is ranked on.',
  },
  applications: {
    title: 'Applications',
    body: 'Nothing is in progress yet. When a deadline is unknown, the opportunity says so instead of inventing a date. Open the organizer page before you apply.',
  },
  calendar: {
    title: 'Calendar',
    body: 'Event starts and application deadlines are stored separately. A card with “Starts” and “Registration deadline unknown” has not put that unknown date on a calendar.',
  },
  agents: {
    title: 'Agents',
    body: 'These cards are prepared examples for the demo request. Live search is not connected, so every result is labeled as a prepared example.',
  },
  settings: {
    title: 'Settings',
    body: 'Saves, likes, and dislikes for this browser stay in local storage under bearrok.discovery. Refreshing the page keeps them.',
  },
  profile: {
    title: 'Profile',
    body: 'Demo student. First-year, interested in a beginner-friendly coding club and an online hackathon next month. This profile is prepared for the demo and is not a signed-in account.',
  },
};

export function SimplePage({ id }: { id: keyof typeof pages }) {
  const page = pages[id];
  return (
    <div className="simple">
      <article className="simple-card">
        <header>
          <span className="prepared">Prepared example</span>
          <h2 className="font-display">{page.title}</h2>
        </header>
        <p>{page.body}</p>
        <Link className="btn-primary" to="/">
          Back to opportunities
        </Link>
      </article>
    </div>
  );
}
