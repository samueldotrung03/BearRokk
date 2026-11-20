import { ArrowSquareOut, CalendarBlank, CursorClick, GoogleLogo, HardDrives, Lightning, Monitor, Table } from '@phosphor-icons/react';
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { ActionButton, Note, Row, Status, Switch } from '../components/settingsParts.tsx';
import { MoreSettings } from './SettingsMore.tsx';
import { useAuth } from '../auth/AuthProvider.tsx';
import { isDesktop } from '../auth/desktop.ts';
import { authMessage } from '../auth/errors.ts';
import { API_URL } from '../auth/firebase.ts';
import type { GoogleService } from '../auth/google.ts';
import { ThemePicker } from '../components/ThemePicker.tsx';
import { NotifySettings } from '../components/NotifySettings.tsx';
import { ShortcutSettings } from '../components/ShortcutSettings.tsx';
import { Card, Page } from '../components/Page.tsx';
import { desktopBridge, loadAllowed, saveAllowed, type GrokConnection, type PermissionKind, type PermissionState } from '../lib/desktopBridge.ts';

interface GrokInfo {
  connected: boolean;
  mode: 'api' | 'cli' | 'simulated';
  detail: string;
}

const googleRows: { service: GoogleService; title: string; icon: ReactNode; text: string }[] = [
  { service: 'account', title: 'Google', icon: <GoogleLogo weight="bold" />, text: 'Lets BearRok use your Google account for the connections below.' },
  { service: 'calendar', title: 'Google Calendar', icon: <CalendarBlank />, text: 'Puts application deadlines on your calendar with reminders a week before, two days before and on the day.' },
  { service: 'sheets', title: 'Google Sheets', icon: <Table />, text: 'Writes your application tracker to a spreadsheet in your Drive: status, deadline, materials and prompts.' },
];

const permissionRows: { kind: PermissionKind; title: string; icon: ReactNode; text: string; pane: string }[] = [
  { kind: 'screen', title: 'Screen recording', icon: <Monitor />, text: 'Lets an agent see what is on your screen, for example an application form you have open.', pane: 'Screen & System Audio Recording' },
  { kind: 'disk', title: 'Full disk access', icon: <HardDrives />, text: 'Lets an agent read files anywhere on this Mac, such as a résumé or transcript in your documents.', pane: 'Full Disk Access' },
  { kind: 'control', title: 'Control this computer', icon: <CursorClick />, text: 'Lets an agent click and type for you, for example to fill in a form you have approved.', pane: 'Accessibility' },
];

