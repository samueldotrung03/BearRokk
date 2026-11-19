import './signin.css';
import { ArrowRight, Envelope, Eye, EyeSlash, GoogleLogo, Lock, XLogo } from '@phosphor-icons/react';
import { useState } from 'react';
import type { FormEvent } from 'react';
import { Link, useNavigate } from 'react-router';
import { BrandMark } from '../components/Brand.tsx';

const preview = ['8 opportunities waiting', '2 deadlines this week', 'Next step: learn SQL'];

const inputClass =
  'signin-input h-11 w-full rounded-xl border border-slate-300 bg-white pl-10 text-base text-ink';

export function SignIn() {
  const navigate = useNavigate();
  const [showPassword, setShowPassword] = useState(false);

  // Mock sign-in: nothing typed is read, stored or sent.
  const enter = () => navigate('/');

  const onSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    enter();
  };

  return (
    <div className="signin-page grid min-h-dvh bg-canvas lg:grid-cols-2">
      <section className="sky signin-hero flex flex-col px-6 pt-6 pb-20 text-white sm:px-10 sm:pt-8 lg:p-12">
        <div className="flex items-center gap-2.5">
          <BrandMark light />
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
            <p className="flex items-center gap-2.5 text-sm font-semibold">
              <span className="live-dot size-2 rounded-full bg-[#34c759]" aria-hidden="true" />
              Agents live
            </p>
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

      <main className="relative -mt-12 flex flex-col items-center justify-center px-4 pb-10 sm:px-8 lg:mt-0 lg:py-12">
        <div className="signin-card w-full max-w-[420px] rounded-3xl border border-white bg-white p-6 shadow-lift sm:p-8">
          <h2 className="font-display text-4xl leading-tight text-ink">Welcome back</h2>
          <p className="mt-1.5 text-[15px] text-ink-2">Sign in to your BearRok account.</p>

          <div className="mt-6 space-y-2.5">
            <button
              type="button"
              onClick={enter}
              className="signin-provider flex h-11 w-full items-center justify-center gap-2.5 rounded-xl border border-line bg-white text-[15px] font-semibold text-ink"
            >
              <GoogleLogo className="size-[18px]" weight="bold" aria-hidden="true" />
              Continue with Google
            </button>
            <button
              type="button"
              onClick={enter}
              className="signin-provider flex h-11 w-full items-center justify-center gap-2.5 rounded-xl border border-line bg-white text-[15px] font-semibold text-ink"
            >
              <XLogo className="size-[18px]" weight="bold" aria-hidden="true" />
              Continue with X
            </button>
          </div>

          <div className="my-5 flex items-center gap-3 text-sm text-ink-3">
            <span className="h-px flex-1 bg-line" aria-hidden="true" />
            or
            <span className="h-px flex-1 bg-line" aria-hidden="true" />
          </div>

          <form onSubmit={onSubmit}>
            <label htmlFor="signin-email" className="text-sm font-semibold text-ink">
              Email
            </label>
            <div className="relative mt-1.5">
              <Envelope
                className="pointer-events-none absolute top-1/2 left-3.5 size-[18px] -translate-y-1/2 text-ink-3"
                aria-hidden="true"
              />
              <input
                id="signin-email"
                name="email"
                type="email"
                autoComplete="email"
                required
                placeholder="you@school.edu"
                className={`${inputClass} pr-3.5`}
              />
            </div>

            <label htmlFor="signin-password" className="mt-4 block text-sm font-semibold text-ink">
              Password
            </label>
            <div className="relative mt-1.5">
              <Lock
                className="pointer-events-none absolute top-1/2 left-3.5 size-[18px] -translate-y-1/2 text-ink-3"
                aria-hidden="true"
              />
              <input
                id="signin-password"
                name="password"
                type={showPassword ? 'text' : 'password'}
                autoComplete="current-password"
                required
                className={`${inputClass} pr-12`}
              />
              <button
                type="button"
                onClick={() => setShowPassword((shown) => !shown)}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
                aria-pressed={showPassword}
                className="absolute top-0.5 right-0.5 grid size-10 place-items-center rounded-[10px] text-ink-2 transition-colors hover:text-ink"
              >
                {showPassword ? (
                  <EyeSlash className="size-[18px]" aria-hidden="true" />
                ) : (
                  <Eye className="size-[18px]" aria-hidden="true" />
                )}
              </button>
            </div>

            <div className="mt-2 flex flex-wrap items-center justify-between gap-x-4">
              <label htmlFor="signin-remember" className="flex min-h-10 items-center gap-2.5 text-sm text-ink-2">
                <input id="signin-remember" name="remember" type="checkbox" className="signin-check size-4" />
                Keep me signed in
              </label>
              <Link to="/" className="signin-link flex min-h-10 items-center text-sm font-semibold text-brand">
                Forgot password?
              </Link>
            </div>

            <button
              type="submit"
              className="btn-primary signin-submit mt-3 flex h-11 w-full items-center justify-center gap-2 text-[15px] text-white"
            >
              Sign in
              <ArrowRight className="signin-arrow size-4" weight="bold" aria-hidden="true" />
            </button>
          </form>

          <p className="mt-3 flex flex-wrap items-center justify-center gap-x-1.5 text-sm text-ink-2">
            New to BearRok?
            <Link to="/" className="signin-link flex min-h-10 items-center font-semibold text-brand">
              Create an account
            </Link>
          </p>
        </div>

        <p className="mt-5 max-w-[420px] text-center text-[13px] text-ink-2">
          Template only. Nothing you type here is sent or saved.
        </p>
      </main>
    </div>
  );
}
