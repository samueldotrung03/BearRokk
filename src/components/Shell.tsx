import {
  Bookmark,
  Bot,
  CalendarDays,
  ClipboardList,
  Compass,
  House,
  Menu,
  Route,
  Settings,
  Sparkles,
  UserRound,
  X,
  type LucideIcon,
} from 'lucide-react';
import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router';
import { useBrowseMode, type BrowseMode } from '../state/mode.tsx';

const mainNav: { to: string; label: string; icon: LucideIcon; end?: boolean }[] = [
  { to: '/', label: 'Feed', icon: House, end: true },
  { to: '/roadmap', label: 'Roadmap', icon: Route },
  { to: '/discover', label: 'Career discovery', icon: Compass },
  { to: '/applications', label: 'Applications', icon: ClipboardList },
  { to: '/calendar', label: 'Calendar', icon: CalendarDays },
  { to: '/saved', label: 'Saved', icon: Bookmark },
  { to: '/agents', label: 'Agents', icon: Bot },
];

const bottomNav: { to: string; label: string; icon: LucideIcon }[] = [
  { to: '/settings', label: 'Settings', icon: Settings },
  { to: '/profile', label: 'Profile', icon: UserRound },
];

export function Shell({ children }: { children: ReactNode }) {
  const { mode, setMode } = useBrowseMode();
  const navigate = useNavigate();
  const location = useLocation();
  const [drawer, setDrawer] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [askOpen, setAskOpen] = useState(false);
  const profileTitle = useId();

  useEffect(() => {
    setDrawer(false);
    setProfileOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      if (document.querySelector('[data-overlay]')) return;
      if (askOpen) {
        setAskOpen(false);
        return;
      }
      if (profileOpen) {
        setProfileOpen(false);
        return;
      }
      if (drawer) setDrawer(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [askOpen, profileOpen, drawer]);

  const chooseMode = (next: BrowseMode) => {
    setMode(next);
    if (location.pathname !== '/') navigate('/');
  };

  return (
    <div className="shell sky" data-drawer={drawer ? 'open' : 'closed'}>
      {drawer && <button type="button" className="scrim" aria-label="Close navigation" onClick={() => setDrawer(false)} />}
      <aside className="sidebar" aria-label="Primary">
        <NavLink to="/" className="brand" onClick={() => chooseMode(mode)}>
          <img src="/logo.png" alt="" />
          <span>BearRok</span>
        </NavLink>
        <nav className="nav-scroll">
          {mainNav.map((item) => (
            <NavLink key={item.to} to={item.to} end={item.end} className="nav-item">
              <item.icon aria-hidden="true" />
              {item.label}
            </NavLink>
          ))}
          <div className="nav-spacer" />
          <div className="nav-divider" />
          {bottomNav.map((item) => (
            <NavLink key={item.to} to={item.to} className="nav-item">
              <item.icon aria-hidden="true" />
              {item.label}
            </NavLink>
          ))}
        </nav>
      </aside>

      <div className="main-col">
        <header className="topbar">
          <button type="button" className="icon-button nav-toggle" aria-expanded={drawer} aria-label="Open navigation" onClick={() => setDrawer(true)}>
            <Menu aria-hidden="true" />
          </button>
          <div className="topbar-center">
            <div className="view-switch" role="group" aria-label="Choose a view">
              <button type="button" aria-pressed={mode === 'foryou' && location.pathname === '/'} onClick={() => chooseMode('foryou')}>
                For you
              </button>
              <button type="button" aria-pressed={mode === 'feed' && location.pathname === '/'} onClick={() => chooseMode('feed')}>
                Feed
              </button>
            </div>
          </div>
          <div className="topbar-end">
            <div className="profile-wrap">
              <button
                type="button"
                className="profile-button"
                aria-haspopup="menu"
                aria-expanded={profileOpen}
                aria-label="Demo student profile"
                onClick={() => setProfileOpen((open) => !open)}
              >
                <UserRound aria-hidden="true" />
              </button>
              {profileOpen && (
                <div className="menu" role="menu" aria-labelledby={profileTitle}>
                  <p id={profileTitle}>
                    <strong>Demo student</strong>
                    <br />
                    <span style={{ color: 'var(--color-ink-3)', fontWeight: 500 }}>Freshman · prepared profile</span>
                  </p>
                  <NavLink to="/profile" role="menuitem" onClick={() => setProfileOpen(false)}>
                    Profile
                  </NavLink>
                  <NavLink to="/saved" role="menuitem" onClick={() => setProfileOpen(false)}>
                    Saved
                  </NavLink>
                  <NavLink to="/settings" role="menuitem" onClick={() => setProfileOpen(false)}>
                    Settings
                  </NavLink>
                </div>
              )}
            </div>
          </div>
        </header>
        <div className="content">{children}</div>
        {askOpen ? (
          <AskPanel onClose={() => setAskOpen(false)} />
        ) : (
          <button type="button" className="ask-launch" onClick={() => setAskOpen(true)}>
            <Sparkles aria-hidden="true" />
            <span>Ask BearRok</span>
          </button>
        )}
      </div>
    </div>
  );
}

function AskPanel({ onClose }: { onClose: () => void }) {
  const [note, setNote] = useState('');
  const [reply, setReply] = useState(
    'Your agents prepared examples for this request: a beginner-friendly coding club and an online hackathon next month. CodePath is first because its Spring 2027 courses are free and taught for students who are new to software.',
  );
  const titleId = useId();
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    closeRef.current?.focus();
  }, []);

  return (
    <section className="ask-panel" role="dialog" aria-modal="true" aria-labelledby={titleId}>
      <header>
        <div>
          <span className="prepared">Prepared examples</span>
          <h2 id={titleId} className="font-display">
            Ask BearRok
          </h2>
        </div>
        <button ref={closeRef} type="button" className="close-x" aria-label="Close Ask BearRok" onClick={onClose}>
          <X aria-hidden="true" />
        </button>
      </header>
      <p>“I want to join a beginner-friendly coding club and attend an online hackathon next month.”</p>
      <p>{reply}</p>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          const text = note.toLowerCase();
          if (text.includes('hackathon') || text.includes('club') || text.includes('codepath')) {
            setReply('The prepared feed already has that. Open Feed, choose Clubs, and search CodePath. Global Hack Week is the online event.');
          } else if (text.trim()) {
            setReply('This demo answers from prepared examples for the club and hackathon request. Browse Feed to compare them.');
          }
          setNote('');
        }}
      >
        <label className="sr-only" htmlFor="ask-note">
          Ask about the prepared examples
        </label>
        <textarea id="ask-note" value={note} onChange={(event) => setNote(event.target.value)} placeholder="Ask about the prepared examples" />
        <button type="submit" className="btn-primary">
          Send
        </button>
      </form>
    </section>
  );
}
