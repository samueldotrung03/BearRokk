import { useEffect } from 'react';
import { Navigate, Route, Routes, useLocation } from 'react-router';
import { useAuth } from './auth/AuthProvider.tsx';
import { isOnboarded } from './auth/onboarding.ts';
import { Assistant } from './components/Assistant.tsx';
import { DeadlineNotifier } from './components/DeadlineNotifier.tsx';
import { MenuBarBridge } from './components/MenuBarBridge.tsx';
import { Dock } from './components/Dock.tsx';
import { Spotlight } from './components/Spotlight.tsx';
import './styles/assistant.css';
import './styles/spotlight.css';
import { Agents } from './pages/Agents.tsx';
import { Applications } from './pages/Applications.tsx';
import { ApplicationPortal } from './pages/ApplicationPortal.tsx';
import { ApplicationView } from './pages/ApplicationView.tsx';
import { Calendar } from './pages/Calendar.tsx';
import { Discover } from './pages/Discover.tsx';
import { Feed } from './pages/Feed.tsx';
import { ForgotPassword } from './pages/ForgotPassword.tsx';
import { Profile } from './pages/Profile.tsx';
import { Roadmap } from './pages/Roadmap.tsx';
import { RoadmapList } from './pages/RoadmapList.tsx';
import { Saved } from './pages/Saved.tsx';
import { Search } from './pages/Search.tsx';
import { Settings } from './pages/Settings.tsx';
import { SignIn } from './pages/SignIn.tsx';
import { SignUp } from './pages/SignUp.tsx';
import { Today } from './pages/Today.tsx';

/** Pages for getting into an account. They have no sidebar and need no sign-in. */
const accountPages = ['/signin', '/signup', '/forgot-password'];

export function App() {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);

  const { status, user } = useAuth();
  const onAccountPage = accountPages.includes(pathname);
  // Firebase takes a moment to restore a saved sign-in; show nothing rather than flash the wrong page.
  if (status === 'loading') return <div className="window-drag" aria-hidden="true" />;
  // The app is for signed-in students, or a guest who chose to look around on sample data.
  if (status === 'signedOut' && !onAccountPage) return <Navigate to="/signin" replace />;
  // A new account fills in "about you" once before reaching the feed.
  if (status === 'signedIn' && user && !isOnboarded(user.uid) && pathname !== '/signup') return <Navigate to="/signup" replace />;

  return (
    <>
      <div className="window-drag" aria-hidden="true" />
      {!onAccountPage && <Dock />}
      <Routes>
        <Route path="/" element={<Feed />} />
        <Route path="/today" element={<Today />} />
        <Route path="/roadmap" element={<Roadmap />} />
        <Route path="/roadmap/list" element={<RoadmapList />} />
        <Route path="/discover" element={<Discover />} />
        <Route path="/applications" element={<Applications />} />
        <Route path="/applications/:id" element={<ApplicationPortal />} />
        <Route path="/applications/:id/view" element={<ApplicationView />} />
        <Route path="/calendar" element={<Calendar />} />
        <Route path="/saved" element={<Saved />} />
        <Route path="/agents" element={<Agents />} />
        <Route path="/search" element={<Search />} />
        <Route path="/profile" element={<Profile />} />
        <Route path="/settings" element={<Settings />} />
        <Route path="/signin" element={<SignIn />} />
        <Route path="/signup" element={<SignUp />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      {!onAccountPage && <Assistant />}
      {!onAccountPage && <DeadlineNotifier />}
      {!onAccountPage && <MenuBarBridge />}
      {!onAccountPage && <Spotlight />}
    </>
  );
}
