// Sends system notifications for deadlines, reminders, start days and roadmap steps while the app
// is open or in the background. Renders nothing. It only acts when the student switched
// notifications on in Settings and the system allowed them; it never asks for permission itself.
import { useCallback, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router';
import { calendarItems } from '../lib/calendar.ts';
import { loadSent, notifyEnabled, notifyPermission, NOTIFY_CHANGED, saveSent, ENABLED_KEY, showNotification } from '../lib/notify/browser.ts';
import { dueNotifications } from '../lib/notify/plan.ts';
import { useStore } from '../state/StoreProvider.tsx';

/** How often to look again while the app stays open, so day changes are caught. */
const CHECK_EVERY = 5 * 60_000;

export function DeadlineNotifier() {
  const { state } = useStore();
  const navigate = useNavigate();
  const items = useMemo(() => calendarItems(state), [state]);

  const check = useCallback(() => {
    if (!notifyEnabled() || notifyPermission() !== 'granted') return;
    const sent = loadSent();
    const due = dueNotifications(items, Date.now(), sent);
    if (due.length === 0) return;
    const shown = due.filter((planned) => showNotification(planned, () => navigate('/calendar')));
    if (shown.length > 0) saveSent([...sent, ...shown.flatMap((planned) => planned.covers)]);
  }, [items, navigate]);

  // On mount and whenever the calendar changes.
  useEffect(() => check(), [check]);

  useEffect(() => {
    const timer = window.setInterval(check, CHECK_EVERY);
    const onStorage = (event: StorageEvent) => {
      // The switch was changed in another window.
      if (event.key === ENABLED_KEY) check();
    };
    window.addEventListener(NOTIFY_CHANGED, check);
    window.addEventListener('storage', onStorage);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener(NOTIFY_CHANGED, check);
      window.removeEventListener('storage', onStorage);
    };
  }, [check]);

  return null;
}
