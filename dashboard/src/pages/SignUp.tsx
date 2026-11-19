import { ArrowLeft, Buildings, Check, Envelope, GraduationCap, MapPin, User } from '@phosphor-icons/react';
import { useState } from 'react';
import type { FormEvent } from 'react';
import { Link, Navigate, useNavigate } from 'react-router';
import { useAuth } from '../auth/AuthProvider.tsx';
import { authMessage } from '../auth/errors.ts';
import { looksLikeEmail, markOnboarded, passwordChecks, passwordOk } from '../auth/onboarding.ts';
import { AuthShell, CardTitle, linkClass, Message, PasswordField, QuietButton, SubmitButton, TextField } from '../auth/ui.tsx';
import { careerOptions, eventOptions, interestOptions, skillOptions } from '../data/sample.ts';
import { useStore } from '../state/StoreProvider.tsx';
import type { ClassYear } from '../types.ts';

const years: ClassYear[] = ['Freshman', 'Sophomore', 'Junior', 'Senior'];
const categories = [
  { id: 'internship', label: 'Internships' },
  { id: 'event', label: 'Events and networking' },
  { id: 'club', label: 'Clubs and communities' },
  { id: 'program', label: 'Research, scholarships, hackathons' },
];
const stepNames = ['Account', 'About you', 'Interests', 'Goals'];

function Steps({ current }: { current: number }) {
  return (
    <ol className="sticky -top-6 z-10 -mx-6 -mt-6 mb-2 flex items-center gap-1.5 bg-white px-6 pt-6 pb-4 sm:-top-8 sm:-mx-8 sm:-mt-8 sm:px-8 sm:pt-8" aria-label={`Step ${current + 1} of ${stepNames.length}: ${stepNames[current]}`}>
      {stepNames.map((name, i) => {
        const done = i < current;
        const active = i === current;
        return (
          <li key={name} className={`flex items-center gap-1.5 ${i < stepNames.length - 1 ? 'flex-1' : ''}`} aria-current={active ? 'step' : undefined}>
            <span
              className={`grid size-6 shrink-0 place-items-center rounded-full text-xs font-bold ${
                done ? 'bg-brand text-white' : active ? 'bg-ink text-white' : 'bg-slate-100 text-ink-3'
              }`}
            >
              {done ? <Check className="size-3.5" weight="bold" aria-hidden="true" /> : i + 1}
            </span>
            {/* Only the current step is named, so four steps fit on a phone. */}
            {active ? <span className="text-[13px] font-semibold whitespace-nowrap text-ink">{name}</span> : <span className="sr-only">{name}</span>}
            {i < stepNames.length - 1 && <span className={`h-px min-w-3 flex-1 ${done ? 'bg-brand' : 'bg-line'}`} aria-hidden="true" />}
          </li>
        );
      })}
    </ol>
  );
}

