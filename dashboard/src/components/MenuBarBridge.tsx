// Keeps the menu bar icon's menu up to date and carries out what is picked from it: start or stop
// a search, or open a page (a deadline's application, the top recommendation, the feed). Renders
// nothing, and does nothing outside the desktop app.
import { useEffect, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router';
import { useAuth } from '../auth/AuthProvider.tsx';
import { desktopBridge } from '../lib/desktopBridge.ts';
import { menuBarData } from '../lib/menuBar.ts';
import { useLive } from '../state/live.tsx';
import { rankFeed } from '../state/ranking.ts';
import { useStore } from '../state/StoreProvider.tsx';

export function MenuBarBridge() {
  const bridge = desktopBridge?.menuBar;
  const auth = useAuth();
  const live = useLive();
  const { state } = useStore();
  const navigate = useNavigate();
  const signedIn = auth.status === 'signedIn' || auth.status === 'guest';

  // The same ranking as the feed's For you, so the top recommendation is the feed's first card.
  const ranked = useMemo(() => rankFeed(live.opportunities, state), [live.opportunities, state]);
  const data = useMemo(
    () =>
      menuBarData({
        signedIn,
        searching: live.searching,
        ranked,
        applications: live.applications,
        postings: [...live.opportunities, ...live.savedCards],
        saved: state.saved,
      }),
    [signedIn, live.searching, ranked, live.applications, live.opportunities, live.savedCards, state.saved],
  );

  // Sent only when what the menu shows changes.
  const sent = useRef('');
  useEffect(() => {
    if (!bridge) return;
    const text = JSON.stringify(data);
    if (text === sent.current) return;
    sent.current = text;
    bridge.update(data);
  }, [bridge, data]);

  const actions = useRef({ live, navigate });
  actions.current = { live, navigate };
  useEffect(() => {
    if (!bridge) return;
    return bridge.onAction((action) => {
      const { live, navigate } = actions.current;
      if (action.type === 'run') void live.runNow();
      else if (action.type === 'stop') void live.stopRun();
      else if (action.type === 'open') navigate(action.path);
    });
  }, [bridge]);

  return null;
}
