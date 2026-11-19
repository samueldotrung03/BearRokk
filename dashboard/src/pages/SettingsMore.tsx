// The rest of the Settings page: how the agents run, reminders, and the account and its data.
import { ArrowsClockwise, Bell, ClockCounterClockwise, DownloadSimple, SignIn, SignOut, Trash, UserCircle } from '@phosphor-icons/react';
import { useState } from 'react';
import { useNavigate } from 'react-router';
import { useAuth } from '../auth/AuthProvider.tsx';
import { authMessage } from '../auth/errors.ts';
import { API_URL } from '../auth/firebase.ts';
import { Card } from '../components/Page.tsx';
import { ActionButton, Note, Row, Status } from '../components/settingsParts.tsx';
import { SCHEDULE_SECONDS, updateSettings, useSettings, type AppSettings } from '../state/settings.ts';
import { useStore } from '../state/StoreProvider.tsx';

const schedules: { value: AppSettings['schedule']; label: string }[] = [
  { value: 'off', label: 'Only when something changes' },
  { value: 'hourly', label: 'Every hour' },
  { value: 'sixHours', label: 'Every 6 hours' },
  { value: 'daily', label: 'Once a day' },
];
const reminderChoices = [
  { days: 14, label: 'Two weeks before' },
  { days: 7, label: 'A week before' },
  { days: 2, label: 'Two days before' },
  { days: 1, label: 'The day before' },
  { days: 0, label: 'On the day' },
];

