import { ArrowLeft, Envelope, PaperPlaneTilt } from '@phosphor-icons/react';
import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { Link, useSearchParams } from 'react-router';
import { useAuth } from '../auth/AuthProvider.tsx';
import { authMessage } from '../auth/errors.ts';
import { looksLikeEmail } from '../auth/onboarding.ts';
import { AuthShell, CardTitle, linkClass, Message, QuietButton, SubmitButton, TextField } from '../auth/ui.tsx';

const RESEND_WAIT = 30;

export function ForgotPassword() {
  const auth = useAuth();
  const [params] = useSearchParams();
  const [email, setEmail] = useState(params.get('email') ?? '');
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resent, setResent] = useState(false);
  const [cooldown, setCooldown] = useState(0);

  // Count the wait before another link can be sent.
  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setTimeout(() => setCooldown((s) => s - 1), 1000);
    return () => clearTimeout(timer);
  }, [cooldown]);

  const send = async (address: string, again = false) => {
    if (!looksLikeEmail(address)) return setError('Enter the email address you signed up with.');
    setBusy(true);
    setError(null);
    try {
      await auth.resetPassword(address);
      setSentTo(address.trim());
      setResent(again);
      setCooldown(RESEND_WAIT);
    } catch (e) {
      setError(authMessage(e));
    } finally {
      setBusy(false);
    }
  };

  const onSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    void send(email);
  };

  const back = (
    <Link to="/signin" className={`${linkClass} mt-3 w-full justify-center gap-1.5`}>
      <ArrowLeft className="size-4" weight="bold" aria-hidden="true" />
      Back to sign in
    </Link>
  );

  return (
    <AuthShell>
      {sentTo ? (
        <>
          <span className="grid size-12 place-items-center rounded-2xl bg-brand-soft text-brand">
            <PaperPlaneTilt className="size-6" weight="bold" aria-hidden="true" />
          </span>
          <div className="mt-4">
            <CardTitle
              title="Check your inbox"
              sub={
                <>
                  If <strong className="font-semibold break-all text-ink">{sentTo}</strong> has a BearRok account, a link to choose a new password
                  is on its way.
                </>
              }
            />
          </div>

          <ol className="mt-5 space-y-2 text-[15px] text-ink-2">
            <li>1. Open the email from BearRok. It can take a minute, and may land in spam.</li>
            <li>2. Click the link and choose a new password.</li>
            <li>3. Come back here and sign in with it.</li>
          </ol>

          <div className="mt-5 space-y-2.5" aria-live="polite">
            {resent && cooldown > 0 && <Message kind="success">Sent again.</Message>}
            {error && <Message kind="error">{error}</Message>}
            <QuietButton disabled={busy || cooldown > 0} onClick={() => void send(sentTo, true)}>
              {cooldown > 0 ? `Send again in ${cooldown}s` : busy ? 'One moment…' : 'Send the link again'}
            </QuietButton>
          </div>

          <button
            type="button"
            onClick={() => {
              setSentTo(null);
              setError(null);
            }}
            className={`${linkClass} mt-2 w-full justify-center`}
          >
            Use a different email
          </button>
          {back}
        </>
      ) : (
        <>
          <CardTitle title="Reset your password" sub="Enter your email and we will send you a link to choose a new one." />
          <form onSubmit={onSubmit} className="mt-6 space-y-4" noValidate>
            <TextField
              id="forgot-email"
              label="Email"
              name="email"
              type="email"
              autoComplete="email"
              autoFocus
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                setError(null);
              }}
              placeholder="you@school.edu"
              icon={<Envelope />}
              error={error}
            />
            <SubmitButton busy={busy}>Send reset link</SubmitButton>
          </form>
          <p className="mt-4 text-center text-[13px] text-ink-3">Signed up with Google or X? Use that button on the sign-in page instead.</p>
          {back}
        </>
      )}
    </AuthShell>
  );
}
