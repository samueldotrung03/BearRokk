// What the menu bar menu and the quick panel show, read from the live backend state: whether a
// search is running, the next deadlines, and the feed's top card. One source for both.
import { useMemo } from 'react';
import { useAuth } from '../auth/AuthProvider.tsx';
import { glance, type Glance } from '../lib/menuBar.ts';
import { useLive } from './live.tsx';
import { rankFeed } from './ranking.ts';
import { useStore } from './StoreProvider.tsx';

export function useGlance(): Glance {
  const auth = useAuth();
  const live = useLive();
  const { state } = useStore();
  const signedIn = auth.status === 'signedIn' || auth.status === 'guest';

  // The same ranking as the feed's For you, so the top recommendation is the feed's first card.
  const ranked = useMemo(() => rankFeed(live.opportunities, state), [live.opportunities, state]);
  return useMemo(
    () =>
      glance({
        signedIn,
        searching: live.searching,
        ranked,
        applications: live.applications,
        postings: [...live.opportunities, ...live.savedCards],
        saved: state.saved,
      }),
    [signedIn, live.searching, ranked, live.applications, live.opportunities, live.savedCards, state.saved],
  );
}
