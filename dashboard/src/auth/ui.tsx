// The shared look of the sign-in, create-account and forgot-password pages: the sky panel on the
// left, a white card on the right, and the same fields, messages and buttons in each.
import '../pages/signin.css';
import { ArrowRight, Eye, EyeSlash, Lock } from '@phosphor-icons/react';
import { useState, type ComponentProps, type ReactNode } from 'react';
import { BrandMark } from '../components/Brand.tsx';

const preview = ['Internships, events and clubs that fit you', 'Deadlines before they pass', 'A roadmap to your goal'];

/** The left panel is the same on every account page; only the card on the right changes. */
export function AuthShell({ below, children }: { /** Shown under the card. */ below?: ReactNode; children: ReactNode }) {
  return (
    <div className="signin-page grid min-h-dvh bg-canvas lg:grid-cols-2">
      <section className="sky signin-hero flex flex-col px-6 pt-6 pb-20 text-white sm:px-10 sm:pt-8 lg:p-12">
        <div className="flex items-center gap-2.5">
          <BrandMark />
          <span className="text-[19px] font-bold tracking-tight">BearRok</span>
        </div>

        <div className="signin-hero-text mt-10 max-w-xl sm:mt-14 lg:mt-[14vh]">
          <h1 className="font-display text-[44px] leading-[1.04] sm:text-6xl xl:text-7xl">
            Find your people. Find your <em>next thing.</em>
          </h1>
          <p className="mt-4 max-w-md text-[17px] leading-relaxed font-medium text-white/95">
            Your agents keep looking while you are in class. Sign in to see what they found.
          </p>
        </div>

        <div className="glass relative mt-auto hidden w-full max-w-xs rounded-2xl p-5 text-ink lg:block">
          <div className="relative">
            <p className="text-sm font-semibold">What your agents bring you</p>
            <ul className="mt-3 space-y-2 text-[15px] font-medium">
              {preview.map((line) => (
                <li key={line} className="flex items-center gap-2.5">
                  <span className="size-1 rounded-full bg-ink/50" aria-hidden="true" />
                  {line}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      <main className="relative -mt-12 flex flex-col items-center justify-center px-4 pb-20 sm:px-8 lg:mt-0 lg:py-12">
        {/* The link under the card hangs below it without taking space, so the card sits in the same place on every page. */}
        <div className="relative w-full max-w-[420px] shrink-0">
          {/* Below lg the card grows with its content and the page scrolls; from lg it has a fixed height and scrolls inside.
              overflow-clip keeps the rounded corners below lg without making the card a scroll container. */}
          <div className="signin-card flex min-h-[min(640px,calc(100dvh-7rem))] flex-col overflow-clip rounded-3xl border border-white bg-white shadow-lift lg:h-[min(720px,calc(100dvh-4rem))] lg:overflow-hidden">
            <div className="signin-scroll flex-1 p-6 sm:p-8 lg:min-h-0 lg:overflow-y-auto">{children}</div>
          </div>
          {below && <div className="absolute inset-x-0 top-full flex justify-center">{below}</div>}
        </div>
      </main>
    </div>
  );
}

export function CardTitle({ title, sub }: { title: string; sub: ReactNode }) {
  return (
    <>
      <h2 className="font-display text-4xl leading-tight text-ink">{title}</h2>
      <p className="mt-1.5 text-[15px] text-ink-2">{sub}</p>
    </>
  );
}

const inputClass = 'signin-input h-11 w-full rounded-xl border border-slate-300 bg-white text-base text-ink';

type FieldProps = Omit<ComponentProps<'input'>, 'className'> & {
  id: string;
  label: string;
  icon?: ReactNode;
  /** Shown under the field in red, and marks the field invalid. */
  error?: string | null;
  hint?: string;
};

export function TextField({ id, label, icon, error, hint, ...input }: FieldProps) {
  return (
    <div>
      <label htmlFor={id} className="block text-sm font-semibold text-ink">
        {label}
      </label>
      <div className="relative mt-1.5">
        {icon && (
          <span className="pointer-events-none absolute top-1/2 left-3.5 -translate-y-1/2 text-ink-3 [&>svg]:size-[18px]" aria-hidden="true">
            {icon}
          </span>
        )}
        <input
          id={id}
          aria-invalid={error ? true : undefined}
          aria-describedby={error || hint ? `${id}-note` : undefined}
          className={`${inputClass} ${icon ? 'pl-10' : 'pl-3.5'} pr-3.5 ${error ? 'border-red-400' : ''}`}
          {...input}
        />
      </div>
      {(error || hint) && (
        <p id={`${id}-note`} className={`mt-1.5 text-[13px] ${error ? 'font-medium text-red-700' : 'text-ink-3'}`}>
          {error ?? hint}
        </p>
      )}
    </div>
  );
}

export function PasswordField({ id, label, error, hint, ...input }: Omit<FieldProps, 'icon' | 'type'>) {
  const [shown, setShown] = useState(false);
  return (
    <div>
      <label htmlFor={id} className="block text-sm font-semibold text-ink">
        {label}
      </label>
      <div className="relative mt-1.5">
        <Lock className="pointer-events-none absolute top-1/2 left-3.5 size-[18px] -translate-y-1/2 text-ink-3" aria-hidden="true" />
        <input
          id={id}
          type={shown ? 'text' : 'password'}
          aria-invalid={error ? true : undefined}
          aria-describedby={error || hint ? `${id}-note` : undefined}
          className={`${inputClass} pr-12 pl-10 ${error ? 'border-red-400' : ''}`}
          {...input}
        />
        <button
          type="button"
          onClick={() => setShown((s) => !s)}
          aria-label={shown ? 'Hide password' : 'Show password'}
          aria-pressed={shown}
          className="absolute top-0.5 right-0.5 grid size-10 place-items-center rounded-[10px] text-ink-2 transition-colors hover:text-ink"
        >
          {shown ? <EyeSlash className="size-[18px]" aria-hidden="true" /> : <Eye className="size-[18px]" aria-hidden="true" />}
        </button>
      </div>
      {(error || hint) && (
        <p id={`${id}-note`} className={`mt-1.5 text-[13px] ${error ? 'font-medium text-red-700' : 'text-ink-3'}`}>
          {error ?? hint}
        </p>
      )}
    </div>
  );
}

export function Message({ kind, children }: { kind: 'error' | 'success' | 'info'; children: ReactNode }) {
  const tone = { error: 'bg-red-50 text-red-700', success: 'bg-emerald-50 text-emerald-800', info: 'bg-brand-soft text-ink-2' }[kind];
  return <p className={`rounded-xl px-3.5 py-2.5 text-sm font-medium ${tone}`}>{children}</p>;
}

export function SubmitButton({ busy, children, arrow = true, ...button }: ComponentProps<'button'> & { busy?: boolean; arrow?: boolean }) {
  return (
    <button
      type="submit"
      disabled={busy || button.disabled}
      className="btn-primary signin-submit flex h-11 w-full items-center justify-center gap-2 text-[15px] text-white disabled:opacity-70"
      {...button}
    >
      {busy ? 'One moment…' : children}
      {!busy && arrow && <ArrowRight className="signin-arrow size-4" weight="bold" aria-hidden="true" />}
    </button>
  );
}

/** A quiet second button, for Back and Skip. */
export function QuietButton({ children, ...button }: ComponentProps<'button'>) {
  return (
    <button
      type="button"
      className="signin-provider flex h-11 w-full items-center justify-center gap-2 rounded-xl border border-line bg-white text-[15px] font-semibold text-ink disabled:opacity-60"
      {...button}
    >
      {children}
    </button>
  );
}

export const linkClass = 'signin-link inline-flex min-h-10 items-center text-sm font-semibold text-brand';
