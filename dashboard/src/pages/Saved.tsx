import { Link } from 'react-router';
import { Masonry } from '../components/Masonry.tsx';
import { OpportunityCard } from '../components/OpportunityCard.tsx';
import { Card, Page } from '../components/Page.tsx';
import { opportunities } from '../data/sample.ts';
import { daysUntil } from '../lib/time.ts';
import { useStore } from '../state/StoreProvider.tsx';

export function Saved() {
  const { state } = useStore();
  // Soonest deadline first; items without one go last.
  const saved = opportunities
    .filter((o) => state.saved.includes(o.id))
    .sort((a, b) => (a.deadline ? daysUntil(a.deadline) : Infinity) - (b.deadline ? daysUntil(b.deadline) : Infinity));

  return (
    <Page title="Saved" subtitle="What you decided to pursue, with the soonest deadline first.">
      {saved.length === 0 ? (
        <Card className="p-10 text-center">
          <p className="text-lg font-semibold">Nothing saved yet</p>
          <p className="mx-auto mt-2 max-w-sm text-sm leading-relaxed text-ink-2">
            Save a card in the feed and it is kept here. Saving also tells the agents to look for more like it.
          </p>
          <Link to="/" className="btn-primary mt-6 inline-flex h-10 items-center rounded-xl px-4 text-sm font-medium text-white">
            Go to the feed
          </Link>
        </Card>
      ) : (
        <Masonry>
          {saved.map((o) => (
            <OpportunityCard key={o.id} opportunity={o} />
          ))}
        </Masonry>
      )}
    </Page>
  );
}