function Segmented<T extends string>({ value, options, onChange, label }: { value: T; options: { value: T; label: string }[]; onChange: (v: T) => void; label: string }) {
  return (
    <div className="inline-flex flex-wrap rounded-xl bg-slate-100 p-1" role="group" aria-label={label}>
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          aria-pressed={value === o.value}
          onClick={() => onChange(o.value)}
          className={`min-h-9 rounded-lg px-3.5 text-sm font-medium transition ${value === o.value ? 'bg-white text-ink shadow-card' : 'text-ink-2'}`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function MoreSettings() {
  const auth = useAuth();
  const settings = useSettings();
  const { state, dispatch } = useStore();
  const navigate = useNavigate();

  const [saved, setSaved] = useState<'idle' | 'ok' | 'offline'>('idle');
  const [runNote, setRunNote] = useState<'idle' | 'ok' | 'offline'>('idle');
  const [running, setRunning] = useState(false);
  const [accountNote, setAccountNote] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [confirmingClear, setConfirmingClear] = useState(false);
  const [confirmText, setConfirmText] = useState('');
  const [deleting, setDeleting] = useState(false);

  /** Calls the backend as the signed-in student, or as the demo student when looking around. */
  const backend = async (path: string, init: RequestInit = {}) => {
    const token = await auth.getToken();
    return fetch(`${API_URL}/api/students/${token ? 'me' : 'demo'}${path}`, {
      ...init,
      headers: { 'content-type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}), ...init.headers },
    });
  };

  /** Settings the agents act on are saved here and sent to the backend. */
  const saveAgentSettings = async (patch: Partial<Pick<AppSettings, 'schedule' | 'reminderDays'>>) => {
    updateSettings(patch);
    const next = { ...settings, ...patch };
    try {
      const res = await backend('/preferences', { method: 'PUT', body: JSON.stringify({ scheduleSeconds: SCHEDULE_SECONDS[next.schedule], reminderDays: next.reminderDays }) });
      setSaved(res.ok ? 'ok' : 'offline');
    } catch {
      setSaved('offline');
    }
  };

  const runNow = async () => {
    setRunning(true);
    setRunNote('idle');
    try {
      const res = await backend('/runs', { method: 'POST' });
      setRunNote(res.ok ? 'ok' : 'offline');
    } catch {
      setRunNote('offline');
    } finally {
      setTimeout(() => setRunning(false), 1200);
    }
  };

  const toggleReminder = (days: number) =>
    void saveAgentSettings({ reminderDays: settings.reminderDays.includes(days) ? settings.reminderDays.filter((d) => d !== days) : [...settings.reminderDays, days].sort((a, b) => b - a) });

  const exportData = () => {
    const data = { exportedAt: new Date().toISOString(), account: auth.user ? { name: auth.user.displayName, email: auth.user.email } : null, profile: state.profile, saved: state.saved, dismissed: state.dismissed, opened: state.opened, roadmapStepsDone: state.doneSteps, goal: state.goalId, settings };
    const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }));
    const link = Object.assign(document.createElement('a'), { href: url, download: 'bearrok-data.json' });
    link.click();
    URL.revokeObjectURL(url);
  };

  const withNote = async (action: () => Promise<void>, done: string) => {
    setAccountNote(null);
    try {
      await action();
      setAccountNote({ kind: 'ok', text: done });
    } catch (e) {
      setAccountNote({ kind: 'error', text: authMessage(e) ?? 'That did not work. Try again.' });
    }
  };

  const deleteAccount = async () => {
    setDeleting(true);
    setAccountNote(null);
    try {
      await auth.deleteAccount();
      dispatch({ type: 'resetHistory' });
      navigate('/signin');
    } catch (e) {
      setAccountNote({ kind: 'error', text: authMessage(e) ?? 'The account could not be deleted. Try again.' });
      setDeleting(false);
    }
  };

  const usesPassword = auth.user?.providerData.some((p) => p.providerId === 'password') ?? false;
  const email = auth.user?.email ?? null;

  return (
    <>
      <Card className="p-7">
        <h2 className="text-lg font-semibold tracking-tight">Agents and reminders</h2>
        <p className="mt-1 text-sm text-ink-2">Your agents always search again when your profile or your reactions change. These add to that.</p>
        <ul className="mt-6 divide-y divide-line">
          <Row
            icon={<ArrowsClockwise />}
            title="Search on a schedule"
            text="How often the agents look for new opportunities and drop closed ones while you are away. More often uses more of your Grok allowance."
            status={settings.schedule === 'off' ? <Status tone="off">Off</Status> : <Status tone="on">On</Status>}
            action={
              <ActionButton disabled={running} onClick={() => void runNow()}>
                {running ? 'Starting…' : 'Run now'}
              </ActionButton>
            }
          >
            <Segmented label="How often" value={settings.schedule} options={schedules} onChange={(schedule) => void saveAgentSettings({ schedule })} />
          </Row>
          <Row
            icon={<Bell />}
            title="Deadline reminders"
            text="When to remind you about anything marked To apply or Applying. These are also the reminders put on your Google Calendar."
            status={settings.reminderDays.length ? <Status tone="on">{settings.reminderDays.length} set</Status> : <Status tone="off">Off</Status>}
          >
            <div className="flex flex-wrap gap-2" role="group" aria-label="Remind me">
              {reminderChoices.map((c) => {
                const on = settings.reminderDays.includes(c.days);
                return (
                  <button
                    key={c.days}
                    type="button"
                    aria-pressed={on}
                    onClick={() => toggleReminder(c.days)}
                    className={`min-h-9 rounded-full border px-3.5 text-sm font-medium transition ${on ? 'border-brand bg-brand text-white' : 'border-line bg-white text-ink-2 hover:border-slate-300'}`}
                  >
                    {c.label}
                  </button>
                );
              })}
            </div>
          </Row>
        </ul>
        <div className="mt-4" aria-live="polite">
          {saved === 'offline' && <Note kind="error">Saved on this device, but the agent backend is not reachable, so it has not taken effect yet.</Note>}
          {runNote === 'ok' && <Note kind="ok">Search started. New results appear in your feed.</Note>}
          {runNote === 'offline' && <Note kind="error">The agent backend is not reachable, so the search did not start.</Note>}
        </div>
      </Card>

      <Card className="p-7">
        <h2 className="text-lg font-semibold tracking-tight">Account and data</h2>
        <ul className="mt-6 divide-y divide-line">
          <Row
            icon={<UserCircle />}
            title={auth.user ? (auth.user.displayName ?? 'Signed in') : 'No account'}
            text={email ?? 'You are looking around without an account. Nothing here is tied to you.'}
            status={!auth.user ? <Status tone="off">Guest</Status> : usesPassword && !auth.user.emailVerified ? <Status tone="warn">Email not confirmed</Status> : <Status tone="on">Signed in</Status>}
            action={
              <>
                {usesPassword && !auth.user?.emailVerified && (
                  <ActionButton onClick={() => void withNote(auth.resendVerification, `Confirmation link sent to ${email}.`)}>Resend link</ActionButton>
                )}
                {usesPassword && email && <ActionButton onClick={() => void withNote(() => auth.resetPassword(email), `Password reset link sent to ${email}.`)}>Change password</ActionButton>}
                <ActionButton onClick={() => void auth.signOut().then(() => navigate('/signin'))}>
                  <span className="flex items-center gap-2">
                    {auth.user ? <SignOut className="size-4" aria-hidden="true" /> : <SignIn className="size-4" aria-hidden="true" />}
                    {auth.user ? 'Sign out' : 'Sign in'}
                  </span>
                </ActionButton>
              </>
            }
          />
          <Row
            icon={<DownloadSimple />}
            title="Download my data"
            text="A file with your profile, what you saved and dismissed, your roadmap progress and these settings."
            status={null}
            action={<ActionButton onClick={exportData}>Download</ActionButton>}
          />
          <Row
            icon={<ClockCounterClockwise />}
            title="Clear my history"
            text="Forgets what you saved, opened and dismissed, so recommendations start over. Your profile stays."
            status={null}
            action={
              !confirmingClear ? (
                <ActionButton
                  onClick={() => {
                    setAccountNote(null);
                    setConfirmingClear(true);
                  }}
                >
                  Clear history
                </ActionButton>
              ) : null
            }
          >
            {confirmingClear && (
              <div className="flex flex-wrap items-center gap-3">
                <p className="text-sm font-semibold text-ink">Clear everything you saved, opened and dismissed?</p>
                <ActionButton
                  onClick={() => {
                    dispatch({ type: 'resetHistory' });
                    setAccountNote({ kind: 'ok', text: 'History cleared.' });
                    setConfirmingClear(false);
                  }}
                >
                  Clear
                </ActionButton>
                <ActionButton onClick={() => setConfirmingClear(false)}>Keep</ActionButton>
              </div>
            )}
          </Row>
          {auth.user && (
            <Row
              icon={<Trash />}
              title="Delete my account"
              text="Removes your account and everything the agents hold about you. This cannot be undone."
              status={null}
              action={!confirming ? <ActionButton onClick={() => setConfirming(true)}>Delete account</ActionButton> : null}
            >
              {confirming && (
                <div className="flex flex-wrap items-end gap-3">
                  <div>
                    <label htmlFor="confirm-delete" className="block text-sm font-semibold text-ink">
                      Type DELETE to confirm
                    </label>
                    <input
                      id="confirm-delete"
                      value={confirmText}
                      onChange={(e) => setConfirmText(e.target.value)}
                      autoComplete="off"
                      className="mt-1.5 block h-10 w-44 rounded-xl border border-slate-300 bg-white px-3 text-[15px] outline-none focus:border-brand focus:ring-3 focus:ring-brand/15"
                    />
                  </div>
                  <button
                    type="button"
                    disabled={confirmText !== 'DELETE' || deleting}
                    onClick={() => void deleteAccount()}
                    className="h-10 rounded-xl bg-red-600 px-4 text-sm font-semibold text-white transition hover:bg-red-700 disabled:opacity-50"
                  >
                    {deleting ? 'Deleting…' : 'Delete forever'}
                  </button>
                  <ActionButton
                    onClick={() => {
                      setConfirming(false);
                      setConfirmText('');
                    }}
                  >
                    Cancel
                  </ActionButton>
                </div>
              )}
            </Row>
          )}
        </ul>
        <div className="mt-4" aria-live="polite">
          {accountNote && <Note kind={accountNote.kind}>{accountNote.text}</Note>}
        </div>
      </Card>
    </>
  );
}
