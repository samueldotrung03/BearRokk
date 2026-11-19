// The Settings block for system notifications: the on/off switch, whether the system allows
// them, what gets announced and when, and a button that sends one right away to try it.
import { Bell } from '@phosphor-icons/react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router';
import { calendarItems } from '../lib/calendar.ts';
import { ENABLED_KEY, NOTIFY_CHANGED, notifyPermission, requestNotifyPermission, showNotification, type NotifyPermission } from '../lib/notify/browser.ts';
import { nextUpcoming, TEST_ONLY } from '../lib/notify/plan.ts';
import { useLocal } from '../lib/useLocal.ts';
import { useStore } from '../state/StoreProvider.tsx';
import { Card } from './Page.tsx';
import { ActionButton, Note, Row, Status, Switch } from './settingsParts.tsx';

const SCHEDULE = [
  'Deadlines you marked "To apply" or "Applying": 3 days before, the day before, and on the day.',
  'Reminders you set: on the day.',
  'Events on your calendar: on the day they start.',
  'Roadmap steps: on the day they are due.',
];

const permissionWords: Record<NotifyPermission, string> = {
  granted: 'Allowed',
  denied: 'Blocked',
  default: 'Not asked yet',
  unsupported: 'Not available here',
};

export function NotifySettings() {
  const { state } = useStore();
  const navigate = useNavigate();
  const [enabled, setEnabled] = useLocal(ENABLED_KEY, false);
  const [permission, setPermission] = useState<NotifyPermission>(notifyPermission);
  const [result, setResult] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null);
  const items = useMemo(() => calendarItems(state), [state]);
  const onDesktop = Boolean((window as unknown as { bearrokDesktop?: unknown }).bearrokDesktop);

  // The permission can change in system settings, so look again when the student comes back.
  const refresh = useCallback(() => setPermission(notifyPermission()), []);
  useEffect(() => {
    window.addEventListener('focus', refresh);
    return () => window.removeEventListener('focus', refresh);
  }, [refresh]);

  // Runs after useLocal has saved the switch, so the notifier reads the new value.
  useEffect(() => {
    window.dispatchEvent(new Event(NOTIFY_CHANGED));
  }, [enabled, permission]);

  const toggle = async (next: boolean) => {
    setEnabled(next);
    setResult(null);
    if (next && notifyPermission() === 'default') setPermission(await requestNotifyPermission());
  };

  const sendTest = () => {
    const planned = nextUpcoming(items, Date.now()) ?? TEST_ONLY;
    const shown = showNotification(planned, () => navigate('/calendar'));
    setResult(shown ? { kind: 'ok', text: `Sent: "${planned.title}". If nothing appeared, check Focus or Do Not Disturb.` } : { kind: 'error', text: 'The notification could not be shown here.' });
  };

  const on = enabled && permission === 'granted';
  const tone = on ? 'on' : permission === 'denied' || permission === 'unsupported' ? 'warn' : 'off';

  return (
    <Card className="p-7">
      <h2 className="text-lg font-semibold tracking-tight">Notifications</h2>
      <p className="mt-1 text-sm text-ink-2">Your agents keep working while you are away. BearRok tells you when something on your calendar needs you.</p>
      <ul className="mt-6 divide-y divide-line">
        <Row
          icon={<Bell />}
          title="Deadline and reminder notifications"
          text="System notifications for what is due, even when BearRok is in the background. At most three at a time, most urgent first."
          status={<Status tone={tone}>{enabled ? permissionWords[permission] : 'Off'}</Status>}
          action={<Switch checked={enabled} onChange={(next) => void toggle(next)} label="Notifications" disabled={permission === 'unsupported'} />}
        >
          <ul className="list-disc space-y-1 pl-5 text-sm text-ink-2">
            {SCHEDULE.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
          <p className="mt-2 text-sm text-ink-3">Finished items and deadlines without a date are never announced. Clicking a notification opens your calendar.</p>
          {permission === 'denied' && (
            <p className="mt-3 text-sm text-ink-2">
              Notifications are blocked.{' '}
              {onDesktop
                ? 'To allow them, open System Settings, then Notifications, choose BearRok and turn on Allow notifications.'
                : 'To allow them, click the site settings icon next to the address bar and set Notifications to Allow.'}
            </p>
          )}
          {permission === 'unsupported' && <p className="mt-3 text-sm text-ink-2">This browser cannot show notifications. The desktop app can.</p>}
          {on && (
            <div className="mt-3 flex flex-wrap items-center gap-3">
              <ActionButton primary onClick={sendTest}>
                Send a test reminder
              </ActionButton>
              {result && <Note kind={result.kind}>{result.text}</Note>}
            </div>
          )}
        </Row>
      </ul>
    </Card>
  );
}
