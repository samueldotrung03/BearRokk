import { PanelLeft } from 'lucide-react';
import type { ReactNode } from 'react';
import { Link } from 'react-router';
import { useStore } from '../state/StoreProvider.tsx';
import { BrandMark } from './Brand.tsx';
import { toggleDock } from './Dock.tsx';

function Brand() {
  return (
    <Link to="/" className="flex items-center gap-2.5 text-white">
      <BrandMark light />
      <span className="text-[19px] font-bold tracking-tight">BearRok</span>
    </Link>
  );
}

/** Page frame: sky header with the title, then content that rises over it. */
export function Page({
  title,
  subtitle,
  aside,
  children,
}: {
  title: string;
  subtitle: string;
  aside?: ReactNode;
  children: ReactNode;
}) {
  const { state } = useStore();
  return (
    <div className="page-outer relative min-h-dvh pb-28 sm:pb-16">
      <div className="sky absolute inset-x-0 top-0 h-[420px]" aria-hidden="true" />
      <div className="relative mx-auto max-w-6xl px-5 sm:px-8">
        <header className="flex items-center justify-between py-5">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={toggleDock}
              className="hidden size-9 place-items-center rounded-xl bg-white/15 text-white transition hover:bg-white/25 sm:grid"
              aria-label="Pin or unpin the navigation dock"
              title="Pin the dock open, or move your pointer to the left edge"
            >
              <PanelLeft className="size-[18px]" aria-hidden="true" />
            </button>
            <Brand />
          </div>
          <div className="flex items-center gap-3">
            <span className="rounded-full bg-white/20 px-3 py-1 text-xs font-medium text-white backdrop-blur">
              Sample data
            </span>
            <Link
              to="/profile"
              className="grid size-9 place-items-center rounded-full bg-white text-sm font-semibold text-brand shadow-card"
              aria-label="Your profile"
            >
              {state.profile.name.charAt(0)}
            </Link>
          </div>
        </header>

        <div className="flex flex-col gap-5 pt-8 pb-9 md:flex-row md:items-end md:justify-between">
          <div className="max-w-2xl text-white">
            <h1 className="font-display text-5xl leading-[1.05] font-medium tracking-[-0.01em] sm:text-6xl">{title}</h1>
            <p className="mt-3 text-[17px] leading-relaxed font-medium text-white/90">{subtitle}</p>
          </div>
          {aside}
        </div>

        <main>{children}</main>
      </div>
    </div>
  );
}

export function Card({ className = '', children }: { className?: string; children: ReactNode }) {
  return <div className={`rounded-3xl border border-white bg-white/90 shadow-card backdrop-blur ${className}`}>{children}</div>;
}

export function StatusPill({ children }: { children: ReactNode }) {
  return (
    <div className="flex w-fit items-center gap-2.5 rounded-full bg-white/85 px-4 py-2 text-sm font-medium text-ink shadow-card backdrop-blur">
      <span className="live-dot size-2 rounded-full bg-[#34c759]" aria-hidden="true" />
      {children}
    </div>
  );
}