export function Settings() {
  const auth = useAuth();

  // ---- Grok ---------------------------------------------------------------
  const [grok, setGrok] = useState<GrokInfo | 'loading' | 'offline'>('loading');
  const checkGrok = useCallback(async () => {
    setGrok('loading');
    try {
      const res = await fetch(`${API_URL}/api/connections`);
      setGrok(res.ok ? ((await res.json()) as { grok: GrokInfo }).grok : 'offline');
    } catch {
      setGrok('offline');
    }
  }, []);
  useEffect(() => void checkGrok(), [checkGrok]);

  // In the desktop app the student connects their own Grok here; the app keeps the choice on this computer.
  const [connection, setConnection] = useState<GrokConnection | null>(null);
  const [grokKey, setGrokKey] = useState('');
  const [grokBusy, setGrokBusy] = useState(false);
  useEffect(() => {
    void desktopBridge?.grok?.status().then(setConnection, () => {});
  }, []);
  const changeGrok = async (act: () => Promise<GrokConnection>) => {
    setGrokBusy(true);
    try {
      const next = await act();
      setConnection(next);
      if (!next.error) setGrokKey('');
    } finally {
      setGrokBusy(false);
      await checkGrok();
    }
  };
  const ownGrok = connection?.managed ? connection : null;

  // ---- Google -------------------------------------------------------------
  const [pending, setPending] = useState<GoogleService | null>(null);
  const [googleError, setGoogleError] = useState<{ service: GoogleService; text: string } | null>(null);
  const attempt = useRef<AbortController | null>(null);
  useEffect(() => () => attempt.current?.abort(), []);

  const signedInWithGoogle = auth.user?.providerData.some((p) => p.providerId === 'google.com') ?? false;
  const connected = (service: GoogleService) => (service === 'account' ? signedInWithGoogle || Object.values(auth.google).some(Boolean) : Boolean(auth.google[service]));

  // Like sign-in, the button is never locked: clicking again starts over.
  const connect = async (service: GoogleService) => {
    attempt.current?.abort();
    const controller = new AbortController();
    attempt.current = controller;
    setPending(service);
    setGoogleError(null);
    try {
      await auth.connectGoogle(service, controller.signal);
    } catch (e) {
      const text = authMessage(e);
      if (attempt.current === controller && text) setGoogleError({ service, text: text === 'Sign-in did not work. Try again.' ? 'Google did not connect. Try again.' : text });
    } finally {
      if (attempt.current === controller) {
        attempt.current = null;
        setPending(null);
      }
    }
  };

  const [exporting, setExporting] = useState(false);
  const [sheet, setSheet] = useState<{ url: string } | { error: string } | null>(null);
  const exportSheet = async () => {
    setExporting(true);
    setSheet(null);
    try {
      const token = await auth.getToken();
      const res = await fetch(`${API_URL}/api/students/${token ? 'me' : 'demo'}/applications/export`, {
        method: 'POST',
        headers: { 'x-google-access-token': auth.google.sheets ?? '', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      });
      const body = (await res.json()) as { url?: string; error?: string };
      setSheet(res.ok && body.url ? { url: body.url } : { error: 'The spreadsheet could not be created. Connect Google Sheets again and retry.' });
    } catch {
      setSheet({ error: 'The agent backend is not reachable right now.' });
    } finally {
      setExporting(false);
    }
  };

  // ---- Desktop permissions -----------------------------------------------
  const onMac = desktopBridge?.platform === 'darwin';
  const [granted, setGranted] = useState<Record<PermissionKind, PermissionState> | null>(null);
  const [allowed, setAllowed] = useState(loadAllowed);
  const refresh = useCallback(() => {
    if (onMac) void desktopBridge!.permissions().then(setGranted);
  }, [onMac]);
  // macOS is changed in System Settings, so look again whenever the student comes back.
  useEffect(() => {
    refresh();
    window.addEventListener('focus', refresh);
    return () => window.removeEventListener('focus', refresh);
  }, [refresh]);

  const allow = (kind: PermissionKind, next: boolean) => {
    const updated = { ...allowed, [kind]: next };
    setAllowed(updated);
    saveAllowed(updated);
    // Turning it on is not enough on its own: macOS has to grant it too.
    if (next && onMac && granted?.[kind] !== 'granted') void desktopBridge!.openPermission(kind);
  };

  return (
    <Page title="Settings" subtitle="What BearRok is connected to, and what its agents are allowed to do on this computer.">
      <div className="grid gap-6">
        <Card className="p-7">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h2 className="text-lg font-semibold tracking-tight">Appearance</h2>
              <p className="mt-1 text-sm text-ink-2">Light, dark, or the same as your computer. Kept on this device.</p>
            </div>
            <ThemePicker />
          </div>
        </Card>

        <Card className="p-7">
          <h2 className="text-lg font-semibold tracking-tight">Connections</h2>
          <p className="mt-1 text-sm text-ink-2">Services your agents use. You can disconnect any of them at any time.</p>
          <ul className="mt-6 divide-y divide-line">
            <Row
              icon={<Lightning weight="fill" />}
              title="Grok"
              text="The model behind every agent: the master, the search managers, the worker fleet and the validators."
              status={
                grok === 'loading' ? (
                  <Status tone="wait">Checking</Status>
                ) : grok === 'offline' ? (
                  <Status tone="warn">Backend not reachable</Status>
                ) : grok.connected ? (
                  <Status tone="on">Connected</Status>
                ) : (
                  <Status tone="off">Not connected</Status>
                )
              }
              action={
                <ActionButton
                  onClick={() => {
                    void desktopBridge?.grok?.status().then(setConnection, () => {});
                    void checkGrok();
                  }}
                >
                  Check again
                </ActionButton>
              }
            >
              {grok !== 'loading' && grok !== 'offline' && <p className="text-sm text-ink-2">{grok.detail}</p>}
              {grok === 'offline' && <p className="text-sm text-ink-2">Start the agent backend, then check again.</p>}
              {ownGrok && (
                <div className="mt-3 space-y-3">
                  {ownGrok.mode ? (
                    <div className="flex flex-wrap items-center gap-3">
                      <p className="text-sm text-ink-2">
                        {ownGrok.mode === 'cli'
                          ? 'Using the Grok app on this computer, on your Grok subscription.'
                          : 'Using your xAI API key. It is stored encrypted on this computer and nowhere else.'}
                      </p>
                      <ActionButton disabled={grokBusy} onClick={() => void changeGrok(() => desktopBridge!.grok!.disconnect())}>
                        Disconnect
                      </ActionButton>
                    </div>
                  ) : (
                    <>
                      <p className="text-sm text-ink-2">Connect your own Grok. Until you do, the agents are simulated and nothing they show is real.</p>
                      <div className="flex flex-wrap items-center gap-3">
                        <ActionButton primary disabled={grokBusy || !ownGrok.cliFound} onClick={() => void changeGrok(() => desktopBridge!.grok!.connect({ mode: 'cli' }))}>
                          Use my Grok subscription
                        </ActionButton>
                        <p className="min-w-0 flex-1 text-sm text-ink-3">
                          {ownGrok.cliFound
                            ? 'The Grok app for the command line was found on this computer.'
                            : 'Needs the Grok app for the command line: install it, sign in with your Grok subscription, then press Check again.'}
                        </p>
                      </div>
                      {ownGrok.canStoreKey && (
                        <form
                          className="flex flex-wrap items-center gap-3"
                          onSubmit={(event) => {
                            event.preventDefault();
                            void changeGrok(() => desktopBridge!.grok!.connect({ mode: 'api', key: grokKey }));
                          }}
                        >
                          <input
                            type="password"
                            value={grokKey}
                            onChange={(event) => setGrokKey(event.target.value)}
                            placeholder="Or paste an xAI API key"
                            aria-label="xAI API key"
                            autoComplete="off"
                            className="h-10 min-w-0 flex-1 rounded-xl border border-slate-300 bg-white px-3 text-[15px] outline-none focus:border-brand focus:ring-3 focus:ring-brand/15"
                          />
                          <ActionButton type="submit" disabled={grokBusy || grokKey.trim().length < 20}>
                            Connect
                          </ActionButton>
                        </form>
                      )}
                    </>
                  )}
                  {ownGrok.error && <p className="text-sm text-amber-800">{ownGrok.error}</p>}
                </div>
              )}
              {!ownGrok && grok !== 'loading' && grok !== 'offline' && !grok.connected && (
                <ol className="mt-2 list-decimal space-y-1 pl-5 text-sm text-ink-2">
                  <li>Install the Grok app for the command line and sign in to it with your Grok subscription.</li>
                  <li>
                    Set <code className="rounded bg-slate-100 px-1 py-0.5 text-[13px]">GROK_TRANSPORT=cli</code> in the backend settings, or add an xAI API key there.
                  </li>
                  <li>Restart the backend and check again.</li>
                </ol>
              )}
            </Row>

            {googleRows.map(({ service, title, icon, text }) => {
              const on = connected(service);
              const viaSignIn = service === 'account' && signedInWithGoogle;
              return (
                <Row
                  key={service}
                  icon={icon}
                  title={title}
                  text={text}
                  status={
                    pending === service ? <Status tone="wait">Waiting for Google</Status> : on ? <Status tone="on">{viaSignIn ? 'Signed in with Google' : 'Connected'}</Status> : <Status tone="off">Not connected</Status>
                  }
                  action={
                    <>
                      {service === 'sheets' && on && (
                        <ActionButton primary disabled={exporting} onClick={() => void exportSheet()}>
                          {exporting ? 'Creating…' : 'Export applications'}
                        </ActionButton>
                      )}
                      {on && !viaSignIn ? (
                        <ActionButton onClick={() => auth.disconnectGoogle(service)}>Disconnect</ActionButton>
                      ) : !on ? (
                        <ActionButton primary onClick={() => void connect(service)}>
                          Connect
                        </ActionButton>
                      ) : null}
                    </>
                  }
                >
                  <div className="space-y-2" aria-live="polite">
                    {pending === service && (
                      <p className="text-sm text-ink-2">
                        {isDesktop ? 'Finish in your browser, then come back here.' : 'Finish in the Google window that opened.'} Closed it? Click Connect again.
                      </p>
                    )}
                    {googleError?.service === service && <Note kind="error">{googleError.text}</Note>}
                    {on && service !== 'account' && pending !== service && <p className="text-[13px] text-ink-3">Connected until you close the app. Google asks again after that.</p>}
                    {service === 'sheets' && sheet && 'url' in sheet && (
                      <Note kind="ok">
                        Spreadsheet created.{' '}
                        <a href={sheet.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 underline">
                          Open it <ArrowSquareOut className="size-3.5" aria-hidden="true" />
                        </a>
                      </Note>
                    )}
                    {service === 'sheets' && sheet && 'error' in sheet && <Note kind="error">{sheet.error}</Note>}
                  </div>
                </Row>
              );
            })}
          </ul>
        </Card>

        <Card className="p-7">
          <h2 className="text-lg font-semibold tracking-tight">On this computer</h2>
          <p className="mt-1 text-sm text-ink-2">
            What agents may do on your Mac. Each one needs two things: the switch here, and the matching permission in macOS System Settings, which only you can
            grant. No agent uses these yet.
          </p>
          {!onMac && (
            <p className="mt-4 rounded-xl bg-brand-soft px-3.5 py-2.5 text-sm text-ink-2">
              These work in the BearRok desktop app on a Mac. Your choices are saved here and apply once you open it.
            </p>
          )}
          <ul className="mt-6 divide-y divide-line">
            {permissionRows.map(({ kind, title, icon, text, pane }) => {
              const os = granted?.[kind];
              return (
                <Row
                  key={kind}
                  icon={icon}
                  title={title}
                  text={text}
                  status={
                    !onMac ? (
                      <Status tone="off">Desktop app only</Status>
                    ) : os === 'granted' ? (
                      allowed[kind] ? <Status tone="on">Allowed</Status> : <Status tone="off">Granted in macOS, switched off here</Status>
                    ) : allowed[kind] ? (
                      <Status tone="warn">Waiting for macOS</Status>
                    ) : (
                      <Status tone="off">Off</Status>
                    )
                  }
                  action={<Switch checked={allowed[kind]} onChange={(next) => allow(kind, next)} label={`Allow ${title.toLowerCase()}`} />}
                >
                  {onMac && os !== 'granted' && allowed[kind] && (
                    <div className="flex flex-wrap items-center gap-3">
                      <p className="min-w-0 flex-1 basis-56 text-sm text-ink-2">
                        In System Settings, open Privacy &amp; Security, then {pane}, and switch BearRok on. macOS may ask you to reopen the app.
                      </p>
                      <ActionButton onClick={() => void desktopBridge!.openPermission(kind)}>Open System Settings</ActionButton>
                    </div>
                  )}
                </Row>
              );
            })}
          </ul>
        </Card>

        <NotifySettings />
        <ShortcutSettings />
        <MoreSettings />
      </div>
    </Page>
  );
}