function Chips({ legend, hint, options, selected, onToggle }: { legend: string; hint?: string; options: string[]; selected: string[]; onToggle: (v: string) => void }) {
  return (
    <fieldset>
      <legend className="text-sm font-semibold text-ink">{legend}</legend>
      {hint && <p className="mt-0.5 text-[13px] text-ink-3">{hint}</p>}
      <div className="mt-2.5 flex flex-wrap gap-2">
        {options.map((option) => {
          const on = selected.includes(option);
          return (
            <button
              key={option}
              type="button"
              aria-pressed={on}
              onClick={() => onToggle(option)}
              className={`min-h-9 rounded-full border px-3.5 text-sm font-medium transition ${
                on ? 'border-brand bg-brand text-white' : 'border-line bg-white text-ink-2 hover:border-slate-300'
              }`}
            >
              {option}
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}

const toggle = (list: string[], value: string) => (list.includes(value) ? list.filter((v) => v !== value) : [...list, value]);

/** "Maya Tran" -> ["Maya", "Tran"]; everything after the first word is the last name. */
function splitName(full: string | null | undefined): [string, string] {
  const parts = (full ?? '').trim().split(/\s+/).filter(Boolean);
  return [parts[0] ?? '', parts.slice(1).join(' ')];
}

function BackButton({ onClick, disabled }: { onClick: () => void; disabled?: boolean }) {
  return (
    <QuietButton onClick={onClick} disabled={disabled}>
      <ArrowLeft className="size-4" weight="bold" aria-hidden="true" />
      Back
    </QuietButton>
  );
}

export function SignUp() {
  const auth = useAuth();
  const navigate = useNavigate();
  const { dispatch } = useStore();

  // Someone who signed in with Google or X has an account already and starts at "About you".
  const [cameSignedIn] = useState(auth.status === 'signedIn');
  const [step, setStep] = useState(cameSignedIn ? 1 : 0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [touched, setTouched] = useState<Record<number, boolean>>({});

  const [knownFirst, knownLast] = splitName(auth.user?.displayName);
  const [firstName, setFirstName] = useState(knownFirst);
  const [lastName, setLastName] = useState(knownLast);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');

  const [school, setSchool] = useState('');
  const [major, setMajor] = useState('');
  const [year, setYear] = useState<ClassYear>('Freshman');
  const [location, setLocation] = useState('');

  const [interests, setInterests] = useState<string[]>([]);
  const [skills, setSkills] = useState<string[]>([]);
  const [careers, setCareers] = useState<string[]>([]);
  const [events, setEvents] = useState<string[]>([]);
  const [wanted, setWanted] = useState<string[]>(categories.map((c) => c.id));

  if (auth.status === 'loading') return null;
  // The later steps need an account.
  if (step > 0 && auth.status !== 'signedIn') return <Navigate to="/signup" replace />;

  const checks = passwordChecks(password);
  const nameErrors = {
    firstName: firstName.trim() ? null : 'Enter your first name.',
    lastName: lastName.trim() ? null : 'Enter your last name.',
  };
  const accountErrors = {
    ...nameErrors,
    email: looksLikeEmail(email) ? null : 'Enter a valid email address.',
    password: passwordOk(password) ? null : 'Choose a stronger password.',
    confirm: confirm === password ? null : 'The two passwords do not match.',
  };
  const fullName = `${firstName.trim()} ${lastName.trim()}`.trim();
  const touch = (n: number) => setTouched((t) => ({ ...t, [n]: true }));

  const createAccount = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    touch(0);
    setError(null);
    if (Object.values(accountErrors).some(Boolean)) return;
    setBusy(true);
    try {
      await auth.createAccount(fullName, email, password);
      setStep(1);
    } catch (e) {
      setError(authMessage(e));
    } finally {
      setBusy(false);
    }
  };

  const aboutYou = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    touch(1);
    if (Object.values(nameErrors).some(Boolean)) return;
    setStep(2);
  };

  /** Save the profile and enter the app. */
  const finish = async () => {
    setBusy(true);
    const profile = {
      name: firstName.trim(),
      fullName,
      ...(school.trim() ? { school: school.trim() } : {}),
      ...(major.trim() ? { major: major.trim() } : {}),
      ...(location.trim() ? { location: location.trim() } : {}),
      year,
      interests,
      skills,
      careerInterests: careers,
      eventTypes: events,
      about: careers.length && !careers.includes('Not sure yet') ? `Exploring ${careers.join(', ').toLowerCase()}.` : '',
    };
    dispatch({ type: 'setProfile', profile });
    await auth.setDisplayName(fullName).catch(() => {});
    // Asking for kinds of event means events are wanted, whatever was picked below.
    const kinds = events.length && !wanted.includes('event') ? [...wanted, 'event'] : wanted;
    // The agents start from this. If the backend is not running, the profile stays saved in the app.
    await auth.saveProfile({ ...profile, categories: kinds.length ? kinds : categories.map((c) => c.id) });
    if (auth.user) markOnboarded(auth.user.uid);
    setBusy(false);
    navigate('/', { replace: true });
  };

  const nameFields = (stepNumber: number) => (
    <div className="grid grid-cols-2 gap-3">
      <TextField
        id="signup-first"
        label="First name"
        name="given-name"
        autoComplete="given-name"
        value={firstName}
        onChange={(e) => setFirstName(e.target.value)}
        placeholder="Maya"
        icon={<User />}
        error={touched[stepNumber] ? nameErrors.firstName : null}
      />
      <TextField
        id="signup-last"
        label="Last name"
        name="family-name"
        autoComplete="family-name"
        value={lastName}
        onChange={(e) => setLastName(e.target.value)}
        placeholder="Tran"
        error={touched[stepNumber] ? nameErrors.lastName : null}
      />
    </div>
  );

  return (
    <AuthShell>
      <Steps current={step} />

      {step === 0 && (
        <>
          <CardTitle title="Create your account" sub="It takes about a minute." />
          <form onSubmit={(e) => void createAccount(e)} className="mt-6 space-y-4" noValidate>
            {nameFields(0)}
            <TextField id="signup-email" label="Email" name="email" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@school.edu" icon={<Envelope />} error={touched[0] ? accountErrors.email : null} />
            <div>
              <PasswordField id="signup-password" label="Password" name="new-password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} error={touched[0] ? accountErrors.password : null} />
              <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[13px]" aria-label="Password requirements">
                {checks.map((c) => (
                  <li key={c.label} className={`flex items-center gap-1.5 ${c.ok ? 'font-medium text-emerald-700' : 'text-ink-3'}`}>
                    <span className={`grid size-3.5 place-items-center rounded-full ${c.ok ? 'bg-emerald-600 text-white' : 'border border-slate-300'}`} aria-hidden="true">
                      {c.ok && <Check className="size-2.5" weight="bold" />}
                    </span>
                    {c.label}
                    <span className="sr-only">{c.ok ? ', met' : ', not met yet'}</span>
                  </li>
                ))}
              </ul>
            </div>
            <PasswordField id="signup-confirm" label="Confirm password" name="confirm-password" autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} error={touched[0] || confirm ? accountErrors.confirm : null} />

            <div aria-live="polite">{error && <Message kind="error">{error}</Message>}</div>
            <SubmitButton busy={busy}>Create account</SubmitButton>
          </form>
          <p className="mt-3 flex flex-wrap items-center justify-center gap-x-1.5 text-sm text-ink-2">
            Already have an account?
            <Link to="/signin" className={linkClass}>
              Sign in
            </Link>
          </p>
        </>
      )}

      {step === 1 && (
        <>
          <CardTitle
            title={cameSignedIn ? 'Set up your profile' : 'About you'}
            sub={cameSignedIn ? 'A few details so your agents know who they are working for.' : 'This tells your agents which opportunities you are eligible for.'}
          />
          {!cameSignedIn && auth.user?.email && !auth.user.emailVerified && (
            <div className="mt-4">
              <Message kind="info">
                We sent a link to <span className="break-all">{auth.user.email}</span> to confirm it is yours. You can keep going.
              </Message>
            </div>
          )}
          <form onSubmit={aboutYou} className="mt-5 space-y-4" noValidate>
            {/* An account from Google or X arrives with a name to check; an email account gave one in step 1. */}
            {cameSignedIn && nameFields(1)}
            <TextField id="signup-school" label="School" name="organization" autoComplete="organization" value={school} onChange={(e) => setSchool(e.target.value)} placeholder="UC Berkeley" icon={<Buildings />} />
            <TextField id="signup-major" label="Major or field of study" name="major" value={major} onChange={(e) => setMajor(e.target.value)} placeholder="Computer Science" icon={<GraduationCap />} />
            <fieldset>
              <legend className="text-sm font-semibold text-ink">Class year</legend>
              <div className="mt-1.5 grid grid-cols-4 rounded-xl bg-slate-100 p-1">
                {years.map((y) => (
                  <button
                    key={y}
                    type="button"
                    aria-pressed={year === y}
                    onClick={() => setYear(y)}
                    className={`h-9 rounded-lg text-[13px] font-semibold transition ${year === y ? 'bg-white text-ink shadow-card' : 'text-ink-2'}`}
                  >
                    {y}
                  </button>
                ))}
              </div>
            </fieldset>
            <TextField id="signup-location" label="Where are you based?" name="location" autoComplete="address-level2" value={location} onChange={(e) => setLocation(e.target.value)} placeholder="Berkeley, CA" icon={<MapPin />} hint="In-person events and clubs are searched near here." />
            <SubmitButton>Continue</SubmitButton>
          </form>
        </>
      )}

      {step === 2 && (
        <>
          <CardTitle title="What are you into?" sub="Pick as many as you like. Your feed adapts from here as you like and save things." />
          <div className="mt-5 space-y-5">
            <Chips legend="Interests" options={interestOptions} selected={interests} onToggle={(v) => setInterests((l) => toggle(l, v))} />
            <Chips legend="Skills you already have" options={skillOptions} selected={skills} onToggle={(v) => setSkills((l) => toggle(l, v))} />
          </div>
          <div className="mt-6 space-y-2.5">
            <SubmitButton type="button" onClick={() => setStep(3)}>
              Continue
            </SubmitButton>
            <BackButton onClick={() => setStep(1)} />
          </div>
        </>
      )}

      {step === 3 && (
        <>
          <CardTitle title="Where are you headed?" sub="Your agents search toward these, and your roadmap is built around them." />
          <div className="mt-5 space-y-5">
            <Chips
              legend="Careers you are considering"
              hint="Not decided is fine. Career discovery will suggest paths that fit."
              options={careerOptions}
              selected={careers}
              onToggle={(v) => setCareers((l) => toggle(l, v))}
            />
            <Chips legend="Events to look for" options={eventOptions} selected={events} onToggle={(v) => setEvents((l) => toggle(l, v))} />
            <Chips
              legend="What else should your agents find?"
              hint="Leave one out and its agents are moved to the others."
              options={categories.map((c) => c.label)}
              selected={categories.filter((c) => wanted.includes(c.id)).map((c) => c.label)}
              onToggle={(label) => setWanted((l) => toggle(l, categories.find((c) => c.label === label)!.id))}
            />
          </div>
          <div className="mt-6 space-y-2.5">
            <SubmitButton type="button" busy={busy} onClick={() => void finish()}>
              Start my agents
            </SubmitButton>
            <BackButton onClick={() => setStep(2)} disabled={busy} />
          </div>
        </>
      )}
    </AuthShell>
  );
}
