import { Envelope, GoogleLogo, XLogo } from '@phosphor-icons/react';
import { useEffect, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import { Link, Navigate, useNavigate } from 'react-router';
import { useAuth } from '../auth/AuthProvider.tsx';
import { isDesktop } from '../auth/desktop.ts';
import { authMessage } from '../auth/errors.ts';
import { AuthShell, CardTitle, linkClass, Message, PasswordField, SubmitButton, TextField } from '../auth/ui.tsx';

export function SignIn() {
  const navigate = useNavigate();
  const auth = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [remember, setRemember] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Which provider's sign-in is open elsewhere (a pop-up, or the system browser in the desktop app).
  const [waiting, setWaiting] = useState<'google' | 'x' | null>(null);
  const pending = useRef<AbortController | null>(null);

  // Stop waiting when the page goes away.
  useEffect(() => () => pending.current?.abort(), []);

  // In the browser, closing Google's or X's window takes Firebase several seconds to report.
  // Coming back to this page with nobody signed in means the window is gone, so reset at once.
  useEffect(() => {
    if (!waiting || isDesktop) return;
    const onFocus = () => setTimeout(() => setWaiting(null), 600);
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, [waiting]);

  // Already signed in: nothing to do here.
  if (auth.status === 'signedIn') return <Navigate to="/" replace />;

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await auth.signInWithEmail(email, password, remember);
    } catch (e) {
      setError(authMessage(e));
    } finally {
      setBusy(false);
    }
  };

  /**
   * The provider buttons are never locked while a sign-in is open elsewhere: clicking one again
   * abandons the earlier attempt and starts a fresh one.
   */
  const withProvider = async (provider: 'google' | 'x') => {
    pending.current?.abort();
    const controller = new AbortController();
    pending.current = controller;
    setWaiting(provider);
    setError(null);
    try {
      await auth.signInWithProvider(provider, remember, controller.signal);
    } catch (e) {
      // An attempt that was replaced by a newer click stays silent.
      if (pending.current === controller) setError(authMessage(e));
    } finally {
      if (pending.current === controller) {
        pending.current = null;
        setWaiting(null);
      }
    }
  };

  const asGuest = () => {
    auth.continueAsGuest();
    navigate('/');
  };

  const providerClass =
    'signin-provider flex h-11 w-full items-center justify-center gap-2.5 rounded-xl border border-line bg-white text-[15px] font-semibold text-ink disabled:opacity-60';

  return (
    <AuthShell
      below={
        <button type="button" onClick={asGuest} className="signin-link mt-5 min-h-10 text-center text-sm font-semibold text-ink-2">
          Look around without an account
        </button>
      }
    >
      <CardTitle title="Welcome back" sub="Sign in to your BearRok account." />

      <div className="mt-6 space-y-2.5">
        <button type="button" disabled={busy} onClick={() => void withProvider('google')} className={providerClass}>
          <GoogleLogo className="size-[18px]" weight="bold" aria-hidden="true" />
          Continue with Google
        </button>
        <button type="button" disabled={busy} onClick={() => void withProvider('x')} className={providerClass}>
          <XLogo className="size-[18px]" weight="bold" aria-hidden="true" />
          Continue with X
        </button>
      </div>

      {waiting && (
        <div className="mt-3" aria-live="polite">
          <Message kind="info">
            {isDesktop
              ? `Finish signing in with ${waiting === 'x' ? 'X' : 'Google'} in your browser, then come back here.`
              : `Finish signing in with ${waiting === 'x' ? 'X' : 'Google'} in the window that opened.`}{' '}
            Closed it? Click the button again.
          </Message>
        </div>
      )}

      <div className="my-5 flex items-center gap-3 text-sm text-ink-3">
        <span className="h-px flex-1 bg-line" aria-hidden="true" />
        or
        <span className="h-px flex-1 bg-line" aria-hidden="true" />
      </div>

      <form onSubmit={(e) => void onSubmit(e)} className="space-y-4">
        <TextField
          id="signin-email"
          label="Email"
          name="email"
          type="email"
          autoComplete="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@school.edu"
          icon={<Envelope />}
        />
        <PasswordField
          id="signin-password"
          label="Password"
          name="password"
          autoComplete="current-password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />

        <div className="-mt-2 flex flex-wrap items-center justify-between gap-x-4">
          <label htmlFor="signin-remember" className="flex min-h-10 items-center gap-2.5 text-sm text-ink-2">
            <input
              id="signin-remember"
              name="remember"
              type="checkbox"
              checked={remember}
              onChange={(e) => setRemember(e.target.checked)}
              className="signin-check size-4"
            />
            Keep me signed in
          </label>
          <Link to={`/forgot-password${email ? `?email=${encodeURIComponent(email)}` : ''}`} className={linkClass}>
            Forgot password?
          </Link>
        </div>

        <div aria-live="polite">{error && <Message kind="error">{error}</Message>}</div>

        <SubmitButton busy={busy}>Sign in</SubmitButton>
      </form>

      <p className="mt-3 flex flex-wrap items-center justify-center gap-x-1.5 text-sm text-ink-2">
        New to BearRok?
        <Link to="/signup" className={linkClass}>
          Create an account
        </Link>
      </p>
    </AuthShell>
  );
}
