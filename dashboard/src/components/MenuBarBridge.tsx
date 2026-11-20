// Keeps the menu bar icon's menu up to date and carries out what is picked from it: start or stop
// a search, or open a page (a deadline's application, the top recommendation, the feed). Renders
// nothing, and does nothing outside the desktop app.
import { useEffect, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router';
import { desktopBridge } from '../lib/desktopBridge.ts';
import { menuBarLabels } from '../lib/menuBar.ts';
import { useGlance } from '../state/glance.ts';
import { useLive } from '../state/live.tsx';

export function MenuBarBridge() {
  const bridge = desktopBridge?.menuBar;
  const live = useLive();
  const navigate = useNavigate();
  const g = useGlance();
  const data = useMemo(() => menuBarLabels(g), [g]);

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
