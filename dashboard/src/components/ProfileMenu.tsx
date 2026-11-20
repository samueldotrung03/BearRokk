// The round button at the top right of every page. Clicking it opens a small menu with Profile
// and Settings.
import { GearSix, UserCircle } from '@phosphor-icons/react';
import { useEffect, useId, useRef, useState } from 'react';
import { Link, useLocation } from 'react-router';
import { useAuth } from '../auth/AuthProvider.tsx';
import { useStore } from '../state/StoreProvider.tsx';

const items = [
  { to: '/profile', label: 'Profile', icon: UserCircle },
  { to: '/settings', label: 'Settings', icon: GearSix },
];

export function ProfileMenu() {
  const { state } = useStore();
  const auth = useAuth();
  const { pathname } = useLocation();
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const menuId = useId();

  // Close on a click elsewhere, on Escape, and when the page changes.
  useEffect(() => {
    if (!open) return;
    const onPointer = (event: PointerEvent) => {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      setOpen(false);
      root.current?.querySelector('button')?.focus();
    };
    document.addEventListener('pointerdown', onPointer);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onPointer);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);
  useEffect(() => setOpen(false), [pathname]);

  // A guest has no profile of their own, so the sample person's name must not stand in for them.
  const guest = auth.status === 'guest';
  const name = guest ? 'Guest' : state.profile.fullName || state.profile.name;
  return (
    <div ref={root} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={menuId}
        aria-label="Account menu"
        className="grid size-9 place-items-center rounded-full bg-white text-sm font-semibold text-brand shadow-card transition hover:scale-105"
      >
        {guest ? 'G' : state.profile.name.charAt(0).toUpperCase() || 'B'}
      </button>
      {open && (
        <div
          id={menuId}
          role="menu"
          aria-label="Account"
          className="profile-menu absolute top-full right-0 z-50 mt-2 w-60 overflow-hidden rounded-2xl border border-line bg-white p-1.5 text-ink shadow-lift"
        >
          <div className="px-3 pt-2 pb-2.5">
            <p className="truncate text-sm font-semibold">{name}</p>
            <p className="truncate text-[13px] text-ink-3">{guest ? 'No account' : (auth.user?.email ?? state.profile.school)}</p>
          </div>
          <div className="h-px bg-line" aria-hidden="true" />
          {items.map(({ to, label, icon: Icon }) => (
            <Link
              key={to}
              to={to}
              role="menuitem"
              onClick={() => setOpen(false)}
              className={`mt-1 flex h-10 items-center gap-3 rounded-xl px-3 text-[15px] font-medium transition hover:bg-brand-soft ${pathname === to ? 'text-brand' : 'text-ink'}`}
            >
              <Icon className="size-[18px]" weight={pathname === to ? 'fill' : 'regular'} aria-hidden="true" />
              {label}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
